const rooms = new Map();

module.exports = {
  addUser: (roomId, user) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: [],
        elements: []
      });
    }
    const room = rooms.get(roomId);
    if (!room.users.some(u => u.id === user.id)) {
      room.users.push(user);
    }
  },

  removeUser: (userId) => {
    const userRooms = [];
    rooms.forEach((room, roomId) => {
      room.users = room.users.filter(user => user.id !== userId);
      if (room.users.length === 0) {
        rooms.delete(roomId);
      } else {
        userRooms.push(roomId);
      }
    });
    return userRooms;
  },

  getUsers: (roomId) => {
    return rooms.has(roomId) ? [...rooms.get(roomId).users] : [];
  },

  addElement: (roomId, element) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).elements.push(element);
    }
  },

  replaceTempElement: (roomId, newElement) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.elements = [
        ...room.elements.filter(el => !el.temp),
        newElement
      ];
    }
  },

  clearElements: (roomId) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).elements = [];
    }
  },

  getElements: (roomId) => {
    return rooms.has(roomId) ? [...rooms.get(roomId).elements] : [];
  }
};