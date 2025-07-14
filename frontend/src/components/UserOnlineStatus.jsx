import React, { useState, useEffect } from 'react';
import { Users, Circle, Clock, RefreshCw, AlertCircle } from 'lucide-react';

// Mock socket.io for demo purposes - replace with actual socket.io in production
const createMockSocket = () => {
  const events = {};
  let connected = false;
  
  return {
    connected,
    id: 'mock-socket-id',
    emit: (event, data) => {
      console.log(`[MOCK] Emitting ${event}:`, data);
      
      // Simulate server responses
      if (event === 'user-login') {
        setTimeout(() => {
          connected = true;
          if (events['users-count-update']) {
            events['users-count-update']({
              online: Math.floor(Math.random() * 10) + 1,
              total: Math.floor(Math.random() * 50) + 10
            });
          }
        }, 500);
      }
      
      if (event === 'request-user-stats') {
        setTimeout(() => {
          if (events['users-count-update']) {
            events['users-count-update']({
              online: Math.floor(Math.random() * 10) + 1,
              total: Math.floor(Math.random() * 50) + 10
            });
          }
        }, 300);
      }
    },
    on: (event, callback) => {
      events[event] = callback;
      
      // Simulate connection
      if (event === 'connect') {
        setTimeout(() => {
          connected = true;
          callback();
        }, 100);
      }
    },
    disconnect: () => {
      connected = false;
      if (events['disconnect']) {
        events['disconnect']();
      }
    }
  };
};

const UserOnlineStatus = ({ currentUser }) => {
  const [userStats, setUserStats] = useState({
    online: 0,
    total: 0,
    onlineUsers: []
  });
  const [socket, setSocket] = useState(null);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock token storage (replace with actual token management)
  const [mockToken] = useState('mock-jwt-token');

  // Mock API calls
  const fetchUserStats = async () => {
    try {
      console.log('🔍 [DEBUG] Fetching user stats...');
      
      // Simulate API call
      const mockData = {
        online: Math.floor(Math.random() * 15) + 1,
        total: Math.floor(Math.random() * 100) + 20,
        onlineUsers: []
      };
      
      console.log('📊 [DEBUG] User stats response:', mockData);
      setUserStats(mockData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('❌ [DEBUG] Error fetching user stats:', error);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      console.log('🔍 [DEBUG] Fetching online users...');
      
      // Generate mock online users
      const mockUsers = [];
      const userCount = Math.floor(Math.random() * 8) + 1;
      
      for (let i = 0; i < userCount; i++) {
        mockUsers.push({
          _id: `user-${i}`,
          username: `User${i + 1}`,
          email: `user${i + 1}@example.com`,
          lastSeen: new Date(Date.now() - Math.random() * 3600000), // Random time within last hour
          isOnline: true
        });
      }
      
      console.log('👥 [DEBUG] Online users response:', mockUsers);
      setUserStats(prevStats => ({
        ...prevStats,
        onlineUsers: mockUsers
      }));
    } catch (error) {
      console.error('❌ [DEBUG] Error fetching online users:', error);
    }
  };

  useEffect(() => {
    console.log('🔄 [DEBUG] UserOnlineStatus useEffect triggered');
    console.log('👤 [DEBUG] Current user:', currentUser);

    if (!currentUser) {
      console.log('❌ [DEBUG] No current user, skipping socket connection');
      return;
    }

    // Check if user object has the expected properties
    const userId = currentUser.id || currentUser._id;
    console.log('👤 [DEBUG] Extracted userId:', userId);
    
    if (!userId) {
      console.error('❌ [DEBUG] No valid userId found in currentUser object');
      console.log('👤 [DEBUG] currentUser keys:', Object.keys(currentUser));
      return;
    }

    // Initialize mock socket connection
    const newSocket = createMockSocket();
    setSocket(newSocket);

    // Handle connection events
    newSocket.on('connect', () => {
      console.log('🔌 [DEBUG] Socket connected:', newSocket.id);
      setConnectionStatus('connected');
      
      // Wait a bit before emitting to ensure connection is stable
      setTimeout(() => {
        console.log('👤 [DEBUG] Emitting user-login for userId:', userId);
        newSocket.emit('user-login', userId);
      }, 100);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 [DEBUG] Socket disconnected');
      setConnectionStatus('disconnected');
    });

    // Listen for user count updates
    newSocket.on('users-count-update', (stats) => {
      console.log('📊 [DEBUG] Received users-count-update:', stats);
      console.log('📊 [DEBUG] Previous stats:', userStats);
      
      setUserStats(prevStats => {
        const newStats = {
          ...prevStats,
          online: stats.online,
          total: stats.total
        };
        console.log('📊 [DEBUG] New stats:', newStats);
        return newStats;
      });
      
      setLastUpdated(new Date());
    });

    // Initial fetch of user stats
    fetchUserStats();

    // Set up heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (newSocket.connected) {
        console.log('💓 [DEBUG] Sending heartbeat');
        newSocket.emit('heartbeat');
      }
    }, 30000); // Send heartbeat every 30 seconds

    // Cleanup on unmount
    return () => {
      console.log('🧹 [DEBUG] Cleaning up socket connection');
      clearInterval(heartbeatInterval);
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [currentUser]);

  const handleShowOnlineUsers = () => {
    if (!showOnlineUsers) {
      fetchOnlineUsers();
    }
    setShowOnlineUsers(!showOnlineUsers);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Request fresh stats from server
      if (socket && socket.connected) {
        socket.emit('request-user-stats');
      }
      
      // Also fetch via API
      await fetchUserStats();
      
      if (showOnlineUsers) {
        await fetchOnlineUsers();
      }
      
      console.log('🔄 [DEBUG] Manual refresh completed');
    } catch (error) {
      console.error('❌ [DEBUG] Error during manual refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Unknown';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'disconnected': return 'text-red-500';
      case 'error': return 'text-red-600';
      default: return 'text-yellow-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Connecting...';
    }
  };

  // Mock current user for demo
  const demoUser = currentUser || { 
    id: 'demo-user-123', 
    username: 'DemoUser', 
    email: 'demo@example.com' 
  };

  return (
    <div className="user-online-status p-4 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      <div className="status-header mb-4">
        <h2 className="status-title flex items-center gap-2 text-xl font-bold text-gray-800">
          <Users className="w-5 h-5" />
          User Activity
        </h2>
        <div className="connection-status flex items-center gap-2 mt-2">
          <Circle className={`w-3 h-3 ${getConnectionStatusColor()}`} />
          <span className={`status-text text-sm ${getConnectionStatusColor()}`}>
            {getConnectionStatusText()}
          </span>
        </div>
      </div>

      <div className="stats-grid grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="stat-card online-stat bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="stat-content flex items-center justify-between">
            <div className="stat-info">
              <p className="stat-label text-sm text-green-600 font-medium">Online Now</p>
              <p className="stat-value text-2xl font-bold text-green-700">{userStats.online}</p>
            </div>
            <div className="stat-icon">
              <Circle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        <div className="stat-card total-stat bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="stat-content flex items-center justify-between">
            <div className="stat-info">
              <p className="stat-label text-sm text-blue-600 font-medium">Total Users</p>
              <p className="stat-value text-2xl font-bold text-blue-700">{userStats.total}</p>
            </div>
            <div className="stat-icon">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="status-actions space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleShowOnlineUsers}
            className="show-users-btn flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Users className="w-4 h-4" />
            {showOnlineUsers ? 'Hide Online Users' : 'Show Online Users'}
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="refresh-btn flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {showOnlineUsers && (
          <div className="online-users-list mt-4 space-y-2">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Online Users</h3>
            {userStats.onlineUsers && userStats.onlineUsers.length > 0 ? (
              userStats.onlineUsers.map((user) => (
                <div
                  key={user._id}
                  className="online-user-item flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="user-info flex items-center gap-3">
                    <div className="user-avatar relative">
                      <div className="avatar-circle w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        {user.username ? user.username.charAt(0).toUpperCase() : '?'}
                      </div>
                      <Circle className="user-status-dot absolute -bottom-1 -right-1 w-3 h-3 text-green-500" />
                    </div>
                    <div className="user-details">
                      <p className="username font-medium text-gray-800">{user.username || 'Unknown'}</p>
                      <p className="user-email text-sm text-gray-500">{user.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="last-seen flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    {formatLastSeen(user.lastSeen)}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-users text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No users online</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="realtime-indicator mt-4 pt-4 border-t border-gray-200">
        <div className="realtime-status flex items-center justify-between text-sm text-gray-500">
          <div className="realtime-info flex items-center gap-2">
            <div className={`realtime-dot w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>Real-time updates</span>
          </div>
          <span className="separator">•</span>
          <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Debug panel */}
      <div className="debug-panel mt-4 p-3 bg-gray-100 rounded-lg text-xs">
        <strong>Debug Info:</strong>
        <div>Current User: {demoUser.username || demoUser.id}</div>
        <div>Socket Connected: {socket?.connected ? 'Yes' : 'No'}</div>
        <div>Socket ID: {socket?.id || 'None'}</div>
        <div>Connection Status: {connectionStatus}</div>
        <div>Online Count: {userStats.online}</div>
        <div>Total Count: {userStats.total}</div>
        <div>Active Users Array Length: {userStats.onlineUsers?.length || 0}</div>
      </div>
    </div>
  );
};

export default UserOnlineStatus;