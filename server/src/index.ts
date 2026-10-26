import http from 'http';
import dotenv from 'dotenv';
import { app } from './app.js';
import { pool, checkDatabaseHealth } from './database/db.js';
import { migrate } from './database/migrate.js';
import { bootstrapOwner } from './database/bootstrapOwner.js';
import { initSocketGateway } from './realtime/socket.gateway.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const trustedOrigins = (process.env.TRUSTED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(s => s.trim());

async function startServer() {
  console.log('====================================================');
  console.log('⚡ Starting AI Automation Labs Connect — AI Automation Labs LLP');
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('====================================================');

  // Verify Database Connection
  const isHealthy = await checkDatabaseHealth();
  if (!isHealthy) {
    console.warn('[Warning] PostgreSQL is not yet responding. Retrying in 2 seconds...');
  } else {
    console.log('✅ PostgreSQL connected successfully.');
  }

  // Auto-run migrations and bootstrap on launch if needed
  try {
    await migrate();
    await bootstrapOwner();
  } catch (err: any) {
    console.error('Initialization warning (continuing if ready):', err.message);
  }

  const server = http.createServer(app);

  // Initialize Socket.IO Realtime Gateway
  initSocketGateway(server, trustedOrigins);

  server.listen(PORT, () => {
    console.log(`\n🎉 AI Automation Labs Connect Server is LIVE!`);
    console.log(`📡 HTTP REST API: http://localhost:${PORT}/api/v1`);
    console.log(`🩺 Health Live:   http://localhost:${PORT}/api/v1/health/live`);
    console.log(`🩺 Health Ready:  http://localhost:${PORT}/api/v1/health/ready`);
    console.log(`💻 Web Client:    http://localhost:${PORT}\n`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[Shutdown] Received ${signal}. Closing server gracefully...`);
    server.close(() => {
      console.log('[Shutdown] HTTP & Socket.IO server closed.');
      pool.end(() => {
        console.log('[Shutdown] Database connections closed.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('[Fatal Error] Failed to start AI Automation Labs Connect server:', err);
  process.exit(1);
});
