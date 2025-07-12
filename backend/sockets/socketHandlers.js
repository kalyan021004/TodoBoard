// sockets/socketHandlers.js
import Task from "../models/task.models.js";

const socketHandlers = (io, socket) => {
  // Handle task creation
  socket.on('task_created', async (taskData) => {
    try {
      const task = new Task({
        ...taskData,
        createdBy: socket.user.id
      });
      
      await task.save();
      await task.populate('assignedUser createdBy', 'username email');
      
      // Broadcast to all users in the board room
      io.to('board_room').emit('task_created', {
        task: task,
        createdBy: socket.user.username,
        timestamp: new Date()
      });
      
      // Acknowledge to sender
      socket.emit('task_created_success', { task });
      
    } catch (error) {
      console.error('Error creating task:', error);
      socket.emit('task_error', { 
        message: 'Failed to create task',
        error: error.message 
      });
    }
  });

  // Handle task updates
  socket.on('task_updated', async (taskData) => {
    try {
      const { taskId, updates } = taskData;
      
      const task = await Task.findByIdAndUpdate(
        taskId,
        { ...updates, updatedAt: new Date() },
        { new: true }
      ).populate('assignedUser createdBy', 'username email');
      
      if (!task) {
        socket.emit('task_error', { message: 'Task not found' });
        return;
      }
      
      // Broadcast to all users in the board room
      io.to('board_room').emit('task_updated', {
        task: task,
        updatedBy: socket.user.username,
        timestamp: new Date()
      });
      
      // Acknowledge to sender
      socket.emit('task_updated_success', { task });
      
    } catch (error) {
      console.error('Error updating task:', error);
      socket.emit('task_error', { 
        message: 'Failed to update task',
        error: error.message 
      });
    }
  });

  // Handle task deletion
  socket.on('task_deleted', async (taskData) => {
    try {
      const { taskId } = taskData;
      
      const task = await Task.findByIdAndDelete(taskId);
      
      if (!task) {
        socket.emit('task_error', { message: 'Task not found' });
        return;
      }
      
      // Broadcast to all users in the board room
      io.to('board_room').emit('task_deleted', {
        taskId: taskId,
        deletedBy: socket.user.username,
        timestamp: new Date()
      });
      
      // Acknowledge to sender
      socket.emit('task_deleted_success', { taskId });
      
    } catch (error) {
      console.error('Error deleting task:', error);
      socket.emit('task_error', { 
        message: 'Failed to delete task',
        error: error.message 
      });
    }
  });

  // Handle task status change (drag and drop)
  socket.on('task_moved', async (taskData) => {
    try {
      const { taskId, newStatus, newPosition } = taskData;
      
      const task = await Task.findByIdAndUpdate(
        taskId,
        { 
          status: newStatus,
          position: newPosition,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('assignedUser createdBy', 'username email');
      
      if (!task) {
        socket.emit('task_error', { message: 'Task not found' });
        return;
      }
      
      // Broadcast to all users in the board room
      io.to('board_room').emit('task_moved', {
        task: task,
        movedBy: socket.user.username,
        timestamp: new Date()
      });
      
      // Acknowledge to sender
      socket.emit('task_moved_success', { task });
      
    } catch (error) {
      console.error('Error moving task:', error);
      socket.emit('task_error', { 
        message: 'Failed to move task',
        error: error.message 
      });
    }
  });

  // Handle task assignment
  socket.on('task_assigned', async (taskData) => {
    try {
      const { taskId, assignedUserId } = taskData;
      
      const task = await Task.findByIdAndUpdate(
        taskId,
        { 
          assignedUser: assignedUserId,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('assignedUser createdBy', 'username email');
      
      if (!task) {
        socket.emit('task_error', { message: 'Task not found' });
        return;
      }
      
      // Broadcast to all users in the board room
      io.to('board_room').emit('task_assigned', {
        task: task,
        assignedBy: socket.user.username,
        timestamp: new Date()
      });
      
      // Send notification to assigned user
      if (assignedUserId) {
        io.to(`user_${assignedUserId}`).emit('task_assigned_to_you', {
          task: task,
          assignedBy: socket.user.username,
          timestamp: new Date()
        });
      }
      
      // Acknowledge to sender
      socket.emit('task_assigned_success', { task });
      
    } catch (error) {
      console.error('Error assigning task:', error);
      socket.emit('task_error', { 
        message: 'Failed to assign task',
        error: error.message 
      });
    }
  });

  // Handle user typing status
  socket.on('user_typing', (data) => {
    socket.to('board_room').emit('user_typing', {
      userId: socket.user.id,
      username: socket.user.username,
      isTyping: data.isTyping,
      timestamp: new Date()
    });
  });

  // Handle get online users
  socket.on('get_online_users', async () => {
    try {
      const sockets = await io.in('board_room').fetchSockets();
      const onlineUsers = sockets.map(s => ({
        userId: s.user.id,
        username: s.user.username,
        email: s.user.email,
        socketId: s.id
      }));
      
      socket.emit('online_users', onlineUsers);
    } catch (error) {
      console.error('Error getting online users:', error);
      socket.emit('error', { message: 'Failed to get online users' });
    }
  });

  // Handle ping for connection status
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date() });
  });
};

export default socketHandlers;