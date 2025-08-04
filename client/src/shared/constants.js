export const SHAPES = {
  CIRCLE: 'circle',
  RECTANGLE: 'rectangle',
  TRIANGLE: 'triangle',
  LINE: 'line',
  FREEHAND: 'freehand'
};

export const EVENTS = {
  JOIN_ROOM: 'join-room',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  DRAW_START: 'draw-start',
  DRAW_MOVE: 'draw-move',
  DRAW_END: 'draw-end',
  SHAPE_RECOGNIZED: 'shape-recognized',
  CLEAR_BOARD: 'clear-board'
};

export const SOCKET_CONFIG = {
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 3000
};