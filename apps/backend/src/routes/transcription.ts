import { Router, Request, Response } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { queueService } from '../services/QueueService';
import { DatabaseService } from '../database/DatabaseService';
import { logger } from '../utils/logger';

const router = Router();

// Get transcription job status
router.get(
  '/job/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    
    if (!jobId) {
      throw createError('Job ID is required', 400);
    }

    const jobStatus = await queueService.getJobStatus(jobId);
    
    if (!jobStatus) {
      throw createError('Job not found', 404);
    }

    res.json({
      success: true,
      data: jobStatus
    });
  })
);

// Get transcription by video ID
router.get(
  '/video/:videoId',
  asyncHandler(async (req: Request, res: Response) => {
    const { videoId } = req.params;
    
    if (!videoId) {
      throw createError('Video ID is required', 400);
    }

    const dbService = DatabaseService.getInstance();
    
    // Get video record
    const video = await dbService.getVideoRepository().findOne({ 
      where: { id: videoId } 
    });
    
    if (!video) {
      throw createError('Video not found', 404);
    }

    // Get job record
    const job = await dbService.getJobRepository().findOne({ 
      where: { videoId } 
    });

    // Get transcript if available
    const transcript = await dbService.getTranscriptRepository().findOne({ 
      where: { videoId } 
    });

    res.json({
      success: true,
      data: {
        video: {
          id: video.id,
          filename: video.filename,
          originalName: video.originalName,
          size: video.size,
          mimeType: video.mimeType,
          duration: video.duration,
          status: video.status,
          uploadedAt: video.createdAt,
          updatedAt: video.updatedAt
        },
        job: job ? {
          id: job.id,
          status: job.status,
          progress: job.progress,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          error: job.error
        } : null,
        transcript: transcript ? {
          id: transcript.id,
          content: transcript.content,
          language: transcript.language,
          confidence: transcript.confidence,
          segments: transcript.segments ? JSON.parse(transcript.segments) : null,
          createdAt: transcript.createdAt
        } : null
      }
    });
  })
);

// Get queue statistics
router.get(
  '/queue/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await queueService.getQueueStats();
    
    res.json({
      success: true,
      data: stats
    });
  })
);

// Start transcription for a specific video (manual trigger)
router.post(
  '/start/:videoId',
  asyncHandler(async (req: Request, res: Response) => {
    const { videoId } = req.params;
    
    if (!videoId) {
      throw createError('Video ID is required', 400);
    }

    const dbService = DatabaseService.getInstance();
    
    // Check if video exists
    const video = await dbService.getVideoRepository().findOne({ 
      where: { id: videoId } 
    });
    
    if (!video) {
      throw createError('Video not found', 404);
    }

    // Check if job already exists and is not failed
    const existingJob = await dbService.getJobRepository().findOne({ 
      where: { videoId } 
    });
    
    if (existingJob && existingJob.status !== 'failed') {
      throw createError('Transcription job already exists for this video', 400);
    }

    // Create or update job record
    let jobRecord;
    if (existingJob) {
      existingJob.status = 'pending';
      existingJob.progress = 0;
      existingJob.error = null;
      existingJob.attempts = 0;
      jobRecord = await dbService.getJobRepository().save(existingJob);
    } else {
      const newJob = dbService.getJobRepository().create({
        videoId: video.id,
        type: 'transcription',
        status: 'pending',
        priority: 0,
        progress: 0
      });
      jobRecord = await dbService.getJobRepository().save(newJob);
    }

    // Add to queue
    const queueJob = await queueService.addTranscriptionJob({
      videoId: video.id,
      videoPath: video.uploadPath,
      originalName: video.originalName
    });

    logger.info(`Manual transcription started for video ${videoId}`, {
      jobId: queueJob.id,
      videoId,
      originalName: video.originalName
    });

    res.json({
      success: true,
      message: 'Transcription started',
      data: {
        jobId: queueJob.id,
        videoId,
        status: 'pending'
      }
    });
  })
);

// Retry failed transcription
router.post(
  '/retry/:videoId',
  asyncHandler(async (req: Request, res: Response) => {
    const { videoId } = req.params;
    
    if (!videoId) {
      throw createError('Video ID is required', 400);
    }

    const dbService = DatabaseService.getInstance();
    
    // Check if video and failed job exist
    const [video, job] = await Promise.all([
      dbService.getVideoRepository().findOne({ where: { id: videoId } }),
      dbService.getJobRepository().findOne({ where: { videoId } })
    ]);
    
    if (!video) {
      throw createError('Video not found', 404);
    }
    
    if (!job) {
      throw createError('No job found for this video', 404);
    }
    
    if (job.status !== 'failed') {
      throw createError('Only failed jobs can be retried', 400);
    }

    // Reset job status
    job.status = 'pending';
    job.progress = 0;
    job.error = null;
    job.attempts = 0;
    job.startedAt = null;
    job.completedAt = null;
    await dbService.getJobRepository().save(job);

    // Add to queue with higher priority
    const queueJob = await queueService.addTranscriptionJob({
      videoId: video.id,
      videoPath: video.uploadPath,
      originalName: video.originalName
    }, { priority: 10 }); // Higher priority for retries

    logger.info(`Transcription retry started for video ${videoId}`, {
      jobId: queueJob.id,
      videoId,
      originalName: video.originalName,
      previousAttempts: job.attempts
    });

    res.json({
      success: true,
      message: 'Transcription retry started',
      data: {
        jobId: queueJob.id,
        videoId,
        status: 'pending'
      }
    });
  })
);

export default router;