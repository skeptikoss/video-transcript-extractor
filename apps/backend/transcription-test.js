require('dotenv').config({ path: '../../.env' });
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
const cors = require('cors');

const app = express();
const PORT = 3000;

// CORS configuration
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Multer configuration for file uploads
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

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir('./uploads', { recursive: true });
  await fs.mkdir('./temp/audio', { recursive: true });
}

// Extract audio from video using FFmpeg
async function extractAudio(videoPath) {
  const audioId = uuidv4();
  const audioPath = path.join('./temp/audio', `${audioId}.mp3`);
  
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vn', // No video
      '-acodec', 'libmp3lame',
      '-ar', '16000', // Sample rate optimal for Whisper
      '-ac', '1', // Mono
      '-b:a', '64k',
      '-y', // Overwrite output file
      audioPath
    ]);

    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(audioPath);
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
}

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(audioPath) {
  try {
    const audioStream = require('fs').createReadStream(audioPath);
    
    const response = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      response_format: 'verbose_json',
      temperature: 0.2
    });

    return response;
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

// Cleanup temporary files
async function cleanup(filePath) {
  try {
    await fs.unlink(filePath);
    console.log(`Cleaned up: ${filePath}`);
  } catch (error) {
    console.error(`Failed to cleanup ${filePath}:`, error.message);
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Transcription service is running',
    timestamp: new Date().toISOString()
  });
});

// Upload and transcribe endpoint
app.post('/api/transcribe', upload.single('video'), async (req, res) => {
  let videoPath = null;
  let audioPath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded'
      });
    }

    console.log('Processing file:', req.file.originalname);

    // Save uploaded video file
    const videoId = uuidv4();
    videoPath = path.join('./uploads', `${videoId}.mp4`);
    await fs.writeFile(videoPath, req.file.buffer);

    console.log('Video saved:', videoPath);

    // Extract audio
    console.log('Extracting audio...');
    audioPath = await extractAudio(videoPath);
    console.log('Audio extracted:', audioPath);

    // Transcribe audio
    console.log('Starting transcription...');
    const transcription = await transcribeAudio(audioPath);
    console.log('Transcription completed');

    // Cleanup files
    await cleanup(videoPath);
    await cleanup(audioPath);

    res.json({
      success: true,
      message: 'Transcription completed successfully',
      data: {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        segments: transcription.segments,
        filename: req.file.originalname
      }
    });

  } catch (error) {
    console.error('Transcription error:', error);
    
    // Cleanup on error
    if (videoPath) await cleanup(videoPath).catch(() => {});
    if (audioPath) await cleanup(audioPath).catch(() => {});

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
async function startServer() {
  try {
    await ensureDirectories();
    
    app.listen(PORT, () => {
      console.log(`Transcription test server running on http://localhost:${PORT}`);
      console.log('Endpoints:');
      console.log('  GET  /api/health - Health check');
      console.log('  POST /api/transcribe - Upload and transcribe video');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();