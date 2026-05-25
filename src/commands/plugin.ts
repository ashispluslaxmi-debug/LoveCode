import { Command } from 'commander';
import chalk from 'chalk';

async function cmdListPlugins() {
  const { listPlugins, formatPluginList } = await import('../plugin/registry.js');
  const plugins = listPlugins();
  console.log(formatPluginList(plugins));
}

async function cmdEnablePlugin(name: string) {
  const { enablePlugin } = await import('../plugin/registry.js');
  const ok = enablePlugin(name);
  console.log(ok ? chalk.green(`Enabled plugin: ${name}`) : chalk.red(`Plugin not found: ${name}`));
}

async function cmdDisablePlugin(name: string) {
  const { disablePlugin } = await import('../plugin/registry.js');
  const ok = disablePlugin(name);
  console.log(ok ? chalk.yellow(`Disabled plugin: ${name}`) : chalk.red(`Plugin not found: ${name}`));
}

async function cmdSearchMarketplace(query?: string) {
  const { searchMarketplace, formatMarketplace } = await import('../plugin/registry.js');
  const results = searchMarketplace(query || '');
  console.log(formatMarketplace(results));
}

export const pluginCommand = new Command('plugin')
  .alias('plugins')
  .description('Manage plugins and extensions')
  .addHelpText('after', `
  Examples:
    lovecode plugin list           List loaded plugins
    lovecode plugin enable <name>  Enable a plugin
    lovecode plugin disable <name> Disable a plugin
    lovecode plugin search <q>     Search plugin marketplace
  `);

pluginCommand
  .command('list')
  .alias('ls')
  .description('List loaded plugins')
  .action(cmdListPlugins);

pluginCommand
  .command('enable')
  .description('Enable a plugin')
  .argument('<name>', 'Plugin name')
  .action(cmdEnablePlugin);

pluginCommand
  .command('disable')
  .description('Disable a plugin')
  .argument('<name>', 'Plugin name')
  .action(cmdDisablePlugin);

pluginCommand
  .command('search')
  .description('Search plugin marketplace')
  .argument('[query]', 'Search query')
  .action(cmdSearchMarketplace);
