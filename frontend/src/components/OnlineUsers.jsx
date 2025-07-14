import React, { useState, useEffect } from 'react';
import '../styles/OnlineUsers.css';

const OnlineUsers = ({ users, typingUsers, allUsers }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filteredUsers, setFilteredUsers] = useState([]);

  // Process online users with details from allUsers
  const getOnlineUserDetails = () => {
    return users.map(onlineUser => {
      const userDetails = allUsers.find(user => user._id === onlineUser.userId);
      return {
        ...onlineUser,
        username: userDetails?.username || onlineUser.username || 'Unknown User',
        email: userDetails?.email || onlineUser.email || '',
        avatar: userDetails?.avatar || null,
        status: userDetails?.status || 'online',
        lastActive: onlineUser.lastSeen || new Date()
      };
    });
  };

  // Process typing users with details from allUsers
  const getTypingUserDetails = () => {
    return typingUsers.map(typingUser => {
      const userDetails = allUsers.find(user => user._id === typingUser.userId);
      return {
        ...typingUser,
        username: userDetails?.username || typingUser.username || 'Unknown User',
        avatar: userDetails?.avatar || null
      };
    });
  };

  // Apply filters whenever users or filter criteria change
  useEffect(() => {
    const onlineUserDetails = getOnlineUserDetails();
    
    const filtered = onlineUserDetails.filter(user => {
      const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    
    setFilteredUsers(filtered);
  }, [users, allUsers, searchTerm, statusFilter]);

  const typingUserDetails = getTypingUserDetails();

  // Get user initials for avatar placeholder
  const getInitials = (username) => {
    if (!username) return 'U';
    return username.split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get color based on user status
  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'away': return '#FF9800';
      case 'busy': return '#F44336';
      case 'offline': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  // Format last active time
  const formatLastActive = (date) => {
    if (!date) return 'Just now';
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  return (
    <div className={`online-users ${isExpanded ? 'expanded' : ''}`}>
      <div className="online-users-summary" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="online-indicator">
          <span className="online-count">{filteredUsers.length}</span>
          <span className="online-dot"></span>
        </div>
        <span className="online-text">Online</span>
        <span className={`expand-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="online-users-dropdown">
          <div className="online-users-header">
            <h4>Online Users ({filteredUsers.length})</h4>
            
            <div className="online-users-controls">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="search-icon">🔍</span>
              </div>
              
              <div className="status-filter">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="online">Online</option>
                  <option value="away">Away</option>
                  <option value="busy">Busy</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="online-users-list">
            {filteredUsers.map((user) => (
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
                  <div className="last-active">
                    {formatLastActive(user.lastActive)}
                  </div>
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
                    <div className="typing-user-info">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.username} className="typing-avatar" />
                      ) : (
                        <div className="typing-avatar-placeholder">
                          {getInitials(user.username)}
                        </div>
                      )}
                      <span className="typing-username">{user.username}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredUsers.length === 0 && (
            <div className="no-users">
              <p>No users found matching your criteria</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OnlineUsers;