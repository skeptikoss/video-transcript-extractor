import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne
} from 'typeorm';
import { Transcript } from './Transcript';
import { Job } from './Job';

export enum VideoStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({ type: 'float', nullable: true })
  duration: number; // Duration in seconds

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'varchar', length: 500 })
  uploadPath: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: VideoStatus.UPLOADED
  })
  status: VideoStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToOne(() => Transcript, transcript => transcript.video)
  transcript: Transcript;

  @OneToMany(() => Job, job => job.video)
  jobs: Job[];
}