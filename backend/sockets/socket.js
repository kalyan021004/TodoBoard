import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

let io;
const onlineUsers = new Map(); // Tracks online users by userId

const isProd = process.env.NODE_ENV === 'production';

// Rate limiter for Socket.IO auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 auth attempts per window
  message: 'Too many authentication attempts, please try again later.'
});

// Allowed origins (strict in production)
const allowedOrigins = isProd
  ? process.env.FRONTEND_URL.split(',') // Comma-separated in .env
  : ['http://localhost:5000', 'http://127.0.0.1:5173'];

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: isProd 
        ? allowedOrigins // Strict origin match
        : (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
            } else {
              console.warn(`❌ Blocked origin: ${origin}`);
              callback(new Error('Not allowed by CORS'));
            }
          },
      credentials: true,
      methods: ['GET', 'POST'] // Minimal methods
    },
    // Production-optimized settings
    pingInterval: 25000,  // 25s (reduces unnecessary traffic)
    pingTimeout: 20000,   // 20s (faster failure detection)
    maxHttpBufferSize: 1e6, // 1MB max payload
    serveClient: false,   // Disable client file serving
    transports: ['websocket'], // WS-only in production
    connectionStateRecovery: {
      maxDisconnectionDuration: 5 * 60 * 1000, // 5min recovery window
      skipMiddlewares: true
    }
  });

  console.log('🚀 Socket.IO server running in', isProd ? 'PRODUCTION' : 'DEVELOPMENT');

  // Authentication middleware (rate-limited)
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        console.warn('⚠️ No token provided');
        return next(new Error('Authentication required'));
      }

      // Apply rate limiting
      authLimiter(socket.request, {}, (err) => {
        if (err) return next(new Error('Too many requests'));
      });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        console.warn(`⚠️ Invalid user ID: ${decoded.userId}`);
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.username = user.username;
      socket.email = user.email;

      next();
    } catch (error) {
      console.error('❌ Auth error:', error.message);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, username, email } = socket;

    // Track user
    onlineUsers.set(userId, {
      userId,
      username,
      email,
      socketId: socket.id,
      connectedAt: new Date(),
      lastSeen: null
    });

    // Join user-specific room
    socket.join(`user_${userId}`);
    
    // Notify others
    socket.broadcast.emit('user_connected', { userId, username });

    // Send online users list
    updateOnlineUsers();

    // Handle events
    socket.on('get_online_users', () => updateOnlineUsers());

    socket.on('typing', (data) => {
      if (!data.receiverId) return;
      socket.to(`user_${data.receiverId}`).emit('typing', {
        userId,
        isTyping: data.isTyping
      });
    });

    // Task events (with validation)
    const handleTaskEvent = (event, data) => {
      if (!data.taskId || !userId) {
        console.warn(`⚠️ Invalid ${event} from ${userId}`);
        return;
      }
      io.emit(event, { ...data, userId });
    };

    socket.on('task_created', (data) => handleTaskEvent('task_created', data));
    socket.on('task_updated', (data) => handleTaskEvent('task_updated', data));
    socket.on('task_deleted', (data) => handleTaskEvent('task_deleted', data));

    // Disconnection handler
    socket.on('disconnect', () => {
      const user = onlineUsers.get(userId);
      if (user) {
        onlineUsers.set(userId, {
          ...user,
          lastSeen: new Date(),
          socketId: null
        });
      }
      io.emit('user_disconnected', { userId });
      updateOnlineUsers();
    });
  });

  // Helper: Update all clients with online users
  const updateOnlineUsers = () => {
    const users = Array.from(onlineUsers.values())
      .filter(user => user.socketId)
      .map(({ userId, username, lastSeen }) => ({
        userId,
        username,
        lastSeen
      }));
    io.emit('online_users', users);
  };

  return io;
};

// Utility exports
export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
};

export const sendNotification = (userId, message) => {
  const user = onlineUsers.get(userId);
  if (user?.socketId) {
    io.to(user.socketId).emit('notification', message);
    return true;
  }
  return false;
};

export const getOnlineUsers = () => Array.from(onlineUsers.values());