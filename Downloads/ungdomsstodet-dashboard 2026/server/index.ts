/**
 * Ungdomsstöd V2 API Server
 * Express server with TypeScript, authentication, and full CRUD operations
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
// import bcrypt from 'bcryptjs'; // Not used in main server file
import { initDatabase, closeDatabase } from './database/connection.js';
import { idempotencyMiddleware } from './utils/idempotency.js';
import { cleanupExpiredIdempotencyKeys } from './utils/idempotency.js';
import { nowInStockholm, getCurrentWeekId, getCurrentMonthId } from './utils/timezone.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import clientRoutes from './routes/clients.js';
import carePlanRoutes from './routes/care-plans.js';
import weeklyDocRoutes from './routes/weekly-docs.js';
import monthlyReportRoutes from './routes/monthly-reports.js';
import vismaTimeRoutes from './routes/visma-time.js';
import dashboardRoutes from './routes/dashboard.js';
import { initializeAuditRoutes } from './routes/audit-logs.js';
import { initializeFeatureFlagRoutes } from './routes/feature-flags.js';
import AuditLogger, { auditMiddleware } from './utils/audit-logger.js';
import type { JwtPayload } from './types/database.js';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Global audit logger instance
let auditLogger: AuditLogger;

// Development token for testing
const DEV_TOKEN = 'dev-token-for-testing';

// Middleware - Enhanced security headers
const helmetConfig = NODE_ENV === 'production' 
  ? {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for React
          styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          formAction: ["'self'"],
          baseUri: ["'self'"],
          manifestSrc: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false, // Disable for compatibility
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      xFrameOptions: { action: 'deny' },
      xContentTypeOptions: true,
      referrerPolicy: { policy: ['strict-origin-when-cross-origin'] },
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: []
      }
    }
  : {
      contentSecurityPolicy: false, // Disable for development
      crossOriginEmbedderPolicy: false
    };

app.use(helmet(helmetConfig));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5175',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Please try again later'
  }
});

app.use('/api/', limiter);

// Idempotency middleware
app.use('/api/', idempotencyMiddleware());

// Audit logging middleware (will be initialized after database connection)

// Request logging in development
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: nowInStockholm().toISOString(),
      timezone: 'Europe/Stockholm',
      weekId: getCurrentWeekId(),
      monthId: getCurrentMonthId(),
      environment: NODE_ENV
    }
  });
});

// Authentication middleware
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const devToken = req.headers['x-dev-token'] as string;

  // Allow dev token in development
  if (NODE_ENV === 'development' && devToken === DEV_TOKEN) {
    req.user = {
      userId: 'dev-user',
      email: 'dev@example.com',
      role: 'admin',
      iat: Date.now() / 1000,
      exp: (Date.now() / 1000) + 3600
    } as JwtPayload;
    return next();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required',
      message: 'Please provide a valid authentication token'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid token',
      message: 'The provided token is invalid or expired'
    });
  }
}

// Admin middleware
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'This operation requires administrator privileges'
    });
  }
  next();
}

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/clients', authenticateToken, clientRoutes);
app.use('/api/care-plans', authenticateToken, carePlanRoutes);
app.use('/api/weekly-docs', authenticateToken, weeklyDocRoutes);
app.use('/api/monthly-reports', authenticateToken, monthlyReportRoutes);
app.use('/api/visma-time', authenticateToken, vismaTimeRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);

// Admin routes
app.use('/api/admin', authenticateToken, requireAdmin, async (req, res) => {
  const idempotencyModule = await import('./utils/idempotency.js');
  res.json({
    success: true,
    data: {
      message: 'Admin panel',
      stats: {
        idempotency: idempotencyModule.getIdempotencyStats(),
        timezone: 'Europe/Stockholm',
        currentTime: nowInStockholm().toISOString()
      }
    }
  });
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  closeDatabase();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize database
    const db = await initDatabase();
    
    // Initialize audit logger
    auditLogger = new AuditLogger(db);
    
    // Add audit middleware to API routes
    app.use('/api/', auditMiddleware(auditLogger));
    
    // Initialize audit routes
    const auditRoutes = initializeAuditRoutes(db);
    app.use('/api/audit-logs', authenticateToken, auditRoutes);
    
    // Initialize feature flag routes
    const featureRoutes = initializeFeatureFlagRoutes(db);
    app.use('/api/feature-flags', authenticateToken, featureRoutes);
    
    // Clean up expired idempotency keys on startup
    cleanupExpiredIdempotencyKeys();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🕐 Timezone: Europe/Stockholm`);
      console.log(`📅 Current week: ${getCurrentWeekId()}`);
      console.log(`📅 Current month: ${getCurrentMonthId()}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      
      if (NODE_ENV === 'development') {
        console.log(`🔑 Dev token: ${DEV_TOKEN}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Schedule cleanup of expired idempotency keys every hour
setInterval(cleanupExpiredIdempotencyKeys, 60 * 60 * 1000);

startServer();

