interface UploadProgressProps {
  progress: number;
  className?: string;
}

export default function UploadProgress({ progress, className = '' }: UploadProgressProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
        <span>Upload Progress</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        >
          <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}