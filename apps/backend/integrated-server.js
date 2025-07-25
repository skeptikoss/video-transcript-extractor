require('dotenv').config({ path: '../../.env' });

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const OpenAI = require('openai');
const { Client: NotionClient } = require('@notionhq/client');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:3001',
    'http://localhost:3001',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ],
  credentials: true
}));

app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Notion client
let notion = null;
if (process.env.NOTION_API_KEY) {
  notion = new NotionClient({
    auth: process.env.NOTION_API_KEY
  });
  console.log('✅ Notion client initialized');
} else {
  console.log('⚠️  Notion API key not configured - Notion features disabled');
}

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
      '-vn',                    // No video
      '-acodec', 'libmp3lame', // MP3 encoding
      '-ar', '16000',          // 16kHz sample rate (Whisper optimized)
      '-ac', '1',              // Mono audio
      '-b:a', '64k',           // 64kbps bitrate
      '-map', '0:a',           // Map first audio stream
      '-avoid_negative_ts', 'make_zero', // Handle timestamp issues
      '-fflags', '+genpts',    // Generate missing timestamps
      '-y',                    // Overwrite output
      audioPath
    ]);

    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      
      // Log duration info from FFmpeg output
      if (output.includes('Duration:')) {
        console.log('FFmpeg detected duration:', output.match(/Duration: [\d:.]+/)?.[0]);
      }
      if (output.includes('time=')) {
        const timeMatch = output.match(/time=([\d:.]+)/);
        if (timeMatch) {
          console.log(`FFmpeg progress: ${timeMatch[1]}`);
        }
      }
    });

    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        try {
          const stats = await fs.stat(audioPath);
          const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          console.log(`Audio extraction completed: ${audioPath}`);
          console.log(`Audio file size: ${fileSizeMB}MB`);
          
          // Get audio duration using FFprobe
          const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            audioPath
          ]);
          
          let probeOutput = '';
          ffprobe.stdout.on('data', (data) => {
            probeOutput += data.toString();
          });
          
          ffprobe.on('close', (probeCode) => {
            if (probeCode === 0) {
              try {
                const audioInfo = JSON.parse(probeOutput);
                const audioDuration = parseFloat(audioInfo.format.duration);
                console.log(`Extracted audio duration: ${audioDuration.toFixed(2)}s`);
              } catch (parseError) {
                console.log('Could not parse audio duration info');
              }
            }
          });
          
          if (stats.size > 25 * 1024 * 1024) { // 25MB limit
            console.warn(`⚠️  Audio file (${fileSizeMB}MB) exceeds OpenAI's 25MB limit - transcription may be incomplete`);
          }
          
          resolve(audioPath);
        } catch (statError) {
          console.error('Failed to get audio file stats:', statError);
          resolve(audioPath);
        }
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
    console.log(`Transcript length: ${response.text.length} characters`);
    console.log(`Duration: ${response.duration}s, Language: ${response.language}`);
    console.log(`Segments: ${response.segments ? response.segments.length : 0}`);
    
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

// ======================
// NOTION API ENDPOINTS
// ======================

// Test Notion connection
app.get('/api/notion/test-connection', async (req, res) => {
  try {
    if (!notion) {
      return res.status(400).json({
        success: false,
        error: 'Notion API key not configured'
      });
    }

    const response = await notion.users.me();
    console.log('Notion connection test successful');
    
    res.json({
      success: true,
      user: {
        id: response.id,
        name: response.name,
        type: response.type
      }
    });
  } catch (error) {
    console.error('Notion connection test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to connect to Notion'
    });
  }
});

// Get accessible databases
app.get('/api/notion/databases', async (req, res) => {
  try {
    if (!notion) {
      return res.status(400).json({
        success: false,
        error: 'Notion API key not configured'
      });
    }

    const query = req.query.search;
    const response = await notion.search({
      filter: {
        value: 'database',
        property: 'object'
      },
      query: query || undefined,
      page_size: 100
    });

    const databases = response.results
      .filter(result => result.object === 'database')
      .map(db => ({
        id: db.id,
        title: db.title && db.title.length > 0 
          ? db.title[0].plain_text || db.title[0].text?.content || 'Untitled Database'
          : 'Untitled Database',
        url: db.url,
        properties: db.properties
      }));

    console.log(`Found ${databases.length} accessible databases`);
    
    res.json({
      success: true,
      databases
    });
  } catch (error) {
    console.error('Failed to fetch databases:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch databases'
    });
  }
});

// Helper function to normalize database ID
function normalizeNotionId(id) {
  if (!id) return id;
  // Remove any dashes and then add them in the correct positions
  const cleanId = id.replace(/-/g, '');
  if (cleanId.length === 32) {
    return `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20)}`;
  }
  return id; // Return as-is if not 32 characters
}

// Sync transcript to Notion
app.post('/api/notion/sync/transcript/:videoId', async (req, res) => {
  try {
    if (!notion) {
      return res.status(400).json({
        success: false,
        error: 'Notion API key not configured'
      });
    }

    const { videoId } = req.params;
    let { databaseId } = req.body;
    
    if (!databaseId) {
      return res.status(400).json({
        success: false,
        error: 'Database ID is required'
      });
    }

    // Normalize the database ID
    databaseId = normalizeNotionId(databaseId);
    console.log(`Using database ID: ${databaseId}`);

    // Get video and transcript data
    const video = videos.get(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    if (!video.transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found for this video'
      });
    }

    const transcript = video.transcript;

    // Get database schema to check available properties
    const database = await notion.databases.retrieve({ database_id: databaseId });
    const availableProperties = Object.keys(database.properties);
    console.log('Available properties:', availableProperties);

    // Check if transcript already exists (only if Video ID property exists)
    let existingCheck = { results: [] };
    if (availableProperties.includes('Video ID')) {
      existingCheck = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Video ID',
          rich_text: {
            equals: videoId
          }
        }
      });
    }

    let result;
    if (existingCheck.results.length > 0) {
      // Update existing page
      const pageId = existingCheck.results[0].id;
      console.log(`Updating existing transcript page: ${pageId}`);
      
      await notion.pages.update({
        page_id: pageId,
        properties: {
          'Title': {
            title: [
              {
                text: {
                  content: `Transcript: ${video.originalName}`
                }
              }
            ]
          },
          'Status': {
            select: {
              name: 'Updated'
            }
          }
        }
      });

      result = {
        success: true,
        pageId: pageId,
        duplicate: true,
        message: 'Transcript updated successfully'
      };
    } else {
      // Create new page
      console.log(`Creating new transcript page for video: ${videoId}`);
      
      // Prepare page content
      const content = [];
      
      // Add video information header
      content.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Video Information' } }]
        }
      });

      // Add video details
      const details = [
        `**File:** ${video.originalName}`,
        `**Video ID:** ${videoId}`,
        `**Upload Date:** ${new Date(video.createdAt).toLocaleDateString()}`,
        `**Transcription Date:** ${new Date(transcript.createdAt).toLocaleDateString()}`
      ];

      if (transcript.duration) {
        details.push(`**Duration:** ${Math.round(transcript.duration)} seconds`);
      }
      if (transcript.confidence) {
        details.push(`**Confidence:** ${(transcript.confidence * 100).toFixed(1)}%`);
      }
      if (transcript.language) {
        details.push(`**Language:** ${transcript.language.charAt(0).toUpperCase() + transcript.language.slice(1)}`);
      }

      content.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: details.join('\n') } }]
        }
      });

      // Add transcript header
      content.push({
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Transcript' } }]
        }
      });

      // Split transcript into chunks (max 2000 chars per block)
      const transcriptText = transcript.content;
      const chunkSize = 1900;
      const chunks = [];
      
      for (let i = 0; i < transcriptText.length; i += chunkSize) {
        chunks.push(transcriptText.substring(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        content.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: chunk } }]
          }
        });
      }

      // Build properties object with only available properties
      const properties = {};
      
      // Find the title property (could be 'Title', 'Name', or the first title property)
      const titleProperty = availableProperties.find(prop => 
        database.properties[prop].type === 'title'
      );
      
      if (titleProperty) {
        properties[titleProperty] = {
          title: [
            {
              text: {
                content: `Transcript: ${video.originalName}`
              }
            }
          ]
        };
      }

      // Add other properties only if they exist
      if (availableProperties.includes('Video File')) {
        properties['Video File'] = {
          rich_text: [
            {
              text: {
                content: video.originalName
              }
            }
          ]
        };
      }

      if (availableProperties.includes('Duration') && transcript.duration) {
        properties['Duration'] = {
          number: Math.round(transcript.duration)
        };
      }

      if (availableProperties.includes('Confidence') && transcript.confidence) {
        properties['Confidence'] = {
          number: transcript.confidence
        };
      }

      if (availableProperties.includes('Language') && transcript.language) {
        properties['Language'] = {
          rich_text: [
            {
              text: {
                content: transcript.language.charAt(0).toUpperCase() + transcript.language.slice(1)
              }
            }
          ]
        };
      }

      if (availableProperties.includes('Upload Date')) {
        properties['Upload Date'] = {
          date: {
            start: new Date(video.createdAt).toISOString().split('T')[0]
          }
        };
      }

      if (availableProperties.includes('Transcription Date')) {
        properties['Transcription Date'] = {
          date: {
            start: new Date(transcript.createdAt).toISOString().split('T')[0]
          }
        };
      }

      if (availableProperties.includes('Video ID')) {
        properties['Video ID'] = {
          rich_text: [
            {
              text: {
                content: videoId
              }
            }
          ]
        };
      }

      if (availableProperties.includes('Status')) {
        properties['Status'] = {
          select: {
            name: 'Synced'
          }
        };
      }

      const pageResponse = await notion.pages.create({
        parent: {
          database_id: databaseId
        },
        properties,
        children: content
      });

      result = {
        success: true,
        pageId: pageResponse.id,
        pageUrl: pageResponse.url,
        duplicate: false,
        message: 'Transcript synced successfully'
      };
    }

    console.log(`Notion sync completed for video: ${videoId}`);
    res.json(result);

  } catch (error) {
    console.error('Failed to sync transcript to Notion:', error.message);
    
    let errorMessage = error.message || 'Failed to sync transcript to Notion';
    
    // Provide more helpful error messages
    if (error.message && error.message.includes('Could not find database')) {
      errorMessage = `Database not found or not shared with integration. Please:\n1. Open your Notion database\n2. Click "Share" (top-right)\n3. Add your integration with edit permissions\n4. Database ID: ${databaseId}`;
    } else if (error.message && error.message.includes('Unauthorized')) {
      errorMessage = 'Integration not authorized. Please check your Notion API key and database sharing settings.';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Check database properties
app.get('/api/notion/database/:databaseId/properties', async (req, res) => {
  try {
    if (!notion) {
      return res.status(400).json({
        success: false,
        error: 'Notion API key not configured'
      });
    }

    const databaseId = normalizeNotionId(req.params.databaseId);
    const database = await notion.databases.retrieve({ database_id: databaseId });
    
    res.json({
      success: true,
      properties: Object.keys(database.properties),
      propertyDetails: database.properties
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Notion status
app.get('/api/notion/status', (req, res) => {
  res.json({
    configured: !!notion,
    apiKey: process.env.NOTION_API_KEY ? 'configured' : 'not configured'
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
      console.log(`🔗 Notion API key: ${process.env.NOTION_API_KEY ? 'configured' : 'missing'}`);
      console.log('');
      console.log('📋 Available endpoints:');
      console.log('  GET  /api/health');
      console.log('  GET  /api/health/detailed');
      console.log('  POST /api/upload');
      console.log('  GET  /api/upload');
      console.log('  GET  /api/upload/:id');
      console.log('  GET  /api/transcription/video/:videoId');
      console.log('  GET  /api/transcription/job/:jobId');
      console.log('  GET  /api/notion/test-connection');
      console.log('  GET  /api/notion/databases');
      console.log('  GET  /api/notion/status');
      console.log('  POST /api/notion/sync/transcript/:videoId');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();