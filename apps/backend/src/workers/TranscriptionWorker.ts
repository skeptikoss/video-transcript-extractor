import { Job } from 'bull';
import { queueService, TranscriptionJobData, JobProgress } from '../services/QueueService';
import { audioExtractorService } from '../services/AudioExtractorService';
import { whisperService } from '../services/WhisperService';
import { DatabaseService } from '../database/DatabaseService';
import { Video } from '../database/entities/Video';
import { Transcript } from '../database/entities/Transcript';
import { Job as JobEntity } from '../database/entities/Job';
import { logger } from '../utils/logger';

export class TranscriptionWorker {
  private static instance: TranscriptionWorker;
  private dbService: DatabaseService;
  private isProcessing = false;

  private constructor() {
    this.dbService = DatabaseService.getInstance();
    this.initializeWorker();
  }

  public static getInstance(): TranscriptionWorker {
    if (!TranscriptionWorker.instance) {
      TranscriptionWorker.instance = new TranscriptionWorker();
    }
    return TranscriptionWorker.instance;
  }

  private initializeWorker(): void {
    const queue = queueService.getTranscriptionQueue();
    
    // Set concurrency based on environment or default to 1
    const concurrency = parseInt(process.env.MAX_CONCURRENT_JOBS || '1');
    
    queue.process('transcribe-video', concurrency, this.processTranscriptionJob.bind(this));
    
    logger.info(`Transcription worker initialized with concurrency: ${concurrency}`);
  }

  private async processTranscriptionJob(job: Job<TranscriptionJobData>): Promise<void> {
    const { videoId, videoPath, originalName } = job.data;
    
    logger.info(`Starting transcription job ${job.id} for video ${videoId}`);
    
    try {
      // Update job status in database
      await this.updateJobStatus(videoId, 'processing', 0);
      
      // Stage 1: Extract audio from video
      await this.updateProgress(job, {
        stage: 'audio_extraction',
        percentage: 10,
        message: 'Extracting audio from video...'
      });
      
      const { audioPath, metadata: audioMetadata } = await audioExtractorService.extractAudio(
        videoPath,
        {
          outputFormat: 'mp3',
          sampleRate: 16000, // Optimal for Whisper
          channels: 1, // Mono for better transcription
          bitRate: '64k'
        }
      );

      await this.updateProgress(job, {
        stage: 'audio_extraction',
        percentage: 30,
        message: 'Audio extraction completed'
      });

      // Stage 2: Transcribe audio using Whisper
      await this.updateProgress(job, {
        stage: 'transcription',
        percentage: 40,
        message: 'Starting transcription with Whisper API...'
      });

      const transcriptionResult = await whisperService.transcribeAudio(audioPath, {
        model: 'whisper-1',
        response_format: 'verbose_json',
        temperature: 0.2
      });

      await this.updateProgress(job, {
        stage: 'transcription',
        percentage: 80,
        message: 'Transcription completed, processing results...'
      });

      // Stage 3: Store transcript in database
      await this.updateProgress(job, {
        stage: 'storage',
        percentage: 90,
        message: 'Saving transcript to database...'
      });

      const transcript = await this.saveTranscript(videoId, transcriptionResult);

      // Stage 4: Update video status and cleanup
      await this.updateVideoStatus(videoId, 'completed');
      await this.updateJobStatus(videoId, 'completed', 100);

      // Cleanup temporary audio file
      await audioExtractorService.cleanupAudioFile(audioPath);

      await this.updateProgress(job, {
        stage: 'storage',
        percentage: 100,
        message: 'Transcription completed successfully'
      });

      logger.info(`Transcription job ${job.id} completed successfully`, {
        videoId,
        transcriptId: transcript.id,
        textLength: transcriptionResult.text.length,
        language: transcriptionResult.language,
        confidence: transcriptionResult.confidence
      });

    } catch (error) {
      logger.error(`Transcription job ${job.id} failed:`, error);
      
      // Update job and video status to failed
      await this.updateJobStatus(videoId, 'failed', job.progress() as number, error.message);
      await this.updateVideoStatus(videoId, 'failed');
      
      // Cleanup any temporary files
      try {
        const tempDir = audioExtractorService.getTempDirectory();
        await audioExtractorService.cleanupOldFiles(0); // Clean all temp files
      } catch (cleanupError) {
        logger.error('Failed to cleanup temporary files:', cleanupError);
      }
      
      throw error;
    }
  }

  private async updateProgress(job: Job<TranscriptionJobData>, progress: JobProgress): Promise<void> {
    try {
      await job.progress(progress);
      logger.debug(`Job ${job.id} progress updated:`, progress);
    } catch (error) {
      logger.error(`Failed to update job progress for ${job.id}:`, error);
    }
  }

  private async updateJobStatus(
    videoId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    progress: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const jobRepo = this.dbService.getJobRepository();
      const job = await jobRepo.findOne({ where: { videoId } });
      
      if (job) {
        job.status = status;
        job.progress = progress;
        
        if (status === 'processing' && job.startedAt === null) {
          job.startedAt = new Date();
        }
        
        if (status === 'completed' || status === 'failed') {
          job.completedAt = new Date();
        }
        
        if (errorMessage) {
          job.error = errorMessage;
        }
        
        await jobRepo.save(job);
      }
    } catch (error) {
      logger.error(`Failed to update job status for video ${videoId}:`, error);
    }
  }

  private async updateVideoStatus(
    videoId: string,
    status: 'uploaded' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    try {
      const videoRepo = this.dbService.getVideoRepository();
      const video = await videoRepo.findOne({ where: { id: videoId } });
      
      if (video) {
        video.status = status;
        await videoRepo.save(video);
      }
    } catch (error) {
      logger.error(`Failed to update video status for ${videoId}:`, error);
    }
  }

  private async saveTranscript(
    videoId: string,
    transcriptionResult: any
  ): Promise<Transcript> {
    try {
      const transcriptRepo = this.dbService.getTranscriptRepository();
      
      const transcript = new Transcript();
      transcript.videoId = videoId;
      transcript.content = transcriptionResult.text;
      transcript.language = transcriptionResult.language || 'unknown';
      transcript.confidence = transcriptionResult.confidence || 0;
      transcript.status = 'completed';
      
      // Store segments as JSON if available
      if (transcriptionResult.segments) {
        transcript.segments = JSON.stringify(transcriptionResult.segments);
      }
      
      const savedTranscript = await transcriptRepo.save(transcript);
      
      logger.info(`Transcript saved for video ${videoId}`, {
        transcriptId: savedTranscript.id,
        textLength: transcript.content.length,
        language: transcript.language,
        confidence: transcript.confidence
      });
      
      return savedTranscript;
    } catch (error) {
      logger.error(`Failed to save transcript for video ${videoId}:`, error);
      throw error;
    }
  }

  public async getWorkerStats(): Promise<{
    isProcessing: boolean;
    queueStats: any;
  }> {
    const queueStats = await queueService.getQueueStats();
    
    return {
      isProcessing: this.isProcessing,
      queueStats
    };
  }

  public async pauseProcessing(): Promise<void> {
    await queueService.pauseQueue();
    logger.info('Transcription processing paused');
  }

  public async resumeProcessing(): Promise<void> {
    await queueService.resumeQueue();
    logger.info('Transcription processing resumed');
  }

  public async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down transcription worker...');
      await queueService.shutdown();
      logger.info('Transcription worker shut down successfully');
    } catch (error) {
      logger.error('Error shutting down transcription worker:', error);
    }
  }
}

export const transcriptionWorker = TranscriptionWorker.getInstance();