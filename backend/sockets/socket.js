import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/user.models.js';
import Task from '../models/task.models.js';
import dotenv from 'dotenv';
import ActivityLog from '../models/activity.models.js';
dotenv.config();

let io;
const onlineUsers = new Map();
const userTaskCounts = new Map(); // Track task counts in memory for quick access

async function getLastActivities() {
  return await ActivityLog.find()
    .populate('user', 'username')
    .populate('task', 'title')
    .sort({ timestamp: -1 })
    .limit(20);
}

async function initializeUserTaskCounts() {
  const users = await User.find().select('_id activeTaskCount');
  users.forEach(user => {
    userTaskCounts.set(user._id.toString(), user.activeTaskCount || 0);
  });
}

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ['https://todo-board-1.vercel.app','https://todoboard-1-nvnk.onrender.com'],
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingInterval: 10000,
    pingTimeout: 5000
  });

  // Initialize task counts when server starts
  initializeUserTaskCounts().catch(err => {
    console.error('Error initializing user task counts:', err);
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
      connectedAt: new Date(),
      taskCount: userTaskCounts.get(userId) || 0
    });

    // Join user to their room
    socket.join(`user_${userId}`);
    
    // Notify others
    socket.broadcast.emit('user_connected', { 
      userId, 
      username,
      taskCount: userTaskCounts.get(userId) || 0
    });
    
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

    // Handle task assignment updates
    socket.on('task_assignment_update', async ({ userId, taskCount }) => {
      if (userTaskCounts.has(userId)) {
        userTaskCounts.set(userId, taskCount);
        const user = onlineUsers.get(userId);
        if (user) {
          user.taskCount = taskCount;
          io.emit('user_task_count_updated', { userId, taskCount });
        }
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

    // Smart assign request handler
    socket.on('request_smart_assign', async ({ excludeUserId }) => {
      try {
        // Find user with minimum tasks, excluding specified user if needed
        const users = Array.from(onlineUsers.values())
          .filter(user => !excludeUserId || user.userId !== excludeUserId)
          .sort((a, b) => a.taskCount - b.taskCount);

        if (users.length > 0) {
          const optimalUser = users[0];
          socket.emit('smart_assign_response', {
            success: true,
            userId: optimalUser.userId,
            username: optimalUser.username,
            taskCount: optimalUser.taskCount
          });
        } else {
          socket.emit('smart_assign_response', {
            success: false,
            message: 'No available users found'
          });
        }
      } catch (error) {
        socket.emit('smart_assign_response', {
          success: false,
          message: 'Error finding optimal assignee'
        });
      }
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

export const updateUserTaskCount = (userId, taskCount) => {
  if (userTaskCounts.has(userId)) {
    userTaskCounts.set(userId, taskCount);
    const user = onlineUsers.get(userId);
    if (user) {
      user.taskCount = taskCount;
      io.emit('user_task_count_updated', { userId, taskCount });
    }
  }
};