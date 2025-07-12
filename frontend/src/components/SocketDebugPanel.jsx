import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

const SocketDebugPanel = ({ testNotification, notifications }) => {
    const { socket } = useSocket();
    const [isVisible, setIsVisible] = useState(false);
    const [socketEvents, setSocketEvents] = useState([]);

    useEffect(() => {
        if (!socket) return;

        // Log socket connection events
        const handleConnect = () => {
            console.log('🔌 Socket connected');
            setSocketEvents(prev => [...prev, { type: 'connect', time: new Date() }]);
        };

        const handleDisconnect = () => {
            console.log('🔌 Socket disconnected');
            setSocketEvents(prev => [...prev, { type: 'disconnect', time: new Date() }]);
        };

        const handleConnectError = (error) => {
            console.log('🔌 Socket connect error:', error);
            setSocketEvents(prev => [...prev, { type: 'connect_error', time: new Date(), data: error }]);
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect_error', handleConnectError);
        };
    }, [socket]);

    const testSocketEmit = () => {
        if (socket) {
            console.log('🧪 Testing socket emit...');
            socket.emit('test_event', { message: 'Hello from client!' });
        }
    };

    const manualNotificationTest = () => {
        console.log('🧪 Manual notification test...');
        if (testNotification) {
            testNotification();
        }
    };

    if (!isVisible) {
        return (
            <button 
                onClick={() => setIsVisible(true)}
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    fontSize: '20px',
                    cursor: 'pointer',
                    zIndex: 1000,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
                }}
                title="Debug Panel"
            >
                🔧
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '400px',
            maxHeight: '600px',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 1000,
            fontFamily: 'monospace',
            fontSize: '12px'
        }}>
            <div style={{
                padding: '10px',
                borderBottom: '1px solid #eee',
                backgroundColor: '#f8f9fa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <strong>Socket Debug Panel</strong>
                <button 
                    onClick={() => setIsVisible(false)}
                    style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
                >
                    ×
                </button>
            </div>
            
            <div style={{ padding: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                <div style={{ marginBottom: '15px' }}>
                    <strong>Socket Status:</strong>
                    <div style={{ color: socket?.connected ? 'green' : 'red', marginTop: '5px' }}>
                        {socket?.connected ? '✅ Connected' : '❌ Disconnected'}
                    </div>
                    {socket?.id && (
                        <div style={{ color: '#666', marginTop: '2px' }}>
                            ID: {socket.id}
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <strong>Current Notifications: {notifications?.length || 0}</strong>
                    <div style={{ marginTop: '5px' }}>
                        {notifications?.map(n => (
                            <div key={n.id} style={{ 
                                padding: '5px', 
                                margin: '2px 0', 
                                backgroundColor: '#f0f0f0',
                                borderRadius: '4px',
                                fontSize: '11px'
                            }}>
                                [{n.type}] {n.message}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <strong>Test Actions:</strong>
                    <div style={{ marginTop: '5px' }}>
                        <button 
                            onClick={manualNotificationTest}
                            style={{
                                padding: '5px 10px',
                                margin: '2px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                        >
                            Test Notification
                        </button>
                        <button 
                            onClick={testSocketEmit}
                            style={{
                                padding: '5px 10px',
                                margin: '2px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                        >
                            Test Socket Emit
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <strong>Recent Socket Events:</strong>
                    <div style={{ marginTop: '5px', maxHeight: '150px', overflowY: 'auto' }}>
                        {socketEvents.slice(-10).map((event, index) => (
                            <div key={index} style={{ 
                                padding: '3px', 
                                margin: '1px 0', 
                                backgroundColor: event.type === 'connect' ? '#d4edda' : 
                                                event.type === 'disconnect' ? '#f8d7da' : '#fff3cd',
                                borderRadius: '3px',
                                fontSize: '10px'
                            }}>
                                {event.time.toLocaleTimeString()}: {event.type}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SocketDebugPanel;