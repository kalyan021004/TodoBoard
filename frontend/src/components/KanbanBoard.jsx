import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import KanbanColumn from './KanbanColumn';
import TaskModal from './TaskModal';
import FilterBar from './FilterBar';
import NotificationContainer from './NotificationContainer';
import OnlineUsers from './OnlineUsers';
import ActivityLogPanel from './ActivityLogPanel';
import { useSocketTasks } from '../hooks/useSocketTasks';
import { useSocketUsers } from '../hooks/useSocketUsers';
import '../styles/KanbanBoard.css';

const KanbanBoard = () => {
  const navigate = useNavigate();
  const {
    tasks,
    notifications,
    activities,
    isLoading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    removeNotification,
    clearNotifications
  } = useSocketTasks();

  const { onlineUsers, typingUsers } = useSocketUsers();

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filters, setFilters] = useState({
    priority: 'all',
    assignedUser: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchTasks();
    setLastRefresh(new Date());
  }, [fetchTasks]);

  // Auto-refresh on error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(handleRefresh, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, handleRefresh]);

  // Get filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Apply filters
    if (filters.priority !== 'all') {
      result = result.filter(task => task.priority === filters.priority);
    }

    if (filters.assignedUser !== 'all') {
      result = result.filter(task => 
        task.assignedUser?._id === filters.assignedUser || 
        task.assignedUser === filters.assignedUser
      );
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(searchTerm) ||
        (task.description && task.description.toLowerCase().includes(searchTerm))
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority] || 0;
          bValue = priorityOrder[b.priority] || 0;
          break;
        case 'assignedUser':
          aValue = a.assignedUser?.username || '';
          bValue = b.assignedUser?.username || '';
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          aValue = a.position;
          bValue = b.position;
      }

      return sortOrder === 'asc' ? 
        (aValue > bValue ? 1 : -1) : 
        (aValue < bValue ? 1 : -1);
    });

    return result;
  }, [tasks, filters, sortBy, sortOrder]);

  // Task operations
  const handleCreateTask = useCallback((status = 'todo') => {
    setEditingTask({ status });
    setShowModal(true);
  }, []);

  const handleEditTask = useCallback((task) => {
    setEditingTask(task);
    setShowModal(true);
  }, []);

  const handleSaveTask = useCallback(async (taskData) => {
    try {
      if (editingTask?._id) {
        await updateTask(editingTask._id, taskData);
      } else {
        await createTask(taskData);
      }
      setShowModal(false);
    } catch (err) {
      console.error('Error saving task:', err);
    }
  }, [editingTask, createTask, updateTask]);

  const handleDeleteTask = useCallback(async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(taskId);
      } catch (err) {
        console.error('Error deleting task:', err);
      }
    }
  }, [deleteTask]);

  // Column configuration
  const columns = useMemo(() => [
    { id: 'todo', title: 'To Do', status: 'todo' },
    { id: 'in-progress', title: 'In Progress', status: 'in-progress' },
    { id: 'done', title: 'Done', status: 'done' }
  ], []);

  // Get tasks by status
  const getTasksByStatus = useCallback((status) => {
    return filteredTasks.filter(task => task.status === status);
  }, [filteredTasks]);

  // Get column statistics
  const getColumnStats = useCallback((status) => {
    const columnTasks = getTasksByStatus(status);
    return {
      total: columnTasks.length,
      high: columnTasks.filter(task => task.priority === 'high').length,
      medium: columnTasks.filter(task => task.priority === 'medium').length,
      low: columnTasks.filter(task => task.priority === 'low').length
    };
  }, [getTasksByStatus]);

  // Handle logout
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your tasks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Tasks</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={handleRefresh}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`kanban-board ${showActivityPanel ? 'with-activity-panel' : ''}`}>
      <NotificationContainer 
        notifications={notifications}
        onRemove={removeNotification}
        onClear={clearNotifications}
      />

      <div className="kanban-header">
        <h1>Task Board</h1>
        <div className="header-actions">
          <OnlineUsers 
            users={onlineUsers} 
            typingUsers={typingUsers}
          />
          <button 
            className={`btn btn-secondary ${showActivityPanel ? 'active' : ''}`}
            onClick={() => setShowActivityPanel(!showActivityPanel)}
          >
            {showActivityPanel ? 'Hide Activity' : 'Show Activity'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleRefresh}
            title={`Last refreshed: ${lastRefresh.toLocaleTimeString()}`}
          >
            ⟳ Refresh
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => handleCreateTask()}
          >
            + Add Task
          </button>
          <button 
            className="btn btn-secondary logout-btn" 
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="kanban-main-content">
        <div className="kanban-board-section">
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            taskCounts={{
              total: filteredTasks.length,
              todo: getTasksByStatus('todo').length,
              inProgress: getTasksByStatus('in-progress').length,
              done: getTasksByStatus('done').length
            }}
          />

          <div className="kanban-columns">
            {columns.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={getTasksByStatus(column.status)}
                stats={getColumnStats(column.status)}
                onCreateTask={handleCreateTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
              />
            ))}
          </div>
        </div>

        {showActivityPanel && (
          <ActivityLogPanel activities={activities} />
        )}
      </div>

      {showModal && (
        <TaskModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          task={editingTask}
          onSave={handleSaveTask}
        />
      )}
    </div>
  );
};

export default KanbanBoard;