import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { uploadSingle, handleMulterError } from '../middleware/uploadMiddleware';
import FileStorageService from '../services/FileStorageService';
import DatabaseService from '../database/DatabaseService';
import { VideoStatus } from '../database/entities/Video';

const router = Router();
const logger = createLogger('upload');

// Upload endpoint
router.post(
  '/',
  uploadSingle,
  handleMulterError,
  asyncHandler(async (req: Request, res: Response) => {
    // Check if file was uploaded
    if (!req.file) {
      throw createError('No file uploaded. Please select a video file.', 400);
    }

    const file = req.file;
    logger.info('Processing file upload', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    try {
      // Get services
      const fileService = FileStorageService.getInstance();
      const dbService = DatabaseService.getInstance();

      // Validate file size
      if (!fileService.validateFileSize(file.size)) {
        throw createError('File size exceeds maximum allowed size', 400);
      }

      // Save file and get metadata
      const fileMetadata = await fileService.saveFile(file.buffer, {
        originalName: file.originalname
      });

      // Create database record
      const videoRecord = await dbService.videoRepository.create({
        id: fileMetadata.id,
        filename: fileMetadata.filename,
        originalName: fileMetadata.originalName,
        size: fileMetadata.size,
        mimeType: fileMetadata.mimeType,
        uploadPath: fileMetadata.uploadPath,
        duration: fileMetadata.duration,
        status: VideoStatus.UPLOADED
      });

      logger.info('File uploaded successfully', {
        id: videoRecord.id,
        filename: videoRecord.filename,
        originalName: videoRecord.originalName,
        size: videoRecord.size
      });

      // Return success response
      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          id: videoRecord.id,
          filename: videoRecord.filename,
          originalName: videoRecord.originalName,
          size: videoRecord.size,
          mimeType: videoRecord.mimeType,
          duration: videoRecord.duration,
          status: videoRecord.status,
          uploadedAt: videoRecord.createdAt
        }
      });

    } catch (error) {
      // Cleanup file if database operation failed
      if (req.file) {
        try {
          const fileService = FileStorageService.getInstance();
          const { filename } = fileService.generateUniqueFilename(req.file.originalname);
          await fileService.deleteFile(filename);
        } catch (cleanupError) {
          logger.error('Failed to cleanup file after error', { 
            error: cleanupError,
            originalname: req.file.originalname 
          });
        }
      }

      logger.error('File upload failed', {
        error,
        originalname: file.originalname,
        size: file.size
      });

      throw error;
    }
  })
);

// Get upload status endpoint
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw createError('Video ID is required', 400);
    }

    const dbService = DatabaseService.getInstance();
    const video = await dbService.videoRepository.findById(id);

    if (!video) {
      throw createError('Video not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: video.id,
        filename: video.filename,
        originalName: video.originalName,
        size: video.size,
        mimeType: video.mimeType,
        duration: video.duration,
        status: video.status,
        uploadedAt: video.createdAt,
        updatedAt: video.updatedAt,
        errorMessage: video.errorMessage
      }
    });
  })
);

// List recent uploads endpoint
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    const dbService = DatabaseService.getInstance();
    
    // Get recent uploads with pagination
    const videos = await dbService.videoRepository.findAll({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset
    });

    const total = await dbService.videoRepository.count();

    res.json({
      success: true,
      data: {
        videos: videos.map(video => ({
          id: video.id,
          filename: video.filename,
          originalName: video.originalName,
          size: video.size,
          mimeType: video.mimeType,
          duration: video.duration,
          status: video.status,
          uploadedAt: video.createdAt,
          updatedAt: video.updatedAt
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

// Delete upload endpoint
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw createError('Video ID is required', 400);
    }

    const dbService = DatabaseService.getInstance();
    const fileService = FileStorageService.getInstance();

    // Find the video record
    const video = await dbService.videoRepository.findById(id);
    if (!video) {
      throw createError('Video not found', 404);
    }

    try {
      // Delete file from storage
      await fileService.deleteFile(video.filename);
      
      // Delete database record
      await dbService.videoRepository.delete(id);

      logger.info('Video deleted successfully', {
        id: video.id,
        filename: video.filename,
        originalName: video.originalName
      });

      res.json({
        success: true,
        message: 'Video deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete video', {
        error,
        id,
        filename: video.filename
      });
      throw error;
    }
  })
);

export default router;