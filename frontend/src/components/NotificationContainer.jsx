import React from 'react';
import '../styles/NotificationContainer.css';

const NotificationContainer = ({ notifications, onRemove, onClear }) => {
    console.log('NotificationContainer render:', {
        notifications,
        type: typeof notifications,
        isArray: Array.isArray(notifications),
        content: notifications
    });

    const notificationArray = Array.isArray(notifications) ? notifications : [];

    if (notificationArray.length === 0) return null;

    return (
        <div className="notification-container">
            <div className="notification-header">
                <span className="notification-count">
                    {notificationArray.length} notification{notificationArray.length > 1 ? 's' : ''}
                </span>
                <button 
                    className="clear-all-btn"
                    onClick={onClear}
                    title="Clear all notifications"
                >
                    Clear All
                </button>
            </div>
            
            <div className="notification-list">
                {notificationArray.map(notification => (
                    <div 
                        key={notification.id}
                        className={`notification notification-${notification.type || 'info'}`}
                    >
                        <div className="notification-content">
                            <div className="notification-message">{notification.message}</div>
                            <div className="notification-time">
                                {notification.timestamp
                                    ? new Date(notification.timestamp).toLocaleTimeString()
                                    : 'Now'}
                            </div>
                        </div>

                        <button 
                            className="notification-close"
                            onClick={() => onRemove(notification.id)}
                            title="Close notification"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NotificationContainer;
