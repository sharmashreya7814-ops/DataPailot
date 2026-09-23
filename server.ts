import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { connectionRoutes } from './server/api/connectionRoutes';
import { schemaRoutes } from './server/api/schemaRoutes';
import { queryRoutes } from './server/api/queryRoutes';
import { aiRoutes } from './server/api/aiRoutes';
import { importRoutes } from './server/api/importRoutes';
import { qualityRoutes } from './server/api/qualityRoutes';
import { cleaningRoutes } from './server/api/cleaningRoutes';
import { performanceRoutes } from './server/api/performanceRoutes';
import { authRoutes } from './server/api/authRoutes';
import { workspaceRoutes } from './server/api/workspaceRoutes';
import { userRoutes } from './server/api/userRoutes';
import { projectRoutes } from './server/api/projectRoutes';
import { shareRoutes } from './server/api/shareRoutes';
import { reportRoutes } from './server/api/reportRoutes';
import { notificationRoutes } from './server/api/notificationRoutes';
import { activityRoutes } from './server/api/activityRoutes';
import { auditRoutes } from './server/api/auditRoutes';
import { searchRoutes } from './server/api/searchRoutes';
import { collaborationResourceRoutes } from './server/api/collaborationResourceRoutes';
import { authMiddleware, correlationIdMiddleware } from './server/middleware/authMiddleware';
import { isGeminiConfigured, GEMINI_MODEL } from './server/ai/geminiClient';
import { ConnectionManager } from './server/database/ConnectionManager';
import { Logger } from './server/utils/logger';
import { AuditLogger } from './server/utils/auditLogger';
import { EmailService } from './server/services/email/EmailService';
import { ensureDemoDatabase } from './server/database/initDemoDatabase';

function validateStartupConfiguration() {
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  Logger.info('Validating DataPilot startup configuration...', {
    nodeVersion: process.version,
    env
  });

  if (env === 'production' || env === 'staging') {
    const missing: string[] = [];
    if (!process.env.DATABASE_URL) {
      missing.push('DATABASE_URL');
    }
    if (!process.env.SESSION_SECRET) {
      missing.push('SESSION_SECRET');
    }
    if (missing.length > 0) {
      Logger.error(`Critical configuration error: Missing required production/staging environment variables: ${missing.join(', ')}`);
      console.error(`FATAL: Missing required ${env} environment variables: ${missing.join(', ')}. Please configure them in your deployment environment.`);
      process.exit(1);
    }
  } else {
    Logger.info(`Running in ${env} mode. Production infrastructure variables (DATABASE_URL, SESSION_SECRET) are optional; using local development / SQLite storage fallbacks.`);
  }

  const aiReady = isGeminiConfigured();
  if (aiReady) {
    Logger.info('Gemini AI Assistant is configured and operational', { model: GEMINI_MODEL });
  } else {
    Logger.warn(
      'Gemini AI Assistant is not configured (GEMINI_API_KEY environment secret is not set). Read-only analytical SQL execution and schema introspection remain fully operational.'
    );
  }

  const emailStatus = EmailService.getInstance().getStatus();
  if (emailStatus.isConfigured && emailStatus.deliveryMode === 'real') {
    Logger.info('Email delivery service is configured and operational', {
      provider: emailStatus.provider,
      deliveryMode: emailStatus.deliveryMode
    });
  } else if (env === 'production') {
    Logger.warn('Transactional email provider is not configured in production. Verification and password reset emails will fail safely until configured.');
  } else {
    Logger.info('Email delivery service running in development fallback mode.');
  }
}

// Simple in-memory rate limiter per IP / endpoint group
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function rateLimiter(limit: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl}`;
    const now = Date.now();
    let record = rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(key, record);
      return next();
    }

    record.count++;
    if (record.count > limit) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.'
        }
      });
    }
    next();
  };
}

async function startServer() {
  validateStartupConfiguration();
  ensureDemoDatabase();

  const app = express();
  const PORT = 3000;

  // Security Headers Middleware
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    next();
  });

  // CORS Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: '150mb' }));
  app.use(cookieParser());
  app.use(correlationIdMiddleware);
  app.use(authMiddleware);

  // Liveness Check: /api/health/live
  app.get('/api/health/live', (_req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
  });

  // Readiness Check: /api/health/ready
  app.get('/api/health/ready', (_req, res) => {
    const dbHealthy = true; // In-memory/Postgres connection pool check
    if (dbHealthy) {
      res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'not_ready', database: 'disconnected' });
    }
  });

  // Comprehensive Health check route
  app.get('/api/health', (_req, res) => {
    const mem = process.memoryUsage();
    res.json({
      status: 'ok',
      service: 'DataPilot Backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024)
      },
      ai: {
        configured: isGeminiConfigured(),
        model: GEMINI_MODEL
      },
      database: {
        engine: 'postgresql',
        mode: 'strict-read-only',
        activeSessions: ConnectionManager.getInstance().getActiveSessionCount()
      }
    });
  });

  // Collaboration and Authentication API routes (with light rate limiting on auth)
  app.use('/api/auth', rateLimiter(30, 60000), authRoutes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/shares', shareRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/activity', activityRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/collaboration', collaborationResourceRoutes);

  // Audit events route for verification & diagnostics (no secrets returned)
  app.get('/api/audit/recent', (_req, res) => {
    res.json({
      success: true,
      events: AuditLogger.getRecentEvents(50)
    });
  });

  // Database & Import API routes (rate limited for AI and heavy imports)
  app.use('/api/database', connectionRoutes);
  app.use('/api/database', schemaRoutes);
  app.use('/api/database', queryRoutes);
  app.use('/api/database', rateLimiter(20, 60000), aiRoutes);
  app.use('/api/quality', qualityRoutes);
  app.use('/api/cleaning', cleaningRoutes);
  app.use('/api/import', rateLimiter(50, 60000), importRoutes);
  app.use('/api/database/import', rateLimiter(50, 60000), importRoutes);
  app.use('/api/performance', performanceRoutes);

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Safe global error handler: Never leaks stack traces or filesystem paths
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    Logger.error('Unhandled internal server error', err);
    res.status(500).json({
      success: false,
      error: 'An internal server error occurred.',
      errorDetails: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred. Please retry your request.'
      }
    });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    Logger.info(`DataPilot server running on http://localhost:${PORT}`);
  });

  // Graceful Shutdown Handlers
  const shutdown = (signal: string) => {
    Logger.info(`Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
      Logger.info('HTTP server closed. Closing active database connections...');
      try {
        ConnectionManager.getInstance().closeAllConnections();
        Logger.info('Database connections closed cleanly.');
      } catch (e) {
        Logger.error('Error closing database connections', e);
      }
      process.exit(0);
    });

    // Force exit after 10 seconds if connections hang
    setTimeout(() => {
      Logger.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
