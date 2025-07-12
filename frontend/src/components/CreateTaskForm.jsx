import React, { useState } from 'react';

const CreateTaskForm = ({ onCreateTask }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (taskData.title.trim()) {
      onCreateTask(taskData);
      setTaskData({
        title: '',
        description: '',
        priority: 'medium',
        status: 'todo'
      });
      setIsOpen(false);
    }
  };

  return (
    <div className="create-task-form">
      {!isOpen ? (
        <button onClick={() => setIsOpen(true)} className="create-task-btn">
          + Create Task
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="task-form">
          <input
            type="text"
            placeholder="Task title"
            value={taskData.title}
            onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
            required
          />
          <textarea
            placeholder="Task description"
            value={taskData.description}
            onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
          />
          <select
            value={taskData.priority}
            onChange={(e) => setTaskData({ ...taskData, priority: e.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <div className="form-buttons">
            <button type="submit">Create</button>
            <button type="button" onClick={() => setIsOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CreateTaskForm;
