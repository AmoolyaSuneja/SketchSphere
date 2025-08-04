import React from 'react';

const UserPanel = ({ users = [], roomId, onErase }) => {
  const handleErase = () => {
    if (onErase) {
      onErase();
    }
  };

  return (
    <div className="user-panel">
      <div className="user-panel-header">
        <h3>Users ({users.length})</h3>
      </div>
      
      <div className="users-list">
        {users.length === 0 ? (
          <div className="empty-state">
            <p>No users connected</p>
          </div>
        ) : (
          users.map((user, index) => (
            <div key={user.id || index} className="user-item">
              <div className="user-name">{user.name || `User ${index + 1}`}</div>
            </div>
          ))
        )}
      </div>
      
      <div className="controls-panel">
        <button 
          className="control-btn" 
          onClick={handleErase}
        >
          🗑️ Erase All
        </button>
      </div>
    </div>
  );
};

export default UserPanel; 