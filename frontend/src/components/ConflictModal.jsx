import React, { useState } from 'react';
import '../styles/ConflictModal.css';

const ConflictModal = ({ 
  isOpen, 
  localTask, 
  serverTask, 
  onResolve, 
  onClose 
}) => {
  const [mergedTask, setMergedTask] = useState({
    ...localTask,
    version: serverTask.version // Always use server version as base
  });

  if (!isOpen) return null;

  const handleFieldChange = (field, value) => {
    setMergedTask(prev => ({ 
      ...prev, 
      [field]: value,
      version: serverTask.version // Keep server version
    }));
  };

  const handleResolve = (action) => {
    switch (action) {
      case 'useLocal':
        onResolve({
          action: 'overwrite',
          data: {
            ...localTask,
            version: serverTask.version + 1 // Force increment
          }
        });
        break;
      case 'useServer':
        onResolve({
          action: 'discard',
          data: serverTask
        });
        break;
      case 'merge':
        onResolve({
          action: 'merge',
          data: mergedTask
        });
        break;
      default:
        onClose();
    }
  };

  const renderFieldComparison = (field, label) => {
    const localValue = localTask[field];
    const serverValue = serverTask[field];
    const isDifferent = localValue !== serverValue;

    if (!isDifferent) return null;

    return (
      <div className="conflict-field" key={field}>
        <h4>{label}</h4>
        <div className="conflict-versions">
          <div className="version">
            <label>
              <input
                type="radio"
                name={field}
                checked={mergedTask[field] === localValue}
                onChange={() => handleFieldChange(field, localValue)}
              />
              Your Version
            </label>
            <div className="value">{localValue || '(empty)'}</div>
          </div>
          <div className="version">
            <label>
              <input
                type="radio"
                name={field}
                checked={mergedTask[field] === serverValue}
                onChange={() => handleFieldChange(field, serverValue)}
              />
              Server Version
            </label>
            <div className="value">{serverValue || '(empty)'}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-backdrop">
      <div className="conflict-modal">
        <h2>Conflict Detected</h2>
        <p className="conflict-description">
          This task was modified by another user while you were editing it.
          Please review the differences and choose how to resolve them.
        </p>

        {renderFieldComparison('title', 'Title')}
        {renderFieldComparison('description', 'Description')}
        {renderFieldComparison('status', 'Status')}
        {renderFieldComparison('priority', 'Priority')}

        <div className="conflict-actions">
          <button 
            className="btn btn-keep"
            onClick={() => handleResolve('useLocal')}
          >
            Keep My Changes
          </button>
          <button
            className="btn btn-server"
            onClick={() => handleResolve('useServer')}
          >
            Use Server Version
          </button>
          <button
            className="btn btn-merge"
            onClick={() => handleResolve('merge')}
          >
            Save Merged
          </button>
          <button
            className="btn btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictModal;