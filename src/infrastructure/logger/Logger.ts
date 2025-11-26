import { ILogger } from '../../core/interfaces/ILogger';
import { config } from '../../config';
import * as fs from 'fs';
import * as path from 'path';

export class Logger implements ILogger {
  private logFilePath: string;

  constructor() {
    this.logFilePath = config.logger.logFilePath;
    // Garante que o diretório existe
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private formatTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private writeLog(level: string, message: string): void {
    const timestamp = this.formatTimestamp();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    // Escreve no console
    console.log(logMessage.trim());
    
    // Escreve no arquivo
    try {
      fs.appendFileSync(this.logFilePath, logMessage);
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  info(message: string): void {
    this.writeLog('INFO', message);
  }

  error(message: string | Error): void {
    const errorMessage = message instanceof Error ? (message.stack || message.message) : message;
    this.writeLog('ERROR', errorMessage);
  }

  debug(message: string): void {
    this.writeLog('DEBUG', message);
  }
} 