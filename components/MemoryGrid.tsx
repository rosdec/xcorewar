import { useEffect, useRef, useState } from 'preact/hooks';

interface Instruction {
  ownerId: number;
  op: string;
  modeA: string;
  valA: number;
  modeB: string;
  valB: number;
  modifier: string;
}

interface MemoryGridProps {
  core: Instruction[];
  coreSize: number;
  warriorColors?: string[];
  updatedAddresses?: Set<number>;
}

export default function MemoryGrid({ 
  core, 
  coreSize, 
  warriorColors = ['#4ade80', '#f87171', '#fbbf24', '#60a5fa', '#c084fc'],
  updatedAddresses = new Set()
}: MemoryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cellSize, setCellSize] = useState(4);
  const [cols, setCols] = useState(100);

  // Calculate grid dimensions and cell size based on container size
  useEffect(() => {
    const calculateDimensions = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      if (containerWidth === 0 || containerHeight === 0) return;
      
      // Calculate the aspect ratio
      const aspectRatio = containerWidth / containerHeight;
      
      // Try different column counts to find the best fit that maximizes cell size
      let bestCols = 100;
      let bestSize = 1;
      let bestFit = Infinity; // Track how well it fits (lower is better)
      
      // Test a wider range of column configurations
      for (let testCols = 40; testCols <= 250; testCols += 5) {
        const testRows = Math.ceil(coreSize / testCols);
        
        // Skip if rows is 0
        if (testRows === 0) continue;
        
        // Calculate what size cells we could have
        const testCellWidth = containerWidth / testCols;
        const testCellHeight = containerHeight / testRows;
        const testSize = Math.min(testCellWidth, testCellHeight);
        
        // Calculate how much wasted space there would be
        const gridWidth = testCols * testSize;
        const gridHeight = testRows * testSize;
        const wastedSpace = (containerWidth - gridWidth) + (containerHeight - gridHeight);
        
        // Prefer configurations that maximize cell size while minimizing waste
        // Use a score that balances size and fit
        const score = wastedSpace - (testSize * 10); // Prioritize larger cells
        
        if (testSize >= 2 && score < bestFit) {
          bestFit = score;
          bestSize = testSize;
          bestCols = testCols;
        }
      }
      
      // Ensure minimum size of 2 pixels
      bestSize = Math.max(2, Math.floor(bestSize));
      
      setCellSize(bestSize);
      setCols(bestCols);
    };

    calculateDimensions();
    
    // Recalculate on window resize
    const resizeObserver = new ResizeObserver(calculateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, [coreSize]);

  // Draw the memory grid on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !core.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rows = Math.ceil(coreSize / cols);
    const canvasWidth = cols * cellSize;
    const canvasHeight = rows * cellSize;

    // Set canvas dimensions
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.fillStyle = '#111827'; // Background color
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw each memory cell
    for (let i = 0; i < coreSize; i++) {
      const instruction = core[i];
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = col * cellSize;
      const y = row * cellSize;

      let color = '#1f2937'; // Default (empty) color

      if (instruction && instruction.ownerId > 0) {
        // Use warrior color
        const colorIndex = (instruction.ownerId - 1) % warriorColors.length;
        color = warriorColors[colorIndex];
      }

      // If recently updated, add a brighter highlight
      if (updatedAddresses.has(i)) {
        ctx.fillStyle = '#ffffff'; // Bright flash for updates
      } else {
        ctx.fillStyle = color;
      }

      // Draw the cell (with small gap for grid effect)
      const gap = Math.max(0, Math.floor(cellSize * 0.1));
      ctx.fillRect(x + gap, y + gap, cellSize - gap * 2, cellSize - gap * 2);
    }
  }, [core, coreSize, cellSize, cols, warriorColors, updatedAddresses]);

  const rows = Math.ceil(coreSize / cols);
  const canvasWidth = cols * cellSize;
  const canvasHeight = rows * cellSize;

  return (
    <div 
      ref={containerRef} 
      className="memory-grid-container"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#111827'
      }}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          imageRendering: 'pixelated'
        }}
      />
    </div>
  );
}
