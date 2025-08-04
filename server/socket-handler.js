const { EVENTS } = require('./constants');
const roomManager = require('./room-manager');

module.exports = (socket, io) => {
  // Join a room
  socket.on(EVENTS.JOIN_ROOM, ({ roomId, user }) => {
    socket.join(roomId);
    roomManager.addUser(roomId, user);
    
    // Notify room about new user
    io.to(roomId).emit(EVENTS.USER_JOINED, {
      user: user
    });
    
    // Send current users list to all users in room
    const users = roomManager.getUsers(roomId);
    io.to(roomId).emit('room-users', { users });
    
    // Send existing elements to new user
    const elements = roomManager.getElements(roomId);
    socket.emit('board-state', elements);
    
    console.log(`User ${user.name} joined room ${roomId}`);
  });

  // Drawing events
  socket.on(EVENTS.DRAW_START, ({ roomId, element }) => {
    roomManager.addElement(roomId, element);
    socket.to(roomId).emit(EVENTS.DRAW_START, element);
  });

  socket.on(EVENTS.DRAW_MOVE, ({ roomId, point }) => {
    socket.to(roomId).emit(EVENTS.DRAW_MOVE, point);
  });

  socket.on(EVENTS.DRAW_END, ({ roomId }) => {
    socket.to(roomId).emit(EVENTS.DRAW_END);
  });

  socket.on(EVENTS.SHAPE_RECOGNIZED, ({ roomId, shape }) => {
    // Add the corrected shape to the room without removing original drawings
    roomManager.addElement(roomId, shape);
    io.to(roomId).emit(EVENTS.SHAPE_RECOGNIZED, shape);
  });

  socket.on(EVENTS.CLEAR_BOARD, ({ roomId }) => {
    // Clear all elements in the room
    roomManager.clearElements(roomId);
    io.to(roomId).emit(EVENTS.CLEAR_BOARD);
    console.log(`Board cleared in room ${roomId}`);
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    const rooms = roomManager.removeUser(socket.id);
    rooms.forEach(roomId => {
      io.to(roomId).emit(EVENTS.USER_LEFT, {
        userId: socket.id
      });
      
      // Send updated users list
      const users = roomManager.getUsers(roomId);
      io.to(roomId).emit('room-users', { users });
    });
    
    console.log(`User ${socket.id} disconnected`);
  });
};