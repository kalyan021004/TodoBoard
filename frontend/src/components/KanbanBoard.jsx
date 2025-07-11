import React, { useState, useEffect } from 'react';
import KanbanColumn from './KanbanColumn';
import TaskModal from './TaskModal';
import FilterBar from './FilterBar';
import { useTasks } from '../hooks/useTasks';
import './KanbanBoard.css';

const KanbanBoard = () => {
    const {
        tasks,
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

    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [draggedTask, setDraggedTask] = useState(null);
    const [draggedOverUser, setDraggedOverUser] = useState(null);

    const [filters, setFilters] = useState({
        priority: 'all',
        assignedUser: 'all',
        search: ''
    });

    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState('desc');

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        if (showModal && users.length === 0) {
            fetchUsers();
        }
    }, [showModal, users.length, fetchUsers]);

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
        
        // Redirect to login page
        window.location.href = '/login';
        // Alternative: if using React Router
        // navigate('/login');
    };

    const getTasksByStatus = (status) => {
        if (!tasks || !Array.isArray(tasks)) {
            return [];
        }

        let filteredTasks = tasks.filter(task => task.status === status);

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

    const handleDragStart = (e, task) => {
        console.log('Drag started:', task);
        setDraggedTask(task);
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

    // Try using updateTaskPosition instead of updateTask
    const handleDrop = async (e, newStatus, newAssignedUser = null) => {
        e.preventDefault();
        
        console.log('Drop event:', {
            draggedTask,
            newStatus,
            newAssignedUser,
            originalStatus: draggedTask?.status
        });

        if (!draggedTask) {
            console.log('No dragged task found');
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
                // Use updateTaskPosition for status changes
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
                // Only update assignedUser if status didn't change
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
            <div className="kanban-header">
                <h1>Task Board</h1>
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
                taskCounts={{
                    total: tasks.length,
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
                />
            )}
        </div>
    );
};

export default KanbanBoard;