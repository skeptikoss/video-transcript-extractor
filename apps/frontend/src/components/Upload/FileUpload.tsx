import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { uploadFile } from '../../services/uploadService';
import FileList from './FileList';
import UploadProgress from './UploadProgress';

interface FileWithProgress {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  uploadResponse?: any;
}

const ACCEPTED_TYPES = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/webm': ['.webm'],
};

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_FILES = 10;

export default function FileUpload() {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, fileId }: { file: File; fileId: string }) => {
      const response = await uploadFile(file, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, progress, status: 'uploading' as const }
              : f
          )
        );
      });
      return { response, fileId };
    },
    onSuccess: ({ response, fileId }) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, status: 'completed', progress: 100, uploadResponse: response }
            : f
        )
      );
      queryClient.invalidateQueries({ queryKey: ['uploads'] });
    },
    onError: (error: any, { fileId }) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { 
                ...f, 
                status: 'error', 
                error: error.response?.data?.error || error.message || 'Upload failed' 
              }
            : f
        )
      );
    },
  });

  const onDrop = (acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map((rejected) => {
        const { file, errors } = rejected;
        return `${file.name}: ${errors.map((e: any) => e.message).join(', ')}`;
      });
      alert(`Some files were rejected:\n${errors.join('\n')}`);
    }

    // Check total file limit
    if (files.length + acceptedFiles.length > MAX_FILES) {
      alert(`Maximum ${MAX_FILES} files allowed. Selected ${acceptedFiles.length} files, but you already have ${files.length}.`);
      return;
    }

    // Add accepted files to the list
    const newFiles: FileWithProgress[] = acceptedFiles.map((file) => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      progress: 0,
      status: 'pending',
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES - files.length,
    multiple: true,
  });

  const startUpload = (fileWithProgress: FileWithProgress) => {
    if (fileWithProgress.status === 'pending') {
      uploadMutation.mutate({ 
        file: fileWithProgress.file, 
        fileId: fileWithProgress.id 
      });
    }
  };

  const startAllUploads = () => {
    files
      .filter((f) => f.status === 'pending')
      .forEach((fileWithProgress) => {
        startUpload(fileWithProgress);
      });
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'completed'));
  };

  const pendingFiles = files.filter((f) => f.status === 'pending').length;
  const uploadingFiles = files.filter((f) => f.status === 'uploading').length;
  const completedFiles = files.filter((f) => f.status === 'completed').length;
  const errorFiles = files.filter((f) => f.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          {
            'border-blue-300 bg-blue-50': isDragActive && !isDragReject,
            'border-red-300 bg-red-50': isDragReject,
            'border-gray-300 hover:border-gray-400': !isDragActive && !isDragReject,
          }
        )}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          <div className="text-gray-400">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <div>
            {isDragActive ? (
              isDragReject ? (
                <p className="text-red-600 font-medium">
                  Some files are not supported
                </p>
              ) : (
                <p className="text-blue-600 font-medium">
                  Drop the files here...
                </p>
              )
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drag & drop video files here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Supports MP4, MOV, AVI, WebM files up to 500MB each
                  <br />
                  Maximum {MAX_FILES} files at once
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File List and Controls */}
      {files.length > 0 && (
        <div className="space-y-4">
          {/* Status Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6 text-sm">
                <span className="text-gray-600">
                  {files.length} file{files.length !== 1 ? 's' : ''} total
                </span>
                {pendingFiles > 0 && (
                  <span className="text-yellow-600">
                    {pendingFiles} pending
                  </span>
                )}
                {uploadingFiles > 0 && (
                  <span className="text-blue-600">
                    {uploadingFiles} uploading
                  </span>
                )}
                {completedFiles > 0 && (
                  <span className="text-green-600">
                    {completedFiles} completed
                  </span>
                )}
                {errorFiles > 0 && (
                  <span className="text-red-600">
                    {errorFiles} failed
                  </span>
                )}
              </div>
              
              <div className="flex space-x-2">
                {pendingFiles > 0 && (
                  <button
                    onClick={startAllUploads}
                    disabled={uploadMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    Upload All ({pendingFiles})
                  </button>
                )}
                
                {completedFiles > 0 && (
                  <button
                    onClick={clearCompleted}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
                  >
                    Clear Completed
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* File List */}
          <FileList 
            files={files} 
            onStartUpload={startUpload}
            onRemoveFile={removeFile}
          />
        </div>
      )}
    </div>
  );
}