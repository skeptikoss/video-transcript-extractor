import multer from 'multer';
import { Request } from 'express';
import { createLogger } from '../utils/logger';
import { createError } from './errorHandler';

const logger = createLogger('uploadMiddleware');

// Configure multer for memory storage (we'll handle file saving manually)
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file extension
  const allowedExtensions = ['.mp4', '.mov', '.avi', '.webm'];
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    logger.warn('File rejected: invalid extension', {
      originalname: file.originalname,
      extension: fileExtension
    });
    
    return cb(createError('Only MP4, MOV, AVI, and WebM video files are allowed', 400));
  }

  // Check mimetype (additional validation)
  const allowedMimeTypes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'application/octet-stream' // Sometimes files come with this mimetype
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    logger.warn('File rejected: invalid mimetype', {
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    
    return cb(createError('Invalid file type. Only video files are allowed.', 400));
  }

  logger.info('File accepted for upload', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: req.get('content-length')
  });

  cb(null, true);
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '100000000', 10), // Default 100MB
    files: 1, // Only allow one file at a time
    fields: 10, // Limit number of fields
    fieldNameSize: 100, // Limit field name size
    fieldSize: 1024 * 1024 // 1MB limit for field values
  }
});

// Error handling middleware for multer
export const handleMulterError = (error: any, _req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    logger.error('Multer error occurred', { error: error.message, code: error.code });
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 100MB.',
          code: 'FILE_TOO_LARGE'
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files. Only one file is allowed.',
          code: 'TOO_MANY_FILES'
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'Unexpected file field.',
          code: 'UNEXPECTED_FILE'
        });
      
      default:
        return res.status(400).json({
          success: false,
          error: 'File upload error.',
          code: 'UPLOAD_ERROR'
        });
    }
  }
  
  next(error);
};

// Export configured upload middleware
export const uploadSingle = upload.single('video');

export default upload;