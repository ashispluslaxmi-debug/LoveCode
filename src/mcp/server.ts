import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { allTools, type ToolDefinition } from '../core/tools.js';

function mcpToolSchema(tool: ToolDefinition) {
  const parts = tool.usage ? tool.usage.split('\n').filter(Boolean) : [];
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx > 0) {
      const key = part.slice(0, eqIdx).trim();
      const desc = part.slice(eqIdx + 1).trim();
      properties[key] = { type: 'string', description: desc };
      required.push(key);
    }
  }

  if (Object.keys(properties).length === 0) {
    properties.path = { type: 'string', description: 'File or directory path' };
  }

  return {
    type: 'object' as const,
    properties,
    required,
  };
}

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'lovecode-ai',
      version: '0.1.9',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: mcpToolSchema(tool),
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = allTools.find((t) => t.name === name);

    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const workingDir = process.cwd();
      const result = await tool.execute(workingDir, (args || {}) as Record<string, string>);

      if (result.success) {
        return {
          content: [{ type: 'text', text: result.output }],
        };
      } else {
        return {
          content: [{ type: 'text', text: result.error || result.output }],
          isError: true,
        };
      }
    } catch (err) {
      return {
        content: [{ type: 'text', text: (err as Error).message }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
