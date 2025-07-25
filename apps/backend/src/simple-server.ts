import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3000;

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Detailed health check
app.get('/api/health/detailed', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: true, // Simplified for now
      stats: {
        videos: 0,
        transcripts: 0,
        jobs: 0
      }
    },
    storage: {
      available: true,
      uploadsDirectory: uploadDir
    }
  });
});

// Upload endpoint
app.post('/api/upload', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const fileInfo = {
      id: `upload_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadPath: req.file.path,
      status: 'uploaded',
      createdAt: new Date().toISOString()
    };

    console.log('File uploaded:', fileInfo);

    res.json({
      success: true,
      data: fileInfo
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed'
    });
  }
});

// Get uploads (simplified)
app.get('/api/upload', (req, res) => {
  res.json({
    success: true,
    data: {
      uploads: [],
      total: 0,
      page: 1,
      limit: 10
    }
  });
});

// Get single upload
app.get('/api/upload/:id', (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.params.id,
      status: 'uploaded'
    }
  });
});

// Delete upload
app.delete('/api/upload/:id', (req, res) => {
  res.json({
    success: true
  });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Simple backend server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🚀 Ready for testing!`);
});