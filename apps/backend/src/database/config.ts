import { DataSource } from 'typeorm';
import path from 'path';
import { Video } from './entities/Video';
import { Transcript } from './entities/Transcript';
import { Job } from './entities/Job';

const isDevelopment = process.env.NODE_ENV === 'development';
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, '../../../data/app.db');

// Ensure data directory exists
const dataDir = path.dirname(databasePath);
if (!require('fs').existsSync(dataDir)) {
  require('fs').mkdirSync(dataDir, { recursive: true });
}

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: databasePath,
  synchronize: isDevelopment, // Use synchronize in development for easier testing
  logging: isDevelopment ? ['query', 'error'] : ['error'],
  entities: [Video, Transcript, Job],
  migrations: [path.join(__dirname, './migrations/*.ts')],
  subscribers: [path.join(__dirname, './subscribers/*.ts')]
});

export default AppDataSource;