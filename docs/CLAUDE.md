# CLAUDE.md - Video Transcript Extractor Project Guide

## 🎯 Project Overview

You are helping build a **Video Transcript Extractor for Notion** - a full-stack web application that processes MP4 videos, extracts transcripts using AI, and syncs them to Notion. This is a learning project to master Claude Code development workflows over 8 weeks.

**Current Status**: Project Initialization Phase (Week 0)
**Last Updated**: July 2025
**Developer**: CFA/ACA professional learning full-stack development

## 🧠 Key Context for Every Session

### 📌 MANDATORY SESSION START PROTOCOL
1. **Always read PLANNING.md** at the start of every new conversation for current roadmap
2. **Check TASKS.md** before starting any work to see current sprint status
3. **Mark completed tasks** in TASKS.md immediately upon completion
4. **Add newly discovered tasks** to TASKS.md when found during development

### Primary Objectives
1. **Learn Claude Code**: Master development workflows through practical implementation
2. **Build Real Product**: Create a functional tool for personal productivity
3. **Document Progress**: Maintain comprehensive documentation as learning artifact
4. **Professional Standards**: Write production-quality code suitable for portfolio

### Learning Philosophy
- **Progressive Complexity**: Start simple, add features only after mastering basics
- **Documentation-Driven**: Update docs in real-time during development
- **Framework Extraction**: Convert each implementation into reusable patterns
- **Error-First Thinking**: Anticipate and handle failures gracefully

### Development Constraints
- **Single Developer**: No team dependencies
- **Bootstrap Budget**: Use free tiers where possible
- **8-Week Timeline**: Must balance learning with delivery
- **Private Use**: Can simplify auth and security requirements

## 🏗️ Technical Architecture

### Technology Stack Decisions
```
Frontend:
- React 18 with TypeScript (type safety for learning)
- Vite (fast development experience)
- Tailwind CSS (rapid UI development)
- React Query (data fetching patterns)

Backend:
- Node.js with Express (familiar ecosystem)
- TypeScript (consistency with frontend)
- SQLite (simple local database)
- Bull (robust queue management)

APIs:
- OpenAI Whisper (transcription)
- Notion API (data storage)
- WebSockets (real-time updates)
```

### Architecture Patterns
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│   Workers   │
│   (React)   │◀────│  (Express)  │◀────│   (Bull)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                     │
                           ▼                     ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   SQLite    │     │External APIs│
                    │  Database   │     │(Whisper/Notion)
                    └─────────────┘     └─────────────┘
```

### Key Design Decisions

1. **Monorepo Structure**: Everything in one repository for easier learning
2. **TypeScript Everywhere**: Consistent types across full stack
3. **Local-First**: SQLite and file storage for simplicity
4. **Queue-Based Processing**: Learn async patterns properly
5. **Progressive Enhancement**: Core features work without JS

## 📁 Project Structure

```
video-transcript-extractor/
├── apps/
│   ├── frontend/          # React application
│   │   ├── src/
│   │   ├── public/
│   │   └── package.json
│   └── backend/           # Express server
│       ├── src/
│       ├── workers/
│       └── package.json
├── packages/
│   ├── shared/           # Shared types and utilities
│   └── config/           # Shared configurations
├── docs/
│   ├── CLAUDE.md         # This file
│   ├── PLANNING.md       # Feature roadmap
│   └── TASKS.md          # Sprint tracking
├── scripts/              # Development scripts
├── .env.example          # Environment template
└── package.json          # Root package.json
```

## 🔧 Common Development Tasks

### Starting a Development Session
```bash
# 1. Read current project status
cat docs/PLANNING.md    # Review roadmap and current phase
cat docs/TASKS.md       # Check in-progress and pending tasks

# 2. Check git status
git status

# 3. Start all services
npm run dev

# 4. Begin work on current task
# Remember: Update TASKS.md immediately when completing tasks or discovering new ones
```

### Adding a New Feature
1. Update PLANNING.md with feature specification
2. Create feature branch: `git checkout -b feature/feature-name`
3. Implement with test-driven development
4. Update documentation in real-time
5. Create PR with comprehensive description

### Documentation Maintenance Protocol
**CRITICAL**: Keep documentation synchronized with development
- **PLANNING.md**: Update when scope changes or milestones are reached
- **TASKS.md**: Update immediately when:
  - Starting a new task (mark as "In Progress")
  - Completing a task (mark as "Done" with date)
  - Discovering new tasks (add to backlog)
  - Finding blockers (document with task)
- **CLAUDE.md**: Update with new patterns or insights learned

### Debugging Checklist
- [ ] Check browser console for frontend errors
- [ ] Check terminal for backend errors
- [ ] Verify environment variables are set
- [ ] Check API rate limits and quotas
- [ ] Review error logs in `logs/` directory
- [ ] Test with minimal reproduction case

### API Integration Pattern
```typescript
// Standard API integration pattern
class WhisperService {
  private client: OpenAI;
  private retryConfig = { maxRetries: 3, backoff: 1000 };

  async transcribe(audioPath: string): Promise<Transcript> {
    return this.withRetry(async () => {
      // Implementation with error handling
    });
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    // Exponential backoff implementation
  }
}
```

## 📚 Learning Objectives by Week

### Week 1-2: Foundation
**Focus**: Basic file operations and server setup
```typescript
// Key patterns to master:
- File upload handling
- Async/await patterns
- Error boundaries
- TypeScript basics
- Git workflow
```

### Week 3-4: Core Processing
**Focus**: Queue management and API integration
```typescript
// Key patterns to master:
- Worker queues
- API client creation
- Progress tracking
- WebSocket communication
- State management
```

### Week 5-6: Integration
**Focus**: Database design and external sync
```typescript
// Key patterns to master:
- Database migrations
- Transaction handling
- Rate limiting
- Batch processing
- Error recovery
```

### Week 7-8: Polish
**Focus**: Testing and deployment
```typescript
// Key patterns to master:
- Unit testing
- Integration testing
- Performance optimization
- Deployment pipelines
- Documentation
```

## 🐛 Common Issues and Solutions

### Issue: Large file upload fails
```typescript
// Solution: Implement chunked upload
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

async function uploadChunked(file: File) {
  const chunks = Math.ceil(file.size / CHUNK_SIZE);
  for (let i = 0; i < chunks; i++) {
    const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await uploadChunk(chunk, i, chunks);
  }
}
```

### Issue: Notion API rate limit
```typescript
// Solution: Implement rate limiter
import { RateLimiter } from 'limiter';

const notionLimiter = new RateLimiter({
  tokensPerInterval: 3,
  interval: 'second'
});

async function notionRequest(fn: Function) {
  await notionLimiter.removeTokens(1);
  return fn();
}
```

### Issue: Memory leak during processing
```typescript
// Solution: Stream processing
import { pipeline } from 'stream/promises';

async function processLargeFile(inputPath: string) {
  await pipeline(
    fs.createReadStream(inputPath),
    new TransformStream(),
    fs.createWriteStream(outputPath)
  );
}
```

## 📋 Code Style Guidelines

### TypeScript Conventions
```typescript
// Use interfaces for objects
interface VideoMetadata {
  title: string;
  duration: number;
  size: number;
}

// Use enums for constants
enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Use type for unions
type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string };
```

### Error Handling Pattern
```typescript
// Custom error classes
class TranscriptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

// Consistent error handling
async function handleTranscription(videoId: string) {
  try {
    const result = await transcribe(videoId);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof TranscriptionError) {
      logger.error('Transcription failed', { videoId, error });
      return { success: false, error: error.message };
    }
    throw error; // Unexpected errors bubble up
  }
}
```

### Testing Patterns
```typescript
// Unit test structure
describe('TranscriptionService', () => {
  let service: TranscriptionService;
  
  beforeEach(() => {
    service = new TranscriptionService(mockConfig);
  });

  it('should handle API errors gracefully', async () => {
    // Arrange
    mockApi.transcribe.mockRejectedValue(new Error('API Error'));
    
    // Act
    const result = await service.transcribe('test.mp4');
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('API Error');
  });
});
```

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Environment variables documented
- [ ] Database migrations ready
- [ ] Error monitoring configured
- [ ] Performance benchmarks met

### Deployment Steps
1. Build production bundles
2. Run database migrations
3. Verify environment configuration
4. Deploy backend services
5. Deploy frontend application
6. Verify health checks
7. Monitor error rates

### Post-deployment
- [ ] Verify all features working
- [ ] Check performance metrics
- [ ] Review error logs
- [ ] Update documentation
- [ ] Tag release in Git

## 📖 Quick Reference

### Environment Variables
```bash
# API Keys
OPENAI_API_KEY=sk-...
NOTION_API_KEY=secret_...

# Database
DATABASE_PATH=./data/app.db

# Server
PORT=3000
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Common Commands
```bash
# Development
npm run dev              # Start all services
npm run dev:frontend     # Frontend only
npm run dev:backend      # Backend only

# Testing
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report

# Building
npm run build           # Build all packages
npm run build:frontend  # Frontend only
npm run build:backend   # Backend only

# Database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed test data
npm run db:reset        # Reset database

# Utilities
npm run lint            # Run ESLint
npm run format          # Run Prettier
npm run type-check      # TypeScript check
```

### Useful Resources
- [Whisper API Docs](https://platform.openai.com/docs/guides/speech-to-text)
- [Notion API Reference](https://developers.notion.com/reference)
- [Bull Queue Patterns](https://docs.bullmq.io/patterns)
- [React Query Guide](https://tanstack.com/query/latest)

## 🎓 Learning Notes

### Key Insights (Update as you learn)
1. **File Processing**: Streaming is essential for large files
2. **API Integration**: Always implement retry logic
3. **Queue Management**: Set concurrency limits based on API quotas
4. **Error Handling**: User-friendly messages, detailed logs
5. **Performance**: Measure first, optimize second

### Patterns to Remember
- **Repository Pattern**: Abstract data access
- **Service Pattern**: Business logic separation  
- **Factory Pattern**: Complex object creation
- **Observer Pattern**: Event-driven updates
- **Strategy Pattern**: Swappable algorithms

### Next Learning Goals
- [ ] Master WebSocket implementation
- [ ] Understand database indexing
- [ ] Learn deployment automation
- [ ] Explore performance profiling
- [ ] Study security best practices

## 📝 Session Reminders

**Start of Session**:
- ✅ Read PLANNING.md for current roadmap
- ✅ Check TASKS.md for current sprint items
- ✅ Review recent commits for context

**During Session**:
- ✅ Update TASKS.md when completing items
- ✅ Add new tasks to TASKS.md as discovered
- ✅ Document insights in CLAUDE.md

**End of Session**:
- ✅ Commit all changes with clear messages
- ✅ Update task statuses in TASKS.md
- ✅ Note any blockers or dependencies

---

**Remember**: This is a learning project. Focus on understanding over speed. Document insights, ask questions, and build systematically. Each session should leave the codebase better documented and more maintainable than before.
