declare module 'simple-node-logger' {
  export interface LoggerConfig {
    logFilePath?: string;
    timestampFormat?: string;
  }

  export interface Logger {
    info(message: string): void;
    error(message: string): void;
    debug(message: string): void;
    warn(message: string): void;
  }

  export function createSimpleLogger(config?: LoggerConfig): Logger;
}

