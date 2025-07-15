import express from 'express';
import Task from '../models/task.models.js';
import User from '../models/user.models.js';
import { authenticate } from '../middleware/auth.js';
import { validateTask } from '../middleware/taskValidation.js';
import { getIO } from '../sockets/socket.js';
import { logActivity } from '../middleware/activityLog.js';
import ActivityLog from '../models/activity.models.js';

const router = express.Router();

// Enhanced populate function
const populateTask = async (task) => {
  return await task.populate([
    { 
      path: 'assignedUser', 
      select: 'username email _id' 
    },
    { 
      path: 'createdBy', 
      select: 'username email _id' 
    }
  ]);
};

// Socket emitter helper
const emitToAll = (event, data) => {
  const io = getIO();
  if (io) {
    io.emit(event, data);
    console.log(`[Socket] Emitted ${event}`, data); // Debug log
  }
};

const emitToUser = (userId, event, data) => {
  const io = getIO();
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
    console.log(`[Socket] Emitted ${event} to user_${userId}`, data);
  }
};

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, assignedUser, sortBy = 'createdAt', order = 'desc' } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedUser) filter.assignedUser = assignedUser;
    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;

    const tasks = await Task.find(filter)
      .populate('assignedUser', 'username email')
      .populate('createdBy', 'username email')
      .sort(sort);

    res.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tasks'
    });
  }
});

router.post('/', authenticate, validateTask, async (req, res) => {
  try {
    const { title, description, assignedUser, status, priority } = req.body;
    
    // Validate assigned user exists
    const userExists = await User.findById(assignedUser);
    if (!userExists) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user does not exist'
      });
    }
    
    // Check for duplicate title
    if (title?.trim()) {
      const existingTask = await Task.findOne({ 
        title: { $regex: new RegExp(`^${title.trim()}$`, 'i') }
      });
      
      if (existingTask) {
        return res.status(400).json({
          success: false,
          message: 'Task with this title already exists'
        });
      }
    }
    
    // Create new task
    const task = new Task({
      title: title?.trim() || `Task ${Date.now()}`,
      description: description?.trim(),
      assignedUser,
      status: status || 'todo',
      priority: priority || 'medium',
      createdBy: req.user.id
    });
    
    await task.save();
    const populatedTask = await populateTask(task);
    
    // Log activity
    const activity = await logActivity(req, 'CREATE', task._id, { 
      title: task.title,
      status: task.status,
      priority: task.priority
    });

    // Emit socket events
    emitToAll('activity_created', activity);
    emitToAll('task_created', {
      task: populatedTask,
      createdBy: req.user.username,
      timestamp: new Date()
    });
    
    if (assignedUser !== req.user.id) {
      emitToUser(assignedUser, 'task_assigned_to_you', {
        task: populatedTask,
        assignedBy: req.user.username,
        timestamp: new Date()
      });
    }
    
    res.status(201).json({
      success: true,
      data: populatedTask,
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating task'
    });
  }
});

router.put('/:id', authenticate, validateTask, async (req, res) => {
  try {
    const { title, description, assignedUser, status, priority } = req.body;
    
    const oldTask = await Task.findById(req.params.id);
    if (!oldTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Verify assigned user exists if changed
    if (assignedUser) {
      const userExists = await User.findById(assignedUser);
      if (!userExists) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user does not exist'
        });
      }
    }
    
    // Check for duplicate title if changed
    if (title?.trim() && title.trim() !== oldTask.title) {
      const existingTask = await Task.findOne({ 
        title: { $regex: new RegExp(`^${title.trim()}$`, 'i') },
        _id: { $ne: req.params.id }
      });
      
      if (existingTask) {
        return res.status(400).json({
          success: false,
          message: 'Task with this title already exists'
        });
      }
    }
    
    // Store old values for comparison
    const oldStatus = oldTask.status;
    const oldAssignedUser = oldTask.assignedUser?.toString();
    
    // Update fields
    if (title !== undefined) oldTask.title = title.trim();
    if (description !== undefined) oldTask.description = description?.trim();
    if (assignedUser !== undefined) oldTask.assignedUser = assignedUser;
    if (status !== undefined) oldTask.status = status;
    if (priority !== undefined) oldTask.priority = priority;
    
    await oldTask.save();
    const populatedTask = await populateTask(oldTask);
    
    // Log activity
    const activity = await logActivity(req, 'UPDATE', oldTask._id, {
      changes: {
        title: title !== undefined ? title : oldTask.title,
        status: status !== undefined ? status : oldTask.status,
        priority: priority !== undefined ? priority : oldTask.priority,
        assignedUser: assignedUser !== undefined ? assignedUser : oldTask.assignedUser
      },
      previousStatus: oldStatus
    });

    // Emit socket events
    emitToAll('activity_created', activity);
    emitToAll('task_updated', {
      task: populatedTask,
      updatedBy: req.user.username,
      timestamp: new Date()
    });
    
    if (oldStatus !== status) {
      emitToAll('task_moved', {
        task: populatedTask,
        movedBy: req.user.username,
        oldStatus,
        newStatus: status,
        timestamp: new Date()
      });
    }
    
    if (assignedUser && oldAssignedUser !== assignedUser) {
      emitToAll('task_assigned', {
        task: populatedTask,
        assignedBy: req.user.username,
        assignedTo: assignedUser,
        timestamp: new Date()
      });
      
      if (assignedUser !== req.user.id) {
        emitToUser(assignedUser, 'task_assigned_to_you', {
          task: populatedTask,
          assignedBy: req.user.username,
          timestamp: new Date()
        });
      }
    }
    
    res.json({
      success: true,
      data: populatedTask,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating task'
    });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedUser', 'username email')
      .populate('createdBy', 'username email');
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Log activity before deletion
    const activity = await logActivity(req, 'DELETE', task._id, {
      title: task.title,
      status: task.status,
      priority: task.priority
    });

    await Task.findByIdAndDelete(req.params.id);
    
    // Emit socket events
    emitToAll('activity_created', activity);
    emitToAll('task_deleted', {
      taskId: req.params.id,
      deletedBy: req.user.username,
      taskTitle: task.title,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      data: { id: req.params.id },
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting task'
    });
  }
});

router.put('/:id/position', authenticate, async (req, res) => {
  try {
    const { newStatus, newPosition } = req.body;
    
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ 
        success: false,
        message: 'Task not found' 
      });
    }
    
    const oldStatus = task.status;
    task.status = newStatus;
    task.position = newPosition;
    
    await task.save();
    const populatedTask = await populateTask(task);
    
    // Log activity
    const activity = await logActivity(req, 'UPDATE', task._id, {
      changes: {
        status: newStatus,
        position: newPosition
      },
      previousStatus: oldStatus
    });

    // Emit socket events
    emitToAll('activity_created', activity);
    emitToAll('task_updated', {
      task: populatedTask,
      updatedBy: req.user.username,
      timestamp: new Date()
    });
    
    if (oldStatus !== newStatus) {
      emitToAll('task_moved', {
        task: populatedTask,
        movedBy: req.user.username,
        oldStatus,
        newStatus,
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      data: populatedTask,
      message: 'Task position updated successfully'
    });
  } catch (error) {
    console.error('Error updating task position:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating task position'
    });
  }
});

export default router;