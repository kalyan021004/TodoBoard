// components/ConnectionStatus.js
import React, { useState } from 'react';
import NotificationSystem from './NotificationSystem';
import './ConnectionStatus.css';

const ConnectionStatus = ({ 
  isConnected, 
  connectedUsers, 
  notifications, 
  onClearNotifications,
  onRemoveNotification 
}) => {
  const [showNotifications, setShowNotifications] = useState(true);
  const [showUsersList, setShowUsersList] = useState(false);

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const toggleUsersList = () => {
    setShowUsersList(!showUsersList);
  };

  return (
    <div className="connection-status-container">
      {/* Main status bar */}
      <div className="connection-status-bar">
        <div className="connection-info">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢' : '🔴'}
          </span>
          <span className="status-text">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="users-count" onClick={toggleUsersList}>
            👥 {connectedUsers.length} online
          </span>
        </div>

        <div className="notification-controls">
          <button 
            className={`notification-toggle ${notifications.length > 0 ? 'has-notifications' : ''}`}
            onClick={toggleNotifications}
            title="Toggle notifications"
          >
            🔔
            {notifications.length > 0 && (
              <span className="notification-badge">{notifications.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Connected users list */}
      {showUsersList && (
        <div className="users-list-popup">
          <div className="users-list-header">
            <h4>Online Users</h4>
            <button onClick={toggleUsersList}>×</button>
          </div>
          <div className="users-list">
            {connectedUsers.length > 0 ? (
              connectedUsers.map((user, index) => (
                <div key={user.userId || index} className="user-item">
                  <span className="user-avatar">👤</span>
                  <span className="user-name">{user.username}</span>
                  <span className="user-status">🟢</span>
                </div>
              ))
            ) : (
              <p className="no-users">No users online</p>
            )}
          </div>
        </div>
      )}

      {/* Notification system */}
      {showNotifications && (
        <NotificationSystem 
          notifications={notifications}
          onRemove={onRemoveNotification}
          onClearAll={onClearNotifications}
        />
      )}
    </div>
  );
};

export default ConnectionStatus;