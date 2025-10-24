import dotenv from 'dotenv';

// IMPORTANT: Load environment variables FIRST, before any other imports
// This ensures DATABASE_URL and other env vars are available when modules initialize
// In test environment, don't load .env to avoid overriding test environment variables
if (process.env['NODE_ENV'] !== 'test') {
  dotenv.config();
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import mealsRoutes from './routes/meals';
import dashboardRoutes from './routes/dashboard';

const app = express();
const PORT = process.env['PORT'] || 3000;

// Configure Helmet with relaxed CSP for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow onclick handlers
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"], // Allow CDN for source maps
      fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: null, // Disable HTTPS upgrade for local development
    },
  },
}));
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
// In production (compiled), files are in dist/public
// In development, files are in src/public
const publicPath = process.env['NODE_ENV'] === 'production' ? 'dist/public' : 'src/public';
app.use(express.static(publicPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/meals', mealsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve index.html at root
app.get('/', (_req, res) => {
  res.sendFile('index.html', { root: publicPath });
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] || 'development'
  });
});

interface CustomError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

app.use((err: CustomError, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`Error ${statusCode}: ${message}`);
  console.error(err.stack);

  res.status(statusCode).json({
    error: {
      message: process.env['NODE_ENV'] === 'production' ? 'Something went wrong' : message,
      ...(process.env['NODE_ENV'] !== 'production' && { stack: err.stack })
    }
  });
});

app.use('*', (_req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found'
    }
  });
});

if (process.env['NODE_ENV'] !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
  });
}

export default app;