import apiClient from '../lib/api';

export interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
}

export interface DetailedHealthStatus extends HealthStatus {
  database: {
    connected: boolean;
    stats: {
      videos: number;
      transcripts: number;
      jobs: number;
    };
  };
  storage: {
    available: boolean;
    uploadsDirectory: string;
  };
}

export const getHealthStatus = async (): Promise<HealthStatus> => {
  const response = await apiClient.get<HealthStatus>('/api/health');
  return response.data;
};

export const getDetailedHealthStatus = async (): Promise<DetailedHealthStatus> => {
  const response = await apiClient.get<DetailedHealthStatus>('/api/health/detailed');
  return response.data;
};