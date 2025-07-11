// components/TaskCard.js
import React from 'react';
import './TaskCard.css';

const TaskCard = ({ 
    task, 
    onEdit, 
    onDelete, 
    onDragStart, 
    draggable = false 
}) => {
    const handleDragStart = (e) => {
        // Prevent dragging when clicking on action buttons
        if (e.target.closest('.task-actions')) {
            e.preventDefault();
            return;
        }
        
        onDragStart(e, task);
        
        // Add some visual feedback
        e.target.style.opacity = '0.7';
        
        // Set drag data for better browser compatibility
        e.dataTransfer.setData('text/plain', task._id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = (e) => {
        // Reset visual feedback
        e.target.style.opacity = '1';
    };

    const handleClick = (e) => {
        // Prevent click events when dragging
        if (e.detail === 0) return; // This was a keyboard event
        
        // Don't edit when clicking on action buttons
        if (e.target.closest('.task-actions')) {
            return;
        }
        
        // Optional: Double-click to edit
        if (e.detail === 2) {
            onEdit(task);
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return '#ff4757';
            case 'medium': return '#ffa502';
            case 'low': return '#26de81';
            default: return '#ddd';
        }
    };

    const getPriorityIcon = (priority) => {
        switch (priority) {
            case 'high': return '🔥';
            case 'medium': return '⚡';
            case 'low': return '🌱';
            default: return '⚪';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };

    const getTimeAgo = (dateString) => {
        const now = new Date();
        const created = new Date(dateString);
        const diffTime = Math.abs(now - created);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Yesterday';
        if (diffDays <= 7) return `${diffDays} days ago`;
        return formatDate(dateString);
    };

    return (
        <div 
            className={`task-card priority-${task.priority} ${task.status === 'done' ? 'completed' : ''}`}
            draggable={draggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={handleClick}
            title="Drag to move task, double-click to edit"
        >
            <div className="task-card-header">
                <div className="priority-section">
                    <div 
                        className="priority-indicator"
                        style={{ backgroundColor: getPriorityColor(task.priority) }}
                        title={`Priority: ${task.priority}`}
                    ></div>
                    <span className="priority-icon">{getPriorityIcon(task.priority)}</span>
                </div>
                <div className="task-actions">
                    <button 
                        className="btn-icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(task);
                        }}
                        title="Edit task"
                    >
                        ✏️
                    </button>
                    <button 
                        className="btn-icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(task._id);
                        }}
                        title="Delete task"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            <div className="task-content">
                <h4 className="task-title">{task.title}</h4>
                {task.description && (
                    <p className="task-description">{task.description}</p>
                )}
            </div>

            <div className="task-footer">
                <div className="task-assigned">
                    <div className="user-avatar-small">
                        {task.assignedUser?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="assigned-user">
                        {task.assignedUser?.username || 'Unassigned'}
                    </span>
                </div>
                <div className="task-date">
                    <span className="created-date" title={formatDate(task.createdAt)}>
                        {getTimeAgo(task.createdAt)}
                    </span>
                </div>
            </div>
            
            <div className="drag-handle">
                <span>⋮⋮</span>
            </div>
        </div>
    );
};

export default TaskCard;