import * as winston from 'winston';
import * as path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create logs directory if it doesn't exist
import * as fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export { logger };

// Helper functions for structured logging
export const logError = (message: string, error?: Error, metadata?: any) => {
  logger.error(message, {
    error: error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined,
    metadata,
    timestamp: new Date().toISOString(),
  });
};

export const logInfo = (message: string, metadata?: any) => {
  logger.info(message, {
    metadata,
    timestamp: new Date().toISOString(),
  });
};

export const logWarn = (message: string, metadata?: any) => {
  logger.warn(message, {
    metadata,
    timestamp: new Date().toISOString(),
  });
};

export const logDebug = (message: string, metadata?: any) => {
  logger.debug(message, {
    metadata,
    timestamp: new Date().toISOString(),
  });
};

// Audit logging for security events
export const logAudit = (event: string, userId?: string, metadata?: any) => {
  logger.info(`AUDIT: ${event}`, {
    userId,
    metadata,
    timestamp: new Date().toISOString(),
    type: 'audit',
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info(`PERFORMANCE: ${operation} took ${duration}ms`, {
    operation,
    duration,
    metadata,
    timestamp: new Date().toISOString(),
    type: 'performance',
  });
};