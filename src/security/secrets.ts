import * as fs from 'node:fs';
import chalk from 'chalk';

export interface SecretMatch {
  type: SecretType;
  value: string;
  line: number;
  column: number;
  file?: string;
  context: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export type SecretType =
  | 'aws_key'
  | 'gcp_key'
  | 'github_token'
  | 'gitlab_token'
  | 'openai_key'
  | 'slack_token'
  | 'discord_token'
  | 'npm_token'
  | 'ssh_key'
  | 'pg_connection'
  | 'redis_url'
  | 'mongodb_url'
  | 'jwt_secret'
  | 'generic_api_key'
  | 'password'
  | 'private_key'
  | 'screenshot';

interface SecretRule {
  type: SecretType;
  pattern: RegExp;
  severity: SecretMatch['severity'];
  description: string;
}

const SECRET_RULES: SecretRule[] = [
  { type: 'aws_key', pattern: /(?:AKIA|ASIA)[0-9A-Z]{16}/g, severity: 'critical', description: 'AWS Access Key ID' },
  { type: 'gcp_key', pattern: /AIza[0-9A-Za-z\-_]{35}/g, severity: 'critical', description: 'GCP API Key' },
  { type: 'github_token', pattern: /ghp_[0-9a-zA-Z]{36}|gho_[0-9a-zA-Z]{36}|ghu_[0-9a-zA-Z]{36}|ghs_[0-9a-zA-Z]{36}/g, severity: 'critical', description: 'GitHub Token' },
  { type: 'gitlab_token', pattern: /glpat-[0-9a-zA-Z\-_]{20,}/g, severity: 'critical', description: 'GitLab Token' },
  { type: 'openai_key', pattern: /sk-[0-9a-zA-Z]{20,}/g, severity: 'critical', description: 'OpenAI API Key' },
  { type: 'slack_token', pattern: /xox[baprs]-[0-9a-zA-Z\-]{10,}/g, severity: 'critical', description: 'Slack Token' },
  { type: 'discord_token', pattern: /[MN][0-9A-Za-z\-_]{23}\.[0-9A-Za-z\-_]{6}\.[0-9A-Za-z\-_]{27}/g, severity: 'critical', description: 'Discord Bot Token' },
  { type: 'npm_token', pattern: /npm_[0-9a-zA-Z]{36}/g, severity: 'high', description: 'npm Token' },
  { type: 'ssh_key', pattern: /-----BEGIN (?:RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY-----/g, severity: 'critical', description: 'Private SSH/PGP Key' },
  { type: 'pg_connection', pattern: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/g, severity: 'high', description: 'PostgreSQL Connection String' },
  { type: 'redis_url', pattern: /redis:\/\/[^:\s]+:[^@\s]+@/g, severity: 'high', description: 'Redis Connection URL' },
  { type: 'mongodb_url', pattern: /mongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]+@/g, severity: 'high', description: 'MongoDB Connection String' },
  { type: 'jwt_secret', pattern: /JWT_SECRET\s*=\s*['"][^'"]{16,}['"]/gi, severity: 'high', description: 'JWT Secret' },
  { type: 'generic_api_key', pattern: /(?:api[_-]?key|apikey|api[_-]?secret|api_secret)\s*[:=]\s*['"][^'"]{8,}['"]/gi, severity: 'medium', description: 'Generic API Key/Secret' },
  { type: 'password', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi, severity: 'high', description: 'Password in code' },
  { type: 'private_key', pattern: /-----BEGIN PRIVATE KEY-----/g, severity: 'critical', description: 'Private Key Block' },
];

export function scanText(text: string, fileName?: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    for (const rule of SECRET_RULES) {
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(line)) !== null) {
        const start = match.index;
        const value = match[0];
        const masked = value.length > 8 ? value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4) : '****';
        matches.push({
          type: rule.type,
          value: masked,
          line: lineNum,
          column: start + 1,
          file: fileName,
          context: line.trim().slice(0, 120),
          severity: rule.severity,
        });
      }
    }
  }

  return matches;
}

export function scanFile(filePath: string): SecretMatch[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return scanText(content, filePath);
  } catch {
    return [];
  }
}

export function scanDirectory(dirPath: string, maxFiles: number = 100): SecretMatch[] {
  const results: SecretMatch[] = [];
  let count = 0;

  function walk(dir: string): void {
    if (count >= maxFiles) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (count >= maxFiles) return;
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const fullPath = dir + '/' + entry.name;
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const textExts = ['.ts', '.js', '.py', '.rb', '.go', '.rs', '.java', '.json', '.yaml', '.yml', '.env', '.env.example', '.ini', '.cfg', '.conf', '.toml', '.sh', '.bash', '.zsh', '.txt', '.md', '.xml'];
          const ext = fullPath.slice(fullPath.lastIndexOf('.'));
          if (textExts.includes(ext)) {
            const secrets = scanFile(fullPath);
            results.push(...secrets);
            count++;
          }
        }
      }
    } catch {
      // skip unreadable
    }
  }

  walk(dirPath);
  return results;
}

export function formatSecretMatch(match: SecretMatch): string {
  const severityColor: Record<string, (s: string) => string> = {
    low: chalk.cyan,
    medium: chalk.yellow,
    high: chalk.red,
    critical: chalk.bgRed.white,
  };
  const sev = severityColor[match.severity] || chalk.dim;
  const fileInfo = match.file ? `${chalk.dim(match.file)}:${match.line}:${match.column}` : `line ${match.line}:${match.column}`;
  return `  ${sev(match.severity.toUpperCase().padEnd(10))} ${match.type.padEnd(20)} ${match.value.padEnd(30)} ${fileInfo}\n    ${chalk.dim(match.context)}`;
}

export function formatSecretSummary(matches: SecretMatch[]): string {
  if (matches.length === 0) return chalk.green('No secrets detected.');
  const bySeverity = new Map<SecretMatch['severity'], SecretMatch[]>();
  for (const m of matches) {
    const arr = bySeverity.get(m.severity) || [];
    arr.push(m);
    bySeverity.set(m.severity, arr);
  }
  const lines: string[] = [chalk.bold(`\n  Secrets Detected (${matches.length}):`)];
  for (const [severity, ms] of bySeverity) {
    const label = severity.toUpperCase();
    lines.push(`\n  ${chalk.bold(label)} (${ms.length}):`);
    for (const m of ms.slice(0, 10)) {
      lines.push(formatSecretMatch(m));
    }
    if (ms.length > 10) lines.push(`  ... and ${ms.length - 10} more`);
  }
  return lines.join('\n');
}
