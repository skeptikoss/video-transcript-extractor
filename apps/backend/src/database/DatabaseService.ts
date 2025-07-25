import { DataSource } from 'typeorm';
import { createLogger } from '../utils/logger';
import AppDataSource from './config';
import { VideoRepository, TranscriptRepository, JobRepository } from './repositories';

export class DatabaseService {
  private static instance: DatabaseService;
  private logger = createLogger('DatabaseService');
  private dataSource: DataSource;
  private isConnected = false;

  // Repository instances
  public videoRepository!: VideoRepository;
  public transcriptRepository!: TranscriptRepository;
  public jobRepository!: JobRepository;

  private constructor() {
    this.dataSource = AppDataSource;
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing database connection...');
      
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
        this.logger.info('Database connection established');
      }

      // Run migrations (skip in development with synchronize enabled)
      if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'development') {
        await this.runMigrations();
      }

      // Initialize repositories
      this.videoRepository = VideoRepository.getInstance();
      this.transcriptRepository = TranscriptRepository.getInstance();
      this.jobRepository = JobRepository.getInstance();

      this.isConnected = true;
      this.logger.info('Database service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database', { error });
      throw error;
    }
  }

  async runMigrations(): Promise<void> {
    try {
      this.logger.info('Running database migrations...');
      await this.dataSource.runMigrations();
      this.logger.info('Database migrations completed');
    } catch (error) {
      this.logger.error('Failed to run migrations', { error });
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
        this.isConnected = false;
        this.logger.info('Database connection closed');
      }
    } catch (error) {
      this.logger.error('Failed to close database connection', { error });
      throw error;
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      database: string;
      migrations: boolean;
      lastCheck: Date;
    };
  }> {
    try {
      const lastCheck = new Date();
      
      // Check connection
      const connected = this.dataSource.isInitialized && this.isConnected;
      
      // Check if we can query the database
      let migrationsStatus = false;
      let database = 'unknown';
      
      if (connected) {
        try {
          // Try a simple query
          await this.dataSource.query('SELECT 1');
          
          // Get database info
          database = this.dataSource.options.database as string;
          
          // Check migrations table exists
          const migrationResult = await this.dataSource.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
          );
          migrationsStatus = migrationResult.length > 0;
        } catch (queryError) {
          this.logger.warn('Database health check query failed', { error: queryError });
        }
      }

      const status = connected && migrationsStatus ? 'healthy' : 'unhealthy';

      return {
        status,
        details: {
          connected,
          database,
          migrations: migrationsStatus,
          lastCheck
        }
      };
    } catch (error) {
      this.logger.error('Database health check failed', { error });
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          database: 'error',
          migrations: false,
          lastCheck: new Date()
        }
      };
    }
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }

  isHealthy(): boolean {
    return this.isConnected && this.dataSource.isInitialized;
  }

  async getStats(): Promise<{
    totalVideos: number;
    totalTranscripts: number;
    pendingJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalStorageUsed: number;
    totalWordCount: number;
  }> {
    try {
      if (!this.isHealthy()) {
        throw new Error('Database not healthy');
      }

      const [
        totalVideos,
        totalTranscripts,
        jobStats,
        totalStorageUsed,
        totalWordCount
      ] = await Promise.all([
        this.videoRepository.count(),
        this.transcriptRepository.count(),
        this.jobRepository.getQueueStats(),
        this.videoRepository.getTotalStorageUsed(),
        this.transcriptRepository.getTotalWordCount()
      ]);

      return {
        totalVideos,
        totalTranscripts,
        pendingJobs: jobStats.pending,
        completedJobs: jobStats.completed,
        failedJobs: jobStats.failed,
        totalStorageUsed,
        totalWordCount
      };
    } catch (error) {
      this.logger.error('Failed to get database stats', { error });
      throw error;
    }
  }

  // Graceful shutdown handler
  async gracefulShutdown(): Promise<void> {
    this.logger.info('Shutting down database service...');
    await this.close();
  }
}

export default DatabaseService;