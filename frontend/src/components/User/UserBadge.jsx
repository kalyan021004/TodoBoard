// components/User/UserBadge.jsx
import { useEffect, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';

const UserBadge = ({ user }) => {
  const [taskCount, setTaskCount] = useState(user.activeTaskCount || 0);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleTaskCountUpdate = ({ userId, taskCount }) => {
      if (userId === user._id) {
        setTaskCount(taskCount);
      }
    };

    socket.on('user_task_count_updated', handleTaskCountUpdate);
    
    return () => {
      socket.off('user_task_count_updated', handleTaskCountUpdate);
    };
  }, [socket, user._id]);

  return (
    <div className="flex items-center gap-2">
      <span>{user.username}</span>
      <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">
        {taskCount} tasks
      </span>
    </div>
  );
};

export default UserBadge;