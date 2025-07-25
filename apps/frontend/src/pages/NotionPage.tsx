import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import SyncManager from '../components/Notion/SyncManager';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';

interface Video {
  id: string;
  originalName: string;
  status: string;
  createdAt: string;
  transcript?: {
    id: string;
    content: string;
    confidence: number;
    language: string;
  };
}

const NotionPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch videos with transcripts
  const { data: videosData, isLoading, error, refetch } = useQuery({
    queryKey: ['videos', refreshKey],
    queryFn: async () => {
      const response = await fetch('/api/upload?limit=50');
      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }
      const data = await response.json();
      return data.data.videos;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Transform videos to include transcript data
  const [videosWithTranscripts, setVideosWithTranscripts] = useState<Video[]>([]);

  useEffect(() => {
    if (!videosData) return;

    const fetchTranscripts = async () => {
      const videosWithTranscriptData = await Promise.all(
        videosData.map(async (video: any) => {
          try {
            // Fetch transcript data for each video
            const transcriptResponse = await fetch(`/api/transcription/video/${video.id}`);
            if (transcriptResponse.ok) {
              const transcriptData = await transcriptResponse.json();
              return {
                ...video,
                transcript: transcriptData.data.transcript
              };
            }
            return video;
          } catch (error) {
            console.error(`Failed to fetch transcript for video ${video.id}:`, error);
            return video;
          }
        })
      );

      setVideosWithTranscripts(videosWithTranscriptData);
    };

    fetchTranscripts();
  }, [videosData]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading videos...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="text-red-600 text-xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load videos</h3>
              <p className="text-gray-600 mb-4">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <CloudArrowUpIcon className="h-8 w-8 text-blue-600 mr-3" />
                Notion Sync
              </h1>
              <p className="mt-2 text-gray-600">
                Sync your video transcripts to Notion databases
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        {videosWithTranscripts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Videos
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {videosWithTranscripts.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Ready to Sync
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {videosWithTranscripts.filter(v => v.status === 'completed' && v.transcript).length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Processing
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {videosWithTranscripts.filter(v => v.status === 'processing' || v.status === 'pending').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Sync Interface */}
        <SyncManager videos={videosWithTranscripts} onRefresh={handleRefresh} />
      </div>
    </div>
  );
};

export default NotionPage;