// components/Task/SmartAssignButton.jsx
import { useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import { assignTask } from '../../api/tasks';
import { toast } from 'react-toastify';

const SmartAssignButton = ({ taskId, currentAssignee, onAssignmentSuccess }) => {
  const [isAssigning, setIsAssigning] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();

  const handleSmartAssign = async () => {
    if (!socket) return;
    
    setIsAssigning(true);
    
    try {
      // Request optimal assignee from server
      socket.emit('request_smart_assign', { 
        excludeUserId: user._id // Optionally exclude current user
      }, async (response) => {
        if (response.success) {
          try {
            // Assign the task to the suggested user
            const updatedTask = await assignTask(taskId, {
              assignedUser: response.userId
            });
            
            onAssignmentSuccess(updatedTask);
            
            toast.success(`Task assigned to ${response.username} (${response.taskCount} tasks)`);
          } catch (error) {
            toast.error('Failed to assign task');
          }
        } else {
          toast.warning(response.message || 'No available users found');
        }
        setIsAssigning(false);
      });
    } catch (error) {
      setIsAssigning(false);
      toast.error('Error finding optimal assignee');
    }
  };

  return (
    <button
      onClick={handleSmartAssign}
      disabled={isAssigning}
      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
      title="Automatically assign to user with fewest tasks"
    >
      {isAssigning ? 'Assigning...' : 'Smart Assign'}
    </button>
  );
};

export default SmartAssignButton;