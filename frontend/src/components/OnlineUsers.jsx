import React, { useState } from 'react';
import '../styles/OnlineUsers.css';

const OnlineUsers = ({ users, typingUsers, allUsers }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getOnlineUserDetails = () => {
    return users.map(onlineUser => {
      const userDetails = allUsers.find(user => user._id === onlineUser.userId);
      return {
        ...onlineUser,
        username: userDetails?.username || onlineUser.username || 'Unknown User',
        email: userDetails?.email || onlineUser.email || '',
        avatar: userDetails?.avatar || null
      };
    });
  };

  const getTypingUserDetails = () => {
    return typingUsers.map(typingUser => {
      const userDetails = allUsers.find(user => user._id === typingUser.userId);
      return {
        ...typingUser,
        username: userDetails?.username || typingUser.username || 'Unknown User'
      };
    });
  };

  const onlineUserDetails = getOnlineUserDetails();
  const typingUserDetails = getTypingUserDetails();

  const getInitials = (username) => {
    if (!username) return 'U';
    return username.split(' ').map(name => name.charAt(0)).join('').toUpperCase().slice(0, 2);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return '#4CAF50';
      case 'away':
        return '#FF9800';
      case 'busy':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <div className="online-users">
      <div className="online-users-summary" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="online-indicator">
          <span className="online-count">{onlineUserDetails.length}</span>
          <span className="online-dot"></span>
        </div>
        <span className="online-text">Online</span>
        <span className={`expand-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="online-users-dropdown">
          <div className="online-users-header">
            <h4>Online Users ({onlineUserDetails.length})</h4>
          </div>
          
          <div className="online-users-list">
            {onlineUserDetails.map((user) => (
              <div key={user.userId} className="online-user">
                <div className="user-avatar">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.username} />
                  ) : (
                    <div className="avatar-placeholder">
                      {getInitials(user.username)}
                    </div>
                  )}
                  <div 
                    className="status-indicator"
                    style={{ backgroundColor: getStatusColor(user.status) }}
                  ></div>
                </div>
                <div className="user-info">
                  <div className="user-name">{user.username}</div>
                  {user.email && <div className="user-email">{user.email}</div>}
                </div>
                <div className="user-status">
                  <span className={`status-badge status-${user.status}`}>
                    {user.status || 'online'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {typingUserDetails.length > 0 && (
            <div className="typing-users">
              <div className="typing-header">
                <h5>Currently Typing</h5>
              </div>
              <div className="typing-list">
                {typingUserDetails.map((user) => (
                  <div key={user.userId} className="typing-user">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="typing-username">{user.username}</span>
                    {user.location && (
                      <span className="typing-location">
                        in {user.location.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {onlineUserDetails.length === 0 && (
            <div className="no-users">
              <p>No users currently online</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OnlineUsers;