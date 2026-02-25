import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import prisma from './lib/prisma';

import authRoutes from './routes/auth';
import leadRoutes from './routes/leads';
import taskRoutes from './routes/tasks';
import adminRoutes from './routes/admin';
import dashboardRoutes from './routes/dashboard';
import eodRoutes from './routes/eod';
import projectRoutes from './routes/projects';
import activityRoutes from './routes/activity';
import attendanceRoutes from './routes/attendance';
import leaveRoutes from './routes/leaves';
import reportRoutes from './routes/reports';
import productRoutes from './routes/products';
import { errorHandler } from './middleware/errorHandler';
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// SRE: Brute-force protection for sensitive endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Increased for development/testing
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:3001', 'https://mediaa-masala-crm.vercel.app'];

console.log('🌍 Allowed Origins:', allowedOrigins);

app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(limiter);

app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/eod', eodRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/products', productRoutes);

// Global Error Handler
app.use(errorHandler);

app.get('/health', async (req, res) => {
  try {
    // SRE: Active DB check
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date() });
  } catch (err) {
    console.error('CRITICAL: Health check failed - DB unreachable');
    res.status(503).json({ status: 'error', database: 'unreachable', message: 'Service unavailable' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Backend server running at http://localhost:${port}`);
});
