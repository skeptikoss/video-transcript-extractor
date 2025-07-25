import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import ffmpegStatic from 'ffmpeg-static';
import { logger } from '../utils/logger';

export interface AudioExtractionOptions {
  outputFormat?: 'mp3' | 'wav' | 'flac';
  sampleRate?: number;
  channels?: number;
  bitRate?: string;
  maxDuration?: number; // in seconds
}

export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  bitRate: string;
  format: string;
  size: number;
}

export class AudioExtractorService {
  private static instance: AudioExtractorService;
  private readonly tempDir: string;
  private readonly ffmpegPath: string;

  private constructor() {
    this.tempDir = process.env.TEMP_AUDIO_DIR || join(process.cwd(), 'temp', 'audio');
    this.ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
    this.ensureTempDirectory();
  }

  public static getInstance(): AudioExtractorService {
    if (!AudioExtractorService.instance) {
      AudioExtractorService.instance = new AudioExtractorService();
    }
    return AudioExtractorService.instance;
  }

  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info(`Audio temp directory ensured: ${this.tempDir}`);
    } catch (error) {
      logger.error('Failed to create temp directory:', error);
      throw error;
    }
  }

  public async extractAudio(
    videoPath: string,
    options: AudioExtractionOptions = {}
  ): Promise<{ audioPath: string; metadata: AudioMetadata }> {
    const startTime = Date.now();
    
    try {
      // Validate input file exists
      await fs.access(videoPath);
      
      const {
        outputFormat = 'mp3',
        sampleRate = 16000, // Optimal for Whisper
        channels = 1, // Mono for better transcription
        bitRate = '64k',
        maxDuration,
      } = options;

      // Generate output path
      const videoBaseName = basename(videoPath, extname(videoPath));
      const outputFileName = `${videoBaseName}_${Date.now()}.${outputFormat}`;
      const audioPath = join(this.tempDir, outputFileName);

      logger.info(`Starting audio extraction: ${videoPath} -> ${audioPath}`);

      // Build FFmpeg command
      const ffmpegArgs = this.buildFFmpegArgs(
        videoPath,
        audioPath,
        { outputFormat, sampleRate, channels, bitRate, maxDuration }
      );

      // Execute FFmpeg
      await this.runFFmpeg(ffmpegArgs);

      // Get audio metadata
      const metadata = await this.getAudioMetadata(audioPath);

      const duration = Date.now() - startTime;
      logger.info(`Audio extraction completed in ${duration}ms`, {
        videoPath,
        audioPath,
        metadata,
      });

      return { audioPath, metadata };
    } catch (error) {
      logger.error('Audio extraction failed:', error);
      throw new Error(`Failed to extract audio: ${error.message}`);
    }
  }

  private buildFFmpegArgs(
    inputPath: string,
    outputPath: string,
    options: Required<AudioExtractionOptions>
  ): string[] {
    const args = [
      '-i', inputPath,
      '-vn', // No video
      '-acodec', this.getAudioCodec(options.outputFormat),
      '-ar', options.sampleRate.toString(),
      '-ac', options.channels.toString(),
      '-b:a', options.bitRate,
      '-f', options.outputFormat,
    ];

    // Add duration limit if specified
    if (options.maxDuration) {
      args.push('-t', options.maxDuration.toString());
    }

    // Optimization flags
    args.push(
      '-movflags', 'faststart', // Optimize for streaming
      '-threads', '0', // Use all available threads
      '-y' // Overwrite output file
    );

    args.push(outputPath);

    return args;
  }

  private getAudioCodec(format: string): string {
    switch (format) {
      case 'mp3':
        return 'libmp3lame';
      case 'wav':
        return 'pcm_s16le';
      case 'flac':
        return 'flac';
      default:
        return 'libmp3lame';
    }
  }

  private async runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug(`Running FFmpeg: ${this.ffmpegPath} ${args.join(' ')}`);

      const ffmpeg: ChildProcess = spawn(this.ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stderr = '';

      ffmpeg.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          logger.error(`FFmpeg process exited with code ${code}`, { stderr });
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        logger.error('FFmpeg process error:', error);
        reject(error);
      });

      // Set timeout for long-running processes
      const timeout = setTimeout(() => {
        ffmpeg.kill('SIGKILL');
        reject(new Error('FFmpeg process timed out'));
      }, 10 * 60 * 1000); // 10 minutes timeout

      ffmpeg.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  private async getAudioMetadata(audioPath: string): Promise<AudioMetadata> {
    try {
      const stats = await fs.stat(audioPath);
      
      // Use ffprobe to get detailed metadata
      const metadata = await this.runFFprobe(audioPath);
      
      return {
        duration: metadata.duration || 0,
        sampleRate: metadata.sampleRate || 0,
        channels: metadata.channels || 1,
        bitRate: metadata.bitRate || '0k',
        format: metadata.format || 'unknown',
        size: stats.size,
      };
    } catch (error) {
      logger.error('Failed to get audio metadata:', error);
      
      // Return basic metadata from file stats
      const stats = await fs.stat(audioPath);
      return {
        duration: 0,
        sampleRate: 0,
        channels: 1,
        bitRate: '0k',
        format: 'unknown',
        size: stats.size,
      };
    }
  }

  private async runFFprobe(audioPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        audioPath
      ]);

      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const data = JSON.parse(stdout);
            const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio');
            
            resolve({
              duration: parseFloat(data.format?.duration || '0'),
              sampleRate: parseInt(audioStream?.sample_rate || '0'),
              channels: parseInt(audioStream?.channels || '1'),
              bitRate: audioStream?.bit_rate ? `${Math.round(audioStream.bit_rate / 1000)}k` : '0k',
              format: data.format?.format_name || 'unknown',
            });
          } catch (parseError) {
            reject(new Error(`Failed to parse ffprobe output: ${parseError.message}`));
          }
        } else {
          reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
        }
      });

      ffprobe.on('error', (error) => {
        reject(error);
      });
    });
  }

  public async cleanupAudioFile(audioPath: string): Promise<void> {
    try {
      await fs.unlink(audioPath);
      logger.info(`Cleaned up audio file: ${audioPath}`);
    } catch (error) {
      logger.error(`Failed to cleanup audio file ${audioPath}:`, error);
    }
  }

  public async cleanupOldFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await this.cleanupAudioFile(filePath);
        }
      }

      logger.info(`Cleaned up old audio files older than ${maxAgeMs}ms`);
    } catch (error) {
      logger.error('Failed to cleanup old audio files:', error);
    }
  }

  public async validateAudioFile(audioPath: string): Promise<boolean> {
    try {
      const metadata = await this.getAudioMetadata(audioPath);
      return metadata.size > 0 && metadata.duration > 0;
    } catch (error) {
      logger.error(`Audio file validation failed for ${audioPath}:`, error);
      return false;
    }
  }

  public getTempDirectory(): string {
    return this.tempDir;
  }
}

export const audioExtractorService = AudioExtractorService.getInstance();