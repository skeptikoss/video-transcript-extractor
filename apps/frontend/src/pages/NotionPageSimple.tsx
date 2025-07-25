import React, { useState, useEffect } from 'react';

interface Video {
  id: string;
  originalName: string;
  status: string;
  createdAt: string;
}

const NotionPageSimple: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [notionStatus, setNotionStatus] = useState<'loading' | 'configured' | 'not-configured'>('loading');

  useEffect(() => {
    // Check Notion status
    fetch('http://localhost:3000/api/notion/status')
      .then(res => res.json())
      .then(data => {
        setNotionStatus(data.configured ? 'configured' : 'not-configured');
      })
      .catch(() => setNotionStatus('not-configured'));

    // Fetch videos
    fetch('http://localhost:3000/api/upload')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setVideos(data.data.videos);
        }
      })
      .catch(err => console.error('Failed to fetch videos:', err));
  }, []);

  const testNotionConnection = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/notion/test-connection');
      const data = await response.json();
      alert(data.success ? 'Notion connection successful!' : `Connection failed: ${data.error}`);
    } catch (error) {
      alert('Connection test failed');
    }
  };

  const syncToNotion = async (videoId: string) => {
    if (!selectedDatabase) {
      alert('Please select a database first');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/api/notion/sync/transcript/${videoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseId: selectedDatabase })
      });

      const result = await response.json();
      if (result.success) {
        alert(`Transcript synced successfully! ${result.pageUrl ? 'View in Notion: ' + result.pageUrl : ''}`);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      alert('Sync failed: Network error');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Notion Sync
      </h1>
      
      {/* Notion Status */}
      <div style={{ 
        backgroundColor: notionStatus === 'configured' ? '#ecfdf5' : '#fef2f2', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '2rem',
        border: `1px solid ${notionStatus === 'configured' ? '#d1fae5' : '#fecaca'}`
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0' }}>
          Notion Status: {notionStatus === 'loading' ? 'Checking...' : notionStatus === 'configured' ? 'Configured ✅' : 'Not Configured ❌'}
        </h3>
        <button 
          onClick={testNotionConnection}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Connection
        </button>
      </div>

      {/* Database Selection */}
      {notionStatus === 'configured' && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Database Selection</h3>
          <input
            type="text"
            placeholder="Enter Notion Database ID"
            value={selectedDatabase}
            onChange={(e) => setSelectedDatabase(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              marginBottom: '0.5rem'
            }}
          />
          <button
            onClick={() => setSelectedDatabase('8265b6569a624ed9bd694965d00d0763')}
            style={{
              backgroundColor: '#f3f4f6',
              color: '#374151',
              padding: '0.25rem 0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              marginBottom: '0.5rem'
            }}
          >
            Use Your Database ID
          </button>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Your database ID: 8265b6569a624ed9bd694965d00d0763
          </p>
        </div>
      )}

      {/* Videos List */}
      <div>
        <h3>Videos Available for Sync</h3>
        {videos.length === 0 ? (
          <p>No videos uploaded yet. Upload a video first!</p>
        ) : (
          <div>
            {videos.map((video) => (
              <div 
                key={video.id}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>{video.originalName}</h4>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                      Status: {video.status} | Uploaded: {new Date(video.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => syncToNotion(video.id)}
                    disabled={!selectedDatabase || video.status !== 'completed'}
                    style={{
                      backgroundColor: video.status === 'completed' && selectedDatabase ? '#10b981' : '#9ca3af',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: video.status === 'completed' && selectedDatabase ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {video.status === 'completed' ? 'Sync to Notion' : 'Transcription Pending'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{ 
        backgroundColor: '#f3f4f6', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginTop: '2rem' 
      }}>
        <h4>How to use:</h4>
        <ol>
          <li>Make sure your Notion integration is configured (check status above)</li>
          <li>Enter your Notion database ID</li>
          <li>Wait for video transcription to complete</li>
          <li>Click "Sync to Notion" to send the transcript to your database</li>
        </ol>
      </div>
    </div>
  );
};

export default NotionPageSimple;