// src/components/TaskCard.jsx
import React from 'react';
import useSmartAssign from '../hooks/useSmartAssign';
import '../styles/TaskCard.css';

const TaskCard = ({ 
  task, 
  onEdit, 
  onDelete, 
  onDragStart, 
  draggable = false,
  onTaskUpdate
}) => {
  const { smartAssignTask, isAssigning } = useSmartAssign();

  const handleSmartAssign = async (e) => {
    e.stopPropagation();
    try {
      const updatedTask = await smartAssignTask(task._id);
      if (onTaskUpdate) {
        onTaskUpdate(updatedTask);
      }
    } catch (error) {
      console.error('Smart assign failed:', error);
    }
  };

  const handleDragStart = (e) => {
    if (e.target.closest('.task-actions')) {
      e.preventDefault();
      return;
    }
    onDragStart(e, task);
    e.target.style.opacity = '0.7';
    e.dataTransfer.setData('text/plain', task._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
  };

  const handleClick = (e) => {
    if (e.detail === 0) return;
    if (e.target.closest('.task-actions')) return;
    if (e.detail === 2) onEdit(task);
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
  const options = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(dateString).toLocaleDateString(undefined, options);
};
 const getTimeAgo = (dateString) => {
  const now = new Date();
  const created = new Date(dateString);
  const diffInSeconds = Math.floor((now - created) / 1000);
  
  // Calculate different time intervals
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  if (diffInSeconds < 60) {
    return 'Just now';
  }
  if (diffInSeconds < intervals.hour) {
    const minutes = Math.floor(diffInSeconds / intervals.minute);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (diffInSeconds < intervals.day) {
    const hours = Math.floor(diffInSeconds / intervals.hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diffInSeconds < intervals.week) {
    const days = Math.floor(diffInSeconds / intervals.day);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }
  if (diffInSeconds < intervals.month) {
    const weeks = Math.floor(diffInSeconds / intervals.week);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  if (diffInSeconds < intervals.year) {
    const months = Math.floor(diffInSeconds / intervals.month);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
  
  const years = Math.floor(diffInSeconds / intervals.year);
  return `${years} year${years === 1 ? '' : 's'} ago`;
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
            className="btn-icon smart-assign-btn"
            onClick={handleSmartAssign}
            disabled={isAssigning}
            title="Smart Assign"
          >
            {isAssigning ? (
              <span className="spinner"></span>
            ) : (
              '🤖'
            )}
          </button>
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
      
      {draggable && (
        <div className="drag-handle">
          <span>⋮⋮</span>
        </div>
      )}
    </div>
  );
};

export default TaskCard;