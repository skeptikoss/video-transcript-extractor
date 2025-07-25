import winston from 'winston';
import path from 'path';

// Create logs directory if it doesn't exist
const logDir = path.join(process.cwd(), '../../logs');
const fs = require('fs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    let log = `${timestamp} [${service || 'app'}] ${level.toUpperCase()}: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create logger factory
export function createLogger(service: string): winston.Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service },
    transports: [
      // Console output
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          logFormat
        )
      }),
      
      // File output for errors
      new winston.transports.File({ 
        filename: path.join(logDir, 'error.log'), 
        level: 'error' 
      }),
      
      // File output for all logs
      new winston.transports.File({ 
        filename: path.join(logDir, 'combined.log') 
      })
    ],
    
    // Handle uncaught exceptions
    exceptionHandlers: [
      new winston.transports.File({ 
        filename: path.join(logDir, 'exceptions.log') 
      })
    ],
    
    // Handle unhandled promise rejections
    rejectionHandlers: [
      new winston.transports.File({ 
        filename: path.join(logDir, 'rejections.log') 
      })
    ]
  });
}

export default createLogger('default');