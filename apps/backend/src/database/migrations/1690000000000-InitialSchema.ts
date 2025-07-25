import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1690000000000 implements MigrationInterface {
  name = 'InitialSchema1690000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create videos table
    await queryRunner.query(`
      CREATE TABLE "videos" (
        "id" varchar PRIMARY KEY NOT NULL,
        "filename" varchar(255) NOT NULL,
        "originalName" varchar(255) NOT NULL,
        "size" bigint NOT NULL,
        "duration" real,
        "mimeType" varchar(100) NOT NULL,
        "uploadPath" varchar(500) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT ('uploaded'),
        "errorMessage" text,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create transcripts table
    await queryRunner.query(`
      CREATE TABLE "transcripts" (
        "id" varchar PRIMARY KEY NOT NULL,
        "videoId" varchar NOT NULL,
        "content" text NOT NULL,
        "confidence" real,
        "language" varchar(10),
        "status" varchar(20) NOT NULL DEFAULT ('pending'),
        "segments" text,
        "wordCount" integer,
        "errorMessage" text,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_transcripts_video" FOREIGN KEY ("videoId") REFERENCES "videos" ("id") ON DELETE CASCADE
      )
    `);

    // Create jobs table  
    await queryRunner.query(`
      CREATE TABLE "jobs" (
        "id" varchar PRIMARY KEY NOT NULL,
        "videoId" varchar,
        "type" varchar(50) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT ('pending'),
        "priority" varchar(10) NOT NULL DEFAULT ('normal'),
        "progress" integer NOT NULL DEFAULT (0),
        "data" text,
        "result" text,
        "errorMessage" text,
        "attempts" integer NOT NULL DEFAULT (0),
        "maxAttempts" integer NOT NULL DEFAULT (3),
        "startedAt" datetime,
        "completedAt" datetime,
        "failedAt" datetime,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_jobs_video" FOREIGN KEY ("videoId") REFERENCES "videos" ("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await queryRunner.query(`CREATE INDEX "IDX_videos_status" ON "videos" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_videos_created_at" ON "videos" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_transcripts_video_id" ON "transcripts" ("videoId")`);
    await queryRunner.query(`CREATE INDEX "IDX_transcripts_status" ON "transcripts" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_video_id" ON "jobs" ("videoId")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_status" ON "jobs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_type" ON "jobs" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_priority" ON "jobs" ("priority")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_created_at" ON "jobs" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_jobs_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_jobs_priority"`);
    await queryRunner.query(`DROP INDEX "IDX_jobs_type"`);
    await queryRunner.query(`DROP INDEX "IDX_jobs_status"`);
    await queryRunner.query(`DROP INDEX "IDX_jobs_video_id"`);
    await queryRunner.query(`DROP INDEX "IDX_transcripts_status"`);
    await queryRunner.query(`DROP INDEX "IDX_transcripts_video_id"`);
    await queryRunner.query(`DROP INDEX "IDX_videos_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_videos_status"`);

    // Drop tables (in reverse order due to foreign keys)
    await queryRunner.query(`DROP TABLE "jobs"`);
    await queryRunner.query(`DROP TABLE "transcripts"`);
    await queryRunner.query(`DROP TABLE "videos"`);
  }
}