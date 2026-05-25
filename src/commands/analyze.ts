import { Command } from 'commander';
import chalk from 'chalk';
import { detectProject, printProjectInfo } from '../repo/detect.js';
import { analyzeDependencies, printDepGraph, findCircularDeps } from '../repo/deps.js';
import { generateSummary, printSummary } from '../repo/summary.js';
import { semanticSearch, printSemanticResults } from '../repo/search.js';
import { scanDirectory, printScanSummary } from '../fs/index.js';

export const analyzeCommand = new Command('analyze')
  .alias('a')
  .description('Analyze and understand the repository')
  .addCommand(
    new Command('project')
      .alias('p')
      .description('Detect project type and framework')
      .option('--dir <path>', 'Project directory', process.cwd())
      .action((options) => {
        const info = detectProject(options.dir);
        console.log(printProjectInfo(info));
      }),
  )
  .addCommand(
    new Command('deps')
      .alias('d')
      .description('Analyze dependencies and import graph')
      .option('--dir <path>', 'Project directory', process.cwd())
      .action((options) => {
        console.log(chalk.dim('\n  Analyzing dependencies...'));
        const graph = analyzeDependencies(options.dir);
        console.log(printDepGraph(graph));

        const circles = findCircularDeps(graph);
        if (circles.length > 0) {
          console.log(chalk.yellow(`  ⚠ Found ${circles.length} circular dependenc${circles.length > 1 ? 'ies' : 'y'}`));
          for (const circle of circles.slice(0, 5)) {
            console.log(`  ${chalk.red('↻')} ${circle.join(' → ')}`);
          }
          console.log('');
        }
      }),
  )
  .addCommand(
    new Command('summary')
      .alias('s')
      .description('Generate a full repo architecture summary')
      .option('--dir <path>', 'Project directory', process.cwd())
      .action((options) => {
        console.log(chalk.dim('\n  Generating repository summary...\n'));
        const summary = generateSummary(options.dir);
        console.log(printSummary(summary));
      }),
  )
  .addCommand(
    new Command('search')
      .alias('q')
      .description('Semantically search code in the repository')
      .argument('<query>', 'The search query')
      .option('--dir <path>', 'Project directory', process.cwd())
      .option('--max <number>', 'Maximum results', '10')
      .action(async (query: string, options) => {
        console.log(chalk.dim(`\n  Searching for: "${query}"\n`));
        const results = await semanticSearch(options.dir, query, {
          rootDir: options.dir,
          query,
          maxResults: parseInt(options.max, 10),
        });
        console.log(printSemanticResults(results, query));
      }),
  )
  .addCommand(
    new Command('scan')
      .description('Scan and categorize project files')
      .option('--dir <path>', 'Project directory', process.cwd())
      .option('--category <name>', 'Filter by category')
      .action((options) => {
        const categories = options.category ? [options.category] : undefined;
        const files = scanDirectory({
          rootDir: options.dir,
          maxDepth: 10,
          maxFiles: 10000,
          categories,
        });
        console.log(printScanSummary(files));
        console.log('');
      }),
  );
