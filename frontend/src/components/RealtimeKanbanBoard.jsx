import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KanbanColumn from './KanbanColumn';
import TaskModal from './TaskModal';
import FilterBar from './FilterBar';
import { useTasks } from '../hooks/useTasks';
import { useSocketTasks } from '../hooks/useSocketTasks';
import { useSocketUsers } from '../hooks/useSocketUsers';
import './KanbanBoard.css';

const RealtimeKanbanBoard = () => {
    const navigate = useNavigate();
    
    // Core task management hook
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

    // Real-time task updates via WebSocket
    const {
        tasks: realtimeTasks,
        setTasks: setRealtimeTasks,
        notifications,
        removeNotification,
        clearNotifications
    } = useSocketTasks(initialTasks);

    // Real-time user presence and typing indicators
    const {
        onlineUsers,
        typingUsers
    } = useSocketUsers();

    // Local state
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [draggedTask, setDraggedTask] = useState(null);
    const [draggedOverUser, setDraggedOverUser] = useState(null);
    const [isTyping, setIsTyping] = useState(false);

    const [filters, setFilters] = useState({
        priority: 'all',
        assignedUser: 'all',
        search: ''
    });

    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    const columns = [
        { id: 'todo', title: 'To Do', status: 'todo' },
        { id: 'in-progress', title: 'In Progress', status: 'in-progress' },
        { id: 'done', title: 'Done', status: 'done' }
    ];

    // Sync initial tasks with real-time tasks when initial data loads
    useEffect(() => {
        if (initialTasks.length > 0 && realtimeTasks.length === 0) {
            setRealtimeTasks(initialTasks);
        }
    }, [initialTasks, realtimeTasks.length, setRealtimeTasks]);

    // Load initial data
    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        if (showModal && users.length === 0) {
            fetchUsers();
        }
    }, [showModal, users.length, fetchUsers]);

    // Logout function
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        navigate('/login', { replace: true });
    };

    // Use real-time tasks instead of initial tasks for display
    const getTasksByStatus = (status) => {
        if (!realtimeTasks || !Array.isArray(realtimeTasks)) {
            return [];
        }

        let filteredTasks = realtimeTasks.filter(task => task.status === status);

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

    const handleCreateTask = (status = 'todo') => {
        setEditingTask({ status });
        setShowModal(true);
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingTask(null);
        setIsTyping(false);
    };

    const handleSaveTask = async (taskData) => {
        try {
            if (editingTask._id) {
                await handleUpdateTask(editingTask._id, taskData);
            } else {
                const status = editingTask.status || 'todo';
                await handleCreateTaskSubmit({ ...taskData, status });
            }
            handleCloseModal();
        } catch (error) {
            console.error('Error saving task:', error);
        }
    };

    const handleCreateTaskSubmit = async (taskData) => {
        try {
            await createTask(taskData);
        } catch (error) {
            console.error('Error creating task:', error);
        }
    };

    const handleUpdateTask = async (taskId, updates) => {
        try {
            await updateTask(taskId, updates);
        } catch (error) {
            console.error('Error updating task:', error);
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

    const handleTaskMove = async (taskId, newStatus) => {
        try {
            const tasksInNewStatus = getTasksByStatus(newStatus);
            const newPosition = tasksInNewStatus.length;
            await updateTaskPosition(taskId, newStatus, newPosition);
        } catch (error) {
            console.error('Error moving task:', error);
        }
    };

    const handleDragStart = (e, task) => {
        console.log('Drag started:', task);
        setDraggedTask(task);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task._id);
        // Store the task data in case state gets lost
        e.dataTransfer.setData('application/json', JSON.stringify(task));
        e.target.classList.add('card-flipping');
        setTimeout(() => {
            e.target.classList.remove('card-flipping');
        }, 300);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // Try using updateTaskPosition instead of updateTask
    const handleDrop = async (e, newStatus, newAssignedUser = null) => {
        e.preventDefault();
        
        // Get task from state or drag data
        let taskToMove = draggedTask;
        if (!taskToMove) {
            try {
                const taskData = e.dataTransfer.getData('application/json');
                if (taskData) {
                    taskToMove = JSON.parse(taskData);
                }
            } catch (error) {
                console.error('Error parsing drag data:', error);
            }
        }
        
        console.log('Drop event:', {
            draggedTask,
            taskToMove,
            newStatus,
            newAssignedUser,
            originalStatus: taskToMove?.status
        });

        if (!taskToMove) {
            console.log('No dragged task found');
            return;
        }

        try {
            const currentUserId = taskToMove.assignedUser?._id || taskToMove.assignedUser;
            const statusChanged = taskToMove.status !== newStatus;
            const userChanged = newAssignedUser && newAssignedUser !== currentUserId;

            console.log('Change detection:', {
                statusChanged,
                userChanged,
                currentUserId,
                newAssignedUser
            });

            if (statusChanged) {
                // Use updateTaskPosition for status changes
                const tasksInNewStatus = getTasksByStatus(newStatus);
                const newPosition = tasksInNewStatus.length;
                
                console.log('Using updateTaskPosition:', {
                    taskId: taskToMove._id,
                    newStatus,
                    newPosition
                });

                await updateTaskPosition(taskToMove._id, newStatus, newPosition);
                console.log('Task position updated successfully');
            } else if (userChanged) {
                // Only update assignedUser if status didn't change
                const updateData = {
                    assignedUser: newAssignedUser
                };

                console.log('Updating assigned user:', {
                    taskId: taskToMove._id,
                    updateData
                });

                await updateTask(taskToMove._id, updateData);
                console.log('Task assigned user updated successfully');
            } else {
                console.log('No changes detected, skipping update');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            // Show more detailed error info
            if (error.response) {
                console.error('Response data:', error.response.data);
                console.error('Response status:', error.response.status);
            }
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

    // Get online users working on each column
    const getOnlineUsersForColumn = (status) => {
        const columnTasks = getTasksByStatus(status);
        const assignedUserIds = columnTasks
            .map(task => task.assignedUser?._id || task.assignedUser)
            .filter(Boolean);
        
        return onlineUsers.filter(user => assignedUserIds.includes(user.userId));
    };

    // Get typing users for specific tasks
    const getTypingUsersForTask = (taskId) => {
        return typingUsers.filter(user => user.taskId === taskId);
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading your tasks...</p>
                <button className="btn btn-secondary" onClick={fetchTasks}>
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
                <button className="btn btn-primary" onClick={fetchTasks}>
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="kanban-board">
            {/* Real-time notifications */}
            {notifications.length > 0 && (
                <div className="notifications-container">
                    {notifications.map(notification => (
                        <div 
                            key={notification.id} 
                            className={`notification notification-${notification.type}`}
                            onClick={() => removeNotification(notification.id)}
                        >
                            <span>{notification.message}</span>
                            <button className="notification-close">×</button>
                        </div>
                    ))}
                    {notifications.length > 1 && (
                        <button 
                            className="clear-all-notifications"
                            onClick={clearNotifications}
                        >
                            Clear All
                        </button>
                    )}
                </div>
            )}

            <div className="kanban-header">
                <h1>Task Board</h1>
                <div className="header-info">
                    {/* Online users indicator */}
                    <div className="online-users">
                        <span className="online-count">{onlineUsers.length} online</span>
                        <div className="online-user-list">
                            {onlineUsers.map(user => (
                                <div key={user.userId} className="online-user">
                                    <div className="user-avatar">
                                        {user.username?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                    <span className="user-name">{user.username}</span>
                                    <div className="online-indicator"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => handleCreateTask()}>
                        + Add New Task
                    </button>
                    <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>

            <FilterBar
                filters={filters}
                setFilters={setFilters}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                users={users}
                onlineUsers={onlineUsers}
                taskCounts={{
                    total: realtimeTasks.length,
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
                        onlineUsers={getOnlineUsersForColumn(column.status)}
                        typingUsers={typingUsers}
                        onCreateTask={handleCreateTask}
                        onEditTask={handleEditTask}
                        onDeleteTask={handleDeleteTask}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onUserDragOver={handleUserDragOver}
                        onUserDrop={handleUserDrop}
                        onUserDragOver={handleUserDragOver}
                        onUserDrop={handleUserDrop}
                        isDraggedOver={draggedTask && draggedTask.status !== column.status}
                        draggedOverUser={draggedOverUser}
                        getTypingUsersForTask={getTypingUsersForTask}
                    />
                ))}
            </div>

            {showModal && (
                <TaskModal
                    isOpen={showModal}
                    onClose={handleCloseModal}
                    task={editingTask}
                    onSave={handleSaveTask}
                    users={users}
                    onlineUsers={onlineUsers}
                    typingUsers={typingUsers}
                    isTyping={isTyping}
                    setIsTyping={setIsTyping}
                />
            )}
        </div>
    );
};

export default RealtimeKanbanBoard;