import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Video } from './Video';

export enum JobType {
  TRANSCRIPTION = 'transcription',
  NOTION_SYNC = 'notion_sync',
  CLEANUP = 'cleanup'
}

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRY = 'retry'
}

export enum JobPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high'
}

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  videoId: string;

  @Column({
    type: 'varchar',
    length: 50
  })
  type: JobType;

  @Column({
    type: 'varchar',
    length: 20,
    default: JobStatus.PENDING
  })
  status: JobStatus;

  @Column({
    type: 'varchar',
    length: 10,
    default: JobPriority.NORMAL
  })
  priority: JobPriority;

  @Column({ type: 'integer', default: 0 })
  progress: number; // Progress percentage (0-100)

  @Column({ type: 'text', nullable: true })
  data: string; // JSON string for job-specific data

  @Column({ type: 'text', nullable: true })
  result: string; // JSON string for job results

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'integer', default: 0 })
  attempts: number; // Number of retry attempts

  @Column({ type: 'integer', default: 3 })
  maxAttempts: number;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  failedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Video, video => video.jobs, { nullable: true })
  @JoinColumn({ name: 'videoId' })
  video: Video;
}