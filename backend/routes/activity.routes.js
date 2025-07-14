import express from 'express'
import ActivityLog from '../models/activity.models.js';
import Task from '../models/task.models.js';
const router = express.Router();


router.post('/', async (req, res) => {
  try {
    const task = await Task.create(req.body);
    await logActivity(req, 'CREATE', task._id, { 
      title: task.title,
      status: task.status 
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
export default router;