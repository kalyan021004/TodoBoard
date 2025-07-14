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
import checkDiskSpace from 'check-disk-space';

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
const allowedOrigins = isProduction 
  ? [
      process.env.FRONTEND_URL,
      'https://todo-board-five.vercel.app', // keep for backward compatibility
      'https://todo-board-1.vercel.app'    // your current frontend
    ].filter(Boolean) // remove any undefined values
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const __dirname = path.resolve();

// Serve static files from React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Database connection with enhanced options for production
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Verify the connection
    await mongoose.connection.db.admin().ping();
    console.log('🗄️ Database ping successful');

  } catch (error) {
    console.error('❌ MongoDB connection failed:', {
      error: error.message,
      stack: error.stack,
      env: process.env.MONGODB_URI ? 'URI exists' : 'URI missing!'
    });
    process.exit(1);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

// Health check endpoints
app.get('/', async (req, res) => {
  try {
    const diskInfo = await checkDiskSpace('C:');

    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const memoryUsage = process.memoryUsage();

    res.json({
      status: 'Server is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: dbStatus,
      diskUsage: {
        free: `${(diskInfo.free / 1024 / 1024).toFixed(2)} MB`,
        total: `${(diskInfo.size / 1024 / 1024).toFixed(2)} MB`,
        used: `${((diskInfo.size - diskInfo.free) / 1024 / 1024).toFixed(2)} MB`
      },
      memoryUsage: {
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      },
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Could not complete health check',
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Serve React app - must be after API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Enhanced error handler
app.use((err, req, res, next) => {
  console.error('🚨 Detailed Error:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    statusCode: err.statusCode,
    isOperational: err.isOperational,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    }
  });

  const statusCode = err.statusCode || 500;
  const message = isProduction && !err.isOperational
    ? 'Something went wrong!'
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(!isProduction && { 
      stack: err.stack,
      details: err.details 
    })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Server error handling
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Process error handling
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  if (isProduction) {
    server.close(() => {
      process.exit(1);
    });
  }
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  if (isProduction) {
    server.close(() => {
      process.exit(1);
    });
  }
});

// Memory monitoring
setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`Memory usage: ${Math.round(used * 100) / 100} MB`);
}, 10000);

// Start server
const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();