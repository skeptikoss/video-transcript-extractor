import { useEffect, useState } from 'react';
import clsx from 'clsx';

interface TranscriptionJob {
  id: string;
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage?: string;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  transcript?: {
    id: string;
    content: string;
    language: string;
    confidence: number;
  };
}

interface TranscriptionStatusProps {
  videoId: string;
  jobId?: string;
}

const getStatusIcon = (status: TranscriptionJob['status']) => {
  switch (status) {
    case 'pending':
      return (
        <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'processing':
      return (
        <svg className="h-5 w-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'completed':
      return (
        <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'failed':
      return (
        <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
  }
};

const getStageLabel = (stage?: string) => {
  switch (stage) {
    case 'audio_extraction':
      return 'Extracting Audio';
    case 'transcription':
      return 'Transcribing';
    case 'storage':
      return 'Saving Transcript';
    case 'completed':
      return 'Completed';
    default:
      return 'Processing';
  }
};

export default function TranscriptionStatus({ videoId, jobId }: TranscriptionStatusProps) {
  const [transcriptionData, setTranscriptionData] = useState<{
    video: any;
    job: TranscriptionJob | null;
    transcript: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTranscriptionStatus = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/transcription/video/${videoId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transcription status');
      }
      const result = await response.json();
      setTranscriptionData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTranscriptionStatus();
    
    // Poll for updates if job is pending or processing
    const pollInterval = setInterval(() => {
      if (transcriptionData?.job && 
          (transcriptionData.job.status === 'pending' || transcriptionData.job.status === 'processing')) {
        fetchTranscriptionStatus();
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [videoId, transcriptionData?.job?.status]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 h-10 w-10"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-4">
        <div className="flex items-center space-x-3">
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-red-800">Error Loading Transcription Status</h3>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const { job, transcript } = transcriptionData || {};

  if (!job) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-center text-gray-500">
          <p>No transcription job found for this video.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
          {getStatusIcon(job.status)}
          <span>Transcription Status</span>
        </h3>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Status Overview */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className={clsx(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              {
                'bg-yellow-100 text-yellow-800': job.status === 'pending',
                'bg-blue-100 text-blue-800': job.status === 'processing',
                'bg-green-100 text-green-800': job.status === 'completed',
                'bg-red-100 text-red-800': job.status === 'failed',
              }
            )}>
              {job.status}
            </span>
            {job.stage && (
              <span className="text-sm text-gray-600">
                {getStageLabel(job.stage)}
              </span>
            )}
          </div>
          
          {job.status === 'processing' && (
            <span className="text-sm font-medium text-blue-600">
              {job.progress}%
            </span>
          )}
        </div>

        {/* Progress Bar */}
        {(job.status === 'processing' || job.status === 'completed') && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={clsx(
                'h-2 rounded-full transition-all duration-500',
                {
                  'bg-blue-500': job.status === 'processing',
                  'bg-green-500': job.status === 'completed',
                }
              )}
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}

        {/* Status Message */}
        {job.message && (
          <p className="text-sm text-gray-600">{job.message}</p>
        )}

        {/* Error Message */}
        {job.status === 'failed' && job.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{job.error}</p>
          </div>
        )}

        {/* Transcript Preview */}
        {transcript && job.status === 'completed' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">Transcript</h4>
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span>Language: {transcript.language}</span>
                {transcript.confidence && (
                  <span>Confidence: {Math.round(transcript.confidence * 100)}%</span>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-md p-3 max-h-48 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {transcript.content.substring(0, 500)}
                {transcript.content.length > 500 && '...'}
              </p>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(transcript.content);
                }}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Copy Transcript
              </button>
              
              <button
                onClick={() => {
                  const blob = new Blob([transcript.content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `transcript-${videoId}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Download
              </button>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="text-xs text-gray-500 space-y-1">
          {job.startedAt && (
            <p>Started: {new Date(job.startedAt).toLocaleString()}</p>
          )}
          {job.completedAt && (
            <p>Completed: {new Date(job.completedAt).toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}