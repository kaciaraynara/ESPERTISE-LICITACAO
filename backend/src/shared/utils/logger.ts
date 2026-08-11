export interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

class Logger {
  private formatLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: LogContext) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      environment: process.env.NODE_ENV || 'development',
      message,
      ...(context ? { context } : {}),
    });
  }

  public info(message: string, context?: LogContext): void {
    console.log(this.formatLog('info', message, context));
  }

  public warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog('warn', message, context));
  }

  public error(message: string, context?: LogContext): void {
    console.error(this.formatLog('error', message, context));
  }

  public debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('debug', message, context));
    }
  }
}

export const logger = new Logger();