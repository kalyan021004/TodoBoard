import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import KanbanColumn from './KanbanColumn';
import TaskModal from './TaskModal';
import FilterBar from './FilterBar';
import NotificationContainer from './NotificationContainer';
import OnlineUsers from './OnlineUsers';
import { useTasks } from '../hooks/useTasks';
import { useSocketTasks } from '../hooks/useSocketTasks';
import { useSocketUsers } from '../hooks/useSocketUsers';
import { useSocket } from '../context/SocketContext';
import SocketDebugPanel from './SocketDebugPanel';

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
        testNotification
    } = useSocketTasks(initialTasks);

    const { onlineUsers, typingUsers } = useSocketUsers();

    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [draggedTask, setDraggedTask] = useState(null);
    const [draggedOverUser, setDraggedOverUser] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [tasksInitialized, setTasksInitialized] = useState(false);

    const [filters, setFilters] = useState({
        priority: 'all',
        assignedUser: 'all',
        search: ''
    });

    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    // AUTO-REQUEST NOTIFICATION PERMISSION ON COMPONENT MOUNT
    useEffect(() => {
        const setupNotifications = async () => {
            if ('Notification' in window && Notification.permission === 'default') {
                try {
                    const permission = await Notification.requestPermission();
                    console.log('Notification permission:', permission);
                } catch (error) {
                    console.error('Error requesting notification permission:', error);
                }
            }

            // Log debugging info
            console.log('Notification setup:', {
                supported: 'Notification' in window,
                permission: Notification?.permission,
                isHttps: window.location.protocol === 'https:',
                origin: window.location.origin
            });
        };

        setupNotifications();
    }, []);

    // Better task selection logic
    const activeTasks = useMemo(() => {
        // If we have socket tasks and they're properly initialized, use them
        if (socketTasks.length > 0 && tasksInitialized) {
            return socketTasks;
        }
        // Otherwise use initial tasks
        return initialTasks;
    }, [socketTasks, initialTasks, tasksInitialized]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        if (showModal && users.length === 0) {
            fetchUsers();
        }
    }, [showModal, users.length, fetchUsers]);

    // Better initialization logic
    useEffect(() => {
        if (initialTasks.length > 0) {
            // Always update socket tasks when initial tasks change
            setTasks(initialTasks);
            setTasksInitialized(true);
        }
    }, [initialTasks, setTasks]);

    // Ensure socket tasks are set when they become available
    useEffect(() => {
        if (socketTasks.length > 0 && !tasksInitialized) {
            setTasksInitialized(true);
        }
    }, [socketTasks.length, tasksInitialized]);

    // Handle typing indicator
    const handleTyping = (isTypingNow) => {
        if (socket && isTypingNow !== isTyping) {
            setIsTyping(isTypingNow);
            socket.emit('user_typing', { 
                isTyping: isTypingNow,
                location: 'kanban_board'
            });
        }
    };

    const columns = [
        { id: 'todo', title: 'To Do', status: 'todo' },
        { id: 'in-progress', title: 'In Progress', status: 'in-progress' },
        { id: 'done', title: 'Done', status: 'done' }
    ];

    // Logout function
    const handleLogout = () => {
        // Clear any stored authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        
        // Navigate to login page using React Router
        navigate('/login', { replace: true });
    };
    
    const getTasksByStatus = (status) => {
        if (!activeTasks || !Array.isArray(activeTasks)) {
            return [];
        }

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
                // Socket will handle the update via useSocketTasks
            } else {
                const status = editingTask.status || 'todo';
                await createTask({ ...taskData, status });
                // Socket will handle the creation via useSocketTasks
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
                // Socket will handle the deletion via useSocketTasks
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        }
    };

    const handleDragStart = (e, task) => {
        console.log('Drag started:', task);
        // Ensure we have the complete task object
        const completeTask = activeTasks.find(t => t._id === task._id) || task;
        setDraggedTask(completeTask);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task._id);
        e.target.classList.add('card-flipping');
        setTimeout(() => {
            e.target.classList.remove('card-flipping');
        }, 300);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, newStatus, newAssignedUser = null) => {
        e.preventDefault();
        
        console.log('Drop event:', {
            draggedTask,
            newStatus,
            newAssignedUser,
            originalStatus: draggedTask?.status,
            activeTasks: activeTasks.length
        });

        if (!draggedTask || !draggedTask._id) {
            console.log('No valid dragged task found');
            return;
        }

        try {
            const currentUserId = draggedTask.assignedUser?._id || draggedTask.assignedUser;
            const statusChanged = draggedTask.status !== newStatus;
            const userChanged = newAssignedUser && newAssignedUser !== currentUserId;

            console.log('Change detection:', {
                statusChanged,
                userChanged,
                currentUserId,
                newAssignedUser
            });

            if (statusChanged) {
                const tasksInNewStatus = getTasksByStatus(newStatus);
                const newPosition = tasksInNewStatus.length;
                
                console.log('Using updateTaskPosition:', {
                    taskId: draggedTask._id,
                    newStatus,
                    newPosition
                });

                await updateTaskPosition(draggedTask._id, newStatus, newPosition);
                console.log('Task position updated successfully');
            } else if (userChanged) {
                const updateData = {
                    assignedUser: newAssignedUser
                };

                console.log('Updating assigned user:', {
                    taskId: draggedTask._id,
                    updateData
                });

                await updateTask(draggedTask._id, updateData);
                console.log('Task assigned user updated successfully');
            } else {
                console.log('No changes detected, skipping update');
            }
        } catch (error) {
            console.error('Error updating task:', error);
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

    // Don't render if tasks are not initialized
    if (loading || (!tasksInitialized && initialTasks.length === 0)) {
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
            {/* Notifications */}
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
                    <button className="btn btn-primary" onClick={() => handleCreateTask()}>
                        + Add New Task
                    </button>
                    {/* ADD TEST NOTIFICATION BUTTON FOR DEBUGGING */}
                    <button className="btn btn-secondary" onClick={testNotification}>
                        Test Notification
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