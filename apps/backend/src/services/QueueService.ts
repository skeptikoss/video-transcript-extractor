import Bull, { Queue, Job, JobOptions } from 'bull';
import IORedis from 'ioredis';
import { logger } from '../utils/logger';

export interface TranscriptionJobData {
  videoId: string;
  videoPath: string;
  originalName: string;
  userId?: string;
}

export interface JobProgress {
  stage: 'audio_extraction' | 'chunking' | 'transcription' | 'storage';
  percentage: number;
  message: string;
}

export class QueueService {
  private static instance: QueueService;
  private transcriptionQueue: Queue<TranscriptionJobData>;
  private redisClient: IORedis | null = null;

  private constructor() {
    this.initializeQueue();
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  private initializeQueue(): void {
    try {
      // Try to connect to Redis if URL is provided, otherwise use in-memory
      const redisUrl = process.env.REDIS_URL;
      
      if (redisUrl) {
        this.redisClient = new IORedis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxLoadingTimeout: 1000,
        });

        this.transcriptionQueue = new Bull('transcription', {
          redis: redisUrl,
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 20,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        });

        logger.info('Queue initialized with Redis connection');
      } else {
        // Use in-memory queue for development
        this.transcriptionQueue = new Bull('transcription', {
          defaultJobOptions: {
            removeOnComplete: 10,
            removeOnFail: 20,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        });

        logger.info('Queue initialized with in-memory storage');
      }

      this.setupQueueEventHandlers();
    } catch (error) {
      logger.error('Failed to initialize queue service:', error);
      throw error;
    }
  }

  private setupQueueEventHandlers(): void {
    this.transcriptionQueue.on('completed', (job: Job<TranscriptionJobData>) => {
      logger.info(`Job ${job.id} completed successfully`, {
        videoId: job.data.videoId,
        duration: Date.now() - job.timestamp,
      });
    });

    this.transcriptionQueue.on('failed', (job: Job<TranscriptionJobData>, err: Error) => {
      logger.error(`Job ${job.id} failed:`, {
        videoId: job.data.videoId,
        error: err.message,
        attempts: job.attemptsMade,
      });
    });

    this.transcriptionQueue.on('progress', (job: Job<TranscriptionJobData>, progress: JobProgress) => {
      logger.info(`Job ${job.id} progress: ${progress.percentage}%`, {
        videoId: job.data.videoId,
        stage: progress.stage,
        message: progress.message,
      });
    });

    this.transcriptionQueue.on('stalled', (job: Job<TranscriptionJobData>) => {
      logger.warn(`Job ${job.id} stalled`, {
        videoId: job.data.videoId,
      });
    });
  }

  public async addTranscriptionJob(
    data: TranscriptionJobData,
    options: JobOptions = {}
  ): Promise<Job<TranscriptionJobData>> {
    try {
      const jobOptions: JobOptions = {
        priority: options.priority || 0,
        delay: options.delay || 0,
        ...options,
      };

      const job = await this.transcriptionQueue.add('transcribe-video', data, jobOptions);

      logger.info(`Transcription job ${job.id} added to queue`, {
        videoId: data.videoId,
        priority: jobOptions.priority,
      });

      return job;
    } catch (error) {
      logger.error('Failed to add transcription job to queue:', error);
      throw error;
    }
  }

  public async getJob(jobId: string | number): Promise<Job<TranscriptionJobData> | null> {
    try {
      return await this.transcriptionQueue.getJob(jobId);
    } catch (error) {
      logger.error(`Failed to get job ${jobId}:`, error);
      return null;
    }
  }

  public async getJobStatus(jobId: string | number): Promise<{
    id: string | number;
    state: string;
    progress: any;
    data: TranscriptionJobData;
    attemptsMade: number;
    finishedOn?: number;
    failedReason?: string;
  } | null> {
    try {
      const job = await this.getJob(jobId);
      if (!job) return null;

      const state = await job.getState();
      
      return {
        id: job.id,
        state,
        progress: job.progress(),
        data: job.data,
        attemptsMade: job.attemptsMade,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
      };
    } catch (error) {
      logger.error(`Failed to get job status for ${jobId}:`, error);
      return null;
    }
  }

  public async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.transcriptionQueue.getWaiting(),
        this.transcriptionQueue.getActive(),
        this.transcriptionQueue.getCompleted(),
        this.transcriptionQueue.getFailed(),
        this.transcriptionQueue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  public async pauseQueue(): Promise<void> {
    await this.transcriptionQueue.pause();
    logger.info('Transcription queue paused');
  }

  public async resumeQueue(): Promise<void> {
    await this.transcriptionQueue.resume();
    logger.info('Transcription queue resumed');
  }

  public async cleanCompletedJobs(grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    await this.transcriptionQueue.clean(grace, 'completed');
    logger.info(`Cleaned completed jobs older than ${grace}ms`);
  }

  public async cleanFailedJobs(grace: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    await this.transcriptionQueue.clean(grace, 'failed');
    logger.info(`Cleaned failed jobs older than ${grace}ms`);
  }

  public async shutdown(): Promise<void> {
    try {
      await this.transcriptionQueue.close();
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      logger.info('Queue service shut down successfully');
    } catch (error) {
      logger.error('Error shutting down queue service:', error);
    }
  }

  // Getter for the queue instance (for worker registration)
  public getTranscriptionQueue(): Queue<TranscriptionJobData> {
    return this.transcriptionQueue;
  }
}

export const queueService = QueueService.getInstance();