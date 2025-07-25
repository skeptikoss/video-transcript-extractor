require('dotenv').config({ path: '../../.env' });

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

// Job storage (in-memory for now)
const jobs = new Map();
const videos = new Map();

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir('./uploads', { recursive: true });
  await fs.mkdir('./temp/audio', { recursive: true });
}

// Extract audio from video
async function extractAudio(videoPath) {
  const audioId = uuidv4();
  const audioPath = path.join('./temp/audio', `${audioId}.mp3`);
  
  return new Promise((resolve, reject) => {
    console.log(`Extracting audio: ${videoPath} -> ${audioPath}`);
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '64k',
      '-y',
      audioPath
    ]);

    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`Audio extraction completed: ${audioPath}`);
        resolve(audioPath);
      } else {
        console.error(`FFmpeg failed with code ${code}: ${stderr}`);
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('FFmpeg process error:', error);
      reject(error);
    });
  });
}

// Transcribe audio
async function transcribeAudio(audioPath) {
  try {
    console.log(`Starting transcription: ${audioPath}`);
    
    const audioStream = require('fs').createReadStream(audioPath);
    
    const response = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      response_format: 'verbose_json',
      temperature: 0.2
    });

    console.log(`Transcription completed for: ${audioPath}`);
    return response;
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

// Process transcription job
async function processTranscriptionJob(jobId, videoId, videoPath, originalName) {
  const job = jobs.get(jobId);
  const video = videos.get(videoId);
  
  if (!job || !video) {
    console.error(`Job or video not found: ${jobId}, ${videoId}`);
    return;
  }

  let audioPath = null;

  try {
    // Update job status
    job.status = 'processing';
    job.progress = 10;
    job.stage = 'audio_extraction';
    job.message = 'Extracting audio from video...';
    job.startedAt = new Date().toISOString();

    // Extract audio
    audioPath = await extractAudio(videoPath);
    
    job.progress = 40;
    job.stage = 'transcription';
    job.message = 'Starting transcription with Whisper API...';

    // Transcribe audio
    const transcription = await transcribeAudio(audioPath);
    
    job.progress = 90;
    job.stage = 'storage';
    job.message = 'Saving transcript...';

    // Save transcript
    const transcript = {
      id: uuidv4(),
      videoId: videoId,
      content: transcription.text,
      language: transcription.language || 'unknown',
      duration: transcription.duration || 0,
      segments: transcription.segments || [],
      confidence: transcription.segments ? 
        transcription.segments.reduce((sum, seg) => sum + Math.exp(seg.avg_logprob), 0) / transcription.segments.length 
        : 0,
      createdAt: new Date().toISOString()
    };

    // Update job and video status
    job.status = 'completed';
    job.progress = 100;
    job.stage = 'completed';
    job.message = 'Transcription completed successfully';
    job.completedAt = new Date().toISOString();
    job.transcript = transcript;

    video.status = 'completed';
    video.transcript = transcript;

    console.log(`Transcription job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`Transcription job ${jobId} failed:`, error);
    
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = new Date().toISOString();
    
    video.status = 'failed';
    video.errorMessage = error.message;
  } finally {
    // Cleanup audio file
    if (audioPath) {
      try {
        await fs.unlink(audioPath);
        console.log(`Cleaned up audio file: ${audioPath}`);
      } catch (cleanupError) {
        console.error(`Failed to cleanup audio file: ${cleanupError.message}`);
      }
    }
  }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Video Transcription API is running',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

// Detailed health check
app.get('/api/health/detailed', async (req, res) => {
  try {
    const stats = await fs.stat('./uploads');
    
    res.json({
      success: true,
      data: {
        server: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        },
        storage: {
          uploadsDirectory: './uploads',
          exists: true,
          writable: true
        },
        queue: {
          totalJobs: jobs.size,
          activeJobs: Array.from(jobs.values()).filter(job => job.status === 'processing').length,
          completedJobs: Array.from(jobs.values()).filter(job => job.status === 'completed').length,
          failedJobs: Array.from(jobs.values()).filter(job => job.status === 'failed').length
        },
        services: {
          openai: !!process.env.OPENAI_API_KEY,
          ffmpeg: true // We'll assume it's available since server started
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upload video and start transcription
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded'
      });
    }

    console.log('Processing upload:', req.file.originalname);

    // Save video file
    const videoId = uuidv4();
    const videoPath = path.join('./uploads', `${videoId}.mp4`);
    await fs.writeFile(videoPath, req.file.buffer);

    // Create video record
    const video = {
      id: videoId,
      filename: `${videoId}.mp4`,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadPath: videoPath,
      status: 'uploaded',
      createdAt: new Date().toISOString()
    };
    videos.set(videoId, video);

    // Create transcription job
    const jobId = uuidv4();
    const job = {
      id: jobId,
      videoId: videoId,
      type: 'transcription',
      status: 'pending',
      progress: 0,
      priority: 0,
      createdAt: new Date().toISOString()
    };
    jobs.set(jobId, job);

    console.log(`Video uploaded and job created: ${videoId} -> ${jobId}`);

    // Start transcription in background
    setTimeout(() => {
      processTranscriptionJob(jobId, videoId, videoPath, req.file.originalname);
    }, 1000);

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully and queued for transcription',
      data: {
        id: videoId,
        filename: video.filename,
        originalName: video.originalName,
        size: video.size,
        mimeType: video.mimeType,
        status: video.status,
        uploadedAt: video.createdAt,
        jobId: jobId
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get upload status
app.get('/api/upload/:id', (req, res) => {
  const { id } = req.params;
  const video = videos.get(id);
  
  if (!video) {
    return res.status(404).json({
      success: false,
      error: 'Video not found'
    });
  }

  res.json({
    success: true,
    data: video
  });
});

// Get transcription status
app.get('/api/transcription/video/:videoId', (req, res) => {
  const { videoId } = req.params;
  const video = videos.get(videoId);
  
  if (!video) {
    return res.status(404).json({
      success: false,
      error: 'Video not found'
    });
  }

  // Find the job for this video
  const job = Array.from(jobs.values()).find(j => j.videoId === videoId);

  res.json({
    success: true,
    data: {
      video: video,
      job: job || null,
      transcript: video.transcript || null
    }
  });
});

// Get job status
app.get('/api/transcription/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  res.json({
    success: true,
    data: {
      id: job.id,
      videoId: job.videoId,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      message: job.message,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      transcript: job.transcript
    }
  });
});

// List recent uploads
app.get('/api/upload', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  
  const allVideos = Array.from(videos.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedVideos = allVideos.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: {
      videos: paginatedVideos,
      pagination: {
        page,
        limit,
        total: allVideos.length,
        pages: Math.ceil(allVideos.length / limit)
      }
    }
  });
});

// Start server
async function startServer() {
  try {
    await ensureDirectories();
    
    app.listen(PORT, () => {
      console.log(`🚀 Video Transcription Server running on http://localhost:${PORT}`);
      console.log(`📁 Upload directory: ${path.resolve('./uploads')}`);
      console.log(`🔗 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`✅ OpenAI API key: ${process.env.OPENAI_API_KEY ? 'configured' : 'missing'}`);
      console.log('');
      console.log('📋 Available endpoints:');
      console.log('  GET  /api/health');
      console.log('  GET  /api/health/detailed');
      console.log('  POST /api/upload');
      console.log('  GET  /api/upload');
      console.log('  GET  /api/upload/:id');
      console.log('  GET  /api/transcription/video/:videoId');
      console.log('  GET  /api/transcription/job/:jobId');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();