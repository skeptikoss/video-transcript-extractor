# Video Transcript Extractor

Extract transcripts from MP4 videos and seamlessly sync them to Notion.

## 🎯 Overview

This application processes multiple MP4 video files, extracts high-quality transcripts using OpenAI's Whisper API, and automatically organizes them in your Notion workspace.

## 🚀 Features

### ✅ Currently Available
- **Drag & Drop Upload**: Modern file upload interface with progress tracking
- **AI-Powered Transcription**: Uses OpenAI Whisper for accurate speech-to-text
- **Real-time Progress**: Live progress tracking with stage indicators
- **Queue Management**: Robust Bull queue for reliable background processing
- **Error Recovery**: Automatic retry with exponential backoff
- **Transcript Management**: Preview, copy, and download transcripts
- **Professional UI**: Responsive design with real-time status updates

### 🔄 In Development
- **Notion Integration**: Automatically sync transcripts to your Notion database (Phase 3)
- **WebSocket Updates**: Enhanced real-time communication (Phase 3)
- **Advanced Features**: Search, filtering, bulk operations (Phase 4)

## 🚦 Current Status

**Phase 2 Complete**: Core transcription pipeline is fully operational! 🎉

- ✅ **Working**: Upload videos → Automatic transcription → View/download transcripts
- ✅ **Tested**: End-to-end pipeline with real video files
- ✅ **Production Ready**: Error handling, progress tracking, resource management
- 🔄 **Next**: Notion integration (Phase 3)

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables in .env
OPENAI_API_KEY=your-openai-api-key

# 3. Start the application
npm run dev

# 4. Open http://localhost:5173 and upload a video!
```

## 📋 Prerequisites

- Node.js 20.x LTS
- FFmpeg installed locally
- OpenAI API key (Notion integration coming in Phase 3)
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

1. Navigate to `http://localhost:5173`
2. Drag and drop MP4 files or click to browse
3. Monitor transcription progress in real-time
4. Configure Notion database connection
5. Click "Sync to Notion" to export transcripts

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express + TypeScript
- **Database**: SQLite with TypeORM
- **Queue**: Bull for job management
- **Real-time**: Socket.io for WebSocket communication

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
