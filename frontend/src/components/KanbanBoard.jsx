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
        users
    } = useTasks();

    // Socket integration
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
        assignTask: assignTaskSocket
    } = useSocketTasks();

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

    // Combine API and Socket tasks with proper synchronization
    const activeTasks = useMemo(() => {
        // If socket tasks exist and are populated, use them
        if (socketTasks && socketTasks.length > 0) {
            return socketTasks;
        }
        // Otherwise, use API tasks
        return apiTasks || [];
    }, [socketTasks, apiTasks]);

    // Sync tasks when API tasks change
    useEffect(() => {
        if (apiTasks && apiTasks.length > 0) {
            syncTasks(apiTasks);
        }
    }, [apiTasks, syncTasks]);

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

    // Initial data load
    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        if (showModal && users.length === 0) {
            fetchUsers();
        }
    }, [showModal, users.length, fetchUsers]);

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
                    aValue = a.position || 0;
                    bValue = b.position || 0;
            }

            return sortOrder === 'asc' ? aValue > bValue ? 1 : -1 : aValue < bValue ? 1 : -1;
        });

        return filteredTasks;
    };

    // Task CRUD operations with immediate state updates
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
                const updatedTask = await updateTaskAPI(editingTask._id, taskData);
                
                // Update local state immediately
                setTasks(prevTasks => 
                    prevTasks.map(task => 
                        task._id === editingTask._id ? updatedTask : task
                    )
                );
                
                // Also emit socket event if connected
                if (socket) {
                    updateTaskSocket(editingTask._id, taskData);
                }
            } else {
                // Create new task
                const status = editingTask.status || 'todo';
                const newTask = await createTaskAPI({ ...taskData, status });
                
                // Update local state immediately
                setTasks(prevTasks => [...prevTasks, newTask]);
                
                // Also emit socket event if connected
                if (socket) {
                    createTaskSocket({ ...taskData, status });
                }
            }
            handleCloseModal();
        } catch (error) {
            console.error('Error saving task:', error);
            // Optionally show error notification
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (window.confirm('Are you sure you want to delete this task?')) {
            try {
                await deleteTaskAPI(taskId);
                
                // Update local state immediately
                setTasks(prevTasks => prevTasks.filter(task => task._id !== taskId));
                
                // Also emit socket event if connected
                if (socket) {
                    deleteTaskSocket(taskId);
                }
            } catch (error) {
                console.error('Error deleting task:', error);
                // Optionally show error notification
            }
        }
    };

    // Drag and drop functionality with immediate updates
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
                
                // Update via API
                const updatedTask = await updateTaskPositionAPI(draggedTask._id, newStatus, newPosition);
                
                // Update local state immediately
                setTasks(prevTasks =>
                    prevTasks.map(task =>
                        task._id === draggedTask._id ? updatedTask : task
                    )
                );
                
                // Also emit socket event if connected
                if (socket) {
                    moveTaskSocket(draggedTask._id, newStatus);
                }
            } else if (userChanged) {
                // Update via API
                const updatedTask = await updateTaskAPI(draggedTask._id, { assignedUser: newAssignedUser });
                
                // Update local state immediately
                setTasks(prevTasks =>
                    prevTasks.map(task =>
                        task._id === draggedTask._id ? updatedTask : task
                    )
                );
                
                // Also emit socket event if connected
                if (socket) {
                    assignTaskSocket(draggedTask._id, newAssignedUser);
                }
            }
        } catch (error) {
            console.error('Error updating task:', error);
            // Optionally revert local state changes on error
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