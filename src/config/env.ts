import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';

const ENV_FILENAME = '.env';
const ENV_EXAMPLE = '.env.example';

export interface EnvVar {
  key: string;
  value: string;
  description: string;
  required: boolean;
}

export const KNOWN_ENV_VARS: EnvVar[] = [
  { key: 'GROQ_API_KEY', value: '', description: 'Groq API key for LLM access', required: false },
  { key: 'OPENROUTER_API_KEY', value: '', description: 'OpenRouter API key for LLM access', required: false },
  { key: 'TOGETHER_API_KEY', value: '', description: 'Together AI API key', required: false },
  { key: 'HUGGINGFACE_API_KEY', value: '', description: 'HuggingFace API key', required: false },
  { key: 'OPENAI_API_KEY', value: '', description: 'OpenAI API key (fallback)', required: false },
  { key: 'OLLAMA_URL', value: 'http://localhost:11434', description: 'Ollama server URL', required: false },
  { key: 'LOVECODE_LOG_LEVEL', value: 'info', description: 'Log level (debug|info|warn|error)', required: false },
  { key: 'LOVECODE_MODEL', value: '', description: 'Override default model', required: false },
  { key: 'LOVECODE_THEME', value: '', description: 'Override default theme', required: false },
  { key: 'LOVECODE_APPROVAL_MODE', value: '', description: 'Override approval mode (smart|strict|permissive)', required: false },
  { key: 'LOVECODE_TELEMETRY', value: '', description: 'Enable telemetry (true|false)', required: false },
];

export function loadEnv(rootDir?: string): Record<string, string> {
  const envPath = path.resolve(rootDir || process.cwd(), ENV_FILENAME);
  const vars: Record<string, string> = {};

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        vars[key] = value;
      }
    }
  }

  for (const v of KNOWN_ENV_VARS) {
    const envVal = process.env[v.key];
    if (envVal) vars[v.key] = envVal;
  }

  for (const [key, value] of Object.entries(vars)) {
    if (value && !process.env[key]) {
      process.env[key] = value;
    }
  }

  return vars;
}

export function saveEnv(vars: Record<string, string>, rootDir?: string): void {
  const envPath = path.resolve(rootDir || process.cwd(), ENV_FILENAME);
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const lines: string[] = ['# LoveCode AI - Environment Configuration', `# Created: ${new Date().toISOString().slice(0, 10)}`, ''];

  for (const v of KNOWN_ENV_VARS) {
    const value = vars[v.key] !== undefined ? vars[v.key] : v.value;
    lines.push(`# ${v.description}`);
    lines.push(`${v.key}=${value}`);
    lines.push('');
  }

  fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
}

export function saveEnvExample(rootDir?: string): void {
  const exPath = path.resolve(rootDir || process.cwd(), ENV_EXAMPLE);
  const lines: string[] = ['# LoveCode AI - Environment Configuration Example', '# Copy this file to .env and fill in your values', ''];

  for (const v of KNOWN_ENV_VARS) {
    lines.push(`# ${v.description}`);
    lines.push(v.required ? `${v.key}=` : `# ${v.key}=`);
    lines.push('');
  }

  fs.writeFileSync(exPath, lines.join('\n'), 'utf-8');
}

export function formatEnvStatus(rootDir?: string): string {
  const vars = loadEnv(rootDir);
  const lines: string[] = [chalk.bold('\n  Environment Variables')];

  for (const v of KNOWN_ENV_VARS) {
    const val = vars[v.key] || process.env[v.key] || '';
    const set = val.length > 0;
    const masked = set && v.key.includes('KEY')
      ? val.slice(0, 8) + '*'.repeat(Math.min(val.length - 8, 20))
      : val || '(not set)';
    lines.push(`  ${set ? chalk.green('✓') : chalk.dim('○')} ${chalk.dim(v.key.padEnd(25))} ${masked}`);
  }

  return lines.join('\n');
}
