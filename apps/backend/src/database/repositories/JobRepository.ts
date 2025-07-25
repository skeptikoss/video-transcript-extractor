import { BaseRepository } from './BaseRepository';
import { Job, JobType, JobStatus, JobPriority } from '../entities/Job';
import AppDataSource from '../config';

export class JobRepository extends BaseRepository<Job> {
  constructor() {
    super(AppDataSource.getRepository(Job));
  }

  static getInstance(): JobRepository {
    return new JobRepository();
  }

  async findByVideoId(videoId: string): Promise<Job[]> {
    try {
      return await this.repository.find({
        where: { videoId },
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error('Failed to find jobs by video ID', { error, videoId });
      throw error;
    }
  }

  async findByStatus(status: JobStatus): Promise<Job[]> {
    try {
      return await this.repository.find({
        where: { status },
        order: { createdAt: 'ASC' }
      });
    } catch (error) {
      this.logger.error('Failed to find jobs by status', { error, status });
      throw error;
    }
  }

  async findByType(type: JobType): Promise<Job[]> {
    try {
      return await this.repository.find({
        where: { type },
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error('Failed to find jobs by type', { error, type });
      throw error;
    }
  }

  async findPendingJobs(limit?: number): Promise<Job[]> {
    try {
      const queryBuilder = this.repository
        .createQueryBuilder('job')
        .where('job.status = :status', { status: JobStatus.PENDING })
        .orderBy('job.priority', 'DESC')
        .addOrderBy('job.createdAt', 'ASC');

      if (limit) {
        queryBuilder.take(limit);
      }

      return await queryBuilder.getMany();
    } catch (error) {
      this.logger.error('Failed to find pending jobs', { error, limit });
      throw error;
    }
  }

  async findRetryableJobs(): Promise<Job[]> {
    try {
      return await this.repository
        .createQueryBuilder('job')
        .where('job.status = :status', { status: JobStatus.FAILED })
        .andWhere('job.attempts < job.maxAttempts')
        .orderBy('job.createdAt', 'ASC')
        .getMany();
    } catch (error) {
      this.logger.error('Failed to find retryable jobs', { error });
      throw error;
    }
  }

  async updateStatus(id: string, status: JobStatus, errorMessage?: string): Promise<Job | null> {
    try {
      const updateData: any = { status };
      
      if (errorMessage !== undefined) {
        updateData.errorMessage = errorMessage;
      }

      if (status === JobStatus.RUNNING) {
        updateData.startedAt = new Date();
      } else if (status === JobStatus.COMPLETED) {
        updateData.completedAt = new Date();
        updateData.progress = 100;
      } else if (status === JobStatus.FAILED) {
        updateData.failedAt = new Date();
      }
      
      await this.repository.update(id, updateData);
      return await this.findById(id);
    } catch (error) {
      this.logger.error('Failed to update job status', { error, id, status, errorMessage });
      throw error;
    }
  }

  async updateProgress(id: string, progress: number): Promise<Job | null> {
    try {
      await this.repository.update(id, { progress });
      return await this.findById(id);
    } catch (error) {
      this.logger.error('Failed to update job progress', { error, id, progress });
      throw error;
    }
  }

  async incrementAttempts(id: string): Promise<Job | null> {
    try {
      await this.repository
        .createQueryBuilder()
        .update(Job)
        .set({ attempts: () => 'attempts + 1' })
        .where('id = :id', { id })
        .execute();
      
      return await this.findById(id);
    } catch (error) {
      this.logger.error('Failed to increment job attempts', { error, id });
      throw error;
    }
  }

  async createTranscriptionJob(videoId: string, priority: JobPriority = JobPriority.NORMAL): Promise<Job> {
    try {
      const jobData = {
        videoId,
        type: JobType.TRANSCRIPTION,
        status: JobStatus.PENDING,
        priority,
        data: JSON.stringify({ videoId })
      };

      return await this.create(jobData);
    } catch (error) {
      this.logger.error('Failed to create transcription job', { error, videoId, priority });
      throw error;
    }
  }

  async createNotionSyncJob(videoId: string, transcriptId?: string): Promise<Job> {
    try {
      const jobData = {
        videoId,
        type: JobType.NOTION_SYNC,
        status: JobStatus.PENDING,
        priority: JobPriority.NORMAL,
        data: JSON.stringify({ videoId, transcriptId })
      };

      return await this.create(jobData);
    } catch (error) {
      this.logger.error('Failed to create Notion sync job', { error, videoId, transcriptId });
      throw error;
    }
  }

  async createCleanupJob(videoId?: string): Promise<Job> {
    try {
      const jobData = {
        videoId,
        type: JobType.CLEANUP,
        status: JobStatus.PENDING,
        priority: JobPriority.LOW,
        data: JSON.stringify({ videoId })
      };

      return await this.create(jobData);
    } catch (error) {
      this.logger.error('Failed to create cleanup job', { error, videoId });
      throw error;
    }
  }

  async getQueueStats(): Promise<{ pending: number; running: number; completed: number; failed: number }> {
    try {
      const [pending, running, completed, failed] = await Promise.all([
        this.repository.count({ where: { status: JobStatus.PENDING } }),
        this.repository.count({ where: { status: JobStatus.RUNNING } }),
        this.repository.count({ where: { status: JobStatus.COMPLETED } }),
        this.repository.count({ where: { status: JobStatus.FAILED } })
      ]);

      return { pending, running, completed, failed };
    } catch (error) {
      this.logger.error('Failed to get queue stats', { error });
      throw error;
    }
  }

  async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.repository
        .createQueryBuilder()
        .delete()
        .from(Job)
        .where('status IN (:...statuses)', { statuses: [JobStatus.COMPLETED, JobStatus.FAILED] })
        .andWhere('createdAt < :cutoffDate', { cutoffDate })
        .execute();

      return result.affected || 0;
    } catch (error) {
      this.logger.error('Failed to cleanup old jobs', { error, daysOld });
      throw error;
    }
  }
}