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
      select: 'username email _id activeTaskCount' 
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
  }
};

const emitToUser = (userId, event, data) => {
  const io = getIO();
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

const updateUserTaskCount = async (userId, increment) => {
  if (!userId) return;
  
  try {
    // Always recalculate from actual database for accuracy
    const actualTaskCount = await Task.countDocuments({ 
      assignedUser: userId,
      status: { $in: ['todo', 'in-progress', 'review'] }
    });
    
    await User.findByIdAndUpdate(userId, { 
      activeTaskCount: actualTaskCount
    });
  } catch (error) {
    console.error('Error updating user task count:', error);
  }
};

const recalculateUserTaskCount = async (userId) => {
  if (!userId) return;
  
  try {
    const actualTaskCount = await Task.countDocuments({ 
      assignedUser: userId,
      status: { $in: ['todo', 'in-progress', 'review'] }
    });
    
    await User.findByIdAndUpdate(userId, { 
      activeTaskCount: actualTaskCount
    });
    
    return actualTaskCount;
  } catch (error) {
    console.error('Error recalculating user task count:', error);
    return 0;
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
      .populate('assignedUser', 'username email activeTaskCount')
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
    
    // Validate assigned user exists if provided
    if (assignedUser) {
      const userExists = await User.findById(assignedUser);
      if (!userExists) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user does not exist'
        });
      }
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
    
    // Update assigned user's task count if assigned
    if (assignedUser) {
      await updateUserTaskCount(assignedUser, true);
    }
    
    const populatedTask = await populateTask(task);
    
    // Log activity
    const activity = await logActivity(req, 'CREATE', task._id, { 
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignedUser: task.assignedUser
    });

    // Emit socket events
    emitToAll('activity_created', activity);
    emitToAll('task_created', {
      task: populatedTask,
      createdBy: req.user.username,
      timestamp: new Date()
    });
    
    if (assignedUser && assignedUser !== req.user.id) {
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
    const { title, description, assignedUser, status, priority, clientVersion } = req.body;

    const oldTask = await Task.findById(req.params.id);
    if (!oldTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Enhanced conflict detection
    if (clientVersion === undefined || Number(clientVersion) !== oldTask.version) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Task has been modified by someone else.',
        conflict: true,
        serverData: {
          _id: oldTask._id,
          title: oldTask.title,
          description: oldTask.description,
          assignedUser: oldTask.assignedUser,
          status: oldTask.status,
          priority: oldTask.priority,
          version: oldTask.version
        },
        clientData: { 
          title, 
          description, 
          assignedUser, 
          status, 
          priority,
          clientVersion
        }
      });
    }

    const oldStatus = oldTask.status;
    const oldAssignedUser = oldTask.assignedUser?.toString();

    if (assignedUser && assignedUser !== oldAssignedUser) {
      const userExists = await User.findById(assignedUser);
      if (!userExists) {
        return res.status(400).json({ success: false, message: 'Assigned user does not exist' });
      }
    }

    if (title?.trim() && title.trim() !== oldTask.title) {
      const existingTask = await Task.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingTask) {
        return res.status(400).json({ success: false, message: 'Task with this title already exists' });
      }
    }

    // Handle task assignment changes
    if (assignedUser && assignedUser !== oldAssignedUser) {
      if (oldAssignedUser) await updateUserTaskCount(oldAssignedUser, false);
      await updateUserTaskCount(assignedUser, true);
    }

    // Update task fields
    oldTask.title = title !== undefined ? title.trim() : oldTask.title;
    oldTask.description = description !== undefined ? description.trim() : oldTask.description;
    oldTask.assignedUser = assignedUser !== undefined ? assignedUser : oldTask.assignedUser;
    oldTask.status = status !== undefined ? status : oldTask.status;
    oldTask.priority = priority !== undefined ? priority : oldTask.priority;
    oldTask.version = oldTask.version + 1; // Always increment version
    oldTask.updatedAt = new Date();

    await oldTask.save();
    const populatedTask = await populateTask(oldTask);

    // Log activity
    const activity = await logActivity(req, 'UPDATE', task._id, {
      changes: {
        title: oldTask.title !== title ? { old: oldTask.title, new: title } : undefined,
        description: oldTask.description !== description ? { old: oldTask.description, new: description } : undefined,
        assignedUser: oldAssignedUser !== assignedUser ? { old: oldAssignedUser, new: assignedUser } : undefined,
        status: oldStatus !== status ? { old: oldStatus, new: status } : undefined,
        priority: oldTask.priority !== priority ? { old: oldTask.priority, new: priority } : undefined
      }
    });

    // Emit socket events
    emitToAll('activity_created', activity);
    emitToAll('task_updated', {
      task: populatedTask,
      updatedBy: req.user.username,
      timestamp: new Date()
    });

    if (oldAssignedUser !== assignedUser && assignedUser) {
      emitToUser(assignedUser, 'task_assigned_to_you', {
        task: populatedTask,
        assignedBy: req.user.username,
        timestamp: new Date()
      });
    }

    res.json({ 
      success: true, 
      data: populatedTask, 
      message: 'Task updated successfully',
      version: oldTask.version // Send back new version
    });

  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, message: 'Server error while updating task' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedUser', 'username email activeTaskCount')
      .populate('createdBy', 'username email');
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Decrement task count for assigned user if exists
    if (task.assignedUser) {
      await updateUserTaskCount(task.assignedUser._id, false);
    }

    // Log activity before deletion
    const activity = await logActivity(req, 'DELETE', task._id, {
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignedUser: task.assignedUser
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

router.get('/smart-assignee', authenticate, async (req, res) => {
  try {
    // Find active users with minimum tasks, excluding the current user if they're not an admin
    const filter = { active: true };
    if (!req.user.isAdmin) {
      filter._id = { $ne: req.user.id }; // Exclude current user unless they're admin
    }

    const userWithFewestTasks = await User.find(filter)
      .sort({ activeTaskCount: 1 })
      .limit(1);
    
    if (!userWithFewestTasks || userWithFewestTasks.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'No available users found for assignment' 
      });
    }

    res.json({
      success: true,
      data: {
        userId: userWithFewestTasks[0]._id,
        username: userWithFewestTasks[0].username,
        currentTaskCount: userWithFewestTasks[0].activeTaskCount
      },
      message: 'Optimal assignee found'
    });
  } catch (error) {
    console.error('Error finding optimal assignee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while finding optimal assignee',
      error: error.message
    });
  }
});

router.patch('/:id/smart-assign', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ 
        success: false,
        message: 'Task not found' 
      });
    }

    // Recalculate ALL user task counts for accuracy
    const allUsers = await User.find({}).select('_id username activeTaskCount');
    
    for (const user of allUsers) {
      await recalculateUserTaskCount(user._id);
    }
    
    // Now get fresh user data with correct counts
    const usersWithCorrectCounts = await User.find({})
      .select('_id username activeTaskCount')
      .sort({ activeTaskCount: 1 });

    const optimalUser = usersWithCorrectCounts[0];

    if (!optimalUser) {
      return res.status(400).json({ 
        success: false,
        message: 'No available users for assignment' 
      });
    }

    // Check if task is already assigned to the optimal user
    if (task.assignedUser?.toString() === optimalUser._id.toString()) {
      return res.status(400).json({ 
        success: false,
        message: 'Task is already assigned to the user with the fewest tasks' 
      });
    }

    // Store the previous assignee BEFORE changing it
    const previousAssigneeId = task.assignedUser?.toString();
    
    // Assign task
    task.assignedUser = optimalUser._id;
    await task.save();
    
    // Recalculate counts for affected users
    if (previousAssigneeId) {
      await recalculateUserTaskCount(previousAssigneeId);
    }
    await recalculateUserTaskCount(optimalUser._id);

    const populatedTask = await populateTask(task);

    // Log activity
    const activity = await logActivity(req, 'SMART_ASSIGN', task._id, {
      assignedTo: optimalUser.username,
      previousAssignee: previousAssigneeId
    });

    // Emit socket events
    emitToAll('activity_created', activity);
    emitToAll('task_updated', {
      task: populatedTask,
      updatedBy: req.user.username,
      timestamp: new Date()
    });

    emitToUser(optimalUser._id, 'task_assigned_to_you', {
      task: populatedTask,
      assignedBy: req.user.username,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: populatedTask,
      message: `Task smart assigned to ${optimalUser.username}`
    });

  } catch (error) {
    console.error('Smart assign error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during smart assignment',
      error: error.message
    });
  }
});

export default router;