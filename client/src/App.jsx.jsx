import React, { useState, useEffect, useContext, useRef } from 'react';
import Whiteboard from './components/whiteboard';
import UserPanel from './components/UserPanel';
import VideoCall from './components/VideoCall';
import { SocketContext } from './context/SocketContext';
import { EVENTS } from './utils/constants';

function App() {
  const socket = useContext(SocketContext);
  const [users, setUsers] = useState([]);
  const [roomId] = useState('default-room');
  const [currentUser, setCurrentUser] = useState(null);
  const [elements, setElements] = useState([]);
  const whiteboardRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    // Generate a random user name
    const userName = `User_${Math.floor(Math.random() * 1000)}`;
    const user = {
      id: socket.id,
      name: userName
    };
    setCurrentUser(user);

    // Join room
    socket.emit(EVENTS.JOIN_ROOM, { roomId, user });

    // Listen for user events
    const handleUserJoined = (data) => {
      setUsers(prev => {
        if (!prev.find(u => u.id === data.user.id)) {
          return [...prev, data.user];
        }
        return prev;
      });
    };

    const handleUserLeft = (data) => {
      setUsers(prev => prev.filter(u => u.id !== data.userId));
    };

    const handleRoomUsers = (data) => {
      setUsers(data.users || []);
    };

    socket.on(EVENTS.USER_JOINED, handleUserJoined);
    socket.on(EVENTS.USER_LEFT, handleUserLeft);
    socket.on('room-users', handleRoomUsers);

    // Add current user to the list
    setUsers(prev => {
      if (!prev.find(u => u.id === user.id)) {
        return [...prev, user];
      }
      return prev;
    });

    return () => {
      socket.off(EVENTS.USER_JOINED, handleUserJoined);
      socket.off(EVENTS.USER_LEFT, handleUserLeft);
      socket.off('room-users', handleRoomUsers);
    };
  }, [socket, roomId]);

  // Header toolbar actions
  const handleErase = () => {
    // Call the whiteboard's erase method
    if (whiteboardRef.current) {
      whiteboardRef.current.handleErase();
    }
  };

  return (
    <div className="app">
      <div className="main-content">
        <div className="header">
          <div className="header-left">
            <h1>🎨 SketchSphere</h1>
          </div>
          
          <div className="header-toolbar">
          </div>
        </div>
        
        <Whiteboard 
          ref={whiteboardRef}
          roomId={roomId} 
          users={users}
          elements={elements}
          setElements={setElements}
          onErase={handleErase}
        />
        <VideoCall />
      </div>
      
      {/* <UserPanel 
        users={users} 
        roomId={roomId}
      /> */}
    </div>
  );
}

export default App;