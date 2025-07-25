import { BaseRepository } from './BaseRepository';
import { Video, VideoStatus } from '../entities/Video';
import AppDataSource from '../config';

export class VideoRepository extends BaseRepository<Video> {
  constructor() {
    super(AppDataSource.getRepository(Video));
  }

  static getInstance(): VideoRepository {
    return new VideoRepository();
  }

  async findByFilename(filename: string): Promise<Video | null> {
    try {
      return await this.repository.findOne({
        where: { filename }
      });
    } catch (error) {
      this.logger.error('Failed to find video by filename', { error, filename });
      throw error;
    }
  }

  async findByStatus(status: VideoStatus): Promise<Video[]> {
    try {
      return await this.repository.find({
        where: { status },
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error('Failed to find videos by status', { error, status });
      throw error;
    }
  }

  async findWithTranscript(id: string): Promise<Video | null> {
    try {
      return await this.repository.findOne({
        where: { id },
        relations: ['transcript']
      });
    } catch (error) {
      this.logger.error('Failed to find video with transcript', { error, id });
      throw error;
    }
  }

  async findWithJobs(id: string): Promise<Video | null> {
    try {
      return await this.repository.findOne({
        where: { id },
        relations: ['jobs']
      });
    } catch (error) {
      this.logger.error('Failed to find video with jobs', { error, id });
      throw error;
    }
  }

  async updateStatus(id: string, status: VideoStatus, errorMessage?: string): Promise<Video | null> {
    try {
      const updateData: any = { status };
      if (errorMessage !== undefined) {
        updateData.errorMessage = errorMessage;
      }
      
      await this.repository.update(id, updateData);
      return await this.findById(id);
    } catch (error) {
      this.logger.error('Failed to update video status', { error, id, status, errorMessage });
      throw error;
    }
  }

  async findRecentUploads(limit: number = 10): Promise<Video[]> {
    try {
      return await this.repository.find({
        order: { createdAt: 'DESC' },
        take: limit
      });
    } catch (error) {
      this.logger.error('Failed to find recent uploads', { error, limit });
      throw error;
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Video[]> {
    try {
      return await this.repository
        .createQueryBuilder('video')
        .where('video.createdAt >= :startDate', { startDate })
        .andWhere('video.createdAt <= :endDate', { endDate })
        .orderBy('video.createdAt', 'DESC')
        .getMany();
    } catch (error) {
      this.logger.error('Failed to find videos by date range', { error, startDate, endDate });
      throw error;
    }
  }

  async getTotalStorageUsed(): Promise<number> {
    try {
      const result = await this.repository
        .createQueryBuilder('video')
        .select('SUM(video.size)', 'totalSize')
        .getRawOne();
      
      return parseInt(result.totalSize || '0', 10);
    } catch (error) {
      this.logger.error('Failed to get total storage used', { error });
      throw error;
    }
  }
}