import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, ExclamationTriangleIcon, CircleStackIcon } from '@heroicons/react/24/outline';

interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  properties: Record<string, any>;
}

interface DatabaseSelectorProps {
  selectedDatabaseId?: string;
  onDatabaseSelect: (databaseId: string) => void;
  disabled?: boolean;
}

const DatabaseSelector: React.FC<DatabaseSelectorProps> = ({
  selectedDatabaseId,
  onDatabaseSelect,
  disabled = false
}) => {
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notionConfigured, setNotionConfigured] = useState<boolean | null>(null);

  // Check Notion configuration status
  useEffect(() => {
    const checkNotionStatus = async () => {
      try {
        const response = await fetch('/api/notion/status');
        const data = await response.json();
        setNotionConfigured(data.configured);
      } catch (error) {
        console.error('Failed to check Notion status:', error);
        setNotionConfigured(false);
      }
    };

    checkNotionStatus();
  }, []);

  // Load databases when component mounts or when opened
  useEffect(() => {
    if (notionConfigured && isOpen && databases.length === 0) {
      loadDatabases();
    }
  }, [notionConfigured, isOpen, databases.length]);

  const loadDatabases = async () => {
    if (!notionConfigured) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/notion/databases');
      const data = await response.json();

      if (data.success) {
        setDatabases(data.databases);
      } else {
        setError(data.error || 'Failed to load databases');
      }
    } catch (error) {
      console.error('Failed to fetch databases:', error);
      setError('Failed to connect to Notion. Please check your configuration.');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/notion/test-connection');
      const data = await response.json();

      if (data.success) {
        setNotionConfigured(true);
        loadDatabases();
      } else {
        setError(data.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setError('Failed to test connection. Please check your Notion API key.');
    } finally {
      setLoading(false);
    }
  };

  const selectedDatabase = databases.find(db => db.id === selectedDatabaseId);

  // If Notion is not configured
  if (notionConfigured === false) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Notion Database
        </label>
        <div className="border-2 border-dashed border-red-300 rounded-lg p-6 text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-red-900">Notion Not Configured</h3>
          <p className="mt-1 text-sm text-red-700">
            Please add your Notion API key to the environment variables to enable sync functionality.
          </p>
          <div className="mt-4">
            <button
              onClick={testConnection}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label htmlFor="database-select" className="block text-sm font-medium text-gray-700">
        Select Notion Database
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || loading}
          className="relative w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selectedDatabase ? (
            <div className="flex items-center">
              <CircleStackIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="block truncate">{selectedDatabase.title}</span>
            </div>
          ) : (
            <div className="flex items-center">
              <CircleStackIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="block truncate text-gray-500">
                {loading ? 'Loading databases...' : 'Choose a database'}
              </span>
            </div>
          )}
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <ChevronDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
            {loading ? (
              <div className="py-4 text-center text-gray-500">
                Loading databases...
              </div>
            ) : error ? (
              <div className="py-4 px-4">
                <div className="text-red-600 text-sm">{error}</div>
                <button
                  onClick={loadDatabases}
                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            ) : databases.length === 0 ? (
              <div className="py-4 px-4 text-center text-gray-500">
                <CircleStackIcon className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                <p className="text-sm">No databases found</p>
                <p className="text-xs text-gray-400 mt-1">
                  Make sure your Notion integration has access to databases
                </p>
              </div>
            ) : (
              databases.map((database) => (
                <button
                  key={database.id}
                  onClick={() => {
                    onDatabaseSelect(database.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                    selectedDatabaseId === database.id ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <CircleStackIcon className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <div className="font-medium">{database.title}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {Object.keys(database.properties).length} properties
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {error && !isOpen && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {selectedDatabase && (
        <div className="text-xs text-gray-500">
          <a 
            href={selectedDatabase.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
          >
            View in Notion →
          </a>
        </div>
      )}
    </div>
  );
};

export default DatabaseSelector;