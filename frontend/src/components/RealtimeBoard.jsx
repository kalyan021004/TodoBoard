// components/RealtimeBoard.js
import React, { useState, useEffect, useCallback } from 'react';
import useSocket from '../hooks/useSocket';
import ConnectionStatus from './ConnectionStatus';
import TaskCard from './TaskCard';
import './RealtimeBoard.css';

const RealtimeBoard = ({ user, boardId = 'default-board' }) => {
  const [tasks, setTasks] = useState({
    todo: [],
    inProgress: [],
    done: []
  });
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});

  // Initialize socket connection
  const {
    isConnected,
    connectedUsers,
    notifications,
    handleTaskCreated,
    handleTaskUpdated,
    handleTaskDeleted,
    handleTaskMoved,
    handleTaskAssigned,
    handleUserTyping,
    emitTaskCreated,
    emitTaskUpdated,
    emitTaskDeleted,
    emitTaskMoved,
    emitTaskAssigned,
    emitUserTyping
  } = useSocket(user, boardId);

  // Load initial tasks
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await fetch('/api/tasks', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await response.json();
        
        // Group tasks by status
        const groupedTasks = {
          todo: data.filter(task => task.status === 'todo'),
          inProgress: data.filter(task => task.status === 'in-progress'),
          done: data.filter(task => task.status === 'done')
        };
        
        setTasks(groupedTasks);
      } catch (error) {
        console.error('Error loading tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, []);

  // Socket event handlers
  useEffect(() => {
    // Handle task creation
    handleTaskCreated((data) => {
      const newTask = data.task;
      setTasks(prev => ({
        ...prev,
        [newTask.status]: [...prev[newTask.status], newTask]
      }));
    });

    // Handle task updates
    handleTaskUpdated((data) => {
      const updatedTask = data.task;
      setTasks(prev => {
        const newTasks = { ...prev };
        
        // Find and update task in all columns
        Object.keys(newTasks).forEach(status => {
          const taskIndex = newTasks[status].findIndex(task => task._id === updatedTask._id);
          if (taskIndex !== -1) {
            newTasks[status][taskIndex] = updatedTask;
          }
        });
        
        return newTasks;
      });
    });

    // Handle task deletion
    handleTaskDeleted((data) => {
      const taskId = data.taskId;
      setTasks(prev => {
        const newTasks = { ...prev };
        
        // Remove task from all columns
        Object.keys(newTasks).forEach(status => {
          newTasks[status] = newTasks[status].filter(task => task._id !== taskId);
        });
        
        return newTasks;
      });
    });

    // Handle task movement
    handleTaskMoved((data) => {
      const { taskId, fromStatus, toStatus } = data;
      
      setTasks(prev => {
        const newTasks = { ...prev };
        
        // Find task in from column
        const taskIndex = newTasks[fromStatus].findIndex(task => task._id === taskId);
        if (taskIndex !== -1) {
          const [movedTask] = newTasks[fromStatus].splice(taskIndex, 1);
          movedTask.status = toStatus;
          newTasks[toStatus].push(movedTask);
        }
        
        return newTasks;
      });
    });

    // Handle task assignment
    handleTaskAssigned((data) => {
      const { taskId, assignedTo } = data;
      
      setTasks(prev => {
        const newTasks = { ...prev };
        
        // Update assigned user in all columns
        Object.keys(newTasks).forEach(status => {
          const taskIndex = newTasks[status].findIndex(task => task._id === taskId);
          if (taskIndex !== -1) {
            newTasks[status][taskIndex].assignedUser = assignedTo;
          }
        });
        
        return newTasks;
      });
    });

    // Handle user typing
    handleUserTyping((data) => {
      setTypingUsers(prev => ({
        ...prev,
        [data.taskId]: data.isTyping ? data.username : null
      }));
      
      // Clear typing after 3 seconds
      if (data.isTyping) {
        setTimeout(() => {
          setTypingUsers(prev => ({
            ...prev,
            [data.taskId]: null
          }));
        }, 3000);
      }
    });
  }, [
    handleTaskCreated,
    handleTaskUpdated,
    handleTaskDeleted,
    handleTaskMoved,
    handleTaskAssigned,
    handleUserTyping
  ]);

  // Task creation handler
  const handleCreateTask = useCallback(async (taskData) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(taskData)
      });
      
      const newTask = await response.json();
      
      // Update local state
      setTasks(prev => ({
        ...prev,
        [newTask.status]: [...prev[newTask.status], newTask]
      }));
      
      // Emit to other users
      emitTaskCreated(newTask);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  }, [emitTaskCreated]);

  // Task update handler
  const handleUpdateTask = useCallback(async (taskId, updates) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      
      const updatedTask = await response.json();
      
      // Update local state
      setTasks(prev => {
        const newTasks = { ...prev };
        Object.keys(newTasks).forEach(status => {
          const taskIndex = newTasks[status].findIndex(task => task._id === taskId);
          if (taskIndex !== -1) {
            newTasks[status][taskIndex] = updatedTask;
          }
        });
        return newTasks;
      });
      
      // Emit to other users
      emitTaskUpdated(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }, [emitTaskUpdated]);

  // Task deletion handler
  const handleDeleteTask = useCallback(async (taskId) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Update local state
      setTasks(prev => {
        const newTasks = { ...prev };
        Object.keys(newTasks).forEach(status => {
          newTasks[status] = newTasks[status].filter(task => task._id !== taskId);
        });
        return newTasks;
      });
      
      // Emit to other users
      emitTaskDeleted(taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  }, [emitTaskDeleted]);

  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    
    if (!draggedTask || draggedTask.status === targetStatus) {
      setDraggedTask(null);
      return;
    }

    const fromStatus = draggedTask.status;
    const taskId = draggedTask._id;

    try {
      // Update task status on server
      await handleUpdateTask(taskId, { status: targetStatus });
      
      // Update local state
      setTasks(prev => {
        const newTasks = { ...prev };
        const taskIndex = newTasks[fromStatus].findIndex(task => task._id === taskId);
        
        if (taskIndex !== -1) {
          const [movedTask] = newTasks[fromStatus].splice(taskIndex, 1);
          movedTask.status = targetStatus;
          newTasks[targetStatus].push(movedTask);
        }
        
        return newTasks;
      });
      
      // Emit to other users
      emitTaskMoved({
        taskId,
        fromStatus,
        toStatus: targetStatus
      });
    } catch (error) {
      console.error('Error moving task:', error);
    }
    
    setDraggedTask(null);
  };

  // Typing handler
  const handleTyping = (taskId, isTyping) => {
    emitUserTyping({ taskId, isTyping });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading board...</p>
      </div>
    );
  }

  return (
    <div className="realtime-board">
      <ConnectionStatus 
        isConnected={isConnected}
        connectedUsers={connectedUsers}
        notifications={notifications}
      />
      
      <div className="board-header">
        <h1>Collaborative To-Do Board</h1>
        <div className="board-stats">
          <span>Total Tasks: {Object.values(tasks).flat().length}</span>
          <span>Online: {connectedUsers.length}</span>
        </div>
      </div>

      <div className="board-columns">
        {Object.entries(tasks).map(([status, taskList]) => (
          <div
            key={status}
            className={`board-column ${status}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="column-header">
              <h3>{status.charAt(0).toUpperCase() + status.slice(1).replace(/([A-Z])/g, ' $1')}</h3>
              <span className="task-count">{taskList.length}</span>
            </div>
            
            <div className="column-content">
              {taskList.map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  onUpdate={handleUpdateTask}
                  onDelete={handleDeleteTask}
                  onDragStart={handleDragStart}
                  onTyping={handleTyping}
                  typingUser={typingUsers[task._id]}
                  currentUser={user}
                />
              ))}
              
              {taskList.length === 0 && (
                <div className="empty-column">
                  <p>No tasks yet</p>
                  <p>Drop tasks here or create a new one</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <button 
        className="add-task-btn"
        onClick={() => handleCreateTask({
          title: 'New Task',
          description: '',
          status: 'todo',
          priority: 'medium',
          assignedUser: user.username
        })}
      >
        + Add Task
      </button>
    </div>
  );
};

export default RealtimeBoard;