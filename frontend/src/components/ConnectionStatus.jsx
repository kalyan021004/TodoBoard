import React from 'react';
import { useSocket } from '../context/SocketContext';

const ConnectionStatus = () => {
  const { connectionStatus, isConnected } = useSocket();

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#22c55e';
      case 'disconnected':
        return '#ef4444';
      case 'reconnecting':
        return '#f59e0b';
      case 'error':
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'error':
        return 'Connection Error';
      case 'failed':
        return 'Connection Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="connection-status" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      fontSize: '14px',
      color: getStatusColor()
    }}>
      <div 
        className="status-indicator"
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          animation: connectionStatus === 'reconnecting' ? 'pulse 2s infinite' : 'none'
        }}
      />
      <span>{getStatusText()}</span>
    </div>
  );
};


export default ConnectionStatus;