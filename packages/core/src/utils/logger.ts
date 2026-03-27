export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

class Logger {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      none: 0,
      error: 1,
      warn: 2,
      info: 3,
      debug: 4,
    };
    return levels[level] <= levels[this.level];
  }

  debug(...args: any[]) {
    if (this.shouldLog('debug')) console.debug(...args);
  }

  info(...args: any[]) {
    if (this.shouldLog('info')) console.info(...args);
  }

  warn(...args: any[]) {
    if (this.shouldLog('warn')) console.warn(...args);
  }

  error(...args: any[]) {
    if (this.shouldLog('error')) console.error(...args);
  }
}

export const logger = new Logger();
