// hooks/useSocket.js
import { useEffect, useState, useCallback, useRef } from 'react';
import socketService from '../utils/socket';

const useSocket = (userData, boardId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const hasConnectedOnce = useRef(false);
  const notificationId = useRef(0);

  // Initialize socket connection
  useEffect(() => {
    if (userData && boardId) {
      const socket = socketService.connect({
        userId: userData.id,
        username: userData.username,
        boardId
      });

      // Connection status handlers
      socket.on('connect', () => {
        setIsConnected(true);
        hasConnectedOnce.current = true;
        addNotification(`Connected to board successfully`, 'success');
      });

      socket.on('disconnect', (reason) => {
        setIsConnected(false);
        // Only show disconnect notification if we were previously connected
        if (hasConnectedOnce.current) {
          addNotification(`Disconnected from board (${reason})`, 'warning');
        }
      });

      socket.on('connect_error', (error) => {
        setIsConnected(false);
        if (hasConnectedOnce.current) {
          addNotification(`Connection error: ${error.message}`, 'error');
        }
      });

      // User presence handlers
      socketService.onUserConnected((data) => {
        setConnectedUsers(prev => {
          const exists = prev.some(user => user.userId === data.userId);
          if (!exists) {
            return [...prev, { userId: data.userId, username: data.username }];
          }
          return prev;
        });
        // Only show notification if it's not the current user
        if (data.userId !== userData.id) {
          addNotification(`${data.username} joined the board`, 'info');
        }
      });

      socketService.onUserDisconnected((data) => {
        setConnectedUsers(prev => 
          prev.filter(user => user.userId !== data.userId)
        );
        // Only show notification if it's not the current user
        if (data.userId !== userData.id) {
          addNotification(`${data.username} left the board`, 'info');
        }
      });

      socketService.onBoardUsers((users) => {
        setConnectedUsers(users);
      });

      return () => {
        hasConnectedOnce.current = false;
        socketService.disconnect();
        setIsConnected(false);
        setConnectedUsers([]);
      };
    }
  }, [userData, boardId]);

  // Add notification helper with unique IDs
  const addNotification = useCallback((message, type = 'info') => {
    const notification = {
      id: ++notificationId.current,
      message,
      type,
      timestamp: new Date()
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  // Socket event handlers with better notifications
  const handleTaskCreated = useCallback((callback) => {
    socketService.onTaskCreated((data) => {
      callback(data);
      // Only show notification if it's not the current user
      if (data.createdBy !== userData?.username) {
        addNotification(`${data.createdBy} created "${data.task.title}"`, 'success');
      }
    });
  }, [addNotification, userData?.username]);

  const handleTaskUpdated = useCallback((callback) => {
    socketService.onTaskUpdated((data) => {
      callback(data);
      // Only show notification if it's not the current user
      if (data.updatedBy !== userData?.username) {
        addNotification(`${data.updatedBy} updated "${data.task.title}"`, 'info');
      }
    });
  }, [addNotification, userData?.username]);

  const handleTaskDeleted = useCallback((callback) => {
    socketService.onTaskDeleted((data) => {
      callback(data);
      // Only show notification if it's not the current user
      if (data.deletedBy !== userData?.username) {
        addNotification(`${data.deletedBy} deleted a task`, 'warning');
      }
    });
  }, [addNotification, userData?.username]);

  const handleTaskMoved = useCallback((callback) => {
    socketService.onTaskMoved((data) => {
      callback(data);
      // Only show notification if it's not the current user
      if (data.movedBy !== userData?.username) {
        addNotification(
          `${data.movedBy} moved "${data.task?.title || 'a task'}" from ${data.fromStatus} to ${data.toStatus}`, 
          'info'
        );
      }
    });
  }, [addNotification, userData?.username]);

  const handleTaskAssigned = useCallback((callback) => {
    socketService.onTaskAssigned((data) => {
      callback(data);
      // Only show notification if it's not the current user
      if (data.assignedBy !== userData?.username) {
        const assignedUser = typeof data.assignedTo === 'string' ? data.assignedTo : data.assignedTo?.username;
        addNotification(`${data.assignedBy} assigned "${data.task?.title || 'a task'}" to ${assignedUser}`, 'info');
      }
    });
  }, [addNotification, userData?.username]);

  const handleUserTyping = useCallback((callback) => {
    socketService.onUserTyping(callback);
  }, []);

  // Socket emitters
  const emitTaskCreated = useCallback((taskData) => {
    socketService.emitTaskCreated(taskData);
    // Add local notification for own action
    addNotification(`You created "${taskData.task.title}"`, 'success');
  }, [addNotification]);

  const emitTaskUpdated = useCallback((taskData) => {
    socketService.emitTaskUpdated(taskData);
    // Add local notification for own action
    addNotification(`You updated "${taskData.task.title}"`, 'info');
  }, [addNotification]);

  const emitTaskDeleted = useCallback((taskData) => {
    socketService.emitTaskDeleted(taskData.taskId);
    // Add local notification for own action
    addNotification(`You deleted a task`, 'warning');
  }, [addNotification]);

  const emitTaskMoved = useCallback((taskData) => {
    socketService.emitTaskMoved(taskData);
    // Add local notification for own action
    addNotification(`You moved "${taskData.task?.title || 'a task'}" to ${taskData.toStatus}`, 'info');
  }, [addNotification]);

  const emitTaskAssigned = useCallback((taskData) => {
    socketService.emitTaskAssigned(taskData);
    // Add local notification for own action
    const assignedUser = typeof taskData.assignedTo === 'string' ? taskData.assignedTo : taskData.assignedTo?.username;
    addNotification(`You assigned "${taskData.task?.title || 'a task'}" to ${assignedUser}`, 'info');
  }, [addNotification]);

  const emitUserTyping = useCallback((data) => {
    socketService.emitUserTyping(data);
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Remove specific notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    isConnected,
    connectedUsers,
    notifications,
    // Event handlers
    handleTaskCreated,
    handleTaskUpdated,
    handleTaskDeleted,
    handleTaskMoved,
    handleTaskAssigned,
    handleUserTyping,
    // Emitters
    emitTaskCreated,
    emitTaskUpdated,
    emitTaskDeleted,
    emitTaskMoved,
    emitTaskAssigned,
    emitUserTyping,
    // Utilities
    clearNotifications,
    removeNotification
  };
};

export default useSocket;