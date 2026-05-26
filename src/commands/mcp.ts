import { Command } from 'commander';
import chalk from 'chalk';

async function cmdStartMcp() {
  console.log(chalk.dim('Starting LoveCode MCP server on stdio...'));
  const { startMcpServer } = await import('../mcp/server.js');
  await startMcpServer();
}

export const mcpCommand = new Command('mcp')
  .description('Model Context Protocol server — expose LoveCode tools to MCP clients')
  .addHelpText('after', `
  Examples:
    lovecode mcp                    Start MCP server (stdio transport)

  Use with any MCP client (Claude Desktop, VS Code, etc.):
    {
      "mcpServers": {
        "lovecode": {
          "command": "lovecode",
          "args": ["mcp"]
        }
      }
    }
  `);

mcpCommand.action(cmdStartMcp);
