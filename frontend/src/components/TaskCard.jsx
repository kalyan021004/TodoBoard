import React from 'react';
import './TaskCard.css';

const TaskCard = ({ task, onEdit, onDelete, onStatusChange }) => {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ff4757';
      case 'medium': return '#ffa502';
      case 'low': return '#2ed573';
      default: return '#747d8c';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'todo': return '#6c5ce7';
      case 'in-progress': return '#fdcb6e';
      case 'completed': return '#00b894';
      default: return '#747d8c';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="task-card">
      <div className="task-header">
        <h3 className="task-title">{task.title}</h3>
        <div className="task-priority" style={{ backgroundColor: getPriorityColor(task.priority) }}>
          {task.priority}
        </div>
      </div>
      
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
      
      <div className="task-meta">
        <div className="task-assigned">
          <span className="label">Assigned to:</span>
          <span className="value">{task.assignedUser?.username || 'Unknown'}</span>
        </div>
        
        <div className="task-status">
          <span className="label">Status:</span>
          <select 
            value={task.status} 
            onChange={(e) => onStatusChange(task._id, e.target.value)}
            className="status-select"
            style={{ backgroundColor: getStatusColor(task.status) }}
          >
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      
      <div className="task-dates">
        <span className="created-date">Created: {formatDate(task.createdAt)}</span>
        <span className="updated-date">Updated: {formatDate(task.updatedAt)}</span>
      </div>
      
      <div className="task-actions">
        <button className="edit-btn" onClick={() => onEdit(task)}>
          Edit
        </button>
        <button className="delete-btn" onClick={() => onDelete(task._id)}>
          Delete
        </button>
      </div>
    </div>
  );
};
export default TaskCard;