export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

export class Logger {
  private static instance: Logger;
  private currentLevel: LogLevel = 'none';
  private readonly prefix = '[PlayCanvas Runtime Editor]';

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  getLevel(): LogLevel {
    return this.currentLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.currentLevel === 'none') return false;
    
    const levels: LogLevel[] = ['none', 'error', 'warn', 'info', 'debug'];
    const currentIndex = levels.indexOf(this.currentLevel);
    const messageIndex = levels.indexOf(level);
    
    return messageIndex <= currentIndex;
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(`${this.prefix} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(`${this.prefix} ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.log(`${this.prefix} ${message}`, ...args);
    }
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.log(`${this.prefix} ${message}`, ...args);
    }
  }
}

export const logger = Logger.getInstance(); 