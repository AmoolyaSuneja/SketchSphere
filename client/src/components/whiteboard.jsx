import React, { useRef, useEffect, useContext, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Line, Circle, Rect } from 'react-konva';
import { SHAPES, EVENTS } from '../utils/constants';
import { SocketContext } from '../context/SocketContext';

const Whiteboard = forwardRef(({ roomId, users, elements, setElements }, ref) => {
  const socket = useContext(SocketContext);
  const stageRef = useRef(null);
  const [debugInfo, setDebugInfo] = useState("");
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [canvasColor, setCanvasColor] = useState('#ffffff');
  const [pencilSize, setPencilSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(6);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);

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
          points: [...updated[lastIndex].points, [point]]
        };
        return updated;
      });
    };

    const handleClearBoard = () => {
      setElements([]);
      setDebugInfo("Board cleared by another user");
    };

    socket.on(EVENTS.DRAW_START, handleRemoteDrawStart);
    socket.on(EVENTS.DRAW_MOVE, handleRemoteDrawMove);
    socket.on(EVENTS.CLEAR_BOARD, handleClearBoard);

    return () => {
      socket.off(EVENTS.DRAW_START, handleRemoteDrawStart);
      socket.off(EVENTS.DRAW_MOVE, handleRemoteDrawMove);
      socket.off(EVENTS.CLEAR_BOARD, handleClearBoard);
    };
  }, [setElements, socket]);

  // Drawing events
  const handleMouseDown = (e) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    setIsDrawing(true);
    const newElement = {
      id: Date.now(),
      type: isErasing ? SHAPES.ERASER : SHAPES.FREEHAND,
      points: [[pos.x, pos.y]],
      color: isErasing ? '#ffffff' : selectedColor,
      strokeWidth: isErasing ? eraserSize : pencilSize
    };
    
    setElements(prev => [...prev, newElement]);
    socket.emit(EVENTS.DRAW_START, { roomId, element: newElement });
    setDebugInfo(isErasing ? "Erasing..." : "Drawing started...");
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    setElements(prev => {
      if (prev.length === 0) return prev;
      
      const lastIndex = prev.length - 1;
      const lastElement = prev[lastIndex];
      
      // Only update freehand drawings and eraser
      if (lastElement.type === SHAPES.FREEHAND || lastElement.type === SHAPES.ERASER) {
        const updatedElement = {
          ...lastElement,
          points: [...lastElement.points, [pos.x, pos.y]]
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
      point: [pos.x, pos.y] 
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    socket.emit(EVENTS.DRAW_END, { roomId });
    setDebugInfo("Drawing ended");
  };

  // Tool actions
  const handleErase = () => {
    setIsErasing(true);
    setIsDrawing(false);
  };

  const handleDraw = () => {
    setIsErasing(false);
    setIsDrawing(false);
  };

  const handleColorSelect = (color) => {
    setSelectedColor(color);
  };

  const presetColors = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', 
    '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080', 
    '#ffc0cb', '#a52a2a', '#808080', '#008000', '#000080'
  ];

  const canvasPresetColors = [
    '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e0',
    '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'
  ];

  return (
    <div className="whiteboard">
      {/* Drawing Tools Panel */}
      <div className="drawing-tools">
        <div className="tools-header">🎨 Drawing Tools</div>
        
        <div className="tool-group">
          <div className="tool-group-title">Tools</div>
          <div className="tool-buttons">
            <button 
              className={`tool-btn ${!isErasing ? 'active' : ''}`}
              onClick={handleDraw}
              title="Pencil Tool"
            >
              🖊️
            </button>
            <button 
              className={`tool-btn eraser ${isErasing ? 'active' : ''}`}
              onClick={handleErase}
              title="Eraser Tool"
            >
              🩹
            </button>
          </div>
        </div>

        <div className="tool-group">
          <div className="tool-group-title">Colors</div>
          <div className="tool-label">Brush Color</div>
          <input
            type="color"
            className="color-picker"
            value={selectedColor}
            onChange={(e) => handleColorSelect(e.target.value)}
            title="Choose brush color"
          />
          <div className="preset-colors">
            {presetColors.map((color) => (
              <button
                key={color}
                className={`preset-color-btn ${selectedColor === color ? 'selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                title={`Select ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="tool-group">
          <div className="tool-group-title">Canvas Background</div>
          <div className="tool-label">Canvas Color</div>
          <input
            type="color"
            className="color-picker"
            value={canvasColor}
            onChange={(e) => setCanvasColor(e.target.value)}
            title="Choose canvas background color"
          />
          <div className="preset-colors">
            {canvasPresetColors.map((color) => (
              <button
                key={color}
                className={`preset-color-btn ${canvasColor === color ? 'selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setCanvasColor(color)}
                title={`Select ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="tool-group">
          <div className="tool-group-title">Tool Sizes</div>
          <div className="tool-label">Pencil Size: {pencilSize}px</div>
          <div className="brush-size-control">
            <div className="brush-size-preview">
              <div 
                className="brush-preview-circle"
                style={{ 
                  width: Math.max(20, pencilSize * 2), 
                  height: Math.max(20, pencilSize * 2),
                  borderWidth: Math.max(1, pencilSize / 4)
                }}
              >
                {pencilSize}
              </div>
              <input
                type="range"
                className="brush-size-slider"
                min="1"
                max="20"
                value={pencilSize}
                onChange={(e) => {
                  const size = parseInt(e.target.value);
                  setPencilSize(size);
                }}
                title="Adjust pencil size"
                style={{ flex: 1 }}
              />
            </div>
            <div className="brush-size-value">{pencilSize}px</div>
          </div>
        </div>

        <div className="tool-group">
          <div className="tool-label">Eraser Size: {eraserSize}px</div>
          <div className="brush-size-control">
            <div className="brush-size-preview">
              <div 
                className="brush-preview-circle"
                style={{ 
                  width: Math.max(20, eraserSize * 2), 
                  height: Math.max(20, eraserSize * 2),
                  borderWidth: Math.max(1, eraserSize / 4)
                }}
              >
                {eraserSize}
              </div>
              <input
                type="range"
                className="brush-size-slider"
                min="2"
                max="40"
                value={eraserSize}
                onChange={(e) => {
                  const size = parseInt(e.target.value);
                  setEraserSize(size);
                }}
                title="Adjust eraser size"
                style={{ flex: 1 }}
              />
            </div>
            <div className="brush-size-value">{eraserSize}px</div>
          </div>
        </div>

        <div className="scroll-hint">
          <span>↓ Scroll for more options ↓</span>
        </div>
      </div>

      {/* Floating Canvas Controls */}
      <div className="canvas-controls">
        <button 
          className="canvas-btn"
          onClick={() => setShowGrid(!showGrid)}
          title={showGrid ? "Hide Grid" : "Show Grid"}
        >
          ⊞
        </button>
        <button 
          className="canvas-btn danger"
          onClick={() => {
            setElements([]);
            socket.emit(EVENTS.CLEAR_BOARD, { roomId });
          }}
          title="Clear Canvas"
        >
          🗑️
        </button>
      </div>

      <div className="debug-info">{debugInfo}</div>
      
      {/* Canvas Grid Background */}
      {showGrid && <div className="canvas-grid" />}
      
      {/* Empty State */}
      {elements.length === 0 && (
        <div className="canvas-empty-state">
          <div className="empty-icon">🎨</div>
          <div className="empty-text">Ready to create!</div>
          <div className="empty-hint">✏️ Pick a tool & start sketching!</div>
        </div>
      )}
      
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        ref={stageRef}
        style={{ backgroundColor: canvasColor }}
      >
        <Layer>
          {elements.map((element) => {
            if (element.type === SHAPES.FREEHAND || element.type === SHAPES.ERASER) {
              return (
                <Line
                  key={element.id}
                  points={element.points.flat()}
                  stroke={element.color || selectedColor}
                  strokeWidth={element.strokeWidth || (isErasing ? eraserSize : pencilSize)}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={element.type === SHAPES.ERASER ? 'destination-out' : 'source-over'}
                />
              );
            }
            if (element.type === SHAPES.LINE) {
              return (
                <Line
                  key={element.id}
                  points={[element.x, element.y, element.x2, element.y2]}
                  stroke={element.color || selectedColor}
                  strokeWidth={element.strokeWidth || pencilSize}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
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
                  stroke={element.color || selectedColor}
                  strokeWidth={element.strokeWidth || pencilSize}
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
                  stroke={element.color || selectedColor}
                  strokeWidth={element.strokeWidth || pencilSize}
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