import { useState, useCallback } from 'react';
import { SHAPES, EVENTS } from '../utils/constants';

export default function useDrawing(socket, roomId) {
  const [elements, setElements] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleDrawStart = useCallback((x, y) => {
    setIsDrawing(true);
    const newElement = {
      id: Date.now(),
      type: SHAPES.FREEHAND,
      points: [[x, y]]
    };
    setElements(prev => [...prev, newElement]);
    socket.emit(EVENTS.DRAW_START, { roomId, element: newElement });
  }, [roomId, socket]);

  const handleDrawMove = useCallback((x, y) => {
    if (!isDrawing) return;
    
    setElements(prev => {
      if (prev.length === 0) return prev;
      
      const lastIndex = prev.length - 1;
      const lastElement = prev[lastIndex];
      
      // Only update freehand drawings
      if (lastElement.type === SHAPES.FREEHAND) {
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

  return {
    elements,
    setElements,
    isDrawing,
    handleDrawStart,
    handleDrawMove,
    handleDrawEnd
  };
}