import * as tf from '@tensorflow/tfjs';
import { Matrix } from 'ml-matrix';
import _ from 'lodash';

class AIShapeRecognition {
  constructor() {
    this.model = null;
    this.isModelLoaded = false;
    this.shapeClasses = ['line', 'circle', 'rectangle', 'triangle', 'freehand'];
    this.inputSize = 64; // 64x64 normalized drawing
  }

  async initialize() {
    try {
      console.log('🤖 Initializing AI Shape Recognition...');
      
      // Create a simple neural network model for shape classification
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [this.inputSize * this.inputSize + 7], // 64x64 + 7 features
            units: 128,
            activation: 'relu',
            kernelInitializer: 'varianceScaling'
          }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({
            units: 64,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: this.shapeClasses.length,
            activation: 'softmax'
          })
        ]
      });

      // Compile the model
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      // Load pre-trained weights if available, otherwise use random weights
      await this.loadOrCreateWeights();
      this.isModelLoaded = true;
      console.log('✅ AI Shape Recognition model initialized successfully');
      console.log('Model summary:', this.model.summary());
    } catch (error) {
      console.error('❌ Failed to initialize AI model:', error);
      this.isModelLoaded = false;
    }
  }

  async loadOrCreateWeights() {
    try {
      // Try to load pre-trained weights from localStorage
      const savedWeights = localStorage.getItem('shapeRecognitionWeights');
      if (savedWeights) {
        const weights = JSON.parse(savedWeights);
        this.model.setWeights(weights.map(w => tf.tensor(w)));
        console.log('Loaded pre-trained weights');
      } else {
        // Initialize with random weights for now
        console.log('Using random weights - model will learn from user interactions');
      }
    } catch (error) {
      console.log('Using random weights due to loading error:', error);
    }
  }

  async saveWeights() {
    try {
      const weights = await this.model.getWeights();
      const weightsData = await Promise.all(weights.map(w => w.data()));
      localStorage.setItem('shapeRecognitionWeights', JSON.stringify(weightsData));
      console.log('Model weights saved');
    } catch (error) {
      console.error('Failed to save weights:', error);
    }
  }

  preprocessDrawing(points) {
    if (!points || points.length < 3) return null;

    // Normalize points to 0-1 range
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    if (width === 0 || height === 0) return null;

    // Normalize points
    const normalizedPoints = points.map(p => [
      (p[0] - minX) / width,
      (p[1] - minY) / height
    ]);

    // Create a 64x64 bitmap representation
    const bitmap = new Array(this.inputSize).fill(null).map(() => 
      new Array(this.inputSize).fill(0)
    );

    // Draw the stroke on the bitmap
    for (let i = 0; i < normalizedPoints.length - 1; i++) {
      const p1 = normalizedPoints[i];
      const p2 = normalizedPoints[i + 1];
      
      const x1 = Math.floor(p1[0] * (this.inputSize - 1));
      const y1 = Math.floor(p1[1] * (this.inputSize - 1));
      const x2 = Math.floor(p2[0] * (this.inputSize - 1));
      const y2 = Math.floor(p2[1] * (this.inputSize - 1));
      
      // Simple line drawing algorithm
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const sx = x1 < x2 ? 1 : -1;
      const sy = y1 < y2 ? 1 : -1;
      let err = dx - dy;
      
      let x = x1, y = y1;
      while (true) {
        if (x >= 0 && x < this.inputSize && y >= 0 && y < this.inputSize) {
          bitmap[y][x] = 1;
        }
        
        if (x === x2 && y === y2) break;
        
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x += sx;
        }
        if (e2 < dx) {
          err += dx;
          y += sy;
        }
      }
    }

    // Flatten to 1D array
    return bitmap.flat();
  }

  extractFeatures(points) {
    if (!points || points.length < 3) return null;

    const features = [];
    
    // Basic geometric features
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = width / height;
    const area = width * height;
    
    // Path length
    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
      pathLength += Math.hypot(
        points[i][0] - points[i-1][0],
        points[i][1] - points[i-1][1]
      );
    }
    
    // Straight line distance
    const straightDistance = Math.hypot(
      points[points.length-1][0] - points[0][0],
      points[points.length-1][1] - points[0][1]
    );
    
    // Curvature features
    let totalCurvature = 0;
    let directionChanges = 0;
    const directions = [];
    
    for (let i = 1; i < points.length; i++) {
      const dx = points[i][0] - points[i-1][0];
      const dy = points[i][1] - points[i-1][1];
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        directions.push(Math.atan2(dy, dx));
      }
    }
    
    for (let i = 1; i < directions.length; i++) {
      const angleDiff = Math.abs(directions[i] - directions[i-1]);
      if (angleDiff > Math.PI/6) directionChanges++;
      totalCurvature += angleDiff;
    }
    
    // Closure detection
    const startEndDist = Math.hypot(
      points[0][0] - points[points.length-1][0],
      points[0][1] - points[points.length-1][1]
    );
    const isClosed = startEndDist < Math.min(width, height) * 0.3;
    
    // Combine features
    features.push(
      aspectRatio,
      area / (pathLength * pathLength), // Compactness
      pathLength / straightDistance, // Straightness
      directionChanges / points.length, // Direction change rate
      totalCurvature / points.length, // Average curvature
      isClosed ? 1 : 0, // Closure
      points.length / pathLength // Point density
    );
    
    return features;
  }

  async recognizeShape(points) {
    console.log('🔍 Starting shape recognition...', { pointsLength: points?.length, modelLoaded: this.isModelLoaded });
    
    if (!this.isModelLoaded) {
      console.log('❌ Model not loaded');
      return null;
    }
    
    if (!points || points.length < 10) {
      console.log('❌ Not enough points for recognition:', points?.length);
      return null;
    }

    try {
      // Extract features
      const features = this.extractFeatures(points);
      console.log('📊 Extracted features:', features);
      if (!features) {
        console.log('❌ Failed to extract features');
        return null;
      }

      // Preprocess drawing for neural network
      const bitmap = this.preprocessDrawing(points);
      console.log('🖼️ Bitmap created:', bitmap?.length, 'pixels');
      if (!bitmap) {
        console.log('❌ Failed to create bitmap');
        return null;
      }

      // Combine features and bitmap
      const input = [...features, ...bitmap];
      console.log('🔗 Combined input length:', input.length);
      
      // Normalize input
      const normalizedInput = input.map(val => 
        typeof val === 'number' ? val / 100 : val
      );

      // Make prediction
      const inputTensor = tf.tensor2d([normalizedInput]);
      console.log('🧠 Making prediction...');
      const prediction = this.model.predict(inputTensor);
      const probabilities = await prediction.data();
      console.log('📈 Raw probabilities:', Array.from(probabilities));
      
      // Get the most likely shape
      const maxIndex = probabilities.indexOf(Math.max(...probabilities));
      const confidence = probabilities[maxIndex];
      const shapeType = this.shapeClasses[maxIndex];
      
      console.log(`🎯 Prediction: ${shapeType} (confidence: ${confidence.toFixed(2)})`);
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
      
      // Lower confidence threshold for testing
      if (confidence > 0.3) {
        console.log(`✅ AI Shape recognized: ${shapeType} (${(confidence * 100).toFixed(0)}%)`);
        
        return {
          type: shapeType,
          confidence: confidence,
          features: this.convertToShape(points, shapeType)
        };
      } else {
        console.log(`❌ AI Confidence too low: ${(confidence * 100).toFixed(0)}%`);
        // Try fallback recognition
        return this.fallbackShapeRecognition(points);
      }
    } catch (error) {
      console.error('❌ Shape recognition error:', error);
      return null;
    }
  }

  // Fallback shape recognition using geometric analysis
  fallbackShapeRecognition(points) {
    console.log('🔄 Using fallback shape recognition...');
    
    if (!points || points.length < 5) return null;
    
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Skip very small shapes
    if (width < 20 || height < 20) return null;
    
    // Calculate path length
    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
      pathLength += Math.hypot(
        points[i][0] - points[i-1][0],
        points[i][1] - points[i-1][1]
      );
    }
    
    // Straight line distance
    const straightDistance = Math.hypot(
      points[points.length-1][0] - points[0][0],
      points[points.length-1][1] - points[0][1]
    );
    
    // Closure detection
    const startEndDist = Math.hypot(
      points[0][0] - points[points.length-1][0],
      points[0][1] - points[points.length-1][1]
    );
    const isClosed = startEndDist < Math.min(width, height) * 0.3;
    
    // Aspect ratio
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    
    // Simple heuristics
    if (!isClosed && aspectRatio > 3 && pathLength / straightDistance < 1.5) {
      console.log('📏 Detected line');
      return {
        type: 'line',
        confidence: 0.8,
        features: {
          type: 'line',
          x: minX,
          y: minY,
          x2: maxX,
          y2: maxY,
          width: width,
          height: height
        }
      };
    }
    
    if (isClosed && Math.abs(width - height) < Math.min(width, height) * 0.3) {
      console.log('⭕ Detected circle');
      const radius = Math.min(width, height) / 2;
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      return {
        type: 'circle',
        confidence: 0.7,
        features: {
          type: 'circle',
          x: centerX - radius,
          y: centerY - radius,
          radius: radius
        }
      };
    }
    
    if (isClosed && aspectRatio < 2) {
      console.log('⬜ Detected rectangle');
      return {
        type: 'rectangle',
        confidence: 0.6,
        features: {
          type: 'rectangle',
          x: minX,
          y: minY,
          width: width,
          height: height
        }
      };
    }
    
    return null;
  }

  convertToShape(points, shapeType) {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    switch (shapeType) {
      case 'line':
        return {
          type: 'line',
          x: minX,
          y: minY,
          x2: maxX,
          y2: maxY,
          width: width,
          height: height
        };
      
      case 'circle':
        const radius = Math.min(width, height) / 2;
        return {
          type: 'circle',
          x: centerX - radius,
          y: centerY - radius,
          radius: radius
        };
      
      case 'rectangle':
        return {
          type: 'rectangle',
          x: minX,
          y: minY,
          width: width,
          height: height
        };
      
      case 'triangle':
        // Simple triangle approximation
        return {
          type: 'triangle',
          x: minX,
          y: minY,
          width: width,
          height: height
        };
      
      default:
        return null;
    }
  }

  async trainOnUserFeedback(points, correctShape) {
    if (!this.isModelLoaded) return;

    try {
      const features = this.extractFeatures(points);
      const bitmap = this.preprocessDrawing(points);
      if (!features || !bitmap) return;

      const input = [...features, ...bitmap];
      const normalizedInput = input.map(val => 
        typeof val === 'number' ? val / 100 : val
      );

      // Create one-hot encoded label
      const labelIndex = this.shapeClasses.indexOf(correctShape);
      if (labelIndex === -1) return;

      const label = new Array(this.shapeClasses.length).fill(0);
      label[labelIndex] = 1;

      // Train the model
      const inputTensor = tf.tensor2d([normalizedInput]);
      const labelTensor = tf.tensor2d([label]);

      await this.model.fit(inputTensor, labelTensor, {
        epochs: 1,
        verbose: 0
      });

      // Clean up
      inputTensor.dispose();
      labelTensor.dispose();

      // Save updated weights
      await this.saveWeights();
      
      console.log(`Model trained on ${correctShape} example`);
    } catch (error) {
      console.error('Training error:', error);
    }
  }
}

// Create singleton instance
const aiShapeRecognition = new AIShapeRecognition();

export default aiShapeRecognition;
