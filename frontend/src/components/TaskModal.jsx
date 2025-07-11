// components/TaskModal.js
import React, { useState, useEffect } from 'react';
import './TaskModal.css';

const TaskModal = ({ isOpen, onClose, task, onSave, users = [] }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        assignedUser: '',
        status: 'todo',
        priority: 'medium'
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    // Debug: Log users to see what we're getting
    useEffect(() => {
        console.log('TaskModal users:', users);
        console.log('Users array length:', users.length);
        console.log('Users is array:', Array.isArray(users));
    }, [users]);

    // Initialize form data when modal opens or task changes
    useEffect(() => {
        if (isOpen) {
            if (task && task._id) {
                // Editing existing task
                setFormData({
                    title: task.title || '',
                    description: task.description || '',
                    assignedUser: task.assignedUser?._id || '',
                    status: task.status || 'todo',
                    priority: task.priority || 'medium'
                });
            } else {
                // Creating new task
                setFormData({
                    title: '',
                    description: '',
                    assignedUser: '',
                    status: task?.status || 'todo',
                    priority: 'medium'
                });
            }
            setErrors({});
        }
    }, [isOpen, task]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.title.trim()) {
            newErrors.title = 'Title is required';
        } else if (formData.title.length > 100) {
            newErrors.title = 'Title must be less than 100 characters';
        }
        
        if (formData.description && formData.description.length > 500) {
            newErrors.description = 'Description must be less than 500 characters';
        }
        
        if (!formData.assignedUser) {
            newErrors.assignedUser = 'Please assign this task to a user';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) return;
        
        setLoading(true);
        
        try {
            await onSave(formData);
        } catch (error) {
            console.error('Error saving task:', error);
            setErrors({ submit: 'Failed to save task. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
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

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <h2>{task?._id ? 'Edit Task' : 'Create New Task'}</h2>
                    <button 
                        className="close-btn"
                        onClick={onClose}
                        type="button"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="task-form">
                    <div className="form-group">
                        <label htmlFor="title">
                            Task Title <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="Enter task title..."
                            className={errors.title ? 'error' : ''}
                            maxLength={100}
                        />
                        {errors.title && <span className="error-message">{errors.title}</span>}
                        <div className="char-count">
                            {formData.title.length}/100
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description</label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Enter task description..."
                            rows={4}
                            className={errors.description ? 'error' : ''}
                            maxLength={500}
                        />
                        {errors.description && <span className="error-message">{errors.description}</span>}
                        <div className="char-count">
                            {formData.description.length}/500
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="assignedUser">
                                Assign to <span className="required">*</span>
                            </label>
                            <select
                                id="assignedUser"
                                name="assignedUser"
                                value={formData.assignedUser}
                                onChange={handleChange}
                                className={errors.assignedUser ? 'error' : ''}
                            >
                                <option value="">Select a user...</option>
                                {Array.isArray(users) && users.length > 0 ? (
                                    users.map(user => (
                                        <option key={user._id} value={user._id}>
                                            {user.username || user.name || `User ${user._id}`}
                                        </option>
                                    ))
                                ) : (
                                    <option value="" disabled>No users available</option>
                                )}
                            </select>
                            {errors.assignedUser && <span className="error-message">{errors.assignedUser}</span>}
                            
                            {/* Debug info - remove this once fixed */}
                            {(!users || users.length === 0) && (
                                <div style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>
                                    Debug: Users array is empty or undefined. 
                                    Users: {JSON.stringify(users)}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="status">Status</label>
                            <select
                                id="status"
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                            >
                                <option value="todo">To Do</option>
                                <option value="in-progress">In Progress</option>
                                <option value="done">Done</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="priority">Priority</label>
                        <div className="priority-selector">
                            {['low', 'medium', 'high'].map(priority => (
                                <label key={priority} className="priority-option">
                                    <input
                                        type="radio"
                                        name="priority"
                                        value={priority}
                                        checked={formData.priority === priority}
                                        onChange={handleChange}
                                    />
                                    <div 
                                        className={`priority-card ${formData.priority === priority ? 'selected' : ''}`}
                                        style={{ borderColor: getPriorityColor(priority) }}
                                    >
                                        <span className="priority-icon">{getPriorityIcon(priority)}</span>
                                        <span className="priority-label">{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {errors.submit && (
                        <div className="error-message submit-error">
                            {errors.submit}
                        </div>
                    )}

                    <div className="modal-footer">
                        <button 
                            type="button" 
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    {task?._id ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                task?._id ? 'Update Task' : 'Create Task'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskModal;