import { execSync } from 'node:child_process';
import type { ToolResult } from '../core/tools.js';
import type { ToolDefinition } from '../core/tools.js';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  minLoveCodeVersion?: string;
}

export interface PluginAPI {
  name: string;
  version: string;
  manifest: PluginManifest;

  onLoad?(): Promise<void> | void;
  onUnload?(): Promise<void> | void;

  registerTool?(tools: ToolDefinition[]): ToolDefinition[];
  registerCommands?(program: unknown): unknown;

  getTools?(): ToolDefinition[];
}

export interface PluginPackage {
  manifest: PluginManifest;
  module: PluginAPI;
  enabled: boolean;
  loadedAt: number;
}

export interface MarketplacePlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  tags: string[];
  installUrl: string;
}

export const PLUGIN_DIR = '.lovecode/plugins';

export const builtinPlugins: Array<{ name: string; description: string; tags: string[]; create: () => PluginAPI }> = [
  {
    name: 'docker',
    description: 'Docker container management and Dockerfile creation',
    tags: ['docker', 'container', 'devops'],
    create: () => {
      const tools: ToolDefinition[] = [
        {
          name: 'docker_ps',
          description: 'List running Docker containers',
          usage: '[all=<true>]',
          execute(_wd: string, args: Record<string, string>): ToolResult {
            const flag = args.all === 'true' ? '-a' : '';
            try {
              
              const out = execSync(`docker ps ${flag}`, { encoding: 'utf-8', timeout: 10000 }).trim();
              return { success: true, output: out || 'No containers' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
        {
          name: 'docker_images',
          description: 'List Docker images',
          usage: '',
          execute(): ToolResult {
            try {
              
              const out = execSync('docker images', { encoding: 'utf-8', timeout: 10000 }).trim();
              return { success: true, output: out || 'No images' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
        {
          name: 'docker_compose_up',
          description: 'Start Docker Compose services',
          usage: '[file=<path>] [detach=<true>]',
          execute(_wd: string, args: Record<string, string>): ToolResult {
            try {
              
              const file = args.file ? `-f ${args.file}` : '';
              const detach = args.detach === 'true' ? '-d' : '';
              const out = execSync(`docker compose ${file} up ${detach}`, { encoding: 'utf-8', timeout: 60000 }).trim();
              return { success: true, output: out || 'Started' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
      ];

      return {
        name: 'docker',
        version: '1.0.0',
        manifest: {
          name: 'docker',
          version: '1.0.0',
          description: 'Docker container management',
          tags: ['docker', 'container', 'devops'],
        },
        getTools: () => tools,
      };
    },
  },
  {
    name: 'kubernetes',
    description: 'Kubernetes cluster management and pod operations',
    tags: ['k8s', 'kubernetes', 'devops'],
    create: () => {
      const tools: ToolDefinition[] = [
        {
          name: 'kubectl_get_pods',
          description: 'List Kubernetes pods',
          usage: '[namespace=<ns>] [all=<true>]',
          execute(_wd: string, args: Record<string, string>): ToolResult {
            try {
              
              const ns = args.namespace ? `-n ${args.namespace}` : '';
              const all = args.all === 'true' ? '--all-namespaces' : '';
              const out = execSync(`kubectl get pods ${ns} ${all}`, { encoding: 'utf-8', timeout: 10000 }).trim();
              return { success: true, output: out || 'No pods' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
        {
          name: 'kubectl_get_services',
          description: 'List Kubernetes services',
          usage: '[namespace=<ns>]',
          execute(_wd: string, args: Record<string, string>): ToolResult {
            try {
              const flag = args.all === 'true' ? '-a' : '';
              const out = execSync(`docker ps ${flag}`, { encoding: 'utf-8', timeout: 10000 }).trim();
              return { success: true, output: out || 'No containers' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
        {
          name: 'kubectl_logs',
          description: 'Show pod logs',
          usage: 'pod=<name> [container=<name>] [tail=<lines>]',
          execute(_wd: string, args: Record<string, string>): ToolResult {
            try {
              
              if (!args.pod) return { success: false, output: '', error: 'pod name required' };
              const container = args.container ? `-c ${args.container}` : '';
              const tail = args.tail ? `--tail=${args.tail}` : '';
              const out = execSync(`kubectl logs ${args.pod} ${container} ${tail}`, { encoding: 'utf-8', timeout: 10000 }).trim();
              return { success: true, output: out || '(empty)' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
      ];
      return {
        name: 'kubernetes',
        version: '1.0.0',
        manifest: {
          name: 'kubernetes',
          version: '1.0.0',
          description: 'Kubernetes cluster management',
          tags: ['k8s', 'kubernetes', 'devops'],
        },
        getTools: () => tools,
      };
    },
  },
  {
    name: 'firebase',
    description: 'Firebase deployment and project management',
    tags: ['firebase', 'gcp', 'deploy'],
    create: () => {
      const tools: ToolDefinition[] = [
        {
          name: 'firebase_deploy',
          description: 'Deploy to Firebase',
          usage: '[project=<id>] [only=<feature>]',
          execute(_wd: string, args: Record<string, string>): ToolResult {
            try {
              
              const project = args.project ? `--project ${args.project}` : '';
              const only = args.only ? `--only ${args.only}` : '';
              const out = execSync(`firebase deploy ${project} ${only}`, { encoding: 'utf-8', timeout: 120000 }).trim();
              return { success: true, output: out || 'Deployed' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
        {
          name: 'firebase_emulators',
          description: 'Start Firebase emulators',
          usage: '[project=<id>]',
          execute(_wd: string, args: Record<string, string>): ToolResult {
            try {
              
              const project = args.project ? `--project ${args.project}` : '';
              const out = execSync(`firebase emulators:start ${project}`, { encoding: 'utf-8', timeout: 30000 }).trim();
              return { success: true, output: out || 'Emulators started' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
      ];
      return {
        name: 'firebase',
        version: '1.0.0',
        manifest: {
          name: 'firebase',
          version: '1.0.0',
          description: 'Firebase deployment and management',
          tags: ['firebase', 'gcp', 'deploy'],
        },
        getTools: () => tools,
      };
    },
  },
  {
    name: 'prisma',
    description: 'Prisma ORM tools — schema management, migrations, studio',
    tags: ['prisma', 'database', 'orm'],
    create: () => {
      const tools: ToolDefinition[] = [
        {
          name: 'prisma_generate',
          description: 'Generate Prisma client',
          usage: '[schema=<path>]',
          execute(_wd: string, args: Record<string, string>): ToolResult {
            try {
              
              const schema = args.schema ? `--schema=${args.schema}` : '';
              const out = execSync(`npx prisma generate ${schema}`, { encoding: 'utf-8', timeout: 30000 }).trim();
              return { success: true, output: out || 'Generated' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
        {
          name: 'prisma_migrate',
          description: 'Run Prisma migrations',
          usage: 'name=<migration_name> [schema=<path>]',
          execute(_wd: string, args: Record<string, string>): ToolResult {
            try {
              
              if (!args.name) return { success: false, output: '', error: 'name required' };
              const schema = args.schema ? `--schema=${args.schema}` : '';
              const out = execSync(`npx prisma migrate dev --name "${args.name}" ${schema}`, { encoding: 'utf-8', timeout: 60000 }).trim();
              return { success: true, output: out || 'Migration created' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
        {
          name: 'prisma_studio',
          description: 'Open Prisma Studio',
          usage: '[schema=<path>]',
          execute(): ToolResult {
            try {
              
              execSync('npx prisma studio', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
              return { success: true, output: 'Prisma Studio started' };
            } catch (e) {
              return { success: true, output: 'Prisma Studio launching...' };
            }
          },
        },
        {
          name: 'prisma_format',
          description: 'Format Prisma schema',
          usage: '[schema=<path>]',
          execute(_wd: string, args: Record<string, string>): ToolResult {
            try {
              
              const schema = args.schema ? `--schema=${args.schema}` : '';
              const out = execSync(`npx prisma format ${schema}`, { encoding: 'utf-8', timeout: 15000 }).trim();
              return { success: true, output: out || 'Formatted' };
            } catch (e) {
              return { success: false, output: '', error: String(e) };
            }
          },
        },
      ];
      return {
        name: 'prisma',
        version: '1.0.0',
        manifest: {
          name: 'prisma',
          version: '1.0.0',
          description: 'Prisma ORM tools',
          tags: ['prisma', 'database', 'orm'],
        },
        getTools: () => tools,
      };
    },
  },
];
