// utils/socket.js - Socket.IO client setup
import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect(userData) {
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    // Connection event handlers
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Join board room
      this.socket.emit('join_board', userData);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.isConnected = false;
      
      // Attempt to reconnect
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.isConnected = false;
      this.handleReconnect();
    });

    return this.socket;
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        if (this.socket) {
          this.socket.connect();
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }

  // Task event emitters
  emitTaskCreated(taskData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('task_created', taskData);
    }
  }

  emitTaskUpdated(taskData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('task_updated', taskData);
    }
  }

  emitTaskDeleted(taskId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('task_deleted', { taskId });
    }
  }

  emitTaskMoved(taskData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('task_moved', taskData);
    }
  }

  emitTaskAssigned(taskData) {
    if (this.socket && this.isConnected) {
      this.socket.emit('task_assigned', taskData);
    }
  }

  emitUserTyping(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit('user_typing', data);
    }
  }

  // Event listeners
  onTaskCreated(callback) {
    if (this.socket) {
      this.socket.on('task_created', callback);
    }
  }

  onTaskUpdated(callback) {
    if (this.socket) {
      this.socket.on('task_updated', callback);
    }
  }

  onTaskDeleted(callback) {
    if (this.socket) {
      this.socket.on('task_deleted', callback);
    }
  }

  onTaskMoved(callback) {
    if (this.socket) {
      this.socket.on('task_moved', callback);
    }
  }

  onTaskAssigned(callback) {
    if (this.socket) {
      this.socket.on('task_assigned', callback);
    }
  }

  onUserConnected(callback) {
    if (this.socket) {
      this.socket.on('user_connected', callback);
    }
  }

  onUserDisconnected(callback) {
    if (this.socket) {
      this.socket.on('user_disconnected', callback);
    }
  }

  onBoardUsers(callback) {
    if (this.socket) {
      this.socket.on('board_users', callback);
    }
  }

  onUserTyping(callback) {
    if (this.socket) {
      this.socket.on('user_typing', callback);
    }
  }

  // Cleanup
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Remove specific event listeners
  removeListener(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Get connection status
  getConnectionStatus() {
    return this.isConnected;
  }
}

// Export singleton instance
export default new SocketService();