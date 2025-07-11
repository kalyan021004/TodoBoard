// components/KanbanColumn.js
import React from 'react';
import TaskCard from './TaskCard';
import './KanbanColumn.css';

const KanbanColumn = ({
    column,
    tasks,
    stats,
    onCreateTask,
    onEditTask,
    onDeleteTask,
    onDragStart,
    onDragOver,
    onDrop,
    isDraggedOver
}) => {
    const handleDragOver = (e) => {
        onDragOver(e);
    };

    const handleDrop = (e) => {
        onDrop(e, column.status);
    };

    return (
        <div 
            className={`kanban-column ${isDraggedOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div className="column-header">
                <div className="column-title">
                    <h3>{column.title}</h3>
                    <span className="task-count">{tasks.length}</span>
                </div>
                
                <div className="column-stats">
                    {stats.high > 0 && <span className="priority-indicator high">{stats.high}</span>}
                    {stats.medium > 0 && <span className="priority-indicator medium">{stats.medium}</span>}
                    {stats.low > 0 && <span className="priority-indicator low">{stats.low}</span>}
                </div>
                
                <button 
                    className="add-task-btn"
                    onClick={() => onCreateTask(column.status)}
                    title="Add task to this column"
                >
                    +
                </button>
            </div>

            <div className="column-content">
                {tasks.length === 0 ? (
                    <div className="empty-column">
                        <p>No tasks yet</p>
                        <button 
                            className="btn btn-ghost"
                            onClick={() => onCreateTask(column.status)}
                        >
                            Add First Task
                        </button>
                    </div>
                ) : (
                    tasks.map(task => (
                        <TaskCard
                            key={task._id}
                            task={task}
                            onEdit={onEditTask}
                            onDelete={onDeleteTask}
                            onDragStart={onDragStart}
                            draggable={true}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default KanbanColumn;