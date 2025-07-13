// hooks/useSocketTasks.js - Fixed Version with Browser Notifications
import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

export const useSocketTasks = (initialTasks = []) => {
  const [tasks, setTasks] = useState(initialTasks);
  const [notifications, setNotifications] = useState([]);
  const { socket } = useSocket();

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Notification permission handler
  const requestNotificationPermission = async () => {
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
  };

  // Show browser notification
  const showBrowserNotification = async (title, body, icon = '/favicon.ico') => {
    const hasPermission = await requestNotificationPermission();
    
    if (hasPermission) {
      try {
        const notification = new Notification(title, {
          body,
          icon,
          tag: 'task-update',
          requireInteraction: false,
          silent: false
        });

        // Auto close after 4 seconds
        setTimeout(() => {
          notification.close();
        }, 4000);

        // Handle notification click
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return true;
      } catch (error) {
        console.error('Error showing notification:', error);
        return false;
      }
    }
    return false;
  };

  // Add debug logging for socket connection
  useEffect(() => {
    console.log('useSocketTasks: Socket state:', {
      socket: !!socket,
      connected: socket?.connected,
      id: socket?.id
    });
  }, [socket]);

  useEffect(() => {
    if (!socket) {
      console.log('useSocketTasks: No socket available');
      return;
    }

    console.log('useSocketTasks: Setting up socket listeners');

    // Task event handlers with enhanced logging and browser notifications
    const handleTaskCreated = (data) => {
      console.log('🔔 Socket event: task_created', data);
      setTasks(prev => [...prev, data.task]);
      const message = `${data.createdBy} created a new task: ${data.task.title}`;
      addNotification(message, 'success');
      showBrowserNotification('New Task Created', message);
    };

    const handleTaskUpdated = (data) => {
      console.log('🔔 Socket event: task_updated', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      const message = `${data.updatedBy} updated task: ${data.task.title}`;
      addNotification(message, 'info');
      showBrowserNotification('Task Updated', message);
    };

    const handleTaskDeleted = (data) => {
      console.log('🔔 Socket event: task_deleted', data);
      setTasks(prev => prev.filter(task => task._id !== data.taskId));
      const message = `${data.deletedBy} deleted a task`;
      addNotification(message, 'warning');
      showBrowserNotification('Task Deleted', message);
    };

    const handleTaskMoved = (data) => {
      console.log('🔔 Socket event: task_moved', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      const message = `${data.movedBy} moved task: ${data.task.title} to ${data.task.status}`;
      addNotification(message, 'info');
      showBrowserNotification('Task Moved', message);
    };

    const handleTaskAssigned = (data) => {
      console.log('🔔 Socket event: task_assigned', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      const message = `${data.assignedBy} assigned task: ${data.task.title}`;
      addNotification(message, 'info');
      showBrowserNotification('Task Assigned', message);
    };

    const handleTaskAssignedToYou = (data) => {
      console.log('🔔 Socket event: task_assigned_to_you', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      const message = `You have been assigned to task: ${data.task.title}`;
      addNotification(message, 'success');
      showBrowserNotification('Task Assigned to You', message);
    };

    const handleTaskError = (data) => {
      console.log('🔔 Socket event: task_error', data);
      const message = `Error: ${data.message}`;
      addNotification(message, 'error');
      showBrowserNotification('Task Error', message);
    };

    // Success handlers
    const handleTaskCreatedSuccess = (data) => {
      console.log('✅ Socket event: task_created_success', data);
    };

    const handleTaskUpdatedSuccess = (data) => {
      console.log('✅ Socket event: task_updated_success', data);
    };

    const handleTaskDeletedSuccess = (data) => {
      console.log('✅ Socket event: task_deleted_success', data);
    };

    const handleTaskMovedSuccess = (data) => {
      console.log('✅ Socket event: task_moved_success', data);
    };

    const handleTaskAssignedSuccess = (data) => {
      console.log('✅ Socket event: task_assigned_success', data);
    };

    // Register event listeners
    socket.on('task_created', handleTaskCreated);
    socket.on('task_updated', handleTaskUpdated);
    socket.on('task_deleted', handleTaskDeleted);
    socket.on('task_moved', handleTaskMoved);
    socket.on('task_assigned', handleTaskAssigned);
    socket.on('task_assigned_to_you', handleTaskAssignedToYou);
    socket.on('task_error', handleTaskError);
    socket.on('task_created_success', handleTaskCreatedSuccess);
    socket.on('task_updated_success', handleTaskUpdatedSuccess);
    socket.on('task_deleted_success', handleTaskDeletedSuccess);
    socket.on('task_moved_success', handleTaskMovedSuccess);
    socket.on('task_assigned_success', handleTaskAssignedSuccess);

    // Log all incoming events for debugging
    const originalOnevent = socket.onevent;
    socket.onevent = function(packet) {
      console.log('📥 Socket received:', packet.data);
      if (originalOnevent) {
        originalOnevent.call(socket, packet);
      }
    };

    console.log('useSocketTasks: All listeners registered');

    // Cleanup
    return () => {
      console.log('useSocketTasks: Cleaning up listeners');
      socket.off('task_created', handleTaskCreated);
      socket.off('task_updated', handleTaskUpdated);
      socket.off('task_deleted', handleTaskDeleted);
      socket.off('task_moved', handleTaskMoved);
      socket.off('task_assigned', handleTaskAssigned);
      socket.off('task_assigned_to_you', handleTaskAssignedToYou);
      socket.off('task_error', handleTaskError);
      socket.off('task_created_success', handleTaskCreatedSuccess);
      socket.off('task_updated_success', handleTaskUpdatedSuccess);
      socket.off('task_deleted_success', handleTaskDeletedSuccess);
      socket.off('task_moved_success', handleTaskMovedSuccess);
      socket.off('task_assigned_success', handleTaskAssignedSuccess);
    };
  }, [socket]);

  const addNotification = (message, type) => {
    console.log('📢 Adding notification:', { message, type });
    const id = Date.now();
    const notification = { id, message, type, timestamp: new Date() };
    
    setNotifications(prev => {
      const newNotifications = [...prev, notification];
      console.log('📢 Notifications updated:', newNotifications);
      return newNotifications;
    });
    
    // Auto remove notification after 5 seconds
    setTimeout(() => {
      console.log('📢 Auto-removing notification:', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id) => {
    console.log('📢 Removing notification:', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    console.log('📢 Clearing all notifications');
    setNotifications([]);
  };

  // Add a manual test function
  const testNotification = () => {
    console.log('🧪 Testing notification manually');
    const message = 'This is a test notification!';
    addNotification(message, 'success');
    showBrowserNotification('Test Notification', message);
  };

  // Debug logging for state changes
  useEffect(() => {
    console.log('📊 Notifications state changed:', notifications);
  }, [notifications]);

  return {
    tasks,
    setTasks,
    notifications,
    removeNotification,
    clearNotifications,
    testNotification,
    showBrowserNotification // Export for manual use
  };
};