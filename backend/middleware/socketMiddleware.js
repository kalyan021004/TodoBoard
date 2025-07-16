// middleware/socketMiddleware.js
const socketMiddleware = (eventType) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Call original send first
      originalSend.call(this, data);
      
      // If response was successful, emit socket event
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const io = req.io;
        const boardId = req.body.boardId || 'default-board';
        
        try {
          const responseData = JSON.parse(data);
          
          switch(eventType) {
            case 'task_created':
              io.to(boardId).emit('task_created', {
                task: responseData.task || responseData,
                createdBy: req.user?.username || 'Unknown'
              });
              break;
              
            case 'task_updated':
              io.to(boardId).emit('task_updated', {
                task: responseData.task || responseData,
                updatedBy: req.user?.username || 'Unknown'
              });
              break;
              
            case 'task_deleted':
              io.to(boardId).emit('task_deleted', {
                taskId: req.params.id,
                deletedBy: req.user?.username || 'Unknown'
              });
              break;
              
            case 'task_moved':
              io.to(boardId).emit('task_moved', {
                task: responseData.task || responseData,
                movedBy: req.user?.username || 'Unknown'
              });
              break;
          }
        } catch (error) {
          console.error('Socket middleware error:', error);
        }
      }
    };
    
    next();
  };
};

export default socketMiddleware;