import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export const useSocketTasks = (initialTasks = []) => {
  const [tasks, setTasks] = useState(initialTasks);
  const [notifications, setNotifications] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const { socket, isConnected } = useSocket();
  const { user, token } = useAuth();

  // FIXED: Better sync with initial tasks
  useEffect(() => {
    if (initialTasks.length > 0) {
      console.log('🔄 Socket hook: Syncing with initial tasks', initialTasks.length);
      setTasks(initialTasks);
      setIsLoadingTasks(false);
    }
  }, [initialTasks]);

  // Fetch initial tasks from API
  const fetchInitialTasks = useCallback(async () => {
    if (!token) return;
    
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
        if (data.success) {
          console.log('📥 Initial tasks loaded:', data.data.length);
          setTasks(data.data);
        } else {
          console.error('Failed to fetch tasks:', data.message);
        }
      } else {
        console.error('HTTP error:', response.status);
      }
    } catch (error) {
      console.error('Error fetching initial tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [token]);

  // Only fetch if no initial tasks provided
  useEffect(() => {
    if (user && token && initialTasks.length === 0) {
      fetchInitialTasks();
    }
  }, [user, token, fetchInitialTasks, initialTasks.length]);

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
    if (!socket) {
      console.log('useSocketTasks: No socket available');
      return;
    }

    console.log('useSocketTasks: Setting up socket listeners');

    const handleTaskCreated = (data) => {
      console.log('🔔 Socket event: task_created', data);
      setTasks(prev => {
        // Check if task already exists to avoid duplicates
        const exists = prev.find(task => task._id === data.task._id);
        if (exists) {
          console.log('Task already exists, updating instead');
          return prev.map(task => 
            task._id === data.task._id ? { ...task, ...data.task } : task
          );
        }
        return [...prev, data.task];
      });
      addNotification({
        message: `${data.createdBy} created a new task: ${data.task.title}`,
        type: 'success',
        taskId: data.task._id
      });
    };

    const handleTaskUpdated = (data) => {
      console.log('🔔 Socket event: task_updated', data);
      setTasks(prev => {
        const taskExists = prev.find(task => task._id === data.task._id);
        if (!taskExists) {
          // If task doesn't exist, add it (might be a new task from another user)
          console.log('Task not found, adding new task');
          return [...prev, data.task];
        }
        return prev.map(task => 
          task._id === data.task._id ? { ...task, ...data.task } : task
        );
      });
      addNotification({
        message: `${data.updatedBy} updated task: ${data.task.title}`,
        type: 'info',
        taskId: data.task._id
      });
    };

    const handleTaskDeleted = (data) => {
      console.log('🔔 Socket event: task_deleted', data);
      setTasks(prev => prev.filter(task => task._id !== data.taskId));
      addNotification({
        message: `${data.deletedBy} deleted a task`,
        type: 'warning',
        taskId: data.taskId
      });
    };

    const handleTaskMoved = (data) => {
      console.log('🔔 Socket event: task_moved', data);
      setTasks(prev => {
        const taskExists = prev.find(task => task._id === data.task._id);
        if (!taskExists) {
          return [...prev, data.task];
        }
        return prev.map(task => 
          task._id === data.task._id ? { ...task, ...data.task } : task
        );
      });
      addNotification({
        message: `${data.movedBy} moved task to ${data.task.status}`,
        type: 'info',
        taskId: data.task._id
      });
    };

    const handleTaskAssigned = (data) => {
      console.log('🔔 Socket event: task_assigned', data);
      setTasks(prev => {
        const taskExists = prev.find(task => task._id === data.task._id);
        if (!taskExists) {
          return [...prev, data.task];
        }
        return prev.map(task => 
          task._id === data.task._id ? { ...task, ...data.task } : task
        );
      });
      addNotification({
        message: `${data.assignedBy} assigned task to ${data.task.assignedTo}`,
        type: 'info',
        taskId: data.task._id
      });
    };

    const handleTaskAssignedToYou = (data) => {
      console.log('🔔 Socket event: task_assigned_to_you', data);
      setTasks(prev => {
        const taskExists = prev.find(task => task._id === data.task._id);
        if (!taskExists) {
          return [...prev, data.task];
        }
        return prev.map(task => 
          task._id === data.task._id ? { ...task, ...data.task } : task
        );
      });
      showBrowserNotification('Task Assigned to You', {
        body: `You've been assigned to: ${data.task.title}`,
        onClick: () => {
          console.log('Notification clicked for task:', data.task._id);
        },
        data: { taskId: data.task._id }
      });
    };

    // FIXED: Add handler for tasks refresh response
    const handleTasksRefreshed = (data) => {
      console.log('🔄 Socket event: tasks_refreshed', data);
      if (data.tasks && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
        addNotification({
          message: 'Tasks refreshed from server',
          type: 'info'
        });
      }
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

    // FIXED: Add error handling for socket events
    const handleError = (error) => {
      console.error('Socket error:', error);
      addNotification({
        message: 'Connection error. Please refresh the page.',
        type: 'error'
      });
    };

    const handleReconnect = () => {
      console.log('🔌 Socket reconnected, requesting fresh data');
      // Request fresh data after reconnection
      socket.emit('request_tasks_refresh');
      addNotification({
        message: 'Reconnected to server',
        type: 'success'
      });
    };

    socket.on('task_created', handleTaskCreated);
    socket.on('task_updated', handleTaskUpdated);
    socket.on('task_deleted', handleTaskDeleted);
    socket.on('task_moved', handleTaskMoved);
    socket.on('task_assigned', handleTaskAssigned);
    socket.on('task_assigned_to_you', handleTaskAssignedToYou);
    socket.on('tasks_refreshed', handleTasksRefreshed);
    socket.on('activities_loaded', handleActivitiesLoaded);
    socket.on('activity_created', handleActivityCreated);
    socket.on('error', handleError);
    socket.on('reconnect', handleReconnect);

    return () => {
      socket.off('task_created', handleTaskCreated);
      socket.off('task_updated', handleTaskUpdated);
      socket.off('task_deleted', handleTaskDeleted);
      socket.off('task_moved', handleTaskMoved);
      socket.off('task_assigned', handleTaskAssigned);
      socket.off('task_assigned_to_you', handleTaskAssignedToYou);
      socket.off('tasks_refreshed', handleTasksRefreshed);
      socket.off('activities_loaded', handleActivitiesLoaded);
      socket.off('activity_created', handleActivityCreated);
      socket.off('error', handleError);
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, showBrowserNotification, user]);

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
    
    if (type !== 'error') {
      setTimeout(() => {
        removeNotification(id);
      }, 5000);
    }

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
    console.log('📤 Creating task via socket:', taskData);
    socket.emit('create_task', taskData);
  }, [socket]);

  const updateTask = useCallback((taskId, updates) => {
    if (!socket) return;
    console.log('📤 Updating task via socket:', taskId, updates);
    socket.emit('update_task', { taskId, updates });
  }, [socket]);

  const deleteTask = useCallback((taskId) => {
    if (!socket) return;
    console.log('📤 Deleting task via socket:', taskId);
    socket.emit('delete_task', { taskId });
  }, [socket]);

  const moveTask = useCallback((taskId, newStatus) => {
    if (!socket) return;
    console.log('📤 Moving task via socket:', taskId, newStatus);
    socket.emit('move_task', { taskId, newStatus });
  }, [socket]);

  const assignTask = useCallback((taskId, assigneeId) => {
    if (!socket) return;
    console.log('📤 Assigning task via socket:', taskId, assigneeId);
    socket.emit('assign_task', { taskId, assigneeId });
  }, [socket]);

  // FIXED: Improved sync function with validation
  const syncTasks = useCallback((newTasks) => {
    if (Array.isArray(newTasks)) {
      console.log('🔄 Syncing tasks:', newTasks.length);
      setTasks(newTasks);
    } else {
      console.warn('Invalid tasks data provided to syncTasks:', newTasks);
    }
  }, []);

  // FIXED: Enhanced refresh function
  const refreshTasks = useCallback(() => {
    console.log('🔄 Refreshing tasks...');
    
    if (socket && socket.connected) {
      // Request fresh data from socket server
      socket.emit('request_tasks_refresh');
    }
    
    if (initialTasks.length > 0) {
      // If we have initial tasks, sync with them
      setTasks(initialTasks);
    } else {
      // Otherwise fetch from API
      fetchInitialTasks();
    }
  }, [initialTasks, fetchInitialTasks, socket]);

  // FIXED: Enhanced test notification with more details
  const testNotification = useCallback(() => {
    const testId = `test-${Date.now()}`;
    addNotification({
      message: `Test notification sent at ${new Date().toLocaleTimeString()}`,
      type: 'info',
      taskId: testId
    });
    
    showBrowserNotification('Test Notification', {
      body: 'This is a test notification from the Kanban board',
      onClick: () => {
        console.log('Test notification clicked');
      }
    });
  }, [addNotification, showBrowserNotification]);

  // FIXED: Add connection status monitoring
  useEffect(() => {
    if (socket) {
      const handleConnect = () => {
        console.log('🔌 Socket connected');
        addNotification({
          message: 'Connected to real-time updates',
          type: 'success'
        });
      };

      const handleDisconnect = () => {
        console.log('🔌 Socket disconnected');
        addNotification({
          message: 'Lost connection to real-time updates',
          type: 'warning'
        });
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
      };
    }
  }, [socket, addNotification]);

  return {
    tasks,
    notifications,
    activities,
    isLoadingActivities,
    isLoadingTasks,
    setTasks: syncTasks,
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