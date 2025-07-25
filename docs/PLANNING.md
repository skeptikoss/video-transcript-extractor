# PLANNING.md - Video Transcript Extractor

**Last Updated**: July 2025  
**Project Status**: Initialization Phase  
**Target Completion**: 8 weeks from project start

## 🎯 Project Vision

### Product Vision
Build a **private web application** that transforms video content into searchable, organized knowledge in Notion by:
- Eliminating manual transcription work
- Creating a searchable video knowledge base
- Enabling efficient video content processing
- Demonstrating full-stack development capabilities

### Learning Vision
Master **Claude Code development workflows** through building a real product by:
- Progressing from simple file handling to complex API orchestration
- Documenting every architectural decision and learning insight
- Creating reusable patterns for future projects
- Building portfolio-quality code with professional standards

### Success Vision
By Week 8, achieve:
- ✅ Fully functional application processing 10+ videos seamlessly
- ✅ Complete Notion integration with zero manual steps
- ✅ Comprehensive documentation demonstrating learning journey
- ✅ Confidence to start new Claude Code projects independently

## 🏗️ System Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│                    (React + TypeScript + Tailwind)               │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP/WebSocket
┌─────────────────────────▼───────────────────────────────────────┐
│                      API Gateway Layer                           │
│                  (Express + TypeScript + Auth)                   │
└─────────────┬────────────────────────────┬──────────────────────┘
              │                            │
┌─────────────▼──────────────┐ ┌──────────▼──────────────────────┐
│     Queue Management        │ │      Business Logic Layer       │
│   (Bull + Redis/Memory)     │ │    (Services + Validation)      │
└─────────────┬──────────────┘ └──────────┬──────────────────────┘
              │                            │
┌─────────────▼──────────────────────────▼──────────────────────┐
│                    Data & Storage Layer                         │
│           SQLite DB          │        File Storage              │
└─────────────────────────────┴──────────────────────────────────┘
              │                            │
┌─────────────▼──────────────┐ ┌──────────▼──────────────────────┐
│   External Services         │ │       Background Workers         │
│ • OpenAI Whisper API       │ │  • Transcription Worker          │
│ • Notion API               │ │  • Sync Worker                   │
└────────────────────────────┘ └──────────────────────────────────┘
```

### Component Architecture

#### Frontend Components
```
Frontend/
├── Core/
│   ├── Layout (App shell, navigation)
│   ├── Auth (Simple token management)
│   └── ErrorBoundary (Global error handling)
├── Upload/
│   ├── DropZone (Drag-drop interface)
│   ├── FileValidator (Client-side validation)
│   └── UploadProgress (Real-time feedback)
├── Processing/
│   ├── QueueDisplay (Current processing status)
│   ├── TranscriptPreview (Review before sync)
│   └── ProgressTracker (WebSocket updates)
└── Notion/
    ├── DatabaseConfig (Setup wizard)
    ├── SyncManager (Batch operations)
    └── SyncHistory (Previous syncs)
```

#### Backend Services
```
Backend/
├── API Routes/
│   ├── /upload (Multipart file handling)
│   ├── /transcribe (Queue management)
│   ├── /notion (Sync operations)
│   └── /status (WebSocket events)
├── Services/
│   ├── FileService (Storage management)
│   ├── TranscriptionService (Whisper integration)
│   ├── NotionService (API client)
│   └── QueueService (Job management)
├── Workers/
│   ├── TranscriptionWorker (Process videos)
│   ├── NotionSyncWorker (Batch sync)
│   └── CleanupWorker (Storage management)
└── Database/
    ├── Models (TypeORM entities)
    ├── Migrations (Schema versions)
    └── Repositories (Data access)
```

### Data Flow Architecture

#### Upload Flow
```
1. User selects videos → Frontend validation
2. Chunked upload → Backend receives chunks
3. File assembly → Storage + metadata extraction
4. Queue entry → Job created with priority
5. WebSocket notification → UI updates
```

#### Processing Flow
```
1. Worker picks job → Locks for processing
2. Extract audio → FFmpeg conversion
3. Chunk if needed → 25MB segments
4. Call Whisper API → With retry logic
5. Assemble transcript → Store in DB
6. Update job status → Notify frontend
```

#### Sync Flow
```
1. User triggers sync → Select transcripts
2. Validate Notion auth → Check permissions
3. Create/find database → Ensure schema
4. Batch create pages → Rate limited
5. Handle failures → Retry logic
6. Update sync status → Complete
```

## 💻 Technology Stack

### Frontend Stack
| Technology | Version | Purpose | Learning Focus |
|------------|---------|---------|----------------|
| React | 18.x | UI framework | Component patterns, hooks |
| TypeScript | 5.x | Type safety | Interfaces, generics |
| Vite | 5.x | Build tool | Modern tooling |
| Tailwind CSS | 3.x | Styling | Utility-first CSS |
| React Query | 5.x | Data fetching | Cache management |
| React Hook Form | 7.x | Form handling | Validation patterns |
| Socket.io Client | 4.x | WebSockets | Real-time updates |
| Axios | 1.x | HTTP client | Interceptors, retry |

### Backend Stack
| Technology | Version | Purpose | Learning Focus |
|------------|---------|---------|----------------|
| Node.js | 20.x LTS | Runtime | Async patterns |
| Express | 4.x | Web framework | Middleware design |
| TypeScript | 5.x | Type safety | Shared types |
| SQLite | 3.x | Database | Schema design |
| TypeORM | 0.3.x | ORM | Migrations, relations |
| Bull | 4.x | Queue management | Job patterns |
| Socket.io | 4.x | WebSockets | Event architecture |
| Multer | 1.x | File uploads | Stream handling |

### External Services
| Service | Purpose | Limits | Cost |
|---------|---------|--------|------|
| OpenAI Whisper | Transcription | 25MB/file | $0.006/min |
| Notion API | Storage | 3 req/sec | Free |
| FFmpeg | Audio extraction | Local | Free |

### Development Tools
| Tool | Version | Purpose |
|------|---------|---------|
| ESLint | 8.x | Code linting |
| Prettier | 3.x | Code formatting |
| Jest | 29.x | Unit testing |
| Supertest | 6.x | API testing |
| Nodemon | 3.x | Development server |
| Concurrently | 8.x | Process management |

## 🛠️ Required Tools & Setup

### Prerequisites Checklist

#### System Requirements
- [ ] **Node.js 20.x LTS** - JavaScript runtime
  ```bash
  # Check version
  node --version  # Should be v20.x.x
  
  # Install via nvm (recommended)
  nvm install 20
  nvm use 20
  ```

- [ ] **npm 10.x** - Package manager
  ```bash
  npm --version  # Should be 10.x.x
  ```

- [ ] **Git 2.x** - Version control
  ```bash
  git --version  # Should be 2.x.x
  ```

#### Local Dependencies
- [ ] **FFmpeg** - Video/audio processing
  ```bash
  # macOS
  brew install ffmpeg
  
  # Windows (via Chocolatey)
  choco install ffmpeg
  
  # Linux
  sudo apt update
  sudo apt install ffmpeg
  
  # Verify installation
  ffmpeg -version
  ```

- [ ] **SQLite 3** - Database (usually included with Node)
  ```bash
  # Verify
  sqlite3 --version
  ```

#### Development Environment
- [ ] **VS Code** - Recommended editor
  - Extensions:
    - [ ] ESLint
    - [ ] Prettier
    - [ ] TypeScript and JavaScript
    - [ ] Tailwind CSS IntelliSense
    - [ ] GitLens
    - [ ] Thunder Client (API testing)

- [ ] **Claude Code** - AI development assistant
  ```bash
  # Installation instructions from Anthropic
  ```

#### API Keys Required
- [ ] **OpenAI API Key**
  - Sign up at: https://platform.openai.com
  - Add billing: Whisper costs ~$0.006/minute
  - Create key: https://platform.openai.com/api-keys
  
- [ ] **Notion Integration**
  - Create integration: https://www.notion.so/my-integrations
  - Get secret key
  - Share target database with integration

### Project Setup Commands
```bash
# 1. Clone repository (once created)
git clone [repository-url]
cd video-transcript-extractor

# 2. Install dependencies
npm install

# 3. Environment setup
cp .env.example .env
# Edit .env with your API keys

# 4. Database setup
npm run db:migrate

# 5. Verify setup
npm run verify-setup  # Custom script to check all requirements

# 6. Start development
npm run dev
```

### Recommended Folder Structure
```
~/Projects/
├── video-transcript-extractor/    # Main project
├── test-videos/                   # Sample MP4 files
└── backups/                       # Database backups
```

## 📅 Development Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Working file upload and basic backend

#### Week 1 Deliverables
- [ ] Project initialization with TypeScript
- [ ] Basic Express server with health check
- [ ] File upload endpoint with validation
- [ ] SQLite database setup
- [ ] Initial documentation structure

#### Week 2 Deliverables
- [ ] React frontend with Vite
- [ ] File upload UI with drag-drop
- [ ] File storage service
- [ ] Basic error handling
- [ ] Frontend-backend communication

**Learning Milestones**: File handling, TypeScript basics, API design

### Phase 2: Core Processing (Weeks 3-4)
**Goal**: Functional transcription pipeline

#### Week 3 Deliverables
- [ ] FFmpeg integration for audio extraction
- [ ] Whisper API client with retry logic
- [ ] Bull queue setup
- [ ] Worker process implementation
- [ ] Progress tracking system

#### Week 4 Deliverables
- [ ] WebSocket integration
- [ ] Real-time progress updates
- [ ] Transcript storage in database
- [ ] Error recovery mechanisms
- [ ] Basic transcript preview

**Learning Milestones**: Queue patterns, API integration, WebSockets

### Phase 3: Notion Integration (Weeks 5-6)
**Goal**: Seamless Notion synchronization

#### Week 5 Deliverables
- [ ] Notion API authentication
- [ ] Database creation/detection
- [ ] Page creation with metadata
- [ ] Rate limiting implementation
- [ ] Sync status tracking

#### Week 6 Deliverables
- [ ] Batch sync operations
- [ ] Duplicate detection
- [ ] Error handling and retry
- [ ] Sync history UI
- [ ] Configuration management

**Learning Milestones**: External API integration, rate limiting, batch processing

### Phase 4: Polish & Deploy (Weeks 7-8)
**Goal**: Production-ready application

#### Week 7 Deliverables
- [ ] Comprehensive error handling
- [ ] Performance optimization
- [ ] Export functionality
- [ ] Search implementation
- [ ] UI/UX improvements

#### Week 8 Deliverables
- [ ] Unit test coverage
- [ ] Integration tests
- [ ] Documentation completion
- [ ] Deployment setup
- [ ] Final bug fixes

**Learning Milestones**: Testing, deployment, performance optimization

## 🎯 Feature Prioritization

### MVP Features (Must Have)
1. **Multi-file Upload** - Core functionality
2. **Transcription Processing** - Main value proposition
3. **Notion Sync** - Key integration
4. **Progress Tracking** - User feedback
5. **Error Handling** - Reliability

### Post-MVP Features (Nice to Have)
1. **Transcript Editing** - Quality improvement
2. **Batch Export** - Convenience
3. **Search Function** - Discoverability
4. **Summary Generation** - Added value
5. **Cloud Deployment** - Accessibility

### Future Enhancements (Backlog)
1. **Additional Formats** - MOV, AVI support
2. **Google Drive Integration** - Source expansion
3. **Team Features** - Multi-user support
4. **Custom AI Prompts** - Flexibility
5. **Analytics Dashboard** - Insights

## 📊 Risk Management

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limits | High | Implement queuing and backoff |
| Large file handling | Medium | Chunked processing |
| Transcription accuracy | Medium | Allow manual editing |
| Notion API changes | Low | Version lock, monitoring |

### Learning Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Complexity overwhelm | High | Progressive feature addition |
| Time management | Medium | Clear weekly milestones |
| Technical blockers | Medium | Claude Code assistance |
| Scope creep | Low | Strict MVP focus |

## 📝 Documentation Strategy

### Living Documents
- **CLAUDE.md**: Project context and patterns
- **PLANNING.md**: This file - roadmap and architecture
- **TASKS.md**: Sprint tracking and progress
- **README.md**: User documentation
- **CHANGELOG.md**: Version history

### Documentation Principles
1. **Real-time Updates**: Document as you code
2. **Decision Records**: Capture why, not just what
3. **Learning Focus**: Include insights and gotchas
4. **Code Examples**: Illustrate patterns
5. **Visual Aids**: Diagrams for complex flows

## ✅ Success Metrics

### Technical Metrics
- [ ] 80%+ test coverage
- [ ] <3 second page load
- [ ] 95%+ transcription accuracy
- [ ] Zero data loss
- [ ] <1% error rate

### Learning Metrics
- [ ] Can explain every component
- [ ] Understand all integrations
- [ ] Able to debug independently
- [ ] Ready for next project
- [ ] Portfolio-ready code

### Business Metrics
- [ ] 10+ videos processed successfully
- [ ] 5+ hours saved vs manual work
- [ ] Zero manual steps required
- [ ] Reliable daily use
- [ ] Complete documentation

---

**Next Steps**: 
1. Review and confirm technology choices
2. Set up development environment
3. Create initial project structure
4. Begin Week 1 implementation

**Remember**: This is a learning journey. Each phase builds on the previous one. Document everything, ask questions, and focus on understanding over speed.
