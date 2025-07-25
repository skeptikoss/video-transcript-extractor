import FileUpload from '../components/Upload/FileUpload';

export default function UploadPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Upload Videos for Transcription
        </h1>
        <p className="text-gray-600">
          Upload MP4, MOV, AVI, or WebM video files to extract transcripts using AI. 
          Files will be processed automatically and transcripts will be available for sync to Notion.
        </p>
      </div>
      
      <FileUpload />
    </div>
  );
}