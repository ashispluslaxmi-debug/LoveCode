import { Command } from 'commander';
import chalk from 'chalk';
import { getProvider, printProviders, setDefaultModel } from '../ai/registry.js';

export const modelsCommand = new Command('models')
  .description('Manage AI models and providers')
  .addCommand(
    new Command('list')
      .alias('ls')
      .description('List all available models and providers')
      .action(() => {
        console.log(printProviders());
      }),
  )
  .addCommand(
    new Command('use')
      .description('Set the default model to use')
      .argument('<model>', 'Model name or provider name')
      .action((model: string) => {
        const result = setDefaultModel(model);
        if (result) {
          console.log(chalk.green(`\n  ✓ Default set to ${chalk.cyan(result.provider)}/${chalk.cyan(result.model)}\n`));
        }
      }),
  )
  .addCommand(
    new Command('show')
      .description('Show current model configuration')
      .argument('[provider]', 'Provider name to inspect')
      .action((provider?: string) => {
        if (provider) {
          const entry = getProvider(provider);
          if (!entry) {
            console.log(chalk.red(`\n  Unknown provider: "${provider}"\n`));
            return;
          }
          const tag = entry.local ? chalk.green(' LOCAL ') : chalk.blue(' CLOUD ');
          console.log(`\n  ${tag} ${chalk.cyan(entry.name)}`);
          console.log(chalk.dim(`  Default model: ${entry.defaultModel}`));
          console.log(chalk.dim(`  Priority: ${entry.priority}`));
          console.log(chalk.dim(`  Models:`));
          for (const m of entry.models) {
            const isDefault = m === entry.defaultModel;
            console.log(`    ${isDefault ? chalk.green('★') : ' '} ${m}${isDefault ? chalk.dim(' (default)') : ''}`);
          }
          console.log('');
        } else {
          console.log(printProviders());
        }
      }),
  )
  .addCommand(
    new Command('test')
      .description('Test a provider connection')
      .argument('[provider]', 'Provider name to test', 'ollama')
      .option('-m, --model <name>', 'Model to test with')
      .action(async (provider: string, options) => {
        const entry = getProvider(provider);
        if (!entry) {
          console.log(chalk.red(`\n  Unknown provider: "${provider}"\n`));
          return;
        }

        const model = options.model || entry.defaultModel;
        console.log(chalk.dim(`\n  Testing ${entry.name}/${model}...`));

        try {
          const config = entry.getConfig?.(model) || {
            model,
            baseUrl: undefined,
            temperature: 0.2,
            maxTokens: 4096,
          };
          const result = await entry.provider.chat(
            [{ role: 'user', content: 'Reply with exactly: OK' }],
            config,
          );
          console.log(chalk.green(`  ✓ ${entry.name}/${model} responded: ${result.slice(0, 50)}`));
        } catch (err) {
          console.log(chalk.red(`  ✗ ${entry.name}/${model} failed: ${(err as Error).message}`));
        }
        console.log('');
      }),
  );
