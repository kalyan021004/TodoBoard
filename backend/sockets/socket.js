// socket/socket.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';

let io;
const onlineUsers = new Map(); // Store online users: socketId -> user data

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin:"https://todo-board-five.vercel.app" || "http://localhost:5173",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true
    }
  });

  console.log('🚀 Socket.IO server initialized');

  // 🔐 Authentication middleware - Let's make this more robust
  io.use(async (socket, next) => {
    try {
      console.log('🔑 Authentication attempt for socket:', socket.id);
      console.log('🔑 Auth data:', socket.handshake.auth);
      
      const token = socket.handshake.auth.token;
      if (!token) {
        console.error('❌ No token provided');
        return next(new Error('No token provided'));
      }

      console.log('🔑 Token received:', token.substring(0, 20) + '...');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔑 Token decoded:', decoded);
      
      // Fix: Use decoded.userId instead of decoded.id
      const userId = decoded.userId || decoded.id;
      const user = await User.findById(userId).select('-password');
      console.log('🔑 User found:', user ? user.username : 'null');
      
      if (!user) {
        console.error('❌ User not found');
        return next(new Error('User not found'));
      }

      // Attach user data to socket
      socket.userId = user._id.toString();
      socket.username = user.username;
      socket.email = user.email;
      
      console.log('✅ Authentication successful for:', socket.username);
      next();
    } catch (error) {
      console.error('❌ Socket authentication error:', error.message);
      next(new Error('Authentication failed: ' + error.message));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.username} (${socket.id})`);
    
    // 👥 Add user to online users
    onlineUsers.set(socket.id, {
      userId: socket.userId,
      username: socket.username,
      email: socket.email,
      socketId: socket.id,
      connectedAt: new Date()
    });

    console.log(`👥 Total online users: ${onlineUsers.size}`);

    // 📢 Broadcast user connected to all other clients
    socket.broadcast.emit('user_connected', {
      userId: socket.userId,
      username: socket.username,
      email: socket.email
    });

    // 📊 Handle get online users request
    socket.on('get_online_users', () => {
      const users = Array.from(onlineUsers.values()).map(user => ({
        userId: user.userId,
        username: user.username,
        email: user.email
      }));
      console.log(`📋 Sending ${users.length} online users to ${socket.username}`);
      console.log('📋 Users:', users.map(u => u.username));
      socket.emit('online_users', users);
    });

    // Handle user joining (optional - for user-specific notifications)
    socket.on('join_user', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined their room`);
    });
    
    // Handle ping/pong for connection testing
    socket.on('ping', () => {
      console.log('📡 Ping received from:', socket.username);
      socket.emit('pong');
    });

    // 💬 Handle user typing
    socket.on('user_typing', (data) => {
      socket.broadcast.emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        isTyping: data.isTyping
      });
    });
    
    // Handle test events (for debugging)
    socket.on('test_event', (data) => {
      console.log('🧪 Test event received:', data);
      socket.emit('test_response', { message: 'Test event received successfully!' });
    });

    // 🔄 Handle task events (these come from your API routes)
    socket.on('task_created', (data) => {
      socket.broadcast.emit('task_created', data);
    });

    socket.on('task_updated', (data) => {
      socket.broadcast.emit('task_updated', data);
    });

    socket.on('task_deleted', (data) => {
      socket.broadcast.emit('task_deleted', data);
    });

    socket.on('task_moved', (data) => {
      socket.broadcast.emit('task_moved', data);
    });

    socket.on('task_assigned', (data) => {
      socket.broadcast.emit('task_assigned', data);
    });
    
    // 🚪 Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`❌ User disconnected: ${socket.username} (${socket.id}) - Reason: ${reason}`);
      
      // Get user data before removing
      const userData = onlineUsers.get(socket.id);
      
      // Remove user from online users
      onlineUsers.delete(socket.id);
      
      console.log(`👥 Total online users after disconnect: ${onlineUsers.size}`);
      
      // Broadcast user disconnected to all clients
      if (userData) {
        socket.broadcast.emit('user_disconnected', {
          userId: userData.userId,
          username: userData.username,
          email: userData.email
        });
      }
    });

    // 🚨 Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Handle connection errors
  io.on('connect_error', (error) => {
    console.error('🚨 Socket connection error:', error);
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// 📈 Helper functions for getting online user stats
export const getOnlineUsers = () => {
  return Array.from(onlineUsers.values());
};

export const getOnlineUsersCount = () => {
  return onlineUsers.size;
};