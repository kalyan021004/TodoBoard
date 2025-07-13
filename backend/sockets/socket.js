// socket/socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';
import dotenv from 'dotenv';
dotenv.config();

let io;
const onlineUsers = new Map();

const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = isProd
  ? ['https://todo-board-1.vercel.app']
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ];

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1')
        ) {
          if (!isProd) console.log(`✅ Socket.IO CORS allowed origin: ${origin}`);
          return callback(null, true);
        }
        console.warn(`❌ Socket.IO CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  console.log('🚀 Socket.IO server initialized');

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId || decoded.id;
      const user = await User.findById(userId).select('-password');

      if (!user) return next(new Error('User not found'));

      socket.userId = user._id.toString();
      socket.username = user.username;
      socket.email = user.email;

      if (!isProd) console.log(`✅ Authenticated socket for ${user.username}`);
      next();
    } catch (error) {
      console.error('❌ Socket authentication error:', error.message);
      next(new Error('Authentication failed: ' + error.message));
    }
  });

  io.on('connection', (socket) => {
    const { username, userId, email } = socket;
    console.log(`🔌 Connected: ${username} (${socket.id})`);

    onlineUsers.set(socket.id, {
      userId,
      username,
      email,
      socketId: socket.id,
      connectedAt: new Date()
    });

    socket.broadcast.emit('user_connected', { userId, username, email });

    socket.on('get_online_users', () => {
      const users = Array.from(onlineUsers.values()).map(user => ({
        userId: user.userId,
        username: user.username,
        email: user.email
      }));
      socket.emit('online_users', users);
    });

    socket.on('join_user', (userId) => {
      socket.join(`user_${userId}`);
    });

    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('user_typing', (data) => {
      socket.broadcast.emit('user_typing', {
        userId,
        username,
        isTyping: data.isTyping
      });
    });

    // Debug: Emit a test task_created on every connection
    if (!isProd) {
      setTimeout(() => {
        socket.emit('task_created', {
          task: {
            _id: 'debug_task_id',
            title: 'Demo Task',
            status: 'Todo'
          },
          createdBy: 'SocketBot'
        });
      }, 1000);
    }

    // Task events
    const broadcastTask = (event) => (data) => {
      socket.broadcast.emit(event, data);
    };

    socket.on('task_created', broadcastTask('task_created'));
    socket.on('task_updated', broadcastTask('task_updated'));
    socket.on('task_deleted', broadcastTask('task_deleted'));
    socket.on('task_moved', broadcastTask('task_moved'));
    socket.on('task_assigned', broadcastTask('task_assigned'));

    socket.on('disconnect', (reason) => {
      onlineUsers.delete(socket.id);
      socket.broadcast.emit('user_disconnected', { userId, username, email });
      console.log(`❌ Disconnected: ${username} (${socket.id}) – Reason: ${reason}`);
    });

    socket.on('error', (err) => {
      console.error('❌ Socket error:', err.message);
    });
  });

  io.on('connect_error', (error) => {
    console.error('🚨 Socket connect_error:', error.message);
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
};

export const getOnlineUsers = () => Array.from(onlineUsers.values());
export const getOnlineUsersCount = () => onlineUsers.size;
