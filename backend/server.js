import express from 'express';
import mongoose from "mongoose";
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { initializeSocket } from './sockets/socket.js';

import authRoutes from './routes/auth.routes.js';
import taskRoutes from './routes/task.routes.js';
import userRoutes from './routes/user.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Create HTTP server explicitly for Socket.IO
const server = createServer(app);

// Initialize Socket.IO
initializeSocket(server);

// Production security middleware
if (isProduction) {
  app.use(helmet());
  app.use(compression());
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  });
  app.use(limiter);
}

// Enhanced CORS configuration
const corsOptions = {
  origin: isProduction 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const __dirname = path.resolve();

// Serve static files from React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Database connection with enhanced options for production
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint with more robust checks
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const memoryUsage = process.memoryUsage();
  
  res.json({ 
    status: dbStatus === 'connected' ? 'OK' : 'WARNING',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    uptime: process.uptime(),
    memoryUsage: {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    },
    onlineUsers: getOnlineUsersCount()
  });
});

// Serve React app - must be after API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Enhanced error handling
app.use((err, req, res, next) => {
  console.error('🚨 Error:', err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = isProduction && !err.isOperational
    ? 'Something went wrong!'
    : err.message;
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(!isProduction && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  if (isProduction) {
    server.close(() => {
      process.exit(1);
    });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  if (isProduction) {
    server.close(() => {
      process.exit(1);
    });
  }
});

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
};

startServer();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});