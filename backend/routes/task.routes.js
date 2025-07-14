import express from 'express'
import Task from '../models/task.models.js';
import User from '../models/user.models.js';
import { authenticate } from '../middleware/auth.js';
import { validateTask } from '../middleware/taskValidation.js';
import { getIO } from '../sockets/socket.js'; // Import the socket instance
import { logActivity } from '../middleware/activityLog.js';
const router = express.Router();


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

router.get('/:id', authenticate, async (req, res) => {
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
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching task'
    });
  }
});

router.post('/', authenticate, validateTask, async (req, res) => {
  try {
    const { title, description, assignedUser, status, priority } = req.body;
    
    // Verify assigned user exists
    const userExists = await User.findById(assignedUser);
    if (!userExists) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user does not exist'
      });
    }
    
    // FIXED: More flexible duplicate check - only check if title is provided and not empty
    if (title && title.trim()) {
      const existingTask = await Task.findOne({ 
        title: { $regex: new RegExp(`^${title.trim()}$`, 'i') }, // Case-insensitive exact match
        // Remove board filter if you're not using boards, or make it dynamic
        // board: null 
      });
      
      if (existingTask) {
        return res.status(400).json({
          success: false,
          message: 'Task with this title already exists'
        });
      }
    }
    
    const task = new Task({
      title: title?.trim() || `Task ${Date.now()}`, // Fallback title if empty
      description: description?.trim(),
      assignedUser,
      status: status || 'todo',
      priority: priority || 'medium',
      createdBy: req.user.id
    });
    
    await task.save();
    await logActivity(req, 'CREATE', task._id, { title: task.title });

    // FIXED: Check if req.io exists before using it
    if (req.io) {
      req.io.emit('activity_created', await getLastActivities());
    }

    await task.populate('assignedUser', 'username email');
    await task.populate('createdBy', 'username email');
    
    // 🎉 EMIT SOCKET EVENT FOR TASK CREATION
    const io = getIO();
    if (io) {
      io.emit('task_created', {
        task: task,
        createdBy: req.user.username,
        timestamp: new Date()
      });
      
      // Special notification for assigned user
      if (assignedUser !== req.user.id) {
        io.emit('task_assigned_to_you', {
          task: task,
          assignedBy: req.user.username,
          assignedUserId: assignedUser,
          timestamp: new Date()
        });
      }
    }
    
    res.status(201).json({
      success: true,
      data: task,
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
    
    // Find the task with old data
    const oldTask = await Task.findById(req.params.id);
    if (!oldTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Verify assigned user exists
    const userExists = await User.findById(assignedUser);
    if (!userExists) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user does not exist'
      });
    }
    
    // FIXED: Better duplicate check for updates
    if (title && title.trim() && title.trim() !== oldTask.title) {
      const existingTask = await Task.findOne({ 
        title: { $regex: new RegExp(`^${title.trim()}$`, 'i') }, // Case-insensitive
        _id: { $ne: req.params.id } // Exclude current task
        // Remove board filter if not using boards
        // board: null,
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
    
    // Update task - only update fields that are provided
    if (title && title.trim()) {
      oldTask.title = title.trim();
    }
    if (description !== undefined) {
      oldTask.description = description?.trim();
    }
    if (assignedUser) {
      oldTask.assignedUser = assignedUser;
    }
    if (status) {
      oldTask.status = status;
    }
    if (priority) {
      oldTask.priority = priority;
    }
    
    await oldTask.save();
    
    // Populate the updated task
    await oldTask.populate('assignedUser', 'username email');
    await oldTask.populate('createdBy', 'username email');
    
    // 🎉 EMIT SOCKET EVENTS FOR TASK UPDATE
    const io = getIO();
    if (io) {
      // Check if status changed (task moved)
      if (oldStatus !== status) {
        io.emit('task_moved', {
          task: oldTask,
          movedBy: req.user.username,
          oldStatus: oldStatus,
          newStatus: status,
          timestamp: new Date()
        });
      }
      
      // Check if assigned user changed
      if (oldAssignedUser !== assignedUser) {
        io.emit('task_assigned', {
          task: oldTask,
          assignedBy: req.user.username,
          assignedTo: assignedUser,
          timestamp: new Date()
        });
        
        // Special notification for newly assigned user
        if (assignedUser !== req.user.id) {
          io.emit('task_assigned_to_you', {
            task: oldTask,
            assignedBy: req.user.username,
            assignedUserId: assignedUser,
            timestamp: new Date()
          });
        }
      }
      
      // General task updated event
      io.emit('task_updated', {
        task: oldTask,
        updatedBy: req.user.username,
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      data: oldTask,
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

   
    
    await Task.findByIdAndDelete(req.params.id);
    
    // EMIT SOCKET EVENT FOR TASK DELETION
    const io = getIO();
    if (io) {
      io.emit('task_deleted', {
        taskId: req.params.id,  // Include task ID
        deletedBy: req.user.username,
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      data: { id: req.params.id },  // Return deleted task ID
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



router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const tasks = await Task.find({ assignedUser: req.params.userId })
      .populate('assignedUser', 'username email')
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user tasks'
    });
  }
});

// 🎉 UPDATED POSITION ENDPOINT WITH SOCKET EVENTS
router.put('/:id/position', authenticate, async (req, res) => {
    try {
        const { newStatus, newPosition } = req.body;
        
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });
        
        // Store old status for comparison
        const oldStatus = task.status;
        
        // Update task status and position
        task.status = newStatus;
        task.position = newPosition;
        
        await task.save();
        
        // Populate user data for frontend
        await task.populate('assignedUser', 'username email');
        await task.populate('createdBy', 'username email');
        
        // 🎉 EMIT SOCKET EVENT FOR TASK POSITION/STATUS CHANGE
        const io = getIO();
        if (io) {
          // Only emit if status actually changed
          if (oldStatus !== newStatus) {
            io.emit('task_moved', {
              task: task,
              movedBy: req.user.username,
              oldStatus: oldStatus,
              newStatus: newStatus,
              timestamp: new Date()
            });
          }
        }
        
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;