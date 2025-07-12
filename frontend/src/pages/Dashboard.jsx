import React from 'react';
import RealtimeKanbanBoard from '../components/RealtimeKanbanBoard';
import KanbanBoard from '../components/KanbanBoard';

const Dashboard = () => {
  return (
    <div className="dashboard">
      <KanbanBoard />
    </div>
  );
};

export default Dashboard;