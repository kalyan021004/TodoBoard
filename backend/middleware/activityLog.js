import ActivityLog from '../models/activity.models.js';

export async function logActivity(req, action, taskId, details = {}) {
  try {
    const activityData = {
      action,
      user: req.user._id,
      timestamp: new Date()
    };

    if (taskId) {
      activityData.task = taskId;
    }

    if (Object.keys(details).length > 0) {
      activityData.details = details;
    }

    const activity = await ActivityLog.create(activityData);
    
    // Emit socket event if available
    if (req.io) {
      const populatedActivity = await ActivityLog.findById(activity._id)
        .populate('user', 'username')
        .populate('task', 'title');
      
      req.io.emit('activity_created', populatedActivity);
    }

    return activity;
  } catch (error) {
    console.error('Activity logging failed:', error);
    // Don't throw error as we don't want to break main operation
  }
}