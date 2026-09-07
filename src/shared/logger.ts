/**
 * Logger de linha unica em JSON (exigencia de logs estruturados da Fase 3).
 * Todo log carrega `requestId` para correlacao ponta-a-ponta com o API Gateway
 * e com o monolito, e nunca imprime CPF completo (ver `maskCpf`).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogContext {
  [key: string]: unknown;
}

export class Logger {
  constructor(
    private readonly level: LogLevel = 'info',
    private readonly base: LogContext = {},
  ) {}

  child(context: LogContext): Logger {
    return new Logger(this.level, { ...this.base, ...context });
  }

  debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    if (LEVELS[level] < LEVELS[this.level]) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      service: 'oficina-auth-lambda',
      ...this.base,
      ...context,
    };
    const line = JSON.stringify(entry);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}
