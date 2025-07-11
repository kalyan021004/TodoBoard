// components/DebugPanel.js
import React, { useState } from 'react';

const DebugPanel = () => {
    const [debugInfo, setDebugInfo] = useState({});
    const [testing, setTesting] = useState(false);

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const runDebugTests = async () => {
        setTesting(true);
        const results = {};
        
        try {
            // Test 1: Check environment variables
            results.apiUrl = API_BASE_URL;
            results.token = localStorage.getItem('token') ? 'Present' : 'Missing';
            
            // Test 2: Check if API server is reachable
            console.log('🔍 Testing API server connection...');
            try {
                const healthResponse = await fetch(`${API_BASE_URL}/health`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                results.serverHealth = {
                    status: healthResponse.status,
                    statusText: healthResponse.statusText,
                    reachable: healthResponse.ok
                };
            } catch (err) {
                results.serverHealth = {
                    error: err.message,
                    reachable: false
                };
            }

            // Test 3: Test tasks API
            console.log('🔍 Testing tasks API...');
            try {
                const tasksResponse = await fetch(`${API_BASE_URL}/api/tasks`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                results.tasksApi = {
                    status: tasksResponse.status,
                    statusText: tasksResponse.statusText,
                    ok: tasksResponse.ok
                };

                if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json();
                    results.tasksApi.dataReceived = Array.isArray(tasksData) ? tasksData.length : 'Not an array';
                } else {
                    const errorText = await tasksResponse.text();
                    results.tasksApi.error = errorText;
                }
            } catch (err) {
                results.tasksApi = {
                    error: err.message,
                    networkError: true
                };
            }

            // Test 4: Test users API
            console.log('🔍 Testing users API...');
            try {
                const usersResponse = await fetch(`${API_BASE_URL}/api/users`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                results.usersApi = {
                    status: usersResponse.status,
                    statusText: usersResponse.statusText,
                    ok: usersResponse.ok
                };

                if (usersResponse.ok) {
                    const usersData = await usersResponse.json();
                    results.usersApi.dataReceived = Array.isArray(usersData) ? usersData.length : 'Not an array';
                } else {
                    const errorText = await usersResponse.text();
                    results.usersApi.error = errorText;
                }
            } catch (err) {
                results.usersApi = {
                    error: err.message,
                    networkError: true
                };
            }

            // Test 5: Check CORS
            results.corsCheck = 'If you see this, CORS is working';

        } catch (error) {
            results.generalError = error.message;
        }

        setDebugInfo(results);
        setTesting(false);
        console.log('🔍 Debug Results:', results);
    };

    const clearToken = () => {
        localStorage.removeItem('token');
        alert('Token cleared! Please log in again.');
    };

    return (
        <div style={{ 
            position: 'fixed', 
            top: '10px', 
            right: '10px', 
            background: '#f0f0f0', 
            padding: '15px', 
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            maxWidth: '400px',
            fontSize: '12px',
            zIndex: 1000
        }}>
            <h3>Debug Panel</h3>
            <button 
                onClick={runDebugTests}
                disabled={testing}
                style={{ marginBottom: '10px', marginRight: '10px' }}
            >
                {testing ? 'Testing...' : 'Run Debug Tests'}
            </button>
            <button 
                onClick={clearToken}
                style={{ marginBottom: '10px' }}
            >
                Clear Token
            </button>
            
            {Object.keys(debugInfo).length > 0 && (
                <div>
                    <h4>Debug Results:</h4>
                    <pre style={{ 
                        background: '#fff', 
                        padding: '10px', 
                        borderRadius: '4px',
                        fontSize: '11px',
                        overflow: 'auto',
                        maxHeight: '300px'
                    }}>
                        {JSON.stringify(debugInfo, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default DebugPanel;