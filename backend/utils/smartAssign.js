// frontend/src/hooks/useSmartAssign.js
import { useState } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext'; // Assuming you have a toast context

export default function useSmartAssign() {
  const [isAssigning, setIsAssigning] = useState(false);
  const { showToast } = useToast();

  const smartAssignTask = async (taskId) => {
    setIsAssigning(true);
    try {
      const response = await axios.patch(
        `/api/tasks/${taskId}/smart-assign`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      showToast({
        type: 'success',
        message: `Task assigned to ${response.data.data.assignedUser.username}`
      });

      return response.data.data;
    } catch (error) {
      showToast({
        type: 'error',
        message: error.response?.data?.message || 'Failed to smart assign task'
      });
      throw error;
    } finally {
      setIsAssigning(false);
    }
  };

  return { smartAssignTask, isAssigning };
}