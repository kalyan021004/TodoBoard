import { useState, useCallback } from 'react';

const API_BASE_URL=import.meta.env.VITE_API_URL;

export const useTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchUsers = useCallback(async () => {
        try {
            console.log('🔍 Fetching users...');
            const userRes = await fetch(`${API_BASE_URL}/api/users`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            console.log('Users Response:', userRes.status, userRes.statusText);

            if (!userRes.ok) {
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
            console.log('Token:', localStorage.getItem('token') ? 'Present' : 'Missing');

            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found. Please log in again.');
            }

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

            let tasksData = [];
            if (taskResponse.status === 'fulfilled' && taskResponse.value.ok) {
                const json = await taskResponse.value.json();
                console.log('✅ Tasks API Response:', json);
                // Fix: extract from 'data' property, NOT 'tasks'
                tasksData = Array.isArray(json)
                    ? json
                    : Array.isArray(json.data)
                        ? json.data
                        : [];
            } else {
                console.error('❌ Tasks API failed:', taskResponse.reason || taskResponse.value?.statusText);
                if (taskResponse.status === 'fulfilled' && taskResponse.value.status === 401) {
                    throw new Error('Authentication failed. Please log in again.');
                }
            }

            let usersData = [];
            if (userResponse.status === 'fulfilled' && userResponse.value.ok) {
                const json = await userResponse.value.json();
                console.log('✅ Users API Response:', json);
                usersData = Array.isArray(json)
                    ? json
                    : Array.isArray(json?.data)
                        ? json.data
                        : [];
            } else {
                console.error('❌ Users API failed:', userResponse.reason || userResponse.value?.statusText);
            }

            console.log('📊 Final Tasks Array:', tasksData.length, 'items');
            console.log('👥 Final Users Array:', usersData.length, 'items');

            setTasks(tasksData);
            setUsers(usersData);

            if (usersData.length === 0) {
                console.log('🔄 Users array empty, trying separate fetch...');
                setTimeout(() => {
                    fetchUsers();
                }, 1000);
            }

        } catch (err) {
            console.error('❌ Error fetching data:', err);
            clearTimeout(timeoutId);
            setError(err.message);
            setTasks([]);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [fetchUsers]);

    const createTask = useCallback(async (taskData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(taskData)
            });

            if (!response.ok) {
                throw new Error(`Failed to create task: ${response.status} ${response.statusText}`);
            }

            const newTask = await response.json();
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
            const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(taskData)
            });

            if (!response.ok) {
                throw new Error(`Failed to update task: ${response.status} ${response.statusText}`);
            }

            const updatedTask = await response.json();
            setTasks(prev =>
                Array.isArray(prev)
                    ? prev.map(task => task._id === taskId ? updatedTask : task)
                    : [updatedTask]
            );
            return updatedTask;
        } catch (err) {
            console.error('Error updating task:', err);
            setError(err.message);
            throw err;
        }
    }, []);

    const deleteTask = useCallback(async (taskId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete task: ${response.status} ${response.statusText}`);
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
            const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/position`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ newStatus, newPosition })
            });

            if (!response.ok) {
                throw new Error(`Failed to update task position: ${response.status} ${response.statusText}`);
            }

            const updatedTask = await response.json();
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
        updateTaskPosition
    };
};
