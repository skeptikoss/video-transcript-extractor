#!/bin/bash

echo "🚀 Starting Video Transcript Extractor Development Servers..."
echo ""

# Kill any existing processes on these ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 1

echo "📂 Ensuring required directories exist..."
mkdir -p data uploads logs

echo ""
echo "🔧 Starting Backend Server (Port 3000)..."
cd apps/backend && node simple-server.js &
BACKEND_PID=$!

echo "⚛️  Starting Frontend Server (Port 5173)..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "⏱️  Waiting for servers to start..."
sleep 3

echo ""
echo "🏥 Testing backend health..."
curl -s http://localhost:3000/api/health | head -1

echo ""
echo "✅ Development servers are running!"
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔗 Backend:  http://localhost:3000"
echo "📚 API Docs:"
echo "   GET  /api/health"
echo "   GET  /api/health/detailed"
echo "   POST /api/upload"
echo "   GET  /api/upload"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user to stop
wait