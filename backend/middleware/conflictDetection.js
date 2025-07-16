import Task from '../models/task.models.js';
import Conflict from '../models/conflict.models.js';
import { getIO } from '../sockets/socket.js';

const conflictDetectionMiddleware = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { version } = req.body;

    // Skip conflict detection for these cases:
    if (req.method === 'POST' || 
        req.path.includes('/resolve-conflict') ||
        req.path.includes('/position')) {
      return next();
    }

    // Require version for all modifying operations
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method) && version === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Version number is required for updates',
        code: 'VERSION_REQUIRED'
      });
    }

    // Get current task with necessary fields
    const currentTask = await Task.findById(id)
      .select('version lastUpdatedBy title status assignedUser')
      .populate('lastUpdatedBy', 'username email');

    if (!currentTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }

    // Version match check
    if (currentTask.version !== version) {
      console.log(`Conflict detected for task ${id}: 
        DB v${currentTask.version} vs Client v${version}`);

      // Create conflict record with detailed diff
      const conflictData = {
        taskId: id,
        taskTitle: currentTask.title,
        currentVersion: {
          data: currentTask.toObject(),
          version: currentTask.version,
          modifiedAt: currentTask.updatedAt,
          modifiedBy: currentTask.lastUpdatedBy
        },
        conflictingVersion: {
          data: req.body,
          version: version,
          modifiedAt: new Date(),
          modifiedBy: req.user._id
        },
        status: 'pending',
        detectedAt: new Date()
      };

      const conflict = await Conflict.create(conflictData);

      // Notify both users via WebSocket
      const io = getIO();
      if (io) {
        // Notify current editor
        if (currentTask.lastUpdatedBy) {
          io.to(`user_${currentTask.lastUpdatedBy._id}`).emit('conflict_warning', {
            type: 'YOUR_CHANGES_OVERWRITTEN',
            taskId: id,
            conflictId: conflict._id,
            withUser: req.user.username
          });
        }

        // Notify conflicting user
        io.to(`user_${req.user._id}`).emit('conflict_warning', {
          type: 'VERSION_MISMATCH',
          taskId: id,
          conflictId: conflict._id,
          withUser: currentTask.lastUpdatedBy?.username || 'System'
        });
      }

      return res.status(409).json({
        success: false,
        message: 'This task was modified by another user',
        code: 'VERSION_CONFLICT',
        conflict: {
          id: conflict._id,
          task: {
            id: id,
            title: currentTask.title,
            currentStatus: currentTask.status
          },
          versions: {
            current: {
              version: currentTask.version,
              modifiedAt: currentTask.updatedAt,
              modifiedBy: currentTask.lastUpdatedBy
                ? {
                    id: currentTask.lastUpdatedBy._id,
                    name: currentTask.lastUpdatedBy.username
                  }
                : null
            },
            yours: {
              version: version,
              modifiedAt: new Date()
            }
          },
          resolutionEndpoint: `/api/tasks/${id}/resolve-conflict`
        }
      });
    }

    // Attach current task to request for later use
    req.currentTaskState = currentTask;
    next();
  } catch (error) {
    console.error('Conflict detection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process conflict detection',
      code: 'CONFLICT_DETECTION_FAILURE',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export default conflictDetectionMiddleware;