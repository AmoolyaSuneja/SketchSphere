export const SHAPES = {
  CIRCLE: 'circle',
  RECTANGLE: 'rectangle',
  TRIANGLE: 'triangle',
  LINE: 'line',
  FREEHAND: 'freehand',
  ERASER: 'eraser',
  TEXT: 'text',
  HEXAGON: 'hexagon',
  PENTAGON: 'pentagon'
};

export const EVENTS = {
  // Room events
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  ROOM_FULL: 'room-full',

  // Drawing events
  DRAW_START: 'draw-start',
  DRAW_MOVE: 'draw-move',
  DRAW_END: 'draw-end',
  SHAPE_RECOGNIZED: 'shape-recognized',
  SHAPE_UPDATE: 'shape-update',
  CLEAR_BOARD: 'clear-board',

  // Cursor events
  CURSOR_MOVE: 'cursor-move',
  CURSOR_LEAVE: 'cursor-leave',

  // Chat events
  MESSAGE_SEND: 'message-send',
  MESSAGE_RECEIVE: 'message-receive'
};

export const DRAWING_TOOLS = {
  PENCIL: 'pencil',
  ERASER: 'eraser',
  SELECT: 'select',
  TEXT: 'text',
  SHAPE: 'shape'
};

export const SOCKET_CONFIG = {
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 3000,
  PING_TIMEOUT: 10000
};