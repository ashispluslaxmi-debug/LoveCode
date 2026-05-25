import chalk from 'chalk';
import ora from 'ora';
import type { AIProvider, AIProviderConfig, Message } from '../ai/provider.js';
import type {
  AutonomyMode,
  PlanStep,
  StepResult,
  AgentContext,
} from './types.js';
import { getModeConfig, createContext } from './modes.js';
import { getApproval } from './approval.js';
import { getTool } from './tools.js';
import { generatePlan, renderPlan } from './plan.js';

export interface AgentOptions {
  mode: AutonomyMode;
  model: string;
  provider: AIProvider;
  providerConfig: AIProviderConfig;
  workingDir: string;
  task: string;
  onStepComplete?: (step: PlanStep, result: StepResult) => void;
  onPlanGenerated?: (plan: PlanStep[]) => void;
}

const SYSTEM_PROMPT = `You are LoveCode AI, an autonomous coding agent that runs in the terminal.

You can use tools by responding with special tags:
<tool name="tool_name">
key=value
</tool>

Available tools:
- read_file: path=<file path>
- write_file: path=<file path> content=<file content>
- edit_file: path=<file path> oldString=<text> newString=<replacement>
- create_file: path=<file path>
- delete_file: path=<file path>
- append_file: path=<file path> content=<text>
- execute_command: command=<shell command> [timeout=<ms>]
- inline_patch: path=<file> search=<text to find> replace=<replacement>
- syntax_check: path=<file path>
- refactor: edits=<JSON array of edits>
- snapshot: path=<file path> [label=<label>]
- snapshot_restore: id=<snapshot id>
- undo: [path=<file path>]

Search tools:
- grep_search: pattern=<regex> [include=<glob>]
- glob_search: pattern=<glob pattern>
- find_file: query=<name> [content=<true|false>]
- semantic_search: query=<search term>
- scan_files: [path=<dir>] [category=<source|config|doc>]
- rank_files: [task=<task description>]

File ops:
- rename_file: oldPath=<path> newPath=<path>
- duplicate_file: source=<path> dest=<path>
- file_tree: [path=<dir>]

Memory tools:
- store_preference: key=<name> value=<value>
- recall_preferences: (no args)
- repo_note: note=<text>
- recall_repo_memory: (no args)
- save_workflow: name=<name> steps=<step1,step2,...>
- list_workflows: (no args)
- vector_store: text=<content> [label=<category>]
- vector_search: query=<text> [topK=<number>]

Git tools:
- git_status: (no args)
- git_commit: message=<commit message>
- git_diff: [staged=<true|false>]
- git_branches: (no args)
- git_branch: (no args) — get current branch name
- git_create_branch: name=<branch name>
- git_switch_branch: name=<branch name>
- git_log: [count=<number>]

When you want to run a tool, include the XML tag in your response.
After getting tool results, continue the conversation to complete the task.
Always verify your changes work with syntax_check or by running tests.`;

export class AutonomousAgent {
  private options: AgentOptions;
  private messages: Message[] = [];
  private context: AgentContext;
  private plan: PlanStep[] = [];
  private results: StepResult[] = [];

  constructor(options: AgentOptions) {
    this.options = options;
    this.context = createContext(options.mode, options.workingDir);
    this.messages.push({ role: 'system', content: SYSTEM_PROMPT });
  }

  async execute(): Promise<StepResult[]> {
    const cfg = getModeConfig(this.options.mode);

    console.log(chalk.bold.cyan('\n  ╔═══════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('  ║      LoveCode AI ⚡ Autonomous Execution       ║'));
    console.log(chalk.bold.cyan('  ╚═══════════════════════════════════════════════╝'));
    console.log(cfg.color(`  ${cfg.icon} Mode: ${cfg.label}`));
    console.log(chalk.dim(`  Model: ${this.options.model}`));
    console.log(chalk.dim(`  Working Dir: ${this.context.workingDir}`));
    console.log(`\n  ${chalk.bold('Task:')} ${this.options.task}\n`);

    const planSpinner = ora('Generating execution plan...').start();
    this.plan = await generatePlan(this.options.task, (prompt) => this.generate(prompt));
    planSpinner.succeed('Plan generated');

    console.log(renderPlan(this.plan));
    this.options.onPlanGenerated?.(this.plan);

    for (const step of this.plan) {
      const stepResult = await this.executeStep(step);
      this.results.push(stepResult);
      this.options.onStepComplete?.(step, stepResult);

      if (!stepResult.success && this.context.mode === 'assist') {
        console.log(chalk.yellow('\n  Step failed. Continuing to next step.\n'));
      }
    }

    this.printSummary();
    return this.results;
  }

  private async executeStep(step: PlanStep, _attempt: number = 1): Promise<StepResult> {
    const stepLabel = `${chalk.cyan(`Step ${step.id}`)}: ${step.description}`;

    console.log(`\n  ${chalk.bold(stepLabel)}`);

    const taskPrompt = `Execute step: ${step.description}

Working directory: ${this.context.workingDir}

Use the available tools to complete this step. Show what you're doing.`;

    this.messages.push({ role: 'user', content: taskPrompt });

    let result = '';
    const maxAttempts = this.context.maxRetries + 1;

    for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
      const spinner = ora(chalk.dim(`  Attempt ${attemptNum}/${maxAttempts}...`)).start();

      try {
        result = await this.options.provider.chat(this.messages, this.options.providerConfig);
        spinner.stop();

        const toolOutputs = await this.processToolCalls(result);
        this.messages.push({ role: 'assistant', content: result });

        if (toolOutputs.length > 0) {
          for (const toolOutput of toolOutputs) {
            this.messages.push({ role: 'user', content: toolOutput });
          }
        }

        const success = this.isStepSuccessful(result, toolOutputs);
        if (success) {
          console.log(chalk.green(`  ✓ Step ${step.id} completed\n`));
          return { stepId: step.id, description: step.description, success: true, output: result };
        }

        if (attemptNum < maxAttempts) {
          console.log(chalk.yellow(`  ↻ Step ${step.id} needs refinement, retrying...\n`));
          this.messages.push({
            role: 'user',
            content: `The step "${step.description}" was not fully completed. Please try again with a different approach. Fix any errors and complete the task.`,
          });
        }
      } catch (err) {
        spinner.stop();
        const error = String(err);
        console.log(chalk.red(`  ✗ Error: ${error}\n`));

        if (attemptNum < maxAttempts) {
          this.messages.push({
            role: 'user',
            content: `An error occurred: ${error}. Please try a different approach.`,
          });
        } else {
          return {
            stepId: step.id,
            description: step.description,
            success: false,
            output: result,
            error,
          };
        }
      }
    }

    return {
      stepId: step.id,
      description: step.description,
      success: false,
      output: result,
      error: 'Max retries exceeded',
    };
  }

  private async processToolCalls(response: string): Promise<string[]> {
    const outputs: string[] = [];
    const toolRegex = /<tool\s+name="([^"]+)">\n?([\s\S]*?)<\/tool>/g;
    let match: RegExpExecArray | null;

    while ((match = toolRegex.exec(response)) !== null) {
      const toolName = match[1];
      const argsBlock = match[2].trim();

      const args: Record<string, string> = {};
      for (const line of argsBlock.split('\n')) {
        const eqIdx = line.indexOf('=');
        if (eqIdx > 0) {
          const key = line.slice(0, eqIdx).trim();
          const value = line.slice(eqIdx + 1).trim();
          args[key] = value;
        }
      }

      const description = args.command || args.path || args.pattern || toolName;
      const approval = await getApproval(
        this.options.mode,
        toolName,
        description,
        args,
      );

      if (!approval.allowed) {
        outputs.push(`Tool ${toolName} was skipped: ${approval.reason}`);
        continue;
      }

      const tool = getTool(toolName);
      if (!tool) {
        outputs.push(`Unknown tool: ${toolName}`);
        continue;
      }

      const result = await tool.execute(this.context.workingDir, args);
      const output = result.success
        ? `[${toolName}] Output:\n${result.output.slice(0, 5000)}`
        : `[${toolName}] Error: ${result.error}\n${result.output.slice(0, 2000)}`;

      outputs.push(output);
    }

    return outputs;
  }

  private isStepSuccessful(_response: string, toolOutputs: string[]): boolean {
    if (toolOutputs.length === 0) return false;
    const allSuccess = toolOutputs.every((o) => !o.includes('Error:'));
    return allSuccess;
  }

  private async generate(prompt: string): Promise<string> {
    const msgs: Message[] = [
      { role: 'system', content: 'You are a helpful programming assistant.' },
      { role: 'user', content: prompt },
    ];
    return this.options.provider.chat(msgs, this.options.providerConfig);
  }

  private printSummary(): void {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.success).length;
    const failed = total - passed;

    console.log(chalk.bold('\n  ═══════════════════════════════════════════════'));
    console.log(chalk.bold('  Execution Summary'));
    console.log(chalk.bold('  ═══════════════════════════════════════════════'));
    console.log(chalk.dim(`  Total Steps: ${total}`));
    console.log(chalk.green(`  Passed:      ${passed}`));
    if (failed > 0) {
      console.log(chalk.red(`  Failed:      ${failed}`));
    }
    console.log('');

    for (const result of this.results) {
      const icon = result.success ? chalk.green('✓') : chalk.red('✗');
      const label = result.success ? chalk.green('OK') : chalk.red('FAIL');
      console.log(`  ${icon} Step ${result.stepId}: ${result.description}`);
      console.log(`     ${chalk.dim(`[${label}]`)}`);
    }
    console.log('');
  }
}
