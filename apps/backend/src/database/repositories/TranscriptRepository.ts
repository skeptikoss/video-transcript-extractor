import { BaseRepository } from './BaseRepository';
import { Transcript, TranscriptStatus } from '../entities/Transcript';
import AppDataSource from '../config';

export class TranscriptRepository extends BaseRepository<Transcript> {
  constructor() {
    super(AppDataSource.getRepository(Transcript));
  }

  static getInstance(): TranscriptRepository {
    return new TranscriptRepository();
  }

  async findByVideoId(videoId: string): Promise<Transcript | null> {
    try {
      return await this.repository.findOne({
        where: { videoId }
      });
    } catch (error) {
      this.logger.error('Failed to find transcript by video ID', { error, videoId });
      throw error;
    }
  }

  async findByStatus(status: TranscriptStatus): Promise<Transcript[]> {
    try {
      return await this.repository.find({
        where: { status },
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error('Failed to find transcripts by status', { error, status });
      throw error;
    }
  }

  async findWithVideo(id: string): Promise<Transcript | null> {
    try {
      return await this.repository.findOne({
        where: { id },
        relations: ['video']
      });
    } catch (error) {
      this.logger.error('Failed to find transcript with video', { error, id });
      throw error;
    }
  }

  async updateStatus(id: string, status: TranscriptStatus, errorMessage?: string): Promise<Transcript | null> {
    try {
      const updateData: any = { status };
      if (errorMessage !== undefined) {
        updateData.errorMessage = errorMessage;
      }
      
      await this.repository.update(id, updateData);
      return await this.findById(id);
    } catch (error) {
      this.logger.error('Failed to update transcript status', { error, id, status, errorMessage });
      throw error;
    }
  }

  async updateContent(id: string, content: string, confidence?: number, language?: string, segments?: any): Promise<Transcript | null> {
    try {
      const updateData: any = { 
        content,
        wordCount: content.split(/\s+/).length,
        status: TranscriptStatus.COMPLETED
      };
      
      if (confidence !== undefined) {
        updateData.confidence = confidence;
      }
      
      if (language !== undefined) {
        updateData.language = language;
      }
      
      if (segments !== undefined) {
        updateData.segments = JSON.stringify(segments);
      }
      
      await this.repository.update(id, updateData);
      return await this.findById(id);
    } catch (error) {
      this.logger.error('Failed to update transcript content', { error, id, content: content.substring(0, 100) });
      throw error;
    }
  }

  async searchContent(searchTerm: string, limit: number = 20): Promise<Transcript[]> {
    try {
      return await this.repository
        .createQueryBuilder('transcript')
        .where('transcript.content LIKE :searchTerm', { searchTerm: `%${searchTerm}%` })
        .andWhere('transcript.status = :status', { status: TranscriptStatus.COMPLETED })
        .orderBy('transcript.createdAt', 'DESC')
        .take(limit)
        .getMany();
    } catch (error) {
      this.logger.error('Failed to search transcript content', { error, searchTerm, limit });
      throw error;
    }
  }

  async findByLanguage(language: string): Promise<Transcript[]> {
    try {
      return await this.repository.find({
        where: { 
          language,
          status: TranscriptStatus.COMPLETED
        },
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error('Failed to find transcripts by language', { error, language });
      throw error;
    }
  }

  async getCompletedTranscripts(limit?: number): Promise<Transcript[]> {
    try {
      const query = this.repository.find({
        where: { status: TranscriptStatus.COMPLETED },
        order: { createdAt: 'DESC' },
        relations: ['video']
      });

      if (limit) {
        return await this.repository.find({
          where: { status: TranscriptStatus.COMPLETED },
          order: { createdAt: 'DESC' },
          relations: ['video'],
          take: limit
        });
      }

      return await query;
    } catch (error) {
      this.logger.error('Failed to get completed transcripts', { error, limit });
      throw error;
    }
  }

  async getTotalWordCount(): Promise<number> {
    try {
      const result = await this.repository
        .createQueryBuilder('transcript')
        .select('SUM(transcript.wordCount)', 'totalWords')
        .where('transcript.status = :status', { status: TranscriptStatus.COMPLETED })
        .getRawOne();
      
      return parseInt(result.totalWords || '0', 10);
    } catch (error) {
      this.logger.error('Failed to get total word count', { error });
      throw error;
    }
  }
}