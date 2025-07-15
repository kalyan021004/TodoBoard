import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import KanbanColumn from './KanbanColumn';
import TaskModal from './TaskModal';
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
    
    // First fetch tasks via REST API
    const {
        tasks: initialTasks,
        loading,
        error,
        fetchTasks,
        fetchUsers,
        createTask: createTaskRest,
        updateTask: updateTaskRest,
        deleteTask: deleteTaskRest,
        updateTaskPosition,
        users
    } = useTasks();

    // Then use socket for real-time updates
    const { 
        tasks: socketTasks, 
        setTasks, 
        notifications, 
        removeNotification, 
        clearNotifications,
        testNotification,
        createTask: createTaskSocket,
        updateTask: updateTaskSocket,
        deleteTask: deleteTaskSocket,
        moveTask: moveTaskSocket,
        assignTask: assignTaskSocket
    } = useSocketTasks(initialTasks);

    const { onlineUsers, typingUsers } = useSocketUsers();

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
        search: ''
    });

    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    // Notification setup
    useEffect(() => {
        const setupNotifications = async () => {
            if ('Notification' in window && Notification.permission === 'default') {
                try {
                    await Notification.requestPermission();
                } catch (error) {
                    console.error('Error requesting notification permission:', error);
                }
            }
        };
        setupNotifications();
    }, []);

    // FIXED: Better sync logic between REST and Socket tasks
    useEffect(() => {
        if (initialTasks.length > 0) {
            console.log('🔄 Syncing initial tasks with socket state');
            // Only update socket tasks if they're empty or significantly different
            if (socketTasks.length === 0 || 
                JSON.stringify(initialTasks.map(t => t._id).sort()) !== 
                JSON.stringify(socketTasks.map(t => t._id).sort())) {
                setTasks(initialTasks);
            }
        }
    }, [initialTasks, setTasks, socketTasks]);

    // Use socketTasks as the primary source of truth, with fallback to initialTasks
    const activeTasks = useMemo(() => {
        // Always prefer socket tasks when available and populated
        if (socketTasks.length > 0) {
            return socketTasks;
        }
        // Fallback to initial tasks
        return initialTasks;
    }, [socketTasks, initialTasks]);

    // Initial data fetch
    useEffect(() => {
        console.log('🚀 Initial data fetch triggered');
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        if (showModal && users.length === 0) {
            fetchUsers();
        }
    }, [showModal, users.length, fetchUsers]);

    // FIXED: Improved refresh function that handles both REST and Socket
    const handleRefresh = useCallback(async () => {
        console.log('🔄 Manual refresh triggered');
        setLastRefresh(new Date());
        
        try {
            // Always fetch fresh data from REST API
            await fetchTasks();
            
            // If socket is connected, also request fresh socket data
            if (socket && socket.connected) {
                console.log('🔌 Requesting fresh socket data');
                socket.emit('request_tasks_refresh');
            }
        } catch (error) {
            console.error('Error during refresh:', error);
        }
    }, [fetchTasks, socket]);

    // Auto-refresh on error with exponential backoff
    useEffect(() => {
        if (error) {
            console.log('❌ Error detected, scheduling auto-refresh');
            const timer = setTimeout(() => {
                handleRefresh();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, handleRefresh]);

    // Periodic refresh - increased frequency
    useEffect(() => {
        const interval = setInterval(() => {
            console.log('⏰ Periodic refresh triggered');
            handleRefresh();
        }, 120000); // Every 2 minutes instead of 5
        return () => clearInterval(interval);
    }, [handleRefresh]);

    // Typing indicator
    const handleTyping = useCallback((isTypingNow) => {
        if (socket && isTypingNow !== isTyping) {
            setIsTyping(isTypingNow);
            socket.emit('user_typing', { 
                isTyping: isTypingNow,
                location: 'kanban_board'
            });
        }
    }, [socket, isTyping]);

    const columns = [
        { id: 'todo', title: 'To Do', status: 'todo' },
        { id: 'in-progress', title: 'In Progress', status: 'in-progress' },
        { id: 'done', title: 'Done', status: 'done' }
    ];

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        navigate('/login', { replace: true });
    };

    const getTasksByStatus = (status) => {
        if (!activeTasks || !Array.isArray(activeTasks)) return [];

        let filteredTasks = activeTasks.filter(task => task.status === status);

        if (filters.priority !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
        }

        if (filters.assignedUser !== 'all') {
            filteredTasks = filteredTasks.filter(task => {
                const taskUserId = task.assignedUser?._id || task.assignedUser;
                return taskUserId === filters.assignedUser;
            });
        }

        if (filters.search) {
            filteredTasks = filteredTasks.filter(task =>
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

            return sortOrder === 'asc' ? aValue > bValue ? 1 : -1 : aValue < bValue ? 1 : -1;
        });

        return filteredTasks;
    };

    // FIXED: Improved task CRUD operations with better fallback handling
    const handleCreateTask = (status = 'todo') => {
        setEditingTask({ status });
        setShowModal(true);
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setShowModal(true);
        handleTyping(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingTask(null);
        handleTyping(false);
    };

    const handleSaveTask = async (taskData) => {
        try {
            if (editingTask._id) {
                // Update existing task
                if (socket && socket.connected) {
                    console.log('📝 Updating task via socket');
                    updateTaskSocket(editingTask._id, taskData);
                } else {
                    console.log('📝 Updating task via REST API');
                    await updateTaskRest(editingTask._id, taskData);
                    // Force refresh to sync socket state
                    setTimeout(() => handleRefresh(), 500);
                }
            } else {
                // Create new task
                const status = editingTask.status || 'todo';
                if (socket && socket.connected) {
                    console.log('➕ Creating task via socket');
                    createTaskSocket({ ...taskData, status });
                } else {
                    console.log('➕ Creating task via REST API');
                    await createTaskRest({ ...taskData, status });
                    // Force refresh to sync socket state
                    setTimeout(() => handleRefresh(), 500);
                }
            }
            handleCloseModal();
        } catch (error) {
            console.error('Error saving task:', error);
            // Show error and refresh to ensure consistency
            setTimeout(() => handleRefresh(), 1000);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (window.confirm('Are you sure you want to delete this task?')) {
            try {
                if (socket && socket.connected) {
                    console.log('🗑️ Deleting task via socket');
                    deleteTaskSocket(taskId);
                } else {
                    console.log('🗑️ Deleting task via REST API');
                    await deleteTaskRest(taskId);
                    // Force refresh to sync socket state
                    setTimeout(() => handleRefresh(), 500);
                }
            } catch (error) {
                console.error('Error deleting task:', error);
                // Refresh to ensure consistency
                setTimeout(() => handleRefresh(), 1000);
            }
        }
    };

    // FIXED: Improved drag and drop with better error handling
    const handleDragStart = (e, task) => {
        const completeTask = activeTasks.find(t => t._id === task._id) || task;
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
                if (socket && socket.connected) {
                    console.log('🔄 Moving task via socket');
                    moveTaskSocket(draggedTask._id, newStatus);
                } else {
                    console.log('🔄 Moving task via REST API');
                    const tasksInNewStatus = getTasksByStatus(newStatus);
                    const newPosition = tasksInNewStatus.length;
                    await updateTaskPosition(draggedTask._id, newStatus, newPosition);
                    setTimeout(() => handleRefresh(), 500);
                }
            } else if (userChanged) {
                if (socket && socket.connected) {
                    console.log('👤 Assigning task via socket');
                    assignTaskSocket(draggedTask._id, newAssignedUser);
                } else {
                    console.log('👤 Assigning task via REST API');
                    await updateTaskRest(draggedTask._id, { assignedUser: newAssignedUser });
                    setTimeout(() => handleRefresh(), 500);
                }
            }
        } catch (error) {
            console.error('Error updating task:', error);
            // Refresh to ensure consistency
            setTimeout(() => handleRefresh(), 1000);
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

    const getColumnStats = (status) => {
        const columnTasks = getTasksByStatus(status);
        return {
            total: columnTasks.length,
            high: columnTasks.filter(task => task.priority === 'high').length,
            medium: columnTasks.filter(task => task.priority === 'medium').length,
            low: columnTasks.filter(task => task.priority === 'low').length
        };
    };

    const toggleActivityPanel = () => {
        setShowActivityPanel(!showActivityPanel);
    };

    if (loading) {
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

    if (error) {
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
                    <OnlineUsers 
                        users={onlineUsers} 
                        typingUsers={typingUsers}
                        allUsers={users}
                    />
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
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                isDraggedOver={draggedTask && draggedTask.status !== column.status}
                                typingUsers={typingUsers.filter(user => user.location === `column_${column.status}`)}
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
        </div>
    );
};

export default KanbanBoard;