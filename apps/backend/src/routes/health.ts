import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import DatabaseService from '../database/DatabaseService';

const router = Router();
const logger = createLogger('health');

// Basic health check
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.0.1'
  };

  logger.info('Health check requested', healthData);

  res.json({
    success: true,
    data: healthData
  });
}));

// Detailed health check
router.get('/detailed', asyncHandler(async (_req: Request, res: Response) => {
  const dbService = DatabaseService.getInstance();
  const dbHealth = await dbService.healthCheck();
  
  const healthData = {
    status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.0.1',
    system: {
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    },
    services: {
      database: dbHealth,
      whisperApi: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
      notionApi: process.env.NOTION_API_KEY ? 'configured' : 'not_configured'
    }
  };

  // Get database stats if healthy
  if (dbHealth.status === 'healthy') {
    try {
      const stats = await dbService.getStats();
      (healthData.services.database as any).stats = stats;
    } catch (error) {
      logger.warn('Failed to get database stats for health check', { error });
    }
  }

  res.json({
    success: true,
    data: healthData
  });
}));

export default router;