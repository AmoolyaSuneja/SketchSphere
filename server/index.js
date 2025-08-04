const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const socketHandler = require('./socket-handler');
const roomManager = require('./room-manager');

const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Handle socket connections
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  socketHandler(socket, io);
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});