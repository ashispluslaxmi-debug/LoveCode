import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL = (process.env.LOVECODE_LOG_LEVEL || 'info').toUpperCase() as keyof typeof LogLevel;
const currentLevel = LogLevel[LOG_LEVEL] ?? LogLevel.INFO;

export class Logger {
  static debug(...args: unknown[]) {
    if (currentLevel <= LogLevel.DEBUG) {
      console.error(chalk.dim('[debug]'), ...args);
    }
  }

  static info(...args: unknown[]) {
    if (currentLevel <= LogLevel.INFO) {
      console.error(chalk.blue('[info]'), ...args);
    }
  }

  static warn(...args: unknown[]) {
    if (currentLevel <= LogLevel.WARN) {
      console.error(chalk.yellow('[warn]'), ...args);
    }
  }

  static error(...args: unknown[]) {
    if (currentLevel <= LogLevel.ERROR) {
      console.error(chalk.red('[error]'), ...args);
    }
  }
}
