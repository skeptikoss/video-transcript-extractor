import apiClient from '../lib/api';

export interface UploadResponse {
  success: boolean;
  data?: {
    id: string;
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    uploadPath: string;
    status: string;
    createdAt: string;
  };
  error?: string;
}

export interface Upload {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadPath: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadsListResponse {
  success: boolean;
  data?: {
    uploads: Upload[];
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
}

export const uploadFile = async (
  file: File,
  onProgress?: (progressEvent: { loaded: number; total: number }) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('video', file);

  const response = await apiClient.post<UploadResponse>('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onProgress,
  });

  return response.data;
};

export const getUploads = async (page = 1, limit = 10): Promise<UploadsListResponse> => {
  const response = await apiClient.get<UploadsListResponse>('/api/upload', {
    params: { page, limit },
  });
  
  return response.data;
};

export const getUpload = async (id: string): Promise<UploadResponse> => {
  const response = await apiClient.get<UploadResponse>(`/api/upload/${id}`);
  return response.data;
};

export const deleteUpload = async (id: string): Promise<{ success: boolean; error?: string }> => {
  const response = await apiClient.delete(`/api/upload/${id}`);
  return response.data;
};