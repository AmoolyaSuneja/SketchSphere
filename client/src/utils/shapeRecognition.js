import { SHAPES } from './constants';

export function recognizeShape(points) {
  if (!points || points.length < 6) return null;

  // Define thresholds at the top to avoid hoisting issues
  const lineThreshold = 0.6;    // Lowered from 0.8
  const circleThreshold = 0.5;  // Lowered from 0.7
  const rectThreshold = 0.5;    // Lowered from 0.6
  const margin = 0.1;           // Reduced from 0.2

  // Calculate bounding box
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

  // Calculate shape closure
  const startEndDist = Math.hypot(
    points[0][0] - points[points.length-1][0],
    points[0][1] - points[points.length-1][1]
  );
  const isClosedShape = startEndDist < Math.min(width, height) * 0.6;

  // Multiple detection methods
  const lineScore = detectLine(points, width, height, pathLength);
  const circleScore = detectCircle(points, centerX, centerY, width, height, pathLength);
  const rectScore = detectRectangle(points, width, height, pathLength);

  console.log('Shape Analysis:', {
    points: points.length,
    width,
    height,
    aspectRatio: Math.min(width, height) / Math.max(width, height),
    startEndDist,
    isClosedShape,
    lineScore,
    circleScore,
    rectScore,
    thresholds: {
      line: lineThreshold,
      circle: circleThreshold,
      rect: rectThreshold,
      margin
    }
  });

  // Check for line first (highest priority)
  if (lineScore > lineThreshold && lineScore > Math.max(circleScore, rectScore) + margin) {
    return {
      type: SHAPES.LINE,
      x: minX,
      y: minY,
      x2: maxX,
      y2: maxY,
      width: width,
      height: height
    };
  }
  
  // Check for circle/oval
  if (circleScore > circleThreshold && circleScore > rectScore + margin) {
    const radius = Math.min(width, height) / 2;
    return {
      type: SHAPES.CIRCLE,
      x: centerX - radius,
      y: centerY - radius,
      radius: radius
    };
  }
  
  // Check for rectangle/square
  if (rectScore > rectThreshold && rectScore > circleScore + margin) {
    return {
      type: SHAPES.RECTANGLE,
      x: minX,
      y: minY,
      width: width,
      height: height
    };
  }

  return null;
}

function detectCircle(points, centerX, centerY, width, height, pathLength) {
  // Method 1: Distance from center consistency
  let totalDist = 0;
  let distances = [];
  
  points.forEach(point => {
    const dist = Math.hypot(point[0] - centerX, point[1] - centerY);
    distances.push(dist);
    totalDist += dist;
  });
  
  const avgDist = totalDist / points.length;
  
  // Calculate variance in distances
  let variance = 0;
  distances.forEach(dist => {
    variance += Math.pow(dist - avgDist, 2);
  });
  variance = variance / distances.length;
  
  // Method 2: Expected vs actual circumference
  const radius = Math.min(width, height) / 2;
  const expectedCirc = 2 * Math.PI * radius;
  const circRatio = pathLength / expectedCirc;
  
  // Method 3: Aspect ratio (should be very close to 1 for circles)
  const aspectRatio = Math.min(width, height) / Math.max(width, height);
  
  // Method 4: Direction changes (circles should have many gradual changes)
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
    if (angleDiff > Math.PI/12) directionChanges++;
  }
  
  // Circle should have many small direction changes, not few large ones
  const directionScore = Math.min(directionChanges / 20, 1);
  
  // Stricter scoring for circles
  const varianceScore = 1 - Math.min(variance / (radius * radius * 0.5), 1); // More strict
  const circScore = 1 - Math.abs(circRatio - 1);
  const aspectScore = Math.pow(aspectRatio, 2); // Square to penalize non-circular shapes more
  
  // More lenient requirements for circles/ovals
  if (aspectRatio < 0.6) {
    return 0; // Not circular enough (allows ovals)
  }
  
  // More lenient circumference ratio for ovals
  if (Math.abs(circRatio - 1) > 0.5) {
    return 0; // Circumference too far from expected
  }
  
  const finalScore = (varianceScore * 0.4 + circScore * 0.3 + aspectScore * 0.2 + directionScore * 0.1);
  
  console.log('Circle Detection:', {
    varianceScore,
    circScore,
    aspectScore,
    directionScore,
    finalScore,
    directionChanges,
    aspectRatio,
    circRatio
  });
  
  return finalScore;
}

function detectRectangle(points, width, height, pathLength) {
  // Method 1: Direction changes (should be around 4 for rectangle)
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
  }
  
  // Method 2: Expected vs actual perimeter
  const expectedPerim = 2 * (width + height);
  const perimRatio = pathLength / expectedPerim;
  const perimScore = 1 - Math.abs(perimRatio - 1);
  
  // Method 3: Aspect ratio (rectangles can be any ratio, but not too extreme)
  const aspectRatio = Math.min(width, height) / Math.max(width, height);
  
  // Method 4: Straight line detection
  let straightLines = 0;
  for (let i = 2; i < points.length; i++) {
    const p1 = points[i-2];
    const p2 = points[i-1];
    const p3 = points[i];
    
    const angle1 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const angle2 = Math.atan2(p3[1] - p2[1], p3[0] - p2[0]);
    const angleDiff = Math.abs(angle1 - angle2);
    
    if (angleDiff < Math.PI/12) straightLines++;
  }
  
  const straightLineScore = Math.min(straightLines / points.length, 1);
  
  // Method 5: Corner detection (should have 4 distinct corners)
  const cornerScore = 1 - Math.abs(directionChanges - 4) / 4;
  
  // Stricter requirements for rectangles
  // Must have approximately 4 direction changes
  if (directionChanges < 2 || directionChanges > 8) {
    return 0; // Not rectangular enough
  }
  
  // More lenient perimeter ratio
  if (Math.abs(perimRatio - 1) > 0.6) {
    return 0; // Perimeter too far from expected
  }
  
  // More lenient straight line requirement
  if (straightLineScore < 0.2) {
    return 0; // Not enough straight lines
  }
  
  // Combine scores
  const finalScore = (
    cornerScore * 0.4 + 
    perimScore * 0.3 + 
    straightLineScore * 0.2 + 
    aspectRatio * 0.1
  );
  
  console.log('Rectangle Detection:', {
    directionChanges,
    cornerScore,
    perimScore,
    straightLineScore,
    aspectRatio,
    finalScore,
    perimRatio
  });
  
  return finalScore;
}

function detectLine(points, width, height, pathLength) {
  // Method 1: Straightness - check how straight the line is
  let straightnessScore = 0;
  let totalDeviation = 0;
  
  // Calculate the overall direction of the line
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  const overallDx = endPoint[0] - startPoint[0];
  const overallDy = endPoint[1] - startPoint[1];
  const overallLength = Math.hypot(overallDx, overallDy);
  
  if (overallLength === 0) return 0;
  
  // Calculate how much each point deviates from the straight line
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const t = ((point[0] - startPoint[0]) * overallDx + (point[1] - startPoint[1]) * overallDy) / (overallLength * overallLength);
    const projectedX = startPoint[0] + t * overallDx;
    const projectedY = startPoint[1] + t * overallDy;
    const deviation = Math.hypot(point[0] - projectedX, point[1] - projectedY);
    totalDeviation += deviation;
  }
  
  const avgDeviation = totalDeviation / (points.length - 2);
  const maxDeviation = Math.min(width, height) * 0.2; // Allow 20% deviation (increased from 10%)
  straightnessScore = Math.max(0, 1 - (avgDeviation / maxDeviation));
  
  // Method 2: Direction consistency
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
    if (angleDiff > Math.PI/12) directionChanges++;
  }
  
  // Lines should have very few direction changes
  const directionScore = Math.max(0, 1 - (directionChanges / 5)); // Increased from 3
  
  // Method 3: Path length vs straight line distance
  const straightLineDistance = Math.hypot(endPoint[0] - startPoint[0], endPoint[1] - startPoint[1]);
  const pathRatio = pathLength / straightLineDistance;
  const pathScore = Math.max(0, 1 - Math.abs(pathRatio - 1));
  
  // Method 4: Aspect ratio - lines should be long and thin
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  const aspectScore = Math.min(aspectRatio / 5, 1); // Prefer aspect ratios > 5
  
  // Method 5: Closure - lines should not be closed
  const startEndDist = Math.hypot(startPoint[0] - endPoint[0], startPoint[1] - endPoint[1]);
  const closureScore = startEndDist > Math.min(width, height) * 0.3 ? 1 : 0;
  
  // More lenient requirements for lines
  // Must be reasonably straight
  if (straightnessScore < 0.5) {
    return 0;
  }
  
  // Must have few direction changes
  if (directionChanges > 4) {
    return 0;
  }
  
  // Must not be closed
  if (closureScore === 0) {
    return 0;
  }
  
  // More lenient aspect ratio for lines
  if (aspectRatio < 1.5) {
    return 0;
  }
  
  // Combine scores
  const finalScore = (
    straightnessScore * 0.4 +
    directionScore * 0.3 +
    pathScore * 0.2 +
    aspectScore * 0.1
  );
  
  console.log('Line Detection:', {
    straightnessScore,
    directionScore,
    pathScore,
    aspectScore,
    closureScore,
    finalScore,
    directionChanges,
    aspectRatio,
    pathRatio,
    avgDeviation
  });
  
  return finalScore;
}