import React, { useState } from 'react';

const RoomJoinModal = ({ onJoin, isVisible }) => {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('meeting-room-1');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userName.trim() && roomId.trim()) {
      onJoin(userName.trim(), roomId.trim());
    }
  };

  if (!isVisible) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Join Meeting</h2>
          <p>Enter your details to join the meeting</p>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="userName">Your Name</label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              required
              autoFocus
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="roomId">Meeting Room</label>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID"
              required
            />
          </div>
          
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Join Meeting
            </button>
          </div>
        </form>
        
        <div className="modal-footer">
          <p>Share the room ID with others to invite them to the meeting</p>
        </div>
      </div>
    </div>
  );
};

export default RoomJoinModal; 