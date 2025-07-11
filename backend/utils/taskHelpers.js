import Task from "../models/task.models";
// Helper function to get task statistics
 export const getTaskStats = async (userId = null) => {
  try {
    const filter = userId ? { assignedUser: userId } : {};
    
    const stats = await Task.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const result = {
      todo: 0,
      'in-progress': 0,
      completed: 0,
      total: 0
    };
    
    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total += stat.count;
    });
    
    return result;
  } catch (error) {
    console.error('Error getting task stats:', error);
    throw error;
  }
};

export const getOverdueTasks = async (userId = null) => {
  try {
    const filter = userId ? { assignedUser: userId } : {};
    return [];
  } catch (error) {
    console.error('Error getting overdue tasks:', error);
    throw error;
  }
};

