import chalk from 'chalk';
import type { PlanStep } from './types.js';

export function renderPlan(plan: PlanStep[]): string {
  const lines: string[] = [chalk.bold('\n  Execution Plan'), ''];

  for (const step of plan) {
    const toolTag = step.tool ? chalk.dim(` [${step.tool}]`) : '';
    lines.push(`  ${chalk.cyan(`Step ${step.id}`)} ${step.description}${toolTag}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function parsePlanFromResponse(response: string): PlanStep[] {
  const steps: PlanStep[] = [];

  const planRegex = new RegExp('(?:^|\\n)\\s*(?:\\d+)[.)\\s]+(.+?)(?=\\n\\s*(?:\\d+[.)\\s]+|$)', 'g');
  let match;

  while ((match = planRegex.exec(response)) !== null) {
    const description = match[1].trim();
    if (description.length > 0) {
      const id = steps.length + 1;
      const toolMatch = description.match(/^\[(\w+)\]\s*/);
      let cleanDesc = description;
      let tool: string | undefined;

      if (toolMatch) {
        tool = toolMatch[1];
        cleanDesc = description.slice(toolMatch[0].length);
      }

      steps.push({ id, description: cleanDesc, action: cleanDesc, tool });
    }
  }

  if (steps.length === 0) {
    const lines = response.split('\n');
    let stepCount = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\d+[.)]\s/.test(trimmed)) {
        stepCount++;
        const description = trimmed.replace(/^\d+[.)]\s*/, '');
        const toolMatch = description.match(/^\[(\w+)\]\s*/);
        const cleanDesc = toolMatch ? description.slice(toolMatch[0].length) : description;
        steps.push({
          id: stepCount,
          description: cleanDesc,
          action: cleanDesc,
          tool: toolMatch ? toolMatch[1] : undefined,
        });
      }
    }
  }

  return steps;
}

export async function generatePlan(
  task: string,
  generateFn: (prompt: string) => Promise<string>,
): Promise<PlanStep[]> {
  const planningPrompt = `You are a senior software engineer planning a development task.

Task: ${task}

Create a numbered execution plan with specific, actionable steps. Each step should be a single file operation, command, or check.

Format each step as:
1. Description of what to do

Focus on concrete actions. Include file paths when relevant. Keep steps small and focused.

Plan:`;

  const response = await generateFn(planningPrompt);
  const steps = parsePlanFromResponse(response);

  if (steps.length === 0) {
    return [
      { id: 1, description: task, action: task },
    ];
  }

  return steps;
}
