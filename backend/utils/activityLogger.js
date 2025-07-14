// utils/activityLogger.js
import { getIO } from './socket.js';
import ActivityLog from '../models/activityLog.model.js';

export const activityActions = {
    TASK_CREATE: 'task_create',
    TASK_UPDATE: 'task_update',
    TASK_DELETE: 'task_delete',
    TASK_MOVE: 'task_move',
    BOARD_CREATE: 'board_create',
    BOARD_UPDATE: 'board_update',
    BOARD_DELETE: 'board_delete'
};

/**
 * Formats changes between old and new task states
 * @param {Object} oldTask - Previous task state
 * @param {Object} newTask - Updated task state
 * @returns {Object} Formatted changes object
 */
export const formatChanges = (oldTask, newTask) => {
    const changes = {};
    const fieldsToTrack = ['title', 'description', 'status', 'priority', 'dueDate', 'assignedTo'];

    fieldsToTrack.forEach(field => {
        if (JSON.stringify(oldTask[field]) !== JSON.stringify(newTask[field])) {
            changes[field] = {
                from: oldTask[field],
                to: newTask[field]
            };
        }
    });

    return { changes };
};

/**
 * Logs an activity and emits it via socket.io
 * @param {string} action - One of activityActions
 * @param {Object} details - Action-specific details
 * @param {Object} socket - Socket.io instance
 * @param {string} userId - Optional user ID (defaults to socket user)
 */
export const logActivity = async (action, details, socket, userId = null) => {
    try {
        if (!Object.values(activityActions).includes(action)) {
            throw new Error(`Invalid activity action: ${action}`);
        }

        if (!details.boardId) {
            throw new Error('Board ID is required for activity logging');
        }

        const io = getIO();
        const user = userId || (socket?.userId ? socket.userId : null);

        if (!user) {
            throw new Error('User information is required for activity logging');
        }

        const activityData = {
            action,
            details,
            user,
            task: details.taskId || null,
            timestamp: new Date()
        };

        // Create and save the activity log
        const activityLog = new ActivityLog(activityData);
        await activityLog.save();

        // Populate user info before emitting
        const populatedLog = await ActivityLog.findById(activityLog._id)
            .populate('user', 'username avatar')
            .populate('task', 'title status');

        // Emit to all users in the board room
        if (io) {
            io.to(`board_${details.boardId}`).emit('activity_log_created', populatedLog);
        }

        // Also emit to the sender if socket is provided
        if (socket) {
            socket.emit('activity_log_created', populatedLog);
        }

        return populatedLog;
    } catch (error) {
        console.error('Error logging activity:', error);
        if (socket) {
            socket.emit('activity_log_error', {
                error: error.message,
                details: error.errors
            });
        }
        throw error;
    }
};

/**
 * Fetches activity logs for a board with pagination
 * @param {string} boardId - ID of the board
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Paginated activity logs
 */
export const getActivityLogs = async (boardId, page = 1, limit = 20) => {
    try {
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            ActivityLog.find({ 'details.boardId': boardId })
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('user', 'username avatar')
                .populate('task', 'title status'),
            ActivityLog.countDocuments({ 'details.boardId': boardId })
        ]);

        return {
            logs,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        };
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        throw error;
    }
};