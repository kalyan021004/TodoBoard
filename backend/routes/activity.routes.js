import express from 'express';
import Task from '../models/task.models.js';
import User from '../models/user.models.js';
import ActivityLog from '../models/activity.models.js';
import { authenticate } from '../middleware/auth.js';
import { validateTask } from '../middleware/taskValidation.js';
import { getIO } from '../sockets/socket.js';

const router = express.Router();

// Enhanced logActivity function
const logActivity = async (req, action, taskId, details = {}) => {
  try {
    const io = getIO();
    const activity = await ActivityLog.create({
      user: req.user._id,
      action,
      entityType: 'Task',
      entityId: taskId,
      details,
      timestamp: new Date()
    });

    const populatedActivity = await ActivityLog.findById(activity._id)
      .populate('user', 'username email')
      .populate({
        path: 'entityId',
        select: 'title status',
        model: 'Task'
      });

    if (io) {
      io.emit('activity_update', populatedActivity);
      io.to(`task_${taskId}`).emit('task_activity', populatedActivity);
    }

    return populatedActivity;
  } catch (error) {
    console.error('Activity logging failed:', error);
  }
};

// Get all tasks
router.get('/', authenticate, async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignedUser', 'username email')
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks'
    });
  }
});

// Create new task
router.post('/', authenticate, validateTask, async (req, res) => {
  try {
    const task = await Task.create({
      ...req.body,
      createdBy: req.user._id
    });

    const activity = await logActivity(req, 'CREATE', task._id, {
      title: task.title,
      status: task.status,
      priority: task.priority
    });

    const io = getIO();
    if (io) {
      io.emit('task_created', {
        task: await task.populate('assignedUser createdBy', 'username email'),
        activity,
        createdBy: req.user.username
      });
      
      if (req.body.assignedUser && req.body.assignedUser !== req.user._id.toString()) {
        io.to(`user_${req.body.assignedUser}`).emit('task_assigned', {
          task,
          assignedBy: req.user.username
        });
      }
    }

    res.status(201).json({
      success: true,
      data: task,
      activity
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task'
    });
  }
});

// Update task
router.put('/:id', authenticate, validateTask, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('assignedUser createdBy', 'username email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const activity = await logActivity(req, 'UPDATE', task._id, {
      changes: req.body,
      previousStatus: task.status
    });

    const io = getIO();
    if (io) {
      io.emit('task_updated', {
        task,
        activity,
        updatedBy: req.user.username
      });

      if (req.body.assignedUser && req.body.assignedUser !== task.assignedUser?._id.toString()) {
        io.to(`user_${req.body.assignedUser}`).emit('task_assigned', {
          task,
          assignedBy: req.user.username
        });
      }
    }

    res.json({
      success: true,
      data: task,
      activity
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task'
    });
  }
});

// Delete task
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const activity = await logActivity(req, 'DELETE', req.params.id, {
      title: task.title,
      status: task.status
    });

    const io = getIO();
    if (io) {
      io.emit('task_deleted', {
        taskId: req.params.id,
        activity,
        deletedBy: req.user.username
      });
    }

    res.json({
      success: true,
      data: { id: req.params.id },
      activity
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task'
    });
  }
});

// Update task position/status
router.put('/:id/position', authenticate, async (req, res) => {
  try {
    const { status, position } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const oldStatus = task.status;
    task.status = status;
    task.position = position;
    await task.save();

    const activity = await logActivity(req, 'MOVE', task._id, {
      fromStatus: oldStatus,
      toStatus: status,
      position
    });

    const io = getIO();
    if (io) {
      io.emit('task_moved', {
        task: await task.populate('assignedUser createdBy', 'username email'),
        activity,
        movedBy: req.user.username,
        fromStatus: oldStatus,
        toStatus: status
      });
    }

    res.json({
      success: true,
      data: task,
      activity
    });
  } catch (error) {
    console.error('Error moving task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to move task'
    });
  }
});

// Get task activities
router.get('/:id/activities', authenticate, async (req, res) => {
  try {
    const activities = await ActivityLog.find({
      entityType: 'Task',
      entityId: req.params.id
    })
    .sort({ timestamp: -1 })
    .populate('user', 'username email');

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities'
    });
  }
});

export default router;