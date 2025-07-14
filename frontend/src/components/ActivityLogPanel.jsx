// components/ActivityPanel.js
import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { formatDistanceToNow } from 'date-fns';
import '../styles/ActivityLog.css';

const ActivityLogPanel = () => {
  const { activities, isLoadingActivities, loadActivities, isConnected } = useSocket();
  const [localActivities, setLocalActivities] = useState([]);

  // Format activity message based on action type
  const formatActivityMessage = (activity) => {
    try {
      const username = activity.user?.username || 'Unknown user';
      const taskTitle = activity.task?.title || 'a task';
      const details = activity.details || {};

      switch(activity.action) {
        case 'CREATE':
          return `${username} created "${taskTitle}"`;
        case 'UPDATE':
          return `${username} updated "${taskTitle}"`;
        case 'DELETE':
          return `${username} deleted "${taskTitle}"`;
        case 'ASSIGN':
          return `${username} assigned "${taskTitle}" to ${details.assignedTo || 'someone'}`;
        case 'MOVE':
          return `${username} moved "${taskTitle}" to ${details.newStatus || 'another column'}`;
        case 'LOGIN':
          return `${username} logged in`;
        case 'LOGOUT':
          return `${username} logged out`;
        default:
          return `${username} performed an action`;
      }
    } catch (error) {
      console.error('Error formatting activity message:', error);
      return 'An activity occurred';
    }
  };

  // Load activities on mount and when connection status changes
  useEffect(() => {
    if (isConnected) {
      loadActivities();
    }
  }, [isConnected, loadActivities]);

  // Update local activities when activities change
  useEffect(() => {
    if (activities && Array.isArray(activities)) {
      setLocalActivities(activities);
    }
  }, [activities]);

  // Auto-refresh every 30 seconds if connected
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      loadActivities();
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, loadActivities]);

  return (
    <div className="activity-panel">
      <div className="activity-panel-header">
        <h3>Recent Activity</h3>
        <button 
          onClick={loadActivities} 
          disabled={isLoadingActivities}
          className="refresh-button"
        >
          {isLoadingActivities ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {isLoadingActivities && localActivities.length === 0 ? (
        <div className="activity-loading">
          Loading activities...
        </div>
      ) : localActivities.length === 0 ? (
        <div className="activity-empty">
          No activities yet
        </div>
      ) : (
        <ul className="activity-list">
          {localActivities.map((activity) => (
            <li key={activity._id || activity.timestamp} className="activity-item">
              <div className="activity-message">
                {formatActivityMessage(activity)}
              </div>
              <div className="activity-time">
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isConnected && (
        <div className="activity-disconnected">
          Disconnected from activity feed
        </div>
      )}
    </div>
  );
};

export default ActivityLogPanel;