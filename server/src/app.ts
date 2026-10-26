import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { apiRouter } from './routes/api.routes.js';
import { checkDatabaseHealth } from './database/db.js';

export const app = express();

// Trust reverse proxy (Caddy / Nginx / Cloudflare / AWS ALB)
app.set('trust proxy', 1);

const trustedOrigins = (process.env.TRUSTED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(s => s.trim());

// Request Correlation ID and Security Headers
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('X-Request-ID', correlationId);
  (req as any).requestId = correlationId;

  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (trustedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev/local demo
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Serve static assets from public folder
const searchPublicDirs = [
  path.join(__dirname, '../../public'),
  path.resolve(process.cwd(), 'public'),
  path.resolve(process.cwd(), '../public'),
];
const publicDir = searchPublicDirs.find(p => fs.existsSync(p)) || path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

// Root Health and Readiness Probes (for Docker, Kubernetes, AWS, Render, Railway)
app.get(['/health', '/health/live', '/healthz'], (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get(['/health/ready', '/ready'], async (_req: Request, res: Response) => {
  const dbReady = await checkDatabaseHealth();
  if (!dbReady) {
    return res.status(503).json({ status: 'degraded', database: 'disconnected' });
  }
  res.status(200).json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
});

// Mount REST API
app.use('/api/v1', apiRouter);

// Fallback to index.html for SPA client navigation
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.path} not found.`,
        requestId: (req as any).requestId,
      },
    });
  }
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>AI Automation Labs Connect</title></head>
          <body style="font-family: sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <div style="text-align: center;">
              <h1>⚡ AI Automation Labs Connect API is Running</h1>
              <p>Explore endpoints at <code>/api/v1/health/live</code></p>
            </div>
          </body>
        </html>
      `);
    }
  });
});

// Global Error Handler conforming to PRD Section 9
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');
  const message = err.message || 'An unexpected error occurred.';
  const requestId = (req as any).requestId;

  if (status === 500) {
    console.error(`[Unhandled Error] [${requestId}]`, err);
  }

  res.status(status).json({
    error: {
      code,
      message,
      requestId,
    },
  });
});
