import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn
} from 'typeorm';
import { Video } from './Video';

export enum TranscriptStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',  
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Entity('transcripts')
export class Transcript {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  videoId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'float', nullable: true })
  confidence: number; // Average confidence score from Whisper

  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string; // Detected language code (e.g., 'en', 'es')

  @Column({
    type: 'varchar',
    length: 20,
    default: TranscriptStatus.PENDING
  })
  status: TranscriptStatus;

  @Column({ type: 'text', nullable: true })
  segments: string; // JSON string of timestamped segments

  @Column({ type: 'integer', nullable: true })
  wordCount: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToOne(() => Video, video => video.transcript)
  @JoinColumn({ name: 'videoId' })
  video: Video;
}