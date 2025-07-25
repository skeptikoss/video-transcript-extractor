import clsx from 'clsx';
import UploadProgress from './UploadProgress';
import TranscriptionStatus from '../Transcription/TranscriptionStatus';

interface FileWithProgress {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  uploadResponse?: any;
}

interface FileListProps {
  files: FileWithProgress[];
  onStartUpload: (file: FileWithProgress) => void;
  onRemoveFile: (fileId: string) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('video/')) {
    return (
      <svg className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }
  
  return (
    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
};

const getStatusIcon = (status: FileWithProgress['status']) => {
  switch (status) {
    case 'pending':
      return (
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'uploading':
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
    case 'error':
      return (
        <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
  }
};

export default function FileList({ files, onStartUpload, onRemoveFile }: FileListProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Upload Queue
        </h3>
      </div>
      
      <div className="divide-y divide-gray-200">
        {files.map((fileWithProgress) => (
          <div key={fileWithProgress.id} className="p-4">
            <div className="flex items-center space-x-4">
              {/* File Icon */}
              <div className="flex-shrink-0">
                {getFileIcon(fileWithProgress.file.type)}
              </div>
              
              {/* File Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {fileWithProgress.file.name}
                  </p>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(fileWithProgress.status)}
                    <span className={clsx(
                      'text-xs font-medium px-2 py-1 rounded-full',
                      {
                        'bg-gray-100 text-gray-800': fileWithProgress.status === 'pending',
                        'bg-blue-100 text-blue-800': fileWithProgress.status === 'uploading',
                        'bg-green-100 text-green-800': fileWithProgress.status === 'completed',
                        'bg-red-100 text-red-800': fileWithProgress.status === 'error',
                      }
                    )}>
                      {fileWithProgress.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                  <span>{formatFileSize(fileWithProgress.file.size)}</span>
                  <span>{fileWithProgress.file.type}</span>
                </div>
                
                {/* Progress Bar */}
                {(fileWithProgress.status === 'uploading' || fileWithProgress.status === 'completed') && (
                  <UploadProgress progress={fileWithProgress.progress} />
                )}
                
                {/* Error Message */}
                {fileWithProgress.status === 'error' && fileWithProgress.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {fileWithProgress.error}
                  </div>
                )}
                
                {/* Success Message */}
                {fileWithProgress.status === 'completed' && fileWithProgress.uploadResponse && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                    Upload successful! Starting transcription...
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex-shrink-0 flex space-x-2">
                {fileWithProgress.status === 'pending' && (
                  <button
                    onClick={() => onStartUpload(fileWithProgress)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Upload
                  </button>
                )}
                
                {fileWithProgress.status !== 'uploading' && (
                  <button
                    onClick={() => onRemoveFile(fileWithProgress.id)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            
            {/* Transcription Status */}
            {fileWithProgress.status === 'completed' && 
             fileWithProgress.uploadResponse?.data?.id && (
              <div className="mt-4">
                <TranscriptionStatus
                  videoId={fileWithProgress.uploadResponse.data.id}
                  jobId={fileWithProgress.uploadResponse.data.jobId}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}