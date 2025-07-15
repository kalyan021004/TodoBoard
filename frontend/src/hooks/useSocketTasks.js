import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export const useSocketTasks = (initialTasks = []) => {
  const [tasks, setTasks] = useState(initialTasks);
  const [notifications, setNotifications] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true); // Add loading state for tasks
  const { socket, isConnected, loadActivities: loadSocketActivities } = useSocket();
  const { user, token } = useAuth();

  // ✅ ADD THIS: Fetch initial tasks from API
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

  // ✅ ADD THIS: Fetch tasks on mount and when user/token changes
  useEffect(() => {
    if (user && token) {
      fetchInitialTasks();
    }
  }, [user, token, fetchInitialTasks]);

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
    if (!socket) {
      console.log('useSocketTasks: No socket available');
      return;
    }

    console.log('useSocketTasks: Setting up socket listeners');

    const handleTaskCreated = (data) => {
      console.log('🔔 Socket event: task_created', data);
      setTasks(prev => [...prev, data.task]);
      addNotification({
        message: `${data.createdBy} created a new task: ${data.task.title}`,
        type: 'success',
        taskId: data.task._id
      });
    };

    const handleTaskUpdated = (data) => {
      console.log('🔔 Socket event: task_updated', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
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
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      addNotification({
        message: `${data.movedBy} moved task to ${data.task.status}`,
        type: 'info',
        taskId: data.task._id
      });
    };

    const handleTaskAssigned = (data) => {
      console.log('🔔 Socket event: task_assigned', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      addNotification({
        message: `${data.assignedBy} assigned task to ${data.task.assignedTo}`,
        type: 'info',
        taskId: data.task._id
      });
    };

    const handleTaskAssignedToYou = (data) => {
      console.log('🔔 Socket event: task_assigned_to_you', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      showBrowserNotification('Task Assigned to You', {
        body: `You've been assigned to: ${data.task.title}`,
        onClick: () => {
          console.log('Notification clicked for task:', data.task._id);
        },
        data: { taskId: data.task._id }
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

    socket.on('task_created', handleTaskCreated);
    socket.on('task_updated', handleTaskUpdated);
    socket.on('task_deleted', handleTaskDeleted);
    socket.on('task_moved', handleTaskMoved);
    socket.on('task_assigned', handleTaskAssigned);
    socket.on('task_assigned_to_you', handleTaskAssignedToYou);
    socket.on('activities_loaded', handleActivitiesLoaded);
    socket.on('activity_created', handleActivityCreated);

    return () => {
      socket.off('task_created', handleTaskCreated);
      socket.off('task_updated', handleTaskUpdated);
      socket.off('task_deleted', handleTaskDeleted);
      socket.off('task_moved', handleTaskMoved);
      socket.off('task_assigned', handleTaskAssigned);
      socket.off('task_assigned_to_you', handleTaskAssignedToYou);
      socket.off('activities_loaded', handleActivitiesLoaded);
      socket.off('activity_created', handleActivityCreated);
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

  // ✅ ADD THIS: Refresh tasks function
  const refreshTasks = useCallback(() => {
    fetchInitialTasks();
  }, [fetchInitialTasks]);

  return {
    tasks,
    notifications,
    activities,
    isLoadingActivities,
    isLoadingTasks, // ✅ ADD THIS: Export loading state
    setTasks,
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
    refreshTasks // ✅ ADD THIS: Export refresh function
  };
};