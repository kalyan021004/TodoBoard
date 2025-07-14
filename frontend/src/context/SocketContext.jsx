// contexts/SocketContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const { user, token } = useAuth();

  useEffect(() => {
    console.log('🔄 SocketProvider useEffect triggered');
    console.log('👤 User:', user ? user.username : 'null');
    console.log('🔑 Token:', token ? token.substring(0, 20) + '...' : 'null');
    
    if (user && token) {
      console.log('🚀 Initializing socket connection...');
      
      // Initialize socket connection
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        auth: {
          token: token
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      setSocket(newSocket);

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('✅ Connected to server');
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // Get online users when connected
        console.log('📡 Emitting get_online_users');
        newSocket.emit('get_online_users');
      });

      newSocket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setOnlineUsers([]);
      });

      newSocket.on('connect_error', (error) => {
        console.error('🚨 Connection error:', error);
        setConnectionStatus('error');
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
        setConnectionStatus('connected');
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt ${attemptNumber}`);
        setConnectionStatus('reconnecting');
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('🚨 Reconnection error:', error);
        setConnectionStatus('reconnecting');
      });

      newSocket.on('reconnect_failed', () => {
        console.error('🚨 Reconnection failed');
        setConnectionStatus('failed');
      });

      // User presence handlers
      newSocket.on('user_connected', (data) => {
        console.log(`👋 User connected: ${data.username}`);
        setOnlineUsers(prev => {
          const exists = prev.find(u => u.userId === data.userId);
          if (!exists) {
            const newUsers = [...prev, data];
            console.log('👥 Updated online users (user_connected):', newUsers.length);
            return newUsers;
          }
          return prev;
        });
      });

      newSocket.on('user_disconnected', (data) => {
        console.log(`👋 User disconnected: ${data.username}`);
        setOnlineUsers(prev => {
          const newUsers = prev.filter(u => u.userId !== data.userId);
          console.log('👥 Updated online users (user_disconnected):', newUsers.length);
          return newUsers;
        });
      });

      newSocket.on('online_users', (users) => {
        console.log('📋 Received online users:', users);
        console.log('📋 Users count:', users.length);
        console.log('📋 Users list:', users.map(u => u.username));
        setOnlineUsers(users);
      });

      // Ping/pong for connection monitoring
      const pingInterval = setInterval(() => {
        if (newSocket.connected) {
          console.log('📡 Sending ping');
          newSocket.emit('ping');
        }
      }, 30000); // Ping every 30 seconds

      newSocket.on('pong', () => {
        console.log('📡 Pong received');
        setConnectionStatus('connected');
      });

      // Cleanup on unmount
      return () => {
        console.log('🧹 Cleaning up socket connection');
        clearInterval(pingInterval);
        newSocket.disconnect();
      };
    } else {
      console.log('⏳ Waiting for user and token...');
    }
  }, [user, token]);

  // Debug: Log online users changes
  useEffect(() => {
    console.log('👥 Online users state changed:', onlineUsers.length);
    onlineUsers.forEach(user => console.log('  - ', user.username));
  }, [onlineUsers]);

  const emitTaskCreated = (taskData) => {
    if (socket && isConnected) {
      socket.emit('task_created', taskData);
    }
  };

  const emitTaskUpdated = (taskId, updates) => {
    if (socket && isConnected) {
      socket.emit('task_updated', { taskId, updates });
    }
  };

  const emitTaskDeleted = (taskId) => {
    if (socket && isConnected) {
      socket.emit('task_deleted', { taskId });
    }
  };

  const emitTaskMoved = (taskId, newStatus, newPosition) => {
    if (socket && isConnected) {
      socket.emit('task_moved', { taskId, newStatus, newPosition });
    }
  };

  const emitTaskAssigned = (taskId, assignedUserId) => {
    if (socket && isConnected) {
      socket.emit('task_assigned', { taskId, assignedUserId });
    }
  };

  const emitUserTyping = (isTyping) => {
    if (socket && isConnected) {
      socket.emit('user_typing', { isTyping });
    }
  };

  const value = {
    socket,
    isConnected,
    connectionStatus,
    onlineUsers,
    emitTaskCreated,
    emitTaskUpdated,
    emitTaskDeleted,
    emitTaskMoved,
    emitTaskAssigned,
    emitUserTyping
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};