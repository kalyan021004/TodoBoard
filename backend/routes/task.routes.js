import express from 'express'
import Task from '../models/task.models.js';
import User from '../models/user.models.js';
import { authenticate } from '../middleware/auth.js';
import { validateTask } from '../middleware/taskValidation.js';
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
    
    // Check for duplicate title (basic implementation without board)
    const existingTask = await Task.findOne({ 
      title: title.trim(),
      board: null // For now, checking in default board
    });
    
    if (existingTask) {
      return res.status(400).json({
        success: false,
        message: 'Task with this title already exists'
      });
    }
    
    const task = new Task({
      title: title.trim(),
      description: description?.trim(),
      assignedUser,
      status: status || 'todo',
      priority: priority || 'medium',
      createdBy: req.user.id
    });
    
    await task.save();
    
    await task.populate('assignedUser', 'username email');
    await task.populate('createdBy', 'username email');
    
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



router.put('/:id',authenticate, validateTask, async (req, res) => {
  try {
    const { title, description, assignedUser, status, priority } = req.body;
    
    // Find the task
    const task = await Task.findById(req.params.id);
    if (!task) {
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
    
    // Check for duplicate title (excluding current task)
    const existingTask = await Task.findOne({ 
      title: title.trim(),
      board: null,
      _id: { $ne: req.params.id }
    });
    
    if (existingTask) {
      return res.status(400).json({
        success: false,
        message: 'Task with this title already exists'
      });
    }
    
    // Update task
    task.title = title.trim();
    task.description = description?.trim();
    task.assignedUser = assignedUser;
    task.status = status || task.status;
    task.priority = priority || task.priority;
    
    await task.save();
    
    // Populate the updated task
    await task.populate('assignedUser', 'username email');
    await task.populate('createdBy', 'username email');
    
    res.json({
      success: true,
      data: task,
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


router.delete('/:id',authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    
    
    await Task.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
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

export default router;

