import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import KanbanColumn from './KanbanColumn';
import TaskModal from './TaskModal';
import FilterBar from './FilterBar';
import NotificationContainer from './NotificationContainer';
import OnlineUsers from './OnlineUsers';
import ActivityLogPanel from './ActivityLogpanel';
import { useTasks } from '../hooks/useTasks';
import { useSocketTasks } from '../hooks/useSocketTasks';
import { useSocketUsers } from '../hooks/useSocketUsers';
import { useSocket } from '../context/SocketContext';
import '../styles/KanbanBoard.css';

const KanbanBoard = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const {
        tasks: initialTasks,
        loading,
        error,
        fetchTasks,
        fetchUsers,
        createTask,
        updateTask,
        deleteTask,
        updateTaskPosition,
        users
    } = useTasks();

    // Socket integration
    const { 
        tasks: socketTasks, 
        setTasks, 
        notifications, 
        removeNotification, 
        clearNotifications,
        testNotification,
        refreshTasks
    } = useSocketTasks(initialTasks);

    const { onlineUsers, typingUsers } = useSocketUsers();

    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [draggedTask, setDraggedTask] = useState(null);
    const [draggedOverUser, setDraggedOverUser] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [tasksInitialized, setTasksInitialized] = useState(false);
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

    // Combined refresh function
    const handleRefresh = useCallback(() => {
        fetchTasks();
        refreshTasks();
        setLastRefresh(new Date());
    }, [fetchTasks, refreshTasks]);

    // Task management
    const activeTasks = useMemo(() => {
        return socketTasks.length > 0 && tasksInitialized ? socketTasks : initialTasks;
    }, [socketTasks, initialTasks, tasksInitialized]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        if (showModal && users.length === 0) {
            fetchUsers();
        }
    }, [showModal, users.length, fetchUsers]);

    // Initialize tasks
    useEffect(() => {
        if (initialTasks.length > 0) {
            setTasks(initialTasks);
            setTasksInitialized(true);
        }
    }, [initialTasks, setTasks]);

    // Auto-refresh on error
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                handleRefresh();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, handleRefresh]);

    // Periodic refresh
    useEffect(() => {
        const interval = setInterval(() => {
            handleRefresh();
        }, 300000);
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
                    aValue = a.position;
                    bValue = b.position;
            }

            return sortOrder === 'asc' ? aValue > bValue ? 1 : -1 : aValue < bValue ? 1 : -1;
        });

        return filteredTasks;
    };

    // Task CRUD operations
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
                await updateTask(editingTask._id, taskData);
            } else {
                const status = editingTask.status || 'todo';
                await createTask({ ...taskData, status });
            }
            handleCloseModal();
        } catch (error) {
            console.error('Error saving task:', error);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (window.confirm('Are you sure you want to delete this task?')) {
            try {
                await deleteTask(taskId);
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        }
    };

    // Drag and drop functionality
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
                const tasksInNewStatus = getTasksByStatus(newStatus);
                const newPosition = tasksInNewStatus.length;
                await updateTaskPosition(draggedTask._id, newStatus, newPosition);
            } else if (userChanged) {
                await updateTask(draggedTask._id, { assignedUser: newAssignedUser });
            }
        } catch (error) {
            console.error('Error updating task:', error);
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

    if (loading || (!tasksInitialized && initialTasks.length === 0)) {
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