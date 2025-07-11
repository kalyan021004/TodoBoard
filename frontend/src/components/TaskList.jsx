import React, { useState, useEffect } from 'react';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import Modal from './Modal';
import { useTasks } from '../hooks/useTasks';
import './TaskList.css';

const TaskList = () => {
  const { tasks, loading, error, fetchTasks, createTask, updateTask, deleteTask } = useTasks();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    sortBy: 'createdAt',
    order: 'desc'
  });

  useEffect(() => {
    fetchTasks(filters);
    fetchUsers();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      await createTask(taskData);
      setShowCreateModal(false);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleEditTask = async (taskData) => {
    try {
      await updateTask(editingTask._id, taskData);
      setShowEditModal(false);
      setEditingTask(null);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteTask = async () => {
    try {
      await deleteTask(deletingTaskId);
      setShowDeleteModal(false);
      setDeletingTaskId(null);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const task = tasks.find(t => t._id === taskId);
      if (task) {
        await updateTask(taskId, { 
          ...task, 
          status: newStatus,
          assignedUser: task.assignedUser._id 
        });
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setShowEditModal(true);
  };

  const openDeleteModal = (taskId) => {
    setDeletingTaskId(taskId);
    setShowDeleteModal(true);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  if (loading) return <div className="loading">Loading tasks...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="task-list-container">
      <div className="task-header">
        <h2>Tasks</h2>
        <button 
          className="create-task-btn"
          onClick={() => setShowCreateModal(true)}
        >
          Create New Task
        </button>
      </div>

      <div className="task-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={filters.status} 
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All</option>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Priority:</label>
          <select 
            value={filters.priority} 
            onChange={(e) => handleFilterChange('priority', e.target.value)}
          >
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sort by:</label>
          <select 
            value={filters.sortBy} 
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
          >
            <option value="createdAt">Created Date</option>
            <option value="updatedAt">Updated Date</option>
            <option value="title">Title</option>
            <option value="priority">Priority</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Order:</label>
          <select 
            value={filters.order} 
            onChange={(e) => handleFilterChange('order', e.target.value)}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      <div className="task-stats">
        <div className="stat-item">
          <span className="stat-label">Total:</span>
          <span className="stat-value">{tasks.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">To Do:</span>
          <span className="stat-value">{tasks.filter(t => t.status === 'todo').length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">In Progress:</span>
          <span className="stat-value">{tasks.filter(t => t.status === 'in-progress').length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Completed:</span>
          <span className="stat-value">{tasks.filter(t => t.status === 'completed').length}</span>
        </div>
      </div>

      <div className="task-grid">
        {tasks.length === 0 ? (
          <div className="no-tasks">
            <p>No tasks found. Create your first task to get started!</p>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task._id}
              task={task}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)}>
          <div className="modal-header">
            <h3>Create New Task</h3>
          </div>
          <TaskForm
            users={users}
            onSubmit={handleCreateTask}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      )}

      {/* Edit Task Modal */}
      {showEditModal && (
        <Modal onClose={() => setShowEditModal(false)}>
          <div className="modal-header">
            <h3>Edit Task</h3>
          </div>
          <TaskForm
            task={editingTask}
            users={users}
            onSubmit={handleEditTask}
            onCancel={() => setShowEditModal(false)}
            isEditing={true}
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal onClose={() => setShowDeleteModal(false)}>
          <div className="modal-header">
            <h3>Delete Task</h3>
          </div>
          <div className="delete-confirmation">
            <p>Are you sure you want to delete this task? This action cannot be undone.</p>
            <div className="delete-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button 
                className="delete-btn"
                onClick={handleDeleteTask}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TaskList;