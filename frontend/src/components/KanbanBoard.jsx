import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import KanbanColumn from './KanbanColumn';
import TaskModal from './TaskModal';
import ConflictModal from './ConflictModal';  // <-- Conflict modal import
import FilterBar from './FilterBar';
import NotificationContainer from './NotificationContainer';
import OnlineUsers from './OnlineUsers';
import ActivityLogPanel from './ActivityLogPanel';
import { useTasks } from '../hooks/useTasks';
import { useSocketTasks } from '../hooks/useSocketTasks';
import { useSocketUsers } from '../hooks/useSocketUsers';
import { useSocket } from '../context/SocketContext';
import '../styles/KanbanBoard.css';

const KanbanBoard = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();

  // API hooks
  const {
    tasks: apiTasks,
    loading,
    error,
    fetchTasks,
    fetchUsers,
    createTask: createTaskAPI,
    updateTask: updateTaskAPI,
    deleteTask: deleteTaskAPI,
    updateTaskPosition: updateTaskPositionAPI,
    users,
  } = useTasks();

  // Socket hooks
  const {
    tasks: socketTasks,
    setTasks,
    syncTasks,
    notifications,
    removeNotification,
    clearNotifications,
    testNotification,
    refreshTasks,
    createTask: createTaskSocket,
    updateTask: updateTaskSocket,
    deleteTask: deleteTaskSocket,
    moveTask: moveTaskSocket,
    assignTask: assignTaskSocket,
  } = useSocketTasks();

  const { onlineUsers, typingUsers } = useSocketUsers();

  // State management
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);
  const [draggedOverUser, setDraggedOverUser] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filters, setFilters] = useState({
    priority: 'all',
    assignedUser: 'all',
    search: '',
  });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // **Phase 8 Conflict Handling states**
  const [conflictData, setConflictData] = useState(null); // Holds conflict versions
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Combine API + Socket tasks
  const activeTasks = useMemo(() => {
    if (socketTasks && socketTasks.length > 0) {
      return socketTasks;
    }
    return apiTasks || [];
  }, [socketTasks, apiTasks]);

  // Sync socket tasks when API tasks change
  useEffect(() => {
    if (apiTasks && apiTasks.length > 0) {
      syncTasks(apiTasks);
    }
  }, [apiTasks, syncTasks]);

  // Notifications permission request
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error);
    }
  }, []);
  // Add this useEffect hook to your component
useEffect(() => {
  if (!socket) return;

  const handleTaskUpdated = (updatedTask) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task._id === updatedTask._id ? updatedTask : task
      )
    );
  };

  socket.on('task_updated', handleTaskUpdated);

  return () => {
    socket.off('task_updated', handleTaskUpdated);
  };
}, [socket]);

  // Refresh handler (API + socket)
  const handleRefresh = useCallback(() => {
    fetchTasks();
    refreshTasks();
    setLastRefresh(new Date());
  }, [fetchTasks, refreshTasks]);

  // Initial load
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Fetch users on modal open if not loaded
  useEffect(() => {
    if (showModal && users.length === 0) {
      fetchUsers();
    }
  }, [showModal, users.length, fetchUsers]);

  // Auto-refresh on error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(handleRefresh, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, handleRefresh]);

  // Periodic refresh every 5 mins
  useEffect(() => {
    const interval = setInterval(handleRefresh, 300000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  // Typing indicator emit
  const handleTyping = useCallback(
    (isTypingNow) => {
      if (socket && isTypingNow !== isTyping) {
        setIsTyping(isTypingNow);
        socket.emit('user_typing', { isTyping: isTypingNow, location: 'kanban_board' });
      }
    },
    [socket, isTyping]
  );

  // Columns config
  const columns = [
    { id: 'todo', title: 'To Do', status: 'todo' },
    { id: 'in-progress', title: 'In Progress', status: 'in-progress' },
    { id: 'done', title: 'Done', status: 'done' },
  ];

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  // Filtering & sorting helper
  const getTasksByStatus = (status) => {
    if (!activeTasks || !Array.isArray(activeTasks)) return [];

    let filteredTasks = activeTasks.filter((task) => task.status === status);

    if (filters.priority !== 'all') {
      filteredTasks = filteredTasks.filter((task) => task.priority === filters.priority);
    }

    if (filters.assignedUser !== 'all') {
      filteredTasks = filteredTasks.filter((task) => {
        const taskUserId = task.assignedUser?._id || task.assignedUser;
        return taskUserId === filters.assignedUser;
      });
    }

    if (filters.search) {
      filteredTasks = filteredTasks.filter(
        (task) =>
          task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          task.description?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    filteredTasks.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case 'assignedUser':
          aValue = a.assignedUser?.username || a.assignedUser || '';
          bValue = b.assignedUser?.username || b.assignedUser || '';
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          aValue = a.position || 0;
          bValue = b.position || 0;
      }

      return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : aValue < bValue ? 1 : -1;
    });

    return filteredTasks;
  };

  // Show task creation modal
  const handleCreateTask = (status = 'todo') => {
    setEditingTask({ status });
    setShowModal(true);
  };

  // Show task edit modal
  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowModal(true);
    handleTyping(true);
  };

  // Close task modal
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTask(null);
    handleTyping(false);
  };

const handleSaveTask = async (taskData) => {
  try {
    if (editingTask._id) {
      // Update existing task
      const result = await updateTaskAPI(editingTask._id, taskData);

      // Handle conflict response
      if (result?.conflict) {
        setConflictData({
          local: { ...taskData, _id: editingTask._id },
          server: result.serverData
        });
        setShowConflictModal(true);
        return;
      }

      const updatedTask = result.data;
      
      // Update socket if available
      if (socket) {
        updateTaskSocket(editingTask._id, taskData);
      }
    } else {
      // Create new task
      const status = editingTask.status || 'todo';
      const newTask = await createTaskAPI({ ...taskData, status });

      // Update socket if available
      if (socket) {
        createTaskSocket({ ...taskData, status });
      }
    }
    
    // Close modal after successful operation
    handleCloseModal();
  } catch (error) {
    console.error('Error saving task:', error);
    // Don't close modal on error
  }
};
  // Delete task handler
  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTaskAPI(taskId);

        setTasks((prevTasks) => prevTasks.filter((task) => task._id !== taskId));

        if (socket) {
          deleteTaskSocket(taskId);
        }
      } catch (error) {
        console.error('Error deleting task:', error);
        // Handle errors
      }
    }
  };

  // Smart assign update handler
  const handleTaskUpdate = useCallback(
    (updatedTask) => {
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task._id === updatedTask._id ? updatedTask : task))
      );

      if (socket) {
        socket.emit('task_smart_assigned', {
          task: updatedTask,
          assignedTo: updatedTask.assignedUser,
        });
      }
    },
    [setTasks, socket]
  );

  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    const completeTask = activeTasks.find((t) => t._id === task._id) || task;
    setDraggedTask(completeTask);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task._id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newStatus, newAssignedUser = null) => {
    e.preventDefault();

    if (!draggedTask || !draggedTask._id) return;

    try {
      const currentUserId = draggedTask.assignedUser?._id || draggedTask.assignedUser;
      const statusChanged = draggedTask.status !== newStatus;
      const userChanged = newAssignedUser && newAssignedUser !== currentUserId;

      if (statusChanged) {
        const tasksInNewStatus = getTasksByStatus(newStatus);
        const newPosition = tasksInNewStatus.length;

        // Phase 8: Conflict Handling - optimistic concurrency check on update
        try {
          const updatedTask = await updateTaskPositionAPI(draggedTask._id, newStatus, newPosition);

          setTasks((prevTasks) =>
            prevTasks.map((task) => (task._id === draggedTask._id ? updatedTask : task))
          );

          if (socket) {
            moveTaskSocket(draggedTask._id, newStatus);
          }
        } catch (err) {
          // Check if error indicates version conflict (you can customize this)
          if (err.message.includes('Conflict')) {
            // Fetch both versions: server and local
            const serverVersion = await fetch(`${process.env.VITE_API_URL || 'http://localhost:5000'}/api/tasks/${draggedTask._id}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            }).then((res) => res.json());

            setConflictData({
              local: draggedTask,
              server: serverVersion.data || serverVersion,
            });

            setShowConflictModal(true);
          } else {
            throw err; // rethrow other errors
          }
        }
      } else if (userChanged) {
        const updatedTask = await updateTaskAPI(draggedTask._id, { assignedUser: newAssignedUser });

        setTasks((prevTasks) =>
          prevTasks.map((task) => (task._id === draggedTask._id ? updatedTask : task))
        );

        if (socket) {
          assignTaskSocket(draggedTask._id, newAssignedUser);
        }
      }
    } catch (error) {
      console.error('Error updating task:', error);
      // Optionally revert changes on error
    }

    setDraggedTask(null);
    setDraggedOverUser(null);
  };

  const handleUserDragOver = (e, userId) => {
    e.preventDefault();
    setDraggedOverUser(userId);
  };

  const handleUserDrop = (e, userId) => {
    e.preventDefault();
    handleDrop(e, draggedTask.status, userId);
  };

  // Get stats helper
  const getColumnStats = (status) => {
    const columnTasks = getTasksByStatus(status);
    return {
      total: columnTasks.length,
      high: columnTasks.filter((task) => task.priority === 'high').length,
      medium: columnTasks.filter((task) => task.priority === 'medium').length,
      low: columnTasks.filter((task) => task.priority === 'low').length,
    };
  };

  const toggleActivityPanel = () => {
    setShowActivityPanel((prev) => !prev);
  };

  // Socket listener for smart assign updates from others
  useEffect(() => {
    if (socket) {
      const handleSmartAssignUpdate = (data) => {
        setTasks((prevTasks) =>
          prevTasks.map((task) => (task._id === data.task._id ? data.task : task))
        );
      };

      socket.on('task_smart_assigned', handleSmartAssignUpdate);

      return () => {
        socket.off('task_smart_assigned', handleSmartAssignUpdate);
      };
    }
  }, [socket, setTasks]);

 const handleConflictResolve = async (resolution) => {
  try {
    const { action, data } = resolution;
    
    if (action === 'discard') {
      // Just update local state with server version
      setTasks(prev => prev.map(task => 
        task._id === data._id ? data : task
      ));
    } else {
      // For overwrite or merge, send to server
      const response = await updateTask(data._id, data);
      
      if (response?.conflict) {
        // If we get another conflict, show it
        setConflictData({
          local: data,
          server: response.serverData
        });
        return;
      }

      const updatedTask = response.data;
      setTasks(prev => prev.map(task => 
        task._id === updatedTask._id ? updatedTask : task
      ));

      if (socket) {
        updateTaskSocket(updatedTask._id, updatedTask);
      }
    }
    
    setShowConflictModal(false);
    setConflictData(null);
    handleCloseModal();
  } catch (error) {
    console.error('Error resolving conflict:', error);
  }
};

  // UI Loading & error states
  if (loading && activeTasks.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your tasks...</p>
        <button className="btn btn-secondary" onClick={handleRefresh}>
          Retry
        </button>
      </div>
    );
  }

  if (error && activeTasks.length === 0) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>Oops! Something went wrong</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={handleRefresh}>
          Try Again
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
          <OnlineUsers users={onlineUsers} typingUsers={typingUsers} allUsers={users} />
          <button
            className={`btn btn-secondary ${showActivityPanel ? 'active' : ''}`}
            onClick={toggleActivityPanel}
          >
            {showActivityPanel ? 'Hide Activity' : 'Show Activity'}
          </button>
                    <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            title={`Last refreshed: ${lastRefresh.toLocaleTimeString()}`}
          >
            <i className="refresh-icon">⟳</i> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => handleCreateTask()}>
            + Add New Task
          </button>
          <button className="btn btn-secondary" onClick={testNotification}>
            Test Notification
          </button>
          <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
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
            users={users}
            onTyping={handleTyping}
            taskCounts={{
              total: activeTasks.length,
              todo: getTasksByStatus('todo').length,
              inProgress: getTasksByStatus('in-progress').length,
              done: getTasksByStatus('done').length,
            }}
          />

          <div className="kanban-columns">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={getTasksByStatus(column.status)}
                stats={getColumnStats(column.status)}
                onCreateTask={handleCreateTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onTaskUpdate={handleTaskUpdate}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDraggedOver={draggedTask && draggedTask.status !== column.status}
                typingUsers={typingUsers.filter((user) => user.location === `column_${column.status}`)}
              />
            ))}
          </div>
        </div>

        {showActivityPanel && (
          <div className="activity-panel-container">
            <ActivityLogPanel />
          </div>
        )}
      </div>

      {/* Task Modal */}
      {showModal && (
        <TaskModal
          isOpen={showModal}
          onClose={handleCloseModal}
          task={editingTask}
          onSave={handleSaveTask}
          users={users}
          onTyping={handleTyping}
        />
      )}

      {showConflictModal && conflictData && (
  <ConflictModal
    isOpen={showConflictModal}
    localTask={conflictData.local}
    serverTask={conflictData.server}
    onResolve={handleConflictResolve}
    onClose={() => {
      setShowConflictModal(false);
      setConflictData(null);
      handleCloseModal();
    }}
  />
)}
    </div>
  );
};

export default KanbanBoard;

