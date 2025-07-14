// src/utils/activityLogger.js

// Activity action types
export const activityActions = {
    TASK_CREATE: 'TASK_CREATE',
    TASK_UPDATE: 'TASK_UPDATE',
    TASK_DELETE: 'TASK_DELETE',
    TASK_MOVE: 'TASK_MOVE'
};

// Format changes between old and new task state
export const formatChanges = (oldTask, newTask) => {
    const changes = {};
    
    // Compare each field and record changes
    const fields = ['title', 'description', 'status', 'priority', 'dueDate', 'assignedTo'];
    fields.forEach(field => {
        if (oldTask[field] !== newTask[field]) {
            changes[field] = {
                from: oldTask[field],
                to: newTask[field]
            };
        }
    });
    
    return {
        changes,
        oldTitle: oldTask.title,
        newTitle: newTask.title
    };
};

// Main activity logging function
export const logActivity = (action, data, socket) => {
    const activity = {
        action,
        data,
        timestamp: new Date().toISOString(),
        userId: localStorage.getItem('userId') || 'anonymous'
    };
    
    console.log('📝 Activity Log:', activity);
    
    if (socket) {
        socket.emit('activity', activity);
    }
    
    // Here you could also send the activity to your backend
    // for persistent storage if needed
};