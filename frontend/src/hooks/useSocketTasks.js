import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export const useSocketTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { socket, isConnected } = useSocket();
  const { user, token } = useAuth();

  // Initialize tasks from API
  const initializeTasks = useCallback(async () => {
    if (!token || isInitialized) return;
    
    setIsLoadingTasks(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        let tasksData = [];
        
        if (data.success && Array.isArray(data.data)) {
          tasksData = data.data;
        } else if (Array.isArray(data)) {
          tasksData = data;
        } else if (Array.isArray(data.data)) {
          tasksData = data.data;
        }

        console.log('📥 Socket tasks initialized:', tasksData.length);
        setTasks(tasksData);
        setIsInitialized(true);
      } else {
        console.error('Failed to initialize tasks:', response.status);
      }
    } catch (error) {
      console.error('Error initializing tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [token, isInitialized]);

  // Initialize on mount
  useEffect(() => {
    if (user && token && !isInitialized) {
      initializeTasks();
    }
  }, [user, token, isInitialized, initializeTasks]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.log('Notification permission denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  const showBrowserNotification = useCallback(async (title, options = {}) => {
    const hasPermission = await requestNotificationPermission();
    
    if (hasPermission) {
      try {
        const notification = new Notification(title, {
          body: options.body || '',
          icon: options.icon || '/favicon.ico',
          tag: options.tag || 'task-update',
          requireInteraction: options.persistent || false,
          silent: options.silent || false,
          data: options.data || {}
        });

        if (!options.persistent) {
          setTimeout(() => {
            notification.close();
          }, options.duration || 4000);
        }

        notification.onclick = () => {
          window.focus();
          if (options.onClick) {
            options.onClick(notification.data);
          }
          if (!options.persistent) {
            notification.close();
          }
        };

        return notification;
      } catch (error) {
        console.error('Error showing notification:', error);
        return false;
      }
    }
    return false;
  }, [requestNotificationPermission]);

  const loadActivities = useCallback(async () => {
    if (!socket || !isConnected) return;
    
    setIsLoadingActivities(true);
    try {
      socket.emit('request_activities');
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [socket, isConnected]);

  useEffect(() => {
    if (isConnected) {
      loadActivities();
    }
  }, [isConnected, loadActivities]);

  useEffect(() => {
    console.log('useSocketTasks: Socket state:', {
      socket: !!socket,
      connected: isConnected,
      id: socket?.id
    });
  }, [socket, isConnected]);

  useEffect(() => {
    if (!socket || !isInitialized) {
      console.log('useSocketTasks: Socket not available or not initialized');
      return;
    }

    console.log('useSocketTasks: Setting up socket listeners');

    const handleTaskCreated = (data) => {
      console.log('🔔 Socket event: task_created', data);
      const newTask = data.task || data;
      setTasks(prev => {
        // Avoid duplicates
        const exists = prev.find(task => task._id === newTask._id);
        if (exists) return prev;
        return [...prev, newTask];
      });
      addNotification({
        message: `${data.createdBy || 'Someone'} created a new task: ${newTask.title}`,
        type: 'success',
        taskId: newTask._id
      });
    };

    const handleTaskUpdated = (data) => {
      console.log('🔔 Socket event: task_updated', data);
      const updatedTask = data.task || data;
      setTasks(prev => prev.map(task => 
        task._id === updatedTask._id ? updatedTask : task
      ));
      addNotification({
        message: `${data.updatedBy || 'Someone'} updated task: ${updatedTask.title}`,
        type: 'info',
        taskId: updatedTask._id
      });
    };

    const handleTaskDeleted = (data) => {
      console.log('🔔 Socket event: task_deleted', data);
      setTasks(prev => prev.filter(task => task._id !== data.taskId));
      addNotification({
        message: `${data.deletedBy || 'Someone'} deleted a task`,
        type: 'warning',
        taskId: data.taskId
      });
    };

    const handleTaskMoved = (data) => {
      console.log('🔔 Socket event: task_moved', data);
      const movedTask = data.task || data;
      setTasks(prev => prev.map(task => 
        task._id === movedTask._id ? movedTask : task
      ));
      addNotification({
        message: `${data.movedBy || 'Someone'} moved task to ${movedTask.status}`,
        type: 'info',
        taskId: movedTask._id
      });
    };

    const handleTaskAssigned = (data) => {
      console.log('🔔 Socket event: task_assigned', data);
      const assignedTask = data.task || data;
      setTasks(prev => prev.map(task => 
        task._id === assignedTask._id ? assignedTask : task
      ));
      addNotification({
        message: `${data.assignedBy || 'Someone'} assigned task to ${assignedTask.assignedTo || 'someone'}`,
        type: 'info',
        taskId: assignedTask._id
      });
    };

    const handleTaskAssignedToYou = (data) => {
      console.log('🔔 Socket event: task_assigned_to_you', data);
      const assignedTask = data.task || data;
      setTasks(prev => prev.map(task => 
        task._id === assignedTask._id ? assignedTask : task
      ));
      showBrowserNotification('Task Assigned to You', {
        body: `You've been assigned to: ${assignedTask.title}`,
        onClick: () => {
          console.log('Notification clicked for task:', assignedTask._id);
        },
        data: { taskId: assignedTask._id }
      });
    };

    const handleActivitiesLoaded = (loadedActivities) => {
      console.log('📜 Activities loaded:', loadedActivities.length);
      setActivities(loadedActivities);
    };

    const handleActivityCreated = (newActivity) => {
      console.log('➕ New activity:', newActivity);
      setActivities(prev => [newActivity, ...prev.slice(0, 49)]);
      
      if (newActivity.action === 'ASSIGN' && user && newActivity.details.assignedTo === user.id) {
        showBrowserNotification('New Task Assignment', {
          body: `You've been assigned to: ${newActivity.task?.title}`,
          persistent: true
        });
      }
    };

    // Register all socket listeners
    const eventHandlers = {
      'task_created': handleTaskCreated,
      'task_updated': handleTaskUpdated,
      'task_deleted': handleTaskDeleted,
      'task_moved': handleTaskMoved,
      'task_assigned': handleTaskAssigned,
      'task_assigned_to_you': handleTaskAssignedToYou,
      'activities_loaded': handleActivitiesLoaded,
      'activity_created': handleActivityCreated
    };

    Object.entries(eventHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, isInitialized, showBrowserNotification, user]);

  const addNotification = useCallback(({ message, type, taskId }) => {
    const id = Date.now();
    const notification = { 
      id, 
      message, 
      type, 
      taskId,
      timestamp: new Date(),
      isRead: false 
    };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove non-error notifications after 5 seconds
    if (type !== 'error') {
      setTimeout(() => {
        removeNotification(id);
      }, 5000);
    }

    // Show browser notification for important events
    if (type === 'success' || type === 'error') {
      showBrowserNotification('Task Update', {
        body: message,
        data: { taskId }
      });
    }
  }, [showBrowserNotification]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markNotificationAsRead = useCallback((id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const createTask = useCallback((taskData) => {
    if (!socket) return;
    socket.emit('create_task', taskData);
  }, [socket]);

  const updateTask = useCallback((taskId, updates) => {
    if (!socket) return;
    socket.emit('update_task', { taskId, updates });
  }, [socket]);

  const deleteTask = useCallback((taskId) => {
    if (!socket) return;
    socket.emit('delete_task', { taskId });
  }, [socket]);

  const moveTask = useCallback((taskId, newStatus) => {
    if (!socket) return;
    socket.emit('move_task', { taskId, newStatus });
  }, [socket]);

  const assignTask = useCallback((taskId, assigneeId) => {
    if (!socket) return;
    socket.emit('assign_task', { taskId, assigneeId });
  }, [socket]);

  const refreshTasks = useCallback(() => {
    setIsInitialized(false);
    initializeTasks();
  }, [initializeTasks]);

  const testNotification = useCallback(() => {
    addNotification({
      message: 'This is a test notification!',
      type: 'info',
      taskId: 'test'
    });
  }, [addNotification]);

  // Method to sync tasks with external source
  const syncTasks = useCallback((externalTasks) => {
    if (Array.isArray(externalTasks)) {
      setTasks(externalTasks);
    }
  }, []);

  return {
    tasks,
    notifications,
    activities,
    isLoadingActivities,
    isLoadingTasks,
    isInitialized,
    setTasks,
    syncTasks,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    assignTask,
    removeNotification,
    markNotificationAsRead,
    clearNotifications,
    loadActivities,
    showBrowserNotification,
    refreshTasks,
    testNotification
  };
};