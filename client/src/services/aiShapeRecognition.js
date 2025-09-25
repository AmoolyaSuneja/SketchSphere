class MinimalAIShapeRecognition {
  constructor() {
    this.isReady = false;
    this.shapeClasses = ['line', 'circle', 'rectangle'];
  }

  async initialize() {
    // Simulate async init
    await new Promise(r => setTimeout(r, 50));
    this.isReady = true;
    return true;
  }

  // Extract a few crude features
  extractFeatures(points) {
    if (!points || points.length < 6) return null;
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 5 || height < 5) return null;

    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
      pathLength += Math.hypot(points[i][0]-points[i-1][0], points[i][1]-points[i-1][1]);
    }
    const straightDistance = Math.hypot(points[points.length-1][0]-points[0][0], points[points.length-1][1]-points[0][1]);
    const startEndDist = Math.hypot(points[0][0]-points[points.length-1][0], points[0][1]-points[points.length-1][1]);

    const aspect = Math.max(width, height) / Math.max(1, Math.min(width, height));
    const isClosed = startEndDist < Math.min(width, height) * 0.35 ? 1 : 0;
    const straightness = straightDistance > 0 ? pathLength / straightDistance : 1;
    const squareness = 1 - Math.abs(width - height) / Math.max(width, height); // ~1 for square/circle

    return { width, height, aspect, isClosed, straightness, squareness, minX, minY, maxX, maxY };
  }

  // Tiny linear model + softmax with noise to allow mistakes
  predictProbs(f) {
    // Logits biased to sometimes confuse circle/rectangle and lines
    // line logit: prefers non-closed and high aspect, very straight
    const zLine = 1.2 * (f.aspect - 1) + 1.0 * (2 - Math.min(f.straightness, 3)) + (f.isClosed ? -0.8 : 0.6);
    // circle logit: prefers closed and width≈height (high squareness)
    const zCircle = 1.0 * f.isClosed + 1.1 * f.squareness - 0.3 * (f.aspect - 1);
    // rectangle logit: prefers closed and somewhat straight strokes, also squareness but less strict
    const zRect = 0.8 * f.isClosed + 0.6 * f.squareness + 0.2 * (f.aspect - 1);

    // Add random noise to make plausible mistakes
    const noise = () => (Math.random() - 0.5) * 0.8; // [-0.4, 0.4]
    const logits = [zLine + noise(), zCircle + noise(), zRect + noise()];

    // Softmax
    const maxZ = Math.max(...logits);
    const exps = logits.map(z => Math.exp(z - maxZ));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / Math.max(1e-8, sum));
  }

  recognizeShape(points) {
    // If AI not ready or features invalid, try heuristic fallback
    if (!this.isReady) {
      const h = this.heuristicRecognize(points);
      return h ? { type: h.type, confidence: 0.5, features: h } : null;
    }
    const f = this.extractFeatures(points);
    if (!f) {
      const h = this.heuristicRecognize(points);
      return h ? { type: h.type, confidence: 0.5, features: h } : null;
    }
    const probs = this.predictProbs(f);
    const idx = probs.indexOf(Math.max(...probs));
    const type = this.shapeClasses[idx];
    const confidence = probs[idx];
    // Prefer AI result, but if geometry is too tiny fallback to heuristic geometry
    const features = this.convertToShape(points, type) || this.heuristicRecognize(points);
    return {
      type,
      confidence,
      features
    };
  }

  convertToShape(points, type) {
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

    if (type === 'line') {
      return { type: 'line', x: minX, y: minY, x2: maxX, y2: maxY, width, height };
    }
    if (type === 'circle') {
      const radius = Math.min(width, height) / 2;
      return { type: 'circle', x: centerX - radius, y: centerY - radius, radius };
    }
    // rectangle
    return { type: 'rectangle', x: minX, y: minY, width, height };
  }

  // Simple internal heuristic fallback (line, circle, rectangle)
  heuristicRecognize(points) {
    if (!points || points.length < 6) return null;
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 20 || height < 20) return null;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    let pathLength = 0;
    for (let i = 1; i < points.length; i++) {
      pathLength += Math.hypot(points[i][0] - points[i-1][0], points[i][1] - points[i-1][1]);
    }
    const straightDistance = Math.hypot(points[points.length-1][0] - points[0][0], points[points.length-1][1] - points[0][1]);
    const startEndDist = Math.hypot(points[0][0] - points[points.length-1][0], points[0][1] - points[points.length-1][1]);
    const isClosed = startEndDist < Math.min(width, height) * 0.35;
    const aspectRatio = Math.max(width, height) / Math.min(width, height);

    // Line detection
    if (!isClosed && aspectRatio > 3 && (straightDistance > 0 ? pathLength / straightDistance : 1) < 1.5) {
      return { type: 'line', x: minX, y: minY, x2: maxX, y2: maxY, width, height };
    }
    // Circle detection (width≈height)
    if (isClosed && Math.abs(width - height) < Math.min(width, height) * 0.3) {
      const radius = Math.min(width, height) / 2;
      return { type: 'circle', x: centerX - radius, y: centerY - radius, radius };
    }
    // Rectangle detection (closed, reasonable ratio)
    if (isClosed && aspectRatio < 2.5) {
      return { type: 'rectangle', x: minX, y: minY, width, height };
    }
    return null;
  }
}

const aiShapeRecognition = new MinimalAIShapeRecognition();
export default aiShapeRecognition;
