import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

export const useSocketUsers = () => {
  const [typingUsers, setTypingUsers] = useState([]);
  const { socket, onlineUsers } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleUserTyping = (data) => {
      setTypingUsers(prev => {
        const filtered = prev.filter(user => user.userId !== data.userId);
        if (data.isTyping) {
          return [...filtered, data];
        }
        return filtered;
      });

      // Remove typing indicator after 3 seconds
      if (data.isTyping) {
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(user => user.userId !== data.userId));
        }, 3000);
      }
    };

    socket.on('user_typing', handleUserTyping);

    return () => {
      socket.off('user_typing', handleUserTyping);
    };
  }, [socket]);

  return {
    onlineUsers,
    typingUsers
  };
};