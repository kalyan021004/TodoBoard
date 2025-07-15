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
  const [notifications, setNotifications] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const { user, token } = useAuth();

  useEffect(() => {
    if (user && token) {
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket'],
        withCredentials: true
      });

      setSocket(newSocket);

      // Connection events
      newSocket.on('connect', () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        newSocket.emit('get_online_users');
        newSocket.emit('request_activities');
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setConnectionStatus('error');
      });

      // User presence events
      newSocket.on('user_connected', (data) => {
        setOnlineUsers(prev => {
          const exists = prev.find(u => u.userId === data.userId);
          return exists ? prev : [...prev, data];
        });
      });

      newSocket.on('user_disconnected', (data) => {
        setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
      });

      newSocket.on('online_users', (users) => {
        setOnlineUsers(users);
      });

      // Notification events
      newSocket.on('notification', (notification) => {
        setNotifications(prev => [...prev, notification]);
      });

      // Task events
      newSocket.on('task_created', (data) => {
        setTasks(prev => [...prev, data.task]);
      });

      newSocket.on('task_updated', (data) => {
        setTasks(prev => prev.map(task => 
          task._id === data.task._id ? data.task : task
        ));
      });

      newSocket.on('task_deleted', (data) => {
        setTasks(prev => prev.filter(task => task._id !== data.taskId));
      });

      newSocket.on('task_moved', (data) => {
        setTasks(prev => prev.map(task => 
          task._id === data.task._id ? data.task : task
        ));
      });

      newSocket.on('task_assigned', (data) => {
        setTasks(prev => prev.map(task => 
          task._id === data.task._id ? data.task : task
        ));
      });

      // Activity Log events
      newSocket.on('activities_loaded', (loadedActivities) => {
        setActivities(loadedActivities);
      });

      newSocket.on('activity_created', (newActivity) => {
        setActivities(prev => [newActivity, ...prev.slice(0, 19)]);
      });

      // Cleanup
      return () => {
        newSocket.disconnect();
      };
    }
  }, [user, token]);

  const emitEvent = (eventName, data) => {
    if (socket && isConnected) {
      socket.emit(eventName, data);
    }
  };

  const loadActivities = () => {
    if (socket && isConnected) {
      socket.emit('request_activities');
    }
  };

  const value = {
    socket,
    isConnected,
    connectionStatus,
    onlineUsers,
    notifications,
    activities,
    tasks,
    setTasks,
    clearNotifications: () => setNotifications([]),
    loadActivities,
    emitTaskCreated: (data) => emitEvent('task_created', data),
    emitTaskUpdated: (data) => emitEvent('task_updated', data),
    emitTaskDeleted: (data) => emitEvent('task_deleted', data),
    emitTaskMoved: (data) => emitEvent('task_moved', data),
    emitTaskAssigned: (data) => emitEvent('task_assigned', data),
    emitUserTyping: (data) => emitEvent('user_typing', data),
    emitActivityCreated: (data) => emitEvent('activity_created', data)
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};