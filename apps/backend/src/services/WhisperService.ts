import OpenAI from 'openai';
import { createReadStream, promises as fs } from 'fs';
import { logger } from '../utils/logger';

export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments?: TranscriptionSegment[];
  confidence?: number;
}

export interface WhisperOptions {
  model?: 'whisper-1';
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

export class WhisperService {
  private static instance: WhisperService;
  private openai: OpenAI;
  private readonly maxFileSize = 25 * 1024 * 1024; // 25MB limit
  private readonly rateLimitDelay = 334; // ~3 requests per second

  private constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey,
      timeout: 60000, // 60 second timeout
      maxRetries: 3,
    });

    logger.info('WhisperService initialized');
  }

  public static getInstance(): WhisperService {
    if (!WhisperService.instance) {
      WhisperService.instance = new WhisperService();
    }
    return WhisperService.instance;
  }

  public async transcribeAudio(
    audioPath: string,
    options: WhisperOptions = {}
  ): Promise<TranscriptionResult> {
    try {
      logger.info(`Starting transcription for: ${audioPath}`);
      const startTime = Date.now();

      // Check file size
      const stats = await fs.stat(audioPath);
      if (stats.size > this.maxFileSize) {
        throw new Error(`File size ${stats.size} exceeds maximum limit of ${this.maxFileSize} bytes`);
      }

      // Apply rate limiting
      await this.rateLimitDelay();

      // Prepare options with defaults
      const whisperOptions: WhisperOptions = {
        model: 'whisper-1',
        response_format: 'verbose_json',
        temperature: 0.2, // Lower temperature for more consistent results
        ...options,
      };

      // Create file stream
      const audioStream = createReadStream(audioPath);

      // Make API call with retry logic
      const response = await this.retryWithBackoff(
        () => this.openai.audio.transcriptions.create({
          file: audioStream,
          model: whisperOptions.model!,
          language: whisperOptions.language,
          prompt: whisperOptions.prompt,
          response_format: whisperOptions.response_format!,
          temperature: whisperOptions.temperature,
        }),
        3,
        1000
      );

      const duration = Date.now() - startTime;

      // Process response based on format
      let result: TranscriptionResult;
      
      if (whisperOptions.response_format === 'verbose_json') {
        const verboseResponse = response as any;
        result = {
          text: verboseResponse.text || '',
          language: verboseResponse.language || 'unknown',
          duration: verboseResponse.duration || 0,
          segments: verboseResponse.segments || [],
          confidence: this.calculateConfidence(verboseResponse.segments || []),
        };
      } else {
        result = {
          text: typeof response === 'string' ? response : (response as any).text || '',
          language: 'unknown',
          duration: 0,
        };
      }

      logger.info(`Transcription completed in ${duration}ms`, {
        audioPath,
        textLength: result.text.length,
        language: result.language,
        confidence: result.confidence,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      logger.error(`Transcription failed for ${audioPath}:`, error);
      
      // Handle specific OpenAI errors
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.status === 400) {
          throw new Error(`Invalid request: ${error.message}`);
        } else if (error.status === 413) {
          throw new Error('File too large for transcription');
        }
      }

      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        // Don't retry on certain errors
        if (error instanceof OpenAI.APIError) {
          if (error.status === 400 || error.status === 401 || error.status === 413) {
            throw error;
          }
        }

        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`Transcription attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private calculateConfidence(segments: TranscriptionSegment[]): number {
    if (!segments || segments.length === 0) {
      return 0;
    }

    const totalLogProb = segments.reduce((sum, segment) => sum + segment.avg_logprob, 0);
    const averageLogProb = totalLogProb / segments.length;
    
    // Convert log probability to confidence score (0-1)
    // This is a rough approximation - actual confidence calculation may vary
    return Math.max(0, Math.min(1, Math.exp(averageLogProb)));
  }

  private async rateLimitDelay(): Promise<void> {
    await this.sleep(this.rateLimitDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async getModelInfo(): Promise<any> {
    try {
      // Note: OpenAI doesn't have a specific endpoint for model info
      // This is a placeholder for any model-specific configuration
      return {
        model: 'whisper-1',
        maxFileSize: this.maxFileSize,
        supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'wav', 'webm'],
        supportedLanguages: [
          'af', 'ar', 'hy', 'az', 'be', 'bs', 'bg', 'ca', 'zh', 'hr', 'cs', 'da', 'nl',
          'en', 'et', 'fi', 'fr', 'gl', 'de', 'el', 'he', 'hi', 'hu', 'is', 'id', 'it',
          'ja', 'kn', 'kk', 'ko', 'lv', 'lt', 'mk', 'ms', 'mr', 'mi', 'ne', 'no', 'fa',
          'pl', 'pt', 'ro', 'ru', 'sr', 'sk', 'sl', 'es', 'sw', 'sv', 'tl', 'ta', 'th',
          'tr', 'uk', 'ur', 'vi', 'cy'
        ]
      };
    } catch (error) {
      logger.error('Failed to get model info:', error);
      throw error;
    }
  }

  public async validateApiKey(): Promise<boolean> {
    try {
      // Try a simple API call to validate the key
      await this.openai.models.list();
      return true;
    } catch (error) {
      logger.error('API key validation failed:', error);
      return false;
    }
  }

  public formatTranscriptionForDisplay(result: TranscriptionResult): string {
    if (!result.segments || result.segments.length === 0) {
      return result.text;
    }

    return result.segments
      .map(segment => {
        const startTime = this.formatTime(segment.start);
        const endTime = this.formatTime(segment.end);
        return `[${startTime} - ${endTime}] ${segment.text}`;
      })
      .join('\n');
  }

  public formatTranscriptionAsSRT(result: TranscriptionResult): string {
    if (!result.segments || result.segments.length === 0) {
      return `1\n00:00:00,000 --> 00:00:30,000\n${result.text}\n`;
    }

    return result.segments
      .map((segment, index) => {
        const startTime = this.formatTimeForSRT(segment.start);
        const endTime = this.formatTimeForSRT(segment.end);
        return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
      })
      .join('\n');
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private formatTimeForSRT(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
}

export const whisperService = WhisperService.getInstance();