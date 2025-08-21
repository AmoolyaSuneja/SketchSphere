import { useState, useCallback } from 'react';
import { SHAPES, EVENTS } from '../utils/constants';

export default function useDrawing(socket, roomId) {
  const [elements, setElements] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushWidth, setBrushWidth] = useState(3);
  const [isErasing, setIsErasing] = useState(false);

  const handleDrawStart = useCallback((x, y) => {
    setIsDrawing(true);
    const newElement = {
      id: Date.now(),
      type: isErasing ? SHAPES.ERASER : SHAPES.FREEHAND,
      points: [[x, y]],
      color: isErasing ? '#ffffff' : brushColor,
      strokeWidth: isErasing ? brushWidth * 2 : brushWidth
    };
    setElements(prev => [...prev, newElement]);
    socket.emit(EVENTS.DRAW_START, { roomId, element: newElement });
  }, [roomId, socket, brushColor, brushWidth, isErasing]);

  const handleDrawMove = useCallback((x, y) => {
    if (!isDrawing) return;
    
    setElements(prev => {
      if (prev.length === 0) return prev;
      
      const lastIndex = prev.length - 1;
      const lastElement = prev[lastIndex];
      
      // Only update freehand drawings and eraser
      if (lastElement.type === SHAPES.FREEHAND || lastElement.type === SHAPES.ERASER) {
        const updatedElement = {
          ...lastElement,
          points: [...lastElement.points, [x, y]]
        };
        
        return [
          ...prev.slice(0, lastIndex),
          updatedElement
        ];
      }
      return prev;
    });
    
    socket.emit(EVENTS.DRAW_MOVE, { 
      roomId, 
      point: [x, y] 
    });
  }, [isDrawing, roomId, socket]);

  const handleDrawEnd = useCallback(() => {
    setIsDrawing(false);
    socket.emit(EVENTS.DRAW_END, { roomId });
  }, [roomId, socket]);

  const handleErase = useCallback(() => {
    setIsErasing(true);
    setIsDrawing(false);
  }, []);

  const handleDraw = useCallback(() => {
    setIsErasing(false);
    setIsDrawing(false);
  }, []);

  const handleColorChange = useCallback((color) => {
    setBrushColor(color);
  }, []);

  const handleBrushWidthChange = useCallback((width) => {
    setBrushWidth(width);
  }, []);

  const clearBoard = useCallback(() => {
    setElements([]);
    socket.emit(EVENTS.CLEAR_BOARD, { roomId });
  }, [socket, roomId]);

  return {
    elements,
    setElements,
    isDrawing,
    isErasing,
    brushColor,
    brushWidth,
    handleDrawStart,
    handleDrawMove,
    handleDrawEnd,
    handleErase,
    handleDraw,
    handleColorChange,
    handleBrushWidthChange,
    clearBoard
  };
}