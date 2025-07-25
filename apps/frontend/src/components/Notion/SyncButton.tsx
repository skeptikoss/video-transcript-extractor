import React, { useState } from 'react';
import { CloudArrowUpIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface SyncButtonProps {
  videoId: string;
  databaseId?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
  onSyncStart?: () => void;
  onSyncComplete?: (success: boolean, result?: any) => void;
}

interface SyncResult {
  success: boolean;
  pageId?: string;
  pageUrl?: string;
  duplicate?: boolean;
  message?: string;
  error?: string;
}

const SyncButton: React.FC<SyncButtonProps> = ({
  videoId,
  databaseId,
  disabled = false,
  size = 'md',
  variant = 'primary',
  onSyncStart,
  onSyncComplete
}) => {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    if (!databaseId) {
      alert('Please select a Notion database first');
      return;
    }

    setSyncing(true);
    setLastSyncResult(null);
    onSyncStart?.();

    try {
      const response = await fetch(`/api/notion/sync/transcript/${videoId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          databaseId
        })
      });

      const result: SyncResult = await response.json();
      setLastSyncResult(result);
      onSyncComplete?.(result.success, result);

      if (result.success) {
        // Optional: Show success notification
        console.log('Sync successful:', result);
      } else {
        console.error('Sync failed:', result.error);
      }
    } catch (error) {
      console.error('Sync request failed:', error);
      const errorResult: SyncResult = {
        success: false,
        error: 'Network error occurred'
      };
      setLastSyncResult(errorResult);
      onSyncComplete?.(false, errorResult);
    } finally {
      setSyncing(false);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  // Variant classes
  const baseClasses = "inline-flex items-center border font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200";
  
  const variantClasses = {
    primary: "border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-gray-400",
    secondary: "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
  };

  // Success state classes
  const successClasses = "border-transparent bg-green-600 text-white hover:bg-green-700";
  const errorClasses = "border-transparent bg-red-600 text-white hover:bg-red-700";

  // Determine classes based on state
  let buttonClasses = `${baseClasses} ${sizeClasses[size]}`;
  
  if (lastSyncResult?.success) {
    buttonClasses += ` ${successClasses}`;
  } else if (lastSyncResult?.success === false) {
    buttonClasses += ` ${errorClasses}`;
  } else {
    buttonClasses += ` ${variantClasses[variant]}`;
  }

  // Determine icon and text
  let icon;
  let text;

  if (syncing) {
    icon = (
      <svg className={`animate-spin -ml-1 mr-2 ${iconSizeClasses[size]} text-white`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    );
    text = 'Syncing...';
  } else if (lastSyncResult?.success) {
    icon = <CheckCircleIcon className={`-ml-1 mr-2 ${iconSizeClasses[size]}`} />;
    text = lastSyncResult.duplicate ? 'Updated' : 'Synced';
  } else if (lastSyncResult?.success === false) {
    icon = <ExclamationCircleIcon className={`-ml-1 mr-2 ${iconSizeClasses[size]}`} />;
    text = 'Failed';
  } else {
    icon = <CloudArrowUpIcon className={`-ml-1 mr-2 ${iconSizeClasses[size]}`} />;
    text = 'Sync to Notion';
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleSync}
        disabled={disabled || syncing || !databaseId}
        className={buttonClasses}
        title={
          !databaseId 
            ? 'Select a database first' 
            : lastSyncResult?.success 
              ? `Synced to Notion ${lastSyncResult.duplicate ? '(updated)' : '(new page)'}`
              : lastSyncResult?.error 
                ? lastSyncResult.error 
                : 'Sync transcript to Notion'
        }
      >
        {icon}
        {text}
      </button>

      {/* Success message with link */}
      {lastSyncResult?.success && lastSyncResult.pageUrl && (
        <div className="text-xs text-green-600">
          <a 
            href={lastSyncResult.pageUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-green-800 underline"
          >
            View in Notion →
          </a>
        </div>
      )}

      {/* Error message */}
      {lastSyncResult?.success === false && lastSyncResult.error && (
        <div className="text-xs text-red-600" title={lastSyncResult.error}>
          {lastSyncResult.error.length > 50 
            ? `${lastSyncResult.error.substring(0, 50)}...` 
            : lastSyncResult.error
          }
        </div>
      )}
    </div>
  );
};

export default SyncButton;