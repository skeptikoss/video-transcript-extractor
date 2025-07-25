import { Router, Request, Response } from 'express';
import { NotionService, NotionConfig, TranscriptPageData } from '../services/NotionService';
import { VideoRepository } from '../database/repositories/VideoRepository';
import { TranscriptRepository } from '../database/repositories/TranscriptRepository';
import { logger } from '../utils/logger';

const router = Router();

// Initialize NotionService with environment config
const notionConfig: NotionConfig = {
  apiKey: process.env.NOTION_API_KEY || '',
  databaseId: process.env.NOTION_DATABASE_ID
};

let notionService: NotionService | null = null;

// Initialize service if API key is available
if (notionConfig.apiKey) {
  notionService = new NotionService(notionConfig);
} else {
  logger.warn('Notion API key not configured - Notion integration disabled');
}

/**
 * Test Notion connection
 */
router.get('/test-connection', async (req: Request, res: Response) => {
  try {
    if (!notionService) {
      return res.status(400).json({
        success: false,
        error: 'Notion API key not configured'
      });
    }

    const result = await notionService.testConnection();
    res.json(result);
  } catch (error) {
    logger.error('Notion connection test error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get accessible databases
 */
router.get('/databases', async (req: Request, res: Response) => {
  try {
    if (!notionService) {
      return res.status(400).json({
        success: false,
        error: 'Notion API key not configured'
      });
    }

    const query = req.query.search as string;
    const databases = await notionService.searchDatabases(query);
    
    res.json({
      success: true,
      databases
    });
  } catch (error) {
    logger.error('Failed to fetch databases', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch databases'
    });
  }
});

/**
 * Get specific database information
 */
router.get('/databases/:databaseId', async (req: Request, res: Response) => {
  try {
    if (!notionService) {
      return res.status(400).json({
        success: false,
        error: 'Notion API key not configured'
      });
    }

    const { databaseId } = req.params;
    const database = await notionService.getDatabase(databaseId);
    
    if (!database) {
      return res.status(404).json({
        success: false,
        error: 'Database not found or not accessible'
      });
    }

    res.json({
      success: true,
      database
    });
  } catch (error) {
    logger.error('Failed to fetch database', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch database'
    });
  }
});

/**
 * Create a new transcript database
 */
router.post('/databases', async (req: Request, res: Response) => {
  try {
    if (!notionService) {
      return res.status(400).json({
        success: false,
        error: 'Notion API key not configured'
      });
    }

    const { parentPageId, title = 'Video Transcripts' } = req.body;
    
    if (!parentPageId) {
      return res.status(400).json({
        success: false,
        error: 'Parent page ID is required'
      });
    }

    const database = await notionService.createTranscriptDatabase(parentPageId, title);
    
    res.json({
      success: true,
      database
    });
  } catch (error) {
    logger.error('Failed to create database', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create database'
    });
  }
});

/**
 * Sync a single transcript to Notion
 */
router.post('/sync/transcript/:videoId', async (req: Request, res: Response) => {
  try {
    if (!notionService) {
      return res.status(400).json({
        success: false,
        error: 'Notion API key not configured'
      });
    }

    const { videoId } = req.params;
    const { databaseId } = req.body;
    
    if (!databaseId) {
      return res.status(400).json({
        success: false,
        error: 'Database ID is required'
      });
    }

    // Get video and transcript data
    const videoRepo = new VideoRepository();
    const transcriptRepo = new TranscriptRepository();
    
    const video = await videoRepo.findById(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    const transcript = await transcriptRepo.findByVideoId(videoId);
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found'
      });
    }

    // Prepare transcript data for Notion
    const transcriptData: TranscriptPageData = {
      title: `Transcript: ${video.originalName}`,
      content: transcript.content,
      videoId: video.id,
      videoFilename: video.originalName,
      duration: video.duration,
      confidence: transcript.confidence,
      language: transcript.language,
      uploadDate: video.createdAt,
      transcriptionDate: transcript.createdAt
    };

    // Sync to Notion
    const result = await notionService.createTranscriptPage(databaseId, transcriptData);
    
    res.json({
      success: result.success,
      ...result
    });
  } catch (error) {
    logger.error('Failed to sync transcript', { error, videoId: req.params.videoId });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync transcript'
    });
  }
});

/**
 * Sync multiple transcripts to Notion in batch
 */
router.post('/sync/batch', async (req: Request, res: Response) => {
  try {
    if (!notionService) {
      return res.status(400).json({
        success: false,
        error: 'Notion API key not configured'
      });
    }

    const { videoIds, databaseId } = req.body;
    
    if (!databaseId || !Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Database ID and video IDs array are required'
      });
    }

    const results = [];
    const videoRepo = new VideoRepository();
    const transcriptRepo = new TranscriptRepository();

    // Process each video sequentially to respect rate limits
    for (const videoId of videoIds) {
      try {
        const video = await videoRepo.findById(videoId);
        if (!video) {
          results.push({
            videoId,
            success: false,
            error: 'Video not found'
          });
          continue;
        }

        const transcript = await transcriptRepo.findByVideoId(videoId);
        if (!transcript) {
          results.push({
            videoId,
            success: false,
            error: 'Transcript not found'
          });
          continue;
        }

        const transcriptData: TranscriptPageData = {
          title: `Transcript: ${video.originalName}`,
          content: transcript.content,
          videoId: video.id,
          videoFilename: video.originalName,
          duration: video.duration,
          confidence: transcript.confidence,
          language: transcript.language,
          uploadDate: video.createdAt,
          transcriptionDate: transcript.createdAt
        };

        const result = await notionService.createTranscriptPage(databaseId, transcriptData);
        results.push({
          videoId,
          ...result
        });
      } catch (error) {
        logger.error('Failed to sync individual transcript', { error, videoId });
        results.push({
          videoId,
          success: false,
          error: error instanceof Error ? error.message : 'Sync failed'
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    res.json({
      success: true,
      summary: {
        total: results.length,
        successful,
        failed
      },
      results
    });
  } catch (error) {
    logger.error('Failed to batch sync transcripts', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch sync failed'
    });
  }
});

/**
 * Get sync status for a video
 */
router.get('/sync/status/:videoId', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { databaseId } = req.query;

    if (!notionService || !databaseId) {
      return res.json({
        synced: false,
        reason: !notionService ? 'Notion not configured' : 'Database ID required'
      });
    }

    const existing = await notionService.findExistingTranscript(databaseId as string, videoId);
    
    res.json({
      synced: existing.exists,
      pageId: existing.pageId
    });
  } catch (error) {
    logger.error('Failed to check sync status', { error, videoId: req.params.videoId });
    res.json({
      synced: false,
      error: error instanceof Error ? error.message : 'Check failed'
    });
  }
});

/**
 * Get rate limiter status
 */
router.get('/status', (req: Request, res: Response) => {
  if (!notionService) {
    return res.json({
      configured: false,
      error: 'Notion API key not configured'
    });
  }

  const rateLimiterStatus = notionService.getRateLimiterStatus();
  
  res.json({
    configured: true,
    rateLimiter: rateLimiterStatus
  });
});

export default router;