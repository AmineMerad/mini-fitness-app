import dotenv from 'dotenv';
import * as path from 'path';

// Set NODE_ENV to test to prevent app from starting server
process.env['NODE_ENV'] = 'test';

// Load environment variables before any tests run
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath, override: true });
