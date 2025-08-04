import React, { useRef, useEffect, useContext, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Line, Circle, Rect } from 'react-konva';
import { SHAPES, EVENTS } from '../utils/constants';
import useDrawing from '../hooks/useDrawing';
import { SocketContext } from '../context/SocketContext';
import { recognizeShape } from '../utils/shapeRecognition';

const Whiteboard = forwardRef(({ roomId, users, onErase }, ref) => {
  const socket = useContext(SocketContext);
  const stageRef = useRef(null);
  const [debugInfo, setDebugInfo] = useState("");
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const {
    elements,
    setElements,
    isDrawing,
    handleDrawStart,
    handleDrawMove,
    handleDrawEnd
  } = useDrawing(socket, roomId);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleErase: () => {
      setElements([]);
      socket.emit(EVENTS.CLEAR_BOARD, { roomId });
      setDebugInfo("Board cleared");
    }
  }));

  // Update stage size on mount and window resize
  useEffect(() => {
    const updateStageSize = () => {
      const container = stageRef.current?.container();
      if (container) {
        const rect = container.getBoundingClientRect();
        setStageSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateStageSize();
    window.addEventListener('resize', updateStageSize);
    return () => window.removeEventListener('resize', updateStageSize);
  }, []);

  // Socket listeners
  useEffect(() => {
    const handleRemoteDrawStart = (element) => {
      setElements(prev => [...prev, element]);
    };

    const handleRemoteDrawMove = (point) => {
      setElements(prev => {
        if (prev.length === 0) return prev;
        const lastIndex = prev.length - 1;
        const updated = [...prev];
        updated[lastIndex] = {
          ...updated[lastIndex],
          points: [...updated[lastIndex].points, point]
        };
        return updated;
      });
    };

    const handleShapeRecognized = (shape) => {
      setElements(prev => [...prev, { ...shape, id: Date.now() }]);
      setDebugInfo(`Shape corrected: ${shape.type}`);
    };

    const handleClearBoard = () => {
      setElements([]);
      setDebugInfo("Board cleared by another user");
    };

    socket.on(EVENTS.DRAW_START, handleRemoteDrawStart);
    socket.on(EVENTS.DRAW_MOVE, handleRemoteDrawMove);
    socket.on(EVENTS.SHAPE_RECOGNIZED, handleShapeRecognized);
    socket.on(EVENTS.CLEAR_BOARD, handleClearBoard);

    return () => {
      socket.off(EVENTS.DRAW_START, handleRemoteDrawStart);
      socket.off(EVENTS.DRAW_MOVE, handleRemoteDrawMove);
      socket.off(EVENTS.SHAPE_RECOGNIZED, handleShapeRecognized);
      socket.off(EVENTS.CLEAR_BOARD, handleClearBoard);
    };
  }, [setElements, socket]);

  // Drawing events
  const handleMouseDown = (e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    handleDrawStart(pos.x, pos.y);
    setDebugInfo("Drawing started...");
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    handleDrawMove(pos.x, pos.y);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    handleDrawEnd();
    
    if (elements.length === 0) return;
    
    const lastElement = elements[elements.length - 1];
    if (lastElement.type === SHAPES.FREEHAND && lastElement.points.length >= 6) {
      try {
        console.log("Attempting shape recognition with points:", lastElement.points.length);
        const recognized = recognizeShape(lastElement.points);
        console.log("Recognition result:", recognized);
        
        if (recognized) {
          console.log(`Recognized as ${recognized.type}`);
          
          // Replace the original drawing with the corrected shape
          setElements(prev => {
            const newElements = [...prev];
            // Remove the last freehand element
            newElements.pop();
            // Add the corrected shape
            newElements.push({
              ...recognized,
              id: Date.now()
            });
            return newElements;
          });
          
          // Emit to other users
          socket.emit(EVENTS.SHAPE_RECOGNIZED, {
            roomId,
            shape: {
              ...recognized,
              id: Date.now()
            }
          });
          
          setDebugInfo(`Shape corrected: ${recognized.type}`);
        } else {
          console.log("No shape recognized - keeping as freehand");
          setDebugInfo("No shape recognized");
        }
      } catch (error) {
        console.error("Recognition error:", error);
        setDebugInfo(`Recognition error: ${error.message}`);
      }
    }
  };

  return (
    <div className="whiteboard">
      <div className="debug-info">{debugInfo}</div>
      
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        ref={stageRef}
      >
        <Layer>
          {elements.map((element) => {
            if (element.type === SHAPES.FREEHAND) {
              return (
                <Line
                  key={element.id}
                  points={element.points.flat()}
                  stroke="#000"
                  strokeWidth={3}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
              );
            }
            if (element.type === SHAPES.LINE) {
              return (
                <Line
                  key={element.id}
                  points={[element.x, element.y, element.x2, element.y2]}
                  stroke="#000"
                  strokeWidth={3}
                  lineCap="round"
                />
              );
            }
            if (element.type === SHAPES.CIRCLE) {
              return (
                <Circle
                  key={element.id}
                  x={element.x + element.radius}
                  y={element.y + element.radius}
                  radius={element.radius}
                  stroke="#000"
                  strokeWidth={3}
                />
              );
            }
            if (element.type === SHAPES.RECTANGLE) {
              return (
                <Rect
                  key={element.id}
                  x={element.x}
                  y={element.y}
                  width={element.width}
                  height={element.height}
                  stroke="#000"
                  strokeWidth={3}
                />
              );
            }
            return null;
          })}
        </Layer>
      </Stage>
    </div>
  );
});

export default Whiteboard;