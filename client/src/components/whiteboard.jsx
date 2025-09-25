import React, { useRef, useEffect, useContext, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Line, Circle, Rect } from 'react-konva';
import { SHAPES, EVENTS } from '../utils/constants';
import { SocketContext } from '../context/SocketContext';
/* Heuristic fallback is now inside the AI service */
import aiShapeRecognition from '../services/aiShapeRecognition';

const Whiteboard = forwardRef(({ roomId, users, elements, setElements }, ref) => {
  const socket = useContext(SocketContext);
  const stageRef = useRef(null);
  const stageContainerRef = useRef(null);
  const [debugInfo, setDebugInfo] = useState("");
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [canvasColor, setCanvasColor] = useState('#ffffff');
  const [pencilSize, setPencilSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(6);
  const [showGrid, setShowGrid] = useState(false);
  const [showCanvasColorPicker, setShowCanvasColorPicker] = useState(false);
  const [showPenColorPicker, setShowPenColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [showSizeControls, setShowSizeControls] = useState(false);
  /* const [shapeRecognitionEnabled, setShapeRecognitionEnabled] = useState(true); */
  /* const [currentStroke, setCurrentStroke] = useState(null); */
  const [aiModelLoaded, setAiModelLoaded] = useState(false);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleErase: () => {
      setElements([]);
      socket.emit(EVENTS.CLEAR_BOARD, { roomId });
      setDebugInfo("Board cleared");
    }
  }));

  // Initialize minimal AI recognizer
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await aiShapeRecognition.initialize();
        if (mounted) {
          setAiModelLoaded(true);
          setDebugInfo("🤖 AI ready");
        }
      } catch (e) {
        console.error('AI init error', e);
        if (mounted) setDebugInfo("AI failed to init");
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Update stage size on mount and window resize
  useEffect(() => {
    const updateStageSize = () => {
      const containerEl = stageContainerRef.current || stageRef.current?.container();
      if (containerEl) {
        const rect = containerEl.getBoundingClientRect();
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

    const handleClearBoard = () => {
      setElements([]);
      setDebugInfo("Board cleared by another user");
    };

    /* const handleShapeRecognized = (data) => {
      setElements(prev => {
        const updated = [...prev];
        const elementIndex = updated.findIndex(el => el.id === data.elementId);
        if (elementIndex !== -1) {
          updated[elementIndex] = data.shape;
          setDebugInfo(`🤖 Remote AI recognized: ${data.shape.type}`);
        }
        return updated;
      });
    }; */

    socket.on(EVENTS.DRAW_START, handleRemoteDrawStart);
    socket.on(EVENTS.DRAW_MOVE, handleRemoteDrawMove);
    socket.on(EVENTS.CLEAR_BOARD, handleClearBoard);
    /* socket.on(EVENTS.SHAPE_RECOGNIZED, handleShapeRecognized); */

    return () => {
      socket.off(EVENTS.DRAW_START, handleRemoteDrawStart);
      socket.off(EVENTS.DRAW_MOVE, handleRemoteDrawMove);
      socket.off(EVENTS.CLEAR_BOARD, handleClearBoard);
      /* socket.off(EVENTS.SHAPE_RECOGNIZED, handleShapeRecognized); */
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
    
    /* // Store current stroke for shape recognition (disabled)
    setCurrentStroke(newElement); */
    
    setElements(prev => [...prev, newElement]);
    socket.emit(EVENTS.DRAW_START, { roomId, element: newElement });
    setDebugInfo(isErasing ? "Erasing..." : `Drawing with ${selectedColor}`);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    setElements(prev => {
      if (prev.length === 0) return prev;
      
      const lastIndex = prev.length - 1;
      const lastElement = prev[lastIndex];
      
      if (lastElement.type === SHAPES.FREEHAND || lastElement.type === SHAPES.ERASER) {
        const updatedElement = {
          ...lastElement,
          points: [...lastElement.points, [pos.x, pos.y]],
          color: isErasing ? '#ffffff' : selectedColor
        };
        
        /* // Update current stroke for shape recognition (disabled)
        setCurrentStroke(updatedElement); */
        
        return [
          ...prev.slice(0, lastIndex),
          updatedElement
        ];
      }
      return prev;
    });
    
    socket.emit(EVENTS.DRAW_MOVE, { 
      roomId, 
      point: [pos.x, pos.y],
      color: isErasing ? '#ffffff' : selectedColor
    });
  };

  const handleMouseUp = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    /*
    // AI Shape Recognition (disabled)
    if (shapeRecognitionEnabled && currentStroke && currentStroke.points.length > 5) {
      // ...recognition code disabled...
    }
    */
    
  // AI-based recognition with occasional mistakes; fallback to heuristics if null
  setElements(prev => {
      if (prev.length === 0) return prev;
      const lastIndex = prev.length - 1;
      const lastElement = prev[lastIndex];
      if (lastElement.type !== SHAPES.FREEHAND || (lastElement.points?.length || 0) < 6) {
        return prev;
      }
    // Recognize via unified AI service (includes internal fallback)
    const aiResult = aiModelLoaded ? aiShapeRecognition.recognizeShape(lastElement.points) : null;
    const recognized = aiResult?.features;
    if (!recognized) return prev;
    const newShape = {
      id: lastElement.id,
      type: recognized.type,
      x: recognized.x,
      y: recognized.y,
      x2: recognized.x2,
      y2: recognized.y2,
      width: recognized.width,
      height: recognized.height,
      radius: recognized.radius,
      color: lastElement.color,
      strokeWidth: lastElement.strokeWidth
    };
    setDebugInfo(`Recognized: ${recognized.type}${aiResult ? ` (${(aiResult.confidence*100).toFixed(0)}%)` : ''}`);
    return [
      ...prev.slice(0, lastIndex),
      newShape
    ];
    });
    
    /* setCurrentStroke(null); */
    socket.emit(EVENTS.DRAW_END, { roomId });
    setDebugInfo("Drawing ended");
  };

  // Tool actions
  const handleErase = () => {
    setIsErasing(true);
    setIsDrawing(false);
    setDebugInfo("Switched to eraser");
  };

  const handleDraw = () => {
    setIsErasing(false);
    // Do not start drawing until the next pointer down
    setIsDrawing(false);
    setDebugInfo(`Pencil selected (${selectedColor})`);
  };

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    setIsErasing(false);
    // Pause drawing; resume on next pointer down
    setIsDrawing(false);
    setDebugInfo(`Selected color: ${color}`);
    // keep panel open to allow multiple selections
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
      <div className="drawing-tools" style={{ display: 'block' }}>
        <div className="tools-header">Drawing Tools</div>
        
        <div className="tool-group">
          <div className="tool-group-title">Tools</div>
          <div className="tool-buttons">
            <button 
              className={`tool-btn ${!isErasing && isDrawing ? 'active' : ''}`}
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
            <button 
              className="tool-btn"
              onClick={() => {
                setShowSizeControls(!showSizeControls);
                setDebugInfo(`Size controls ${showSizeControls ? 'hidden' : 'shown'}`);
              }}
              title="Adjust Pen and Eraser Size"
            >
              📏
            </button>
            { /* AI toggle removed (disabled) */ }
          </div>
        </div>

        <div className="tool-group size-controls-group">
          <div className="tool-group-title" style={{ display: showSizeControls ? 'block' : 'none' }}>Brush Size</div>
          {showSizeControls && (
            <div className="size-controls">
              <div className="size-control">
                <label>Pen: {pencilSize}px</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={pencilSize}
                  onChange={(e) => setPencilSize(parseInt(e.target.value))}
                  className="size-slider"
                />
              </div>
              <div className="size-control">
                <label>Eraser: {eraserSize}px</label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={eraserSize}
                  onChange={(e) => setEraserSize(parseInt(e.target.value))}
                  className="size-slider"
                />
              </div>
            </div>
          )}
        </div>

        <div className="tool-group">
          <div className="tool-group-title">Pen Color</div>
          <button 
            className="canvas-color-btn"
            onClick={() => setShowPenColorPicker(!showPenColorPicker)}
            title="Choose pen color"
          >
            <div className="color-preview" style={{ backgroundColor: selectedColor }}></div>
            <span>Pen Color</span>
            <span className="color-icon">⚡</span>
          </button>
        </div>

        <div className="tool-group">
          <div className="tool-group-title">Canvas Background</div>
          <button 
            className="canvas-color-btn"
            onClick={() => setShowCanvasColorPicker(!showCanvasColorPicker)}
            title="Choose canvas background color"
          >
            <div className="color-preview" style={{ backgroundColor: canvasColor }}></div>
            <span>Canvas Color</span>
            <span className="color-icon">⚡</span>
          </button>
        </div>
        
        {showPenColorPicker && (
          <div className="color-panel-overlay" onClick={() => { 
            setShowPenColorPicker(false); 
            setIsDrawing(false); 
            setDebugInfo("Color picker closed - Drawing paused");
          }}>
            <div className="color-panel" onClick={(e) => e.stopPropagation()}>
              <div className="color-panel-header">
                <h3>Choose Pen Color</h3>
                <button 
                  className="close-btn"
                  onClick={() => {
                    setShowPenColorPicker(false);
                    setIsDrawing(false);
                    setDebugInfo("Color picker closed - Drawing paused");
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div className="color-panel-content">
                <div className="custom-color-section">
                  <label>Custom Color</label>
                  <input
                    type="color"
                    className="color-picker"
                    value={selectedColor}
                    onChange={(e) => handleColorSelect(e.target.value)}
                    title="Choose custom pen color"
                  />
                </div>
                
                <div className="preset-colors-section">
                  <label>Preset Colors</label>
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
              </div>
            </div>
          </div>
        )}
        
        {showCanvasColorPicker && (
          <div className="color-panel-overlay" onClick={() => { setShowCanvasColorPicker(false); setIsDrawing(false); }}>
            <div className="color-panel" onClick={(e) => e.stopPropagation()}>
              <div className="color-panel-header">
                <h3>Choose Canvas Color</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowCanvasColorPicker(false)}
                >
                  ✕
                </button>
              </div>
              
              <div className="color-panel-content">
                <div className="custom-color-section">
                  <label>Custom Color</label>
                  <input
                    type="color"
                    className="color-picker"
                    value={canvasColor}
                    onChange={(e) => { setCanvasColor(e.target.value); setIsDrawing(false); }}
                    title="Choose custom canvas color"
                  />
                </div>
                
                <div className="preset-colors-section">
                  <label>Preset Colors</label>
                  <div className="preset-colors">
                    {canvasPresetColors.map((color) => (
                      <button
                        key={color}
                        className={`preset-color-btn ${canvasColor === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => { setCanvasColor(color); setIsDrawing(false); }}
                        title={`Select ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
          <div className="empty-icon">✨</div>
          <div className="empty-text">Ready to create!</div>
          <div className="empty-hint">✏️ Pick a tool & start sketching!</div>
        </div>
      )}
      
      <div className="stage-container" ref={stageContainerRef}>
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
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

      <style jsx>{`
        .whiteboard {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .stage-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }
        
        .drawing-tools {
          position: absolute;
          top: 10px;
          left: 10px;
          background: white;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          z-index: 10;
          width: 300px;
          min-height: 100px; /* Ensure minimum height */
          max-height: 85vh;
          overflow-y: auto;
          display: block !important; /* Force display */
        }
        
        .tools-header {
          font-weight: bold;
          margin-bottom: 15px;
          padding-bottom: 5px;
          border-bottom: 1px solid #eee;
          text-align: center;
        }
        
        .tool-group {
          margin-bottom: 20px;
          padding: 10px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
        }
        
        .size-controls-group {
          margin-bottom: 20px;
          padding: 10px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          transition: max-height 0.3s ease-in-out;
          overflow: hidden;
        }
        
        .tool-group-title {
          font-size: 12px;
          color: #666;
          margin-bottom: 10px;
        }
        
        .tool-buttons {
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }
        
        .tool-btn {
          padding: 10px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          flex: 1;
          text-align: center;
          transition: background 0.2s;
        }
        
        .tool-btn:hover {
          background: #f5f5f5;
        }
        
        .tool-btn.active {
          background: #e6f7ff;
          border-color: #91d5ff;
        }
        
        .tool-btn.eraser.active {
          background: #fff2e8;
          border-color: #ffbb96;
        }
        
        .size-controls {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .size-control {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        
        .size-control label {
          font-size: 12px;
          color: #666;
        }
        
        .size-slider {
          width: 100%;
        }
        
        .canvas-color-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          width: 100%;
          justify-content: space-between;
        }
        
        .color-preview {
          width: 20px;
          height: 20px;
          border: 1px solid #ddd;
          border-radius: 3px;
        }
        
        .canvas-controls {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          gap: 10px;
          z-index: 10;
        }
        
        .canvas-btn {
          padding: 10px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }
        
        .canvas-btn:hover {
          background: #f5f5f5;
        }
        
        .canvas-btn.danger:hover {
          background: #fff2f0;
        }
        
        .debug-info {
          position: absolute;
          bottom: 10px;
          left: 10px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 12px;
          z-index: 10;
        }
        
        .canvas-grid {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
          pointer-events: none;
          z-index: 1;
        }
        
        .canvas-empty-state {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: #999;
          z-index: 2;
          pointer-events: none;
        }
        
        .empty-icon {
          font-size: 40px;
          margin-bottom: 10px;
        }
        
        .empty-text {
          font-size: 18px;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        .empty-hint {
          font-size: 14px;
        }
        
        .color-panel-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        
        .color-panel {
          background: white;
          border-radius: 8px;
          padding: 15px;
          width: 300px;
          max-width: 90%;
        }
        
        .color-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .color-panel-header h3 {
          margin: 0;
          font-size: 16px;
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
        }
        
        .color-panel-content {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .custom-color-section,
        .preset-colors-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .custom-color-section label,
        .preset-colors-section label {
          font-size: 14px;
          font-weight: bold;
        }
        
        .color-picker {
          width: 100%;
          height: 40px;
        }
        
        .preset-colors {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 5px;
        }
        
        .preset-color-btn {
          width: 25px;
          height: 25px;
          border: 1px solid #ddd;
          border-radius: 3px;
          cursor: pointer;
          padding: 0;
        }
        
        .preset-color-btn.selected {
          border: 2px solid #1890ff;
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
});

export default Whiteboard;