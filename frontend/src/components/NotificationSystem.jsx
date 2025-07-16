// components/NotificationSystem.js
import React from 'react';
import './NotificationSystem.css';

const NotificationSystem = ({ notifications, onRemove, onClearAll }) => {
  if (!notifications || notifications.length === 0) {
    return null;
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="notification-system">
      <div className="notification-header">
        <h4>Notifications ({notifications.length})</h4>
        {notifications.length > 0 && (
          <button 
            className="clear-all-btn"
            onClick={onClearAll}
            title="Clear all notifications"
          >
            Clear All
          </button>
        )}
      </div>
      
      <div className="notification-list">
        {notifications.map((notification) => (
          <div 
            key={notification.id}
            className={`notification notification-${notification.type}`}
          >
            <div className="notification-content">
              <span className="notification-icon">
                {getNotificationIcon(notification.type)}
              </span>
              <div className="notification-text">
                <p>{notification.message}</p>
                <small className="notification-time">
                  {formatTime(notification.timestamp)}
                </small>
              </div>
            </div>
            <button 
              className="notification-close"
              onClick={() => onRemove(notification.id)}
              title="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationSystem;