// hooks/useSocketTasks.js - Debug Version
import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

export const useSocketTasks = (initialTasks = []) => {
  const [tasks, setTasks] = useState(initialTasks);
  const [notifications, setNotifications] = useState([]);
  const { socket } = useSocket();

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

    // Task event handlers with enhanced logging
    const handleTaskCreated = (data) => {
      console.log('🔔 Socket event: task_created', data);
      setTasks(prev => [...prev, data.task]);
      addNotification(`${data.createdBy} created a new task: ${data.task.title}`, 'success');
    };

    const handleTaskUpdated = (data) => {
      console.log('🔔 Socket event: task_updated', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      addNotification(`${data.updatedBy} updated task: ${data.task.title}`, 'info');
    };

    const handleTaskDeleted = (data) => {
      console.log('🔔 Socket event: task_deleted', data);
      setTasks(prev => prev.filter(task => task._id !== data.taskId));
      addNotification(`${data.deletedBy} deleted a task`, 'warning');
    };

    const handleTaskMoved = (data) => {
      console.log('🔔 Socket event: task_moved', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      addNotification(`${data.movedBy} moved task: ${data.task.title} to ${data.task.status}`, 'info');
    };

    const handleTaskAssigned = (data) => {
      console.log('🔔 Socket event: task_assigned', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      addNotification(`${data.assignedBy} assigned task: ${data.task.title}`, 'info');
    };

    const handleTaskAssignedToYou = (data) => {
      console.log('🔔 Socket event: task_assigned_to_you', data);
      setTasks(prev => prev.map(task => 
        task._id === data.task._id ? data.task : task
      ));
      addNotification(`You have been assigned to task: ${data.task.title}`, 'success');
    };

    const handleTaskError = (data) => {
      console.log('🔔 Socket event: task_error', data);
      addNotification(`Error: ${data.message}`, 'error');
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

    // Generic event listener to catch all events
    const handleAnyEvent = (eventName, ...args) => {
      console.log(`🎯 Socket event received: ${eventName}`, args);
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

    // Listen for ALL events for debugging
    const originalEmit = socket.emit;
    socket.emit = function(...args) {
      console.log('📤 Socket emit:', args[0], args.slice(1));
      return originalEmit.apply(socket, args);
    };

    // Log all incoming events
    const originalOn = socket.on;
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
    addNotification('This is a test notification!', 'success');
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
    testNotification // Add this for manual testing
  };
};