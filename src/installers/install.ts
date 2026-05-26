import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import chalk from 'chalk';

export interface InstallerInfo {
  method: string;
  version: string;
  nodeVersion: string;
  platform: string;
  installDir: string;
}

export function detectInstallMethod(): string {
  if (process.env.npm_config_user_agent?.startsWith('npm')) return 'npm';
  if (process.env.npm_config_user_agent?.startsWith('yarn')) return 'yarn';
  if (process.env.npm_config_user_agent?.startsWith('pnpm')) return 'pnpm';
  if (process.env.CI) return 'ci';
  return 'unknown';
}

export function getInstallerInfo(): InstallerInfo {
  return {
    method: detectInstallMethod(),
    version: process.env.npm_package_version || '0.1.0',
    nodeVersion: process.version,
    platform: process.platform,
    installDir: process.cwd(),
  };
}

export function isGloballyInstalled(): boolean {
  try {
    const result = execSync('which lovecode 2>/dev/null', { encoding: 'utf-8' }).trim();
    return result.length > 0;
  } catch {
    return false;
  }
}

export function printInstallInstructions(): void {
  console.log(chalk.bold.cyan('\n  LoveCode AI - Installation\n'));
  console.log(chalk.bold('  Quick Install:\n'));
  console.log(`  ${chalk.green('NPM:')}`);
  console.log(`    npm install -g lovecode-ai\n`);
  console.log(`  ${chalk.green('Curl:')}`);
  console.log(`    curl -fsSL https://lovecode.sh | bash\n`);
  console.log(`  ${chalk.green('Verify:')}`);
  console.log(`    lovecode --version\n`);

  console.log(chalk.bold('  Termux (Android):\n'));
  console.log(`    pkg install nodejs`);
  console.log(`    npm install -g lovecode-ai`);
  console.log(`    lovecode init\n`);
  console.log(`  ${chalk.dim('LoveCode auto-detects Termux and enables:')}`);
  console.log(`  ${chalk.dim('  • Low RAM mode (128MB max)')}`);
  console.log(`  ${chalk.dim('  • Touch-optimized input')}`);
  console.log(`  ${chalk.dim('  • Reduced cache TTL (120s)')}\n`);
}

export function createInstallScript(rootDir?: string): void {
  const dir = rootDir || process.cwd();
  const scriptPath = path.join(dir, 'install.sh');
  const script = `#!/usr/bin/env bash
set -euo pipefail

LOVECODE_VERSION="${process.env.npm_package_version || 'latest'}"
INSTALL_DIR="\${LOVECODE_DIR:-$HOME/.lovecode}"

echo "⚡ LoveCode AI Installer v$LOVECODE_VERSION"
echo ""

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)  PLATFORM="linux" ;;
  Darwin) PLATFORM="darwin" ;;
  MINGW*|MSYS*) PLATFORM="windows" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js >= 18 is required. Install it from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js >= 18 required (found v$(node -v))"
  exit 1
fi

echo "📦 Installing LoveCode AI..."

# Create install directory
mkdir -p "$INSTALL_DIR"

# Install via npm
npm install -g lovecode-ai 2>/dev/null || {
  echo "⚠️  Global install failed, trying local..."
  npm install lovecode-ai 2>/dev/null || {
    echo "❌ Installation failed. Try: npm install -g lovecode-ai"
    exit 1
  }
}

echo ""
echo "✓ LoveCode AI installed successfully!"
echo ""
echo "  Run: lovecode init     Initialize in a project"
echo "  Run: lovecode setup    Interactive configuration"
echo "  Run: lovecode          Start the AI agent"
echo ""
`;

  const scriptDir = path.dirname(scriptPath);
  if (!fs.existsSync(scriptDir)) fs.mkdirSync(scriptDir, { recursive: true });
  fs.writeFileSync(scriptPath, script, 'utf-8');
  try {
    fs.chmodSync(scriptPath, '755');
  } catch {
    // Windows - skip chmod
  }
}
