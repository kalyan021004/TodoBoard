// components/FilterBar.js
import React from 'react';
import '../styles/FilterBar.css';

const FilterBar = ({ 
    filters, 
    setFilters, 
    sortBy, 
    setSortBy, 
    sortOrder, 
    setSortOrder, 
    users, 
    taskCounts 
}) => {
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleSortChange = (newSortBy) => {
        if (sortBy === newSortBy) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('asc');
        }
    };

    const clearAllFilters = () => {
        setFilters({
            priority: 'all',
            assignedUser: 'all',
            search: ''
        });
        setSortBy('createdAt');
        setSortOrder('desc');
    };

    return (
        <div className="filter-bar">
            <div className="search-box">
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="search-input"
                    />
                    <span className="search-icon">🔍</span>
                </div>
            <div className="filter-section">
                

                <div className="filter-group">
                    <label>Priority:</label>
                    <select
                        value={filters.priority}
                        onChange={(e) => handleFilterChange('priority', e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Priorities</option>
                        <option value="high">High Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="low">Low Priority</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Assigned to:</label>
                    <select
                        value={filters.assignedUser}
                        onChange={(e) => handleFilterChange('assignedUser', e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Users</option>
                        {users.map(user => (
                            <option key={user._id} value={user._id}>
                                {user.username}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="sort-section">
                <span>Sort by:</span>
                <div className="sort-buttons">
                    {['createdAt', 'title', 'priority', 'assignedUser'].map(field => (
                        <button
                            key={field}
                            className={`sort-btn ${sortBy === field ? 'active' : ''}`}
                            onClick={() => handleSortChange(field)}
                        >
                            {field === 'createdAt' ? 'Date' : field.charAt(0).toUpperCase() + field.slice(1)}
                            {sortBy === field && (
                                <span className="sort-indicator">
                                    {sortOrder === 'asc' ? '↑' : '↓'}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="task-stats">
                <div className="stat-item">
                    <span className="stat-number">{taskCounts.total}</span>
                    <span className="stat-label">Total</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">{taskCounts.todo}</span>
                    <span className="stat-label">To Do</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">{taskCounts.inProgress}</span>
                    <span className="stat-label">In Progress</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">{taskCounts.done}</span>
                    <span className="stat-label">Done</span>
                </div>
            </div>

            <button className="clear-filters-btn" onClick={clearAllFilters}>
                Clear All Filters
            </button>
        </div>
    );
};

export default FilterBar;