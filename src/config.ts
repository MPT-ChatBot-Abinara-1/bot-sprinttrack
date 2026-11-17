import dotenv from 'dotenv';

dotenv.config();

export const config = {
  sessionDir: process.env.SESSION_DIR || './auth_info',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000/api/v1',
};
