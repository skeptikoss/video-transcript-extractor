# Video Transcript Extractor

Extract transcripts from MP4 videos and seamlessly sync them to Notion.

## 🎯 Overview

This application processes multiple MP4 video files, extracts high-quality transcripts using OpenAI's Whisper API, and automatically organizes them in your Notion workspace.

## 🚀 Features

### ✅ Production Ready
- **Drag & Drop Upload**: Modern file upload interface with progress tracking
- **AI-Powered Transcription**: Uses OpenAI Whisper for accurate speech-to-text
- **Real-time Progress**: Live progress tracking with stage indicators
- **Queue Management**: Robust Bull queue for reliable background processing
- **Error Recovery**: Automatic retry with exponential backoff
- **Transcript Management**: Preview, copy, and download transcripts
- **Notion Integration**: Seamlessly sync transcripts to your Notion database
- **Professional UI**: Responsive design with real-time status updates
- **Rate Limiting**: Production-compliant API usage (3 req/sec for Notion)
- **Schema Adaptation**: Works with any Notion database structure
- **Duplicate Detection**: Intelligent content management and updates

### 🎯 Advanced Features
- **Automatic Processing**: Upload → Transcribe → Sync in 3 clicks
- **Rich Formatting**: Structured pages with metadata and confidence scores
- **Error Handling**: Comprehensive user guidance and recovery options
- **Resource Management**: Automatic cleanup and memory optimization
- **Multi-format Support**: MP4, MOV, AVI, WebM video files

## 🚦 Current Status

**🎉 PROJECT COMPLETE**: Full end-to-end video-to-Notion workflow operational!

- ✅ **Complete Pipeline**: Upload videos → Automatic transcription → Notion sync
- ✅ **Production Ready**: Comprehensive error handling, rate limiting, resource management
- ✅ **Professional UI**: Suitable for daily productivity use
- ✅ **Tested & Documented**: Real-world testing with comprehensive documentation
- 🏆 **Achievement**: 8-week project completed in 4 development sessions

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables in .env
OPENAI_API_KEY=your-openai-api-key
NOTION_API_KEY=your-notion-integration-token

# 3. Start the application
npm run dev

# 4. Open http://localhost:5173 and upload a video!
# 5. Configure Notion database and sync transcripts
```

## 📋 Prerequisites

- Node.js 20.x LTS
- FFmpeg installed locally
- OpenAI API key (for Whisper transcription)
- Notion API key (create integration at https://www.notion.so/my-integrations)
- 500MB+ free disk space

## 🛠️ Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd video-transcript-extractor
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Run database migrations:
```bash
npm run db:migrate
```

5. Start development server:
```bash
npm run dev
```

## 🎮 Usage

1. **Navigate** to `http://localhost:5173`
2. **Upload** videos via drag-drop or file browser
3. **Monitor** automatic transcription progress in real-time
4. **Configure** Notion database (enter database ID from your Notion URL)
5. **Sync** completed transcripts to Notion with one click
6. **Access** organized transcripts in your Notion workspace

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express + Node.js (JavaScript for rapid development)
- **Database**: In-memory storage (production-ready for single user)
- **Queue**: Bull for reliable background job processing
- **AI Integration**: OpenAI Whisper API for transcription
- **External Sync**: Notion API for knowledge management
- **Media Processing**: FFmpeg for audio extraction

## 📁 Project Structure

```
video-transcript-extractor/
├── apps/
│   ├── frontend/    # React application
│   └── backend/     # Express server
├── packages/
│   ├── shared/      # Shared types
│   └── config/      # Shared configs
├── docs/            # Documentation
└── scripts/         # Utility scripts
```

## 🔧 Development

```bash
# Run frontend only
npm run dev:frontend

# Run backend only
npm run dev:backend

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## 📝 Documentation

- [CLAUDE.md](docs/CLAUDE.md) - Development guide for Claude Code
- [PLANNING.md](docs/PLANNING.md) - Project roadmap and architecture
- [TASKS.md](docs/TASKS.md) - Sprint tracking and task management

## 🤝 Contributing

This is a private learning project. Contributions are not currently accepted.

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- OpenAI for Whisper API
- Notion for their excellent API
- The open source community for amazing tools
