import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health';
import uploadRoutes from './routes/upload';
import transcriptionRoutes from './routes/transcription';
import DatabaseService from './database/DatabaseService';
import { transcriptionWorker } from './workers/TranscriptionWorker';
import { audioExtractorService } from './services/AudioExtractorService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const logger = createLogger('server');

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Compression and parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/transcription', transcriptionRoutes);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    const dbService = DatabaseService.getInstance();
    await dbService.initialize();
    
    // Initialize transcription worker
    transcriptionWorker; // This initializes the singleton
    
    // Setup cleanup job for old audio files (run every hour)
    setInterval(async () => {
      try {
        await audioExtractorService.cleanupOldFiles(24 * 60 * 60 * 1000); // 24 hours
      } catch (error) {
        logger.error('Failed to cleanup old audio files:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  try {
    await transcriptionWorker.shutdown();
    const dbService = DatabaseService.getInstance();
    await dbService.gracefulShutdown();
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  try {
    await transcriptionWorker.shutdown();
    const dbService = DatabaseService.getInstance();
    await dbService.gracefulShutdown();
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
  }
  process.exit(0);
});

export default app;