import { useEffect, useState } from 'react';
import TranscriptionStatus from '../components/Transcription/TranscriptionStatus';

interface Video {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  status: string;
  uploadedAt: string;
}

export default function ProcessingPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/upload');
      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }
      const result = await response.json();
      setVideos(result.data.videos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchVideos, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Processing Queue
          </h1>
          <div className="animate-pulse space-y-4">
            <div className="bg-white rounded-lg h-32"></div>
            <div className="bg-white rounded-lg h-32"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Processing Queue
          </h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Processing Queue
        </h1>
        <p className="text-gray-600">
          Monitor the progress of your video transcription jobs.
        </p>
      </div>
      
      {videos.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No videos uploaded
            </h3>
            <p className="text-gray-500">
              Upload a video on the home page to start transcription.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {videos.map((video) => (
            <div key={video.id} className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {video.originalName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Uploaded: {new Date(video.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {Math.round(video.size / 1024 / 1024)} MB
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <TranscriptionStatus videoId={video.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}