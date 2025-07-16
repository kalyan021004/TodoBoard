import { useState, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const useTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchUsers = useCallback(async () => {
        try {
            console.log('🔍 Fetching users...');
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const userRes = await fetch(`${API_BASE_URL}/api/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Users Response:', userRes.status, userRes.statusText);

            if (!userRes.ok) {
                if (userRes.status === 401) {
                    throw new Error('Authentication failed. Please log in again.');
                }
                const errorText = await userRes.text();
                console.error('❌ Users API Error Response:', errorText);
                throw new Error(`Failed to fetch users: ${userRes.status} ${userRes.statusText}`);
            }

            const usersData = await userRes.json();
            console.log('✅ Users Data:', usersData);

            const usersArray = Array.isArray(usersData)
                ? usersData
                : Array.isArray(usersData?.data)
                    ? usersData.data
                    : [];

            setUsers(usersArray);
            return usersArray;
        } catch (err) {
            console.error('❌ Error fetching users:', err);
            setError(err.message);
            return [];
        }
    }, []);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        setError(null);

        const timeoutId = setTimeout(() => {
            console.error('❌ API calls timed out after 30 seconds');
            setError('Request timed out. Please check your connection and try again.');
            setLoading(false);
        }, 30000);

        try {
            console.log('🔍 Starting API calls...');
            console.log('API_BASE_URL:', API_BASE_URL);
            
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found. Please log in again.');
            }

            console.log('Token:', token ? 'Present' : 'Missing');

            // Fetch both tasks and users concurrently
            const [taskResponse, userResponse] = await Promise.allSettled([
                fetch(`${API_BASE_URL}/api/tasks`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }),
                fetch(`${API_BASE_URL}/api/users`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })
            ]);

            clearTimeout(timeoutId);

            // Handle tasks response
            let tasksData = [];
            if (taskResponse.status === 'fulfilled' && taskResponse.value.ok) {
                const json = await taskResponse.value.json();
                console.log('✅ Tasks API Response:', json);
                
                // Handle different response formats
                if (json.success && Array.isArray(json.data)) {
                    tasksData = json.data;
                } else if (Array.isArray(json)) {
                    tasksData = json;
                } else if (Array.isArray(json.data)) {
                    tasksData = json.data;
                } else {
                    console.warn('⚠️ Unexpected tasks response format:', json);
                    tasksData = [];
                }
            } else {
                console.error('❌ Tasks API failed:', taskResponse.reason || taskResponse.value?.statusText);
                if (taskResponse.status === 'fulfilled' && taskResponse.value.status === 401) {
                    throw new Error('Authentication failed. Please log in again.');
                }
                throw new Error('Failed to fetch tasks');
            }

            // Handle users response
            let usersData = [];
            if (userResponse.status === 'fulfilled' && userResponse.value.ok) {
                const json = await userResponse.value.json();
                console.log('✅ Users API Response:', json);
                
                if (json.success && Array.isArray(json.data)) {
                    usersData = json.data;
                } else if (Array.isArray(json)) {
                    usersData = json;
                } else if (Array.isArray(json.data)) {
                    usersData = json.data;
                } else {
                    console.warn('⚠️ Unexpected users response format:', json);
                    usersData = [];
                }
            } else {
                console.error('❌ Users API failed:', userResponse.reason || userResponse.value?.statusText);
                // Don't throw error for users, just log it
            }

            console.log('📊 Final Tasks Array:', tasksData.length, 'items');
            console.log('👥 Final Users Array:', usersData.length, 'items');

            // Set both states
            setTasks(tasksData);
            setUsers(usersData);

            return { tasks: tasksData, users: usersData };

        } catch (err) {
            console.error('❌ Error fetching data:', err);
            clearTimeout(timeoutId);
            setError(err.message);
            setTasks([]);
            setUsers([]);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const createTask = useCallback(async (taskData) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch(`${API_BASE_URL}/api/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(taskData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create task: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            const newTask = result.data || result;
            
            setTasks(prev => Array.isArray(prev) ? [...prev, newTask] : [newTask]);
            return newTask;
        } catch (err) {
            console.error('Error creating task:', err);
            setError(err.message);
            throw err;
        }
    }, []);

const updateTask = useCallback(async (taskId, taskData) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Get current task version from local state
    const currentTask = tasks.find(t => t._id === taskId);
    const clientVersion = currentTask?.version;

    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...taskData,
        clientVersion // Send current version to server
      })
    });

    const result = await response.json();

    // Handle conflict response
    if (response.status === 409 && result.conflict) {
      return {
        conflict: true,
        serverData: result.serverData,
        clientData: result.clientData
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update task: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const updatedTask = result.data || result;
    
    setTasks(prev =>
      prev.map(task => task._id === taskId ? updatedTask : task)
    );
    
    return { success: true, data: updatedTask };
  } catch (err) {
    console.error('Error updating task:', err);
    setError(err.message);
    throw err;
  }
}, [tasks]);


    const deleteTask = useCallback(async (taskId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete task: ${response.status} ${response.statusText} - ${errorText}`);
            }

            setTasks(prev =>
                Array.isArray(prev)
                    ? prev.filter(task => task._id !== taskId)
                    : []
            );
        } catch (err) {
            console.error('Error deleting task:', err);
            setError(err.message);
            throw err;
        }
    }, []);

    const updateTaskPosition = useCallback(async (taskId, newStatus, newPosition) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/position`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newStatus, newPosition })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update task position: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            const updatedTask = result.data || result;
            
            setTasks(prev =>
                Array.isArray(prev)
                    ? prev.map(task => task._id === taskId ? updatedTask : task)
                    : [updatedTask]
            );
            return updatedTask;
        } catch (err) {
            console.error('Error updating task position:', err);
            setError(err.message);
            throw err;
        }
    }, []);

    // Add method to update tasks from external source (socket)
    const updateTasksFromSocket = useCallback((newTasks) => {
        setTasks(newTasks);
    }, []);

    return {
        tasks,
        users,
        loading,
        error,
        fetchTasks,
        fetchUsers,
        createTask,
        updateTask,
        deleteTask,
        updateTaskPosition,
        updateTasksFromSocket
    };
};