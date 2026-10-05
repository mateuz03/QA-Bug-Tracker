import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const port = Number(process.env.PORT ?? 3001);

export const config = {
  port,
  jwtSecret: process.env.JWT_SECRET ?? 'desenvolvimento-nao-use-em-producao',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  integrationEncryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY
    ?? process.env.JWT_SECRET
    ?? 'desenvolvimento-nao-use-em-producao',
  githubApiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com'
};
