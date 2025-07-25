import React, { useState, useEffect } from 'react';
import DatabaseSelector from './DatabaseSelector';
import SyncButton from './SyncButton';
import { 
  CloudArrowUpIcon, 
  DocumentDuplicateIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CircleStackIcon
} from '@heroicons/react/24/outline';

interface Video {
  id: string;
  originalName: string;
  status: string;
  transcript?: {
    id: string;
    content: string;
    confidence: number;
    language: string;
  };
}

interface SyncManagerProps {
  videos: Video[];
  onRefresh?: () => void;
}

const SyncManager: React.FC<SyncManagerProps> = ({ videos, onRefresh }) => {
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string>('');
  const [syncingVideos, setSyncingVideos] = useState<Set<string>>(new Set());
  const [syncResults, setSyncResults] = useState<Map<string, any>>(new Map());

  // Filter videos that have completed transcripts
  const videosWithTranscripts = videos.filter(
    video => video.status === 'completed' && video.transcript
  );

  const handleDatabaseSelect = (databaseId: string) => {
    setSelectedDatabaseId(databaseId);
    // Store in localStorage for persistence
    localStorage.setItem('selectedNotionDatabaseId', databaseId);
  };

  // Load saved database ID on mount
  useEffect(() => {
    const savedDatabaseId = localStorage.getItem('selectedNotionDatabaseId');
    if (savedDatabaseId) {
      setSelectedDatabaseId(savedDatabaseId);
    }
  }, []);

  const handleSyncStart = (videoId: string) => {
    setSyncingVideos(prev => new Set(prev).add(videoId));
  };

  const handleSyncComplete = (videoId: string, success: boolean, result: any) => {
    setSyncingVideos(prev => {
      const newSet = new Set(prev);
      newSet.delete(videoId);
      return newSet;
    });

    setSyncResults(prev => {
      const newMap = new Map(prev);
      newMap.set(videoId, result);
      return newMap;
    });
  };

  const handleBulkSync = async () => {
    if (!selectedDatabaseId) {
      alert('Please select a Notion database first');
      return;
    }

    const videoIds = videosWithTranscripts.map(video => video.id);
    
    // Start syncing all videos
    videoIds.forEach(videoId => handleSyncStart(videoId));

    try {
      const response = await fetch('/api/notion/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoIds,
          databaseId: selectedDatabaseId
        })
      });

      const batchResult = await response.json();
      
      if (batchResult.success) {
        // Update individual results
        batchResult.results.forEach((result: any) => {
          handleSyncComplete(result.videoId, result.success, result);
        });
      } else {
        // Mark all as failed
        videoIds.forEach(videoId => {
          handleSyncComplete(videoId, false, { 
            success: false, 
            error: batchResult.error || 'Batch sync failed' 
          });
        });
      }
    } catch (error) {
      console.error('Bulk sync failed:', error);
      // Mark all as failed
      videoIds.forEach(videoId => {
        handleSyncComplete(videoId, false, { 
          success: false, 
          error: 'Network error occurred' 
        });
      });
    }
  };

  const getOverallSyncStatus = () => {
    const total = videosWithTranscripts.length;
    const synced = Array.from(syncResults.values()).filter(r => r.success).length;
    const failed = Array.from(syncResults.values()).filter(r => r.success === false).length;
    const pending = total - synced - failed;

    return { total, synced, failed, pending };
  };

  const status = getOverallSyncStatus();

  if (videos.length === 0) {
    return (
      <div className="text-center py-8">
        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No videos uploaded</h3>
        <p className="mt-1 text-sm text-gray-500">Upload videos to sync transcripts to Notion</p>
      </div>
    );
  }

  if (videosWithTranscripts.length === 0) {
    return (
      <div className="text-center py-8">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No transcripts ready</h3>
        <p className="mt-1 text-sm text-gray-500">
          Wait for video transcription to complete before syncing to Notion
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Database Selection */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notion Configuration</h3>
        <DatabaseSelector
          selectedDatabaseId={selectedDatabaseId}
          onDatabaseSelect={handleDatabaseSelect}
        />
      </div>

      {/* Sync Overview */}
      {selectedDatabaseId && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Sync Status</h3>
            {status.total > 1 && (
              <button
                onClick={handleBulkSync}
                disabled={syncingVideos.size > 0}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                Sync All ({status.total})
              </button>
            )}
          </div>

          {/* Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{status.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">{status.synced}</div>
              <div className="text-sm text-green-600">Synced</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-600">{status.failed}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-600">{status.pending}</div>
              <div className="text-sm text-yellow-600">Pending</div>
            </div>
          </div>

          {/* Video List */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900">Transcripts</h4>
            <div className="space-y-3">
              {videosWithTranscripts.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <CloudArrowUpIcon className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {video.originalName}
                        </p>
                        <div className="flex items-center space-x-4 mt-1">
                          {video.transcript && (
                            <>
                              <span className="text-xs text-gray-500">
                                Confidence: {(video.transcript.confidence * 100).toFixed(1)}%
                              </span>
                              <span className="text-xs text-gray-500">
                                Language: {video.transcript.language}
                              </span>
                              <span className="text-xs text-gray-500">
                                Length: {video.transcript.content.length} chars
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <SyncButton
                      videoId={video.id}
                      databaseId={selectedDatabaseId}
                      onSyncStart={() => handleSyncStart(video.id)}
                      onSyncComplete={(success, result) => handleSyncComplete(video.id, success, result)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Help Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <InformationCircleIcon className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              How Notion Sync Works
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Select a Notion database where transcripts will be stored</li>
                <li>Each video transcript becomes a page in your database</li>
                <li>Duplicate transcripts are updated automatically</li>
                <li>You can sync individual transcripts or all at once</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncManager;