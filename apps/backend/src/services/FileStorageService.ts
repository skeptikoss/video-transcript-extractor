import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import { createLogger } from '../utils/logger';

export interface FileMetadata {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadPath: string;
  duration?: number;
}

export interface VideoInfo {
  duration?: number;
  width?: number;
  height?: number;
  bitrate?: number;
  framerate?: number;
  codec?: string;
}

export class FileStorageService {
  private static instance: FileStorageService;
  private logger = createLogger('FileStorageService');
  private uploadDir: string;

  private constructor() {
    this.uploadDir = process.env.UPLOAD_PATH || path.join(process.cwd(), '../../uploads');
    this.ensureUploadDirectory();
  }

  static getInstance(): FileStorageService {
    if (!FileStorageService.instance) {
      FileStorageService.instance = new FileStorageService();
    }
    return FileStorageService.instance;
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      try {
        await fs.mkdir(this.uploadDir, { recursive: true });
        this.logger.info('Created upload directory', { uploadDir: this.uploadDir });
      } catch (error) {
        this.logger.error('Failed to create upload directory', { error, uploadDir: this.uploadDir });
        throw error;
      }
    }
  }

  async validateFileType(buffer: Buffer): Promise<boolean> {
    try {
      const fileType = await fileTypeFromBuffer(buffer);
      
      if (!fileType) {
        return false;
      }

      // Check for MP4 and related video formats
      const allowedMimeTypes = [
        'video/mp4',
        'video/quicktime', // .mov files
        'video/x-msvideo', // .avi files
        'video/webm'
      ];

      return allowedMimeTypes.includes(fileType.mime);
    } catch (error) {
      this.logger.error('Failed to validate file type', { error });
      return false;
    }
  }

  generateUniqueFilename(originalName: string): { id: string; filename: string } {
    const id = uuidv4();
    const extension = path.extname(originalName).toLowerCase();
    const sanitizedName = path.basename(originalName, extension)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50);
    
    const filename = `${id}_${sanitizedName}${extension}`;
    
    return { id, filename };
  }

  async saveFile(buffer: Buffer, metadata: Partial<FileMetadata>): Promise<FileMetadata> {
    try {
      if (!metadata.originalName) {
        throw new Error('Original filename is required');
      }

      // Generate unique filename
      const { id, filename } = this.generateUniqueFilename(metadata.originalName);
      const uploadPath = path.join(this.uploadDir, filename);

      // Validate file type
      const isValidType = await this.validateFileType(buffer);
      if (!isValidType) {
        throw new Error('Invalid file type. Only MP4 and compatible video formats are allowed.');
      }

      // Get file type info
      const fileType = await fileTypeFromBuffer(buffer);
      const mimeType = fileType?.mime || 'application/octet-stream';

      // Save file to disk
      await fs.writeFile(uploadPath, buffer);

      this.logger.info('File saved successfully', {
        id,
        filename,
        originalName: metadata.originalName,
        size: buffer.length
      });

      // Extract video metadata (duration, etc.)
      const videoInfo = await this.extractVideoMetadata(uploadPath);

      const fileMetadata: FileMetadata = {
        id,
        originalName: metadata.originalName,
        filename,
        size: buffer.length,
        mimeType,
        uploadPath,
        ...videoInfo
      };

      return fileMetadata;
    } catch (error) {
      this.logger.error('Failed to save file', { error, originalName: metadata.originalName });
      throw error;
    }
  }

  private async extractVideoMetadata(filePath: string): Promise<VideoInfo> {
    try {
      // For now, return empty metadata
      // TODO: Implement FFmpeg/FFprobe integration for extracting video metadata
      this.logger.info('Video metadata extraction not yet implemented', { filePath });
      
      return {};
    } catch (error) {
      this.logger.warn('Failed to extract video metadata', { error, filePath });
      return {};
    }
  }

  async deleteFile(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadDir, filename);
      await fs.unlink(filePath);
      
      this.logger.info('File deleted successfully', { filename });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete file', { error, filename });
      return false;
    }
  }

  async fileExists(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadDir, filename);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileInfo(filename: string): Promise<{ size: number; mtime: Date } | null> {
    try {
      const filePath = path.join(this.uploadDir, filename);
      const stats = await fs.stat(filePath);
      
      return {
        size: stats.size,
        mtime: stats.mtime
      };
    } catch (error) {
      this.logger.error('Failed to get file info', { error, filename });
      return null;
    }
  }

  getUploadDirectory(): string {
    return this.uploadDir;
  }

  validateFileSize(size: number): boolean {
    const maxSizeBytes = parseInt(process.env.MAX_FILE_SIZE || '100000000', 10); // Default 100MB
    return size <= maxSizeBytes;
  }

  async cleanup(): Promise<void> {
    // TODO: Implement cleanup of temporary files and old uploads
    this.logger.info('File cleanup not yet implemented');
  }
}

export default FileStorageService;