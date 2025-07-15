import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';
import dotenv from 'dotenv';
import ActivityLog from '../models/activity.models.js';
dotenv.config();

let io;
const onlineUsers = new Map();

async function getLastActivities() {
  return await ActivityLog.find()
    .populate('user', 'username')
    .populate('task', 'title')
    .sort({ timestamp: -1 })
    .limit(20);
}
export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ['https://todo-board-1.vercel.app', 'https://todoboard-1-nvnk.onrender.com'],
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingInterval: 10000,
    pingTimeout: 5000
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.userId = user._id.toString();
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, username } = socket;

    // Add user to online list
    onlineUsers.set(userId, {
      userId,
      username,
      socketId: socket.id,
      connectedAt: new Date()
    });

    // Join user to their room
    socket.join(`user_${userId}`);

    // Notify others
    socket.broadcast.emit('user_connected', { userId, username });

    // Send online users to new connection
    updateOnlineUsers();

    // Handle disconnection
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      io.emit('user_disconnected', { userId, username });
      updateOnlineUsers();
    });

    // Handle online users request
    socket.on('get_online_users', () => {
      updateOnlineUsers();
    });
    socket.on('request_tasks_refresh', async () => {
      try {
        console.log('📥 Client requested tasks refresh');

        // Fetch fresh tasks from database
        const tasks = await Task.find()
          .populate('assignedUser', 'username email')
          .sort({ createdAt: -1 });

        // Send fresh tasks back to the requesting client
        socket.emit('tasks_refreshed', {
          tasks,
          timestamp: new Date()
        });

        console.log('📤 Sent refreshed tasks to client:', tasks.length);
      } catch (error) {
        console.error('Error refreshing tasks:', error);
        socket.emit('error', {
          message: 'Failed to refresh tasks',
          error: error.message
        });
      }
    });

    // Notification handler
    socket.on('send_notification', ({ receiverId, message }) => {
      const receiver = onlineUsers.get(receiverId);
      if (receiver) {
        io.to(receiver.socketId).emit('notification', {
          senderId: userId,
          senderName: username,
          message,
          timestamp: new Date()
        });
      }
    });
    socket.on('request_activities', async () => {
      const activities = await getLastActivities();
      socket.emit('activities_loaded', activities);
    });
  });

  function updateOnlineUsers() {
    const users = Array.from(onlineUsers.values());
    io.emit('online_users', users);
  }
};

export const getIO = () => io;
export const getOnlineUsers = () => Array.from(onlineUsers.values());
export const sendNotification = (userId, notification) => {
  const user = onlineUsers.get(userId);
  if (user) {
    io.to(user.socketId).emit('notification', notification);
  }
};