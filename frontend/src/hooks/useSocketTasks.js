import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export const useSocketTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { socket, isConnected } = useSocket();
  const { user, token } = useAuth();

  // Fetch initial tasks from API
  const fetchTasks = useCallback(async () => {
    if (!token) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Invalid response format');
      }

      setTasks(data.data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Fetch activities from API
  const fetchActivities = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/activities`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }

      const data = await response.json();
      setActivities(data.data || []);
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchTasks();
    fetchActivities();
  }, [fetchTasks, fetchActivities]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleTaskEvent = (type, data) => {
      switch (type) {
        case 'created':
          setTasks(prev => [...prev, data.task]);
          addNotification(`${data.createdBy} created: ${data.task.title}`);
          break;
        case 'updated':
          setTasks(prev => prev.map(task => 
            task._id === data.task._id ? data.task : task
          ));
          addNotification(`${data.updatedBy} updated: ${data.task.title}`);
          break;
        case 'deleted':
          setTasks(prev => prev.filter(task => task._id !== data.taskId));
          addNotification(`${data.deletedBy} deleted a task`);
          break;
        default:
          break;
      }
    };

    const handleActivityCreated = (activity) => {
      setActivities(prev => [activity, ...prev.slice(0, 49)]);
    };

    socket.on('task_created', (data) => handleTaskEvent('created', data));
    socket.on('task_updated', (data) => handleTaskEvent('updated', data));
    socket.on('task_deleted', (data) => handleTaskEvent('deleted', data));
    socket.on('activity_created', handleActivityCreated);

    return () => {
      socket.off('task_created');
      socket.off('task_updated');
      socket.off('task_deleted');
      socket.off('activity_created');
    };
  }, [socket, isConnected, user]);

  // Notification management
  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    const notification = {
      id,
      message,
      type,
      timestamp: new Date(),
      isRead: false
    };
    
    setNotifications(prev => [...prev, notification]);
    
    if (type !== 'error') {
      setTimeout(() => {
        removeNotification(id);
      }, 5000);
    }
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Task operations
  const createTask = useCallback(async (taskData) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create task');
      }

      const newTask = await response.json();
      return newTask.data;
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err.message);
      throw err;
    }
  }, [token]);

  const updateTask = useCallback(async (taskId, updates) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update task');
      }

      const updatedTask = await response.json();
      return updatedTask.data;
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err.message);
      throw err;
    }
  }, [token]);

  const deleteTask = useCallback(async (taskId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete task');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err.message);
      throw err;
    }
  }, [token]);

  return {
    tasks,
    notifications,
    activities,
    isLoading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    removeNotification,
    clearNotifications
  };
};