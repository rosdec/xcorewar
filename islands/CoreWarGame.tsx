import { useState, useCallback, useEffect } from 'preact/hooks';
import '../assets/corewar-game.css';
import TabbedWarriorDefinition from '../components/TabbedWarriorDefinition.tsx';
import MemoryGrid from '../components/MemoryGrid.tsx';
import CoreMemorySnippet from '../components/CoreMemorySnippet.tsx';

// --- CORE WAR TYPES AND CONSTANTS ---

// Using a simplified ICWS '94 subset for the initial implementation

/** The memory size for the Core War simulator. A standard size is 8000. */
const CORE_SIZE = 8100;
/** The maximum number of processes per warrior. */
const MAX_PROCESSES = 8000;
/** The default instruction that fills the core. DAT 0, 0. */
const DEFAULT_DAT_VALUE = 0;

/** Addressing Modes supported. Simplification: focusing on Direct and Immediate. */
type Mode = 'IMMEDIATE' | 'DIRECT' | 'INDIRECT_B' | 'PREDECREMENT_A';

/** Core War Opcodes. Subset for a functional Imp/Dwarf. */
type OpCode = 'DAT' | 'MOV' | 'ADD' | 'SUB' | 'JMP' | 'SPL' | 'NOP';

/** Structure of a single instruction in the core. */
interface Instruction {
  ownerId: number; // Which warrior owns this instruction
  op: OpCode;
  modeA: Mode;
  valA: number;
  modeB: Mode;
  valB: number;
  modifier: string; // TBD: 'A', 'B', 'AB', 'F', 'X', 'I' (simplified to 'I' for now)
}

/** Structure of a single running process (program counter). */
interface Process {
  pc: number; // Program Counter (current instruction index)
  processId: number; // Unique ID for logging
}

/** Structure of a warrior (program) */
interface Warrior {
  id: number;
  name: string;
  startAddr: number;
  processes: Process[];
}

// --- CORE WAR LOGIC IMPLEMENTATION ---

/** Helper function for modulo arithmetic (handles negative numbers correctly for circular memory) */
const mod = (n: number, m: number): number => {
  return ((n % m) + m) % m;
};

/**
 * Parses a simplified Redcode line into an Instruction object.
 * Format: [OP] [MODE_A]VAL_A, [MODE_B]VAL_B [; Comment]
 * Example: MOV $1, 2
 * @param line Single line of redcode string
 * @param ownerId The warrior ID to assign ownership
 * @returns An Instruction object or null on parse error
 */
const parseRedcodeLine = (line: string, ownerId: number): Instruction | null => {
  const parts = line.trim().toUpperCase().split(';')[0].split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return null;

  const op: OpCode = parts[0] as OpCode;
  if (!['DAT', 'MOV', 'ADD', 'SUB', 'JMP', 'SPL', 'NOP'].includes(op)) return null;

  // Function to parse a field (A or B)
  const parseField = (fieldStr: string): { mode: Mode, val: number } => {
    let mode: Mode = 'DIRECT';
    let valStr = fieldStr.replace(',', '').trim();
    let val: number = 0;

    if (valStr.startsWith('#')) {
      mode = 'IMMEDIATE';
      valStr = valStr.substring(1);
    } else if (valStr.startsWith('@')) {
      mode = 'INDIRECT_B';
      valStr = valStr.substring(1);
    } else if (valStr.startsWith('<')) {
      mode = 'PREDECREMENT_A'; // Simplification, should be Pre-decrement B
      valStr = valStr.substring(1);
    } else if (valStr.startsWith('$')) {
        valStr = valStr.substring(1);
    }
    
    // Default to 0 if not provided for simplicity in parsing
    val = parseInt(valStr) || 0;
    return { mode, val };
  };

  let fieldA = { mode: 'DIRECT' as Mode, val: 0 };
  let fieldB = { mode: 'DIRECT' as Mode, val: 0 };

  if (parts.length > 1) {
    // Join all parts after the opcode to handle spaces around commas
    // e.g., "MOV 0, 1" splits to ["MOV", "0,", "1"], so we rejoin to "0, 1"
    const operands = parts.slice(1).join(' ');
    const fields = operands.split(',');
    if (fields[0]) {
      fieldA = parseField(fields[0]);
    }
    if (fields[1]) {
      fieldB = parseField(fields[1]);
    }
  }

  return {
    ownerId,
    op,
    modeA: fieldA.mode,
    valA: fieldA.val,
    modeB: fieldB.mode,
    valB: fieldB.val,
    modifier: 'I', // Default to 'I' (for MOV.I, ADD.I etc. which affects both fields for arithmetic)
  };
};

/**
 * Calculates the effective address based on the addressing mode.
 * @param pc The current Program Counter (base address).
 * @param mode The addressing mode.
 * @param value The value from the A or B field.
 * @param core The memory array (needed for indirect/predecrement).
 * @returns The effective address (index in the core).
 */
const getEffectiveAddress = (pc: number, mode: Mode, value: number, core: Instruction[]): number => {
  switch (mode) {
    case 'IMMEDIATE':
      // Immediate mode returns the value itself, not an address, but here we must return an address
      // for the `core` array access. In Core War, immediate is often used for *data* not addresses.
      // For core access, we treat immediate values as *relative direct* for this simplification.
      return mod(pc + value, CORE_SIZE); 
    case 'DIRECT':
      return mod(pc + value, CORE_SIZE);
    case 'INDIRECT_B': {
      // The address is PC + value, and the final address is that instruction's B-field value
      const pointerAddr = mod(pc + value, CORE_SIZE);
      return mod(pc + core[pointerAddr].valB, CORE_SIZE);
    }
    case 'PREDECREMENT_A':
      // Not fully implemented, but for simplicity, treat as Direct/Immediate for now
      return mod(pc + value, CORE_SIZE); 
    default:
      return mod(pc + value, CORE_SIZE);
  }
};

/**
 * Executes a single instruction for the current process.
 * @param core The current memory core.
 * @param warrior The warrior whose process is being executed.
 * @param process The process being executed.
 * @returns The new core state and the list of new processes.
 */
const executeInstruction = (
  core: Instruction[],
  warrior: Warrior,
  process: Process,
  processes: Process[],
  log: (message: string) => void,
): { newCore: Instruction[], newProcesses: Process[], processKilled: boolean, nextPc: number, updatedAddresses: number[] } => {
  const instruction = core[process.pc];
  const newCore = [...core];
  const newProcesses = [...processes];
  let processKilled = false;
  let nextPc = mod(process.pc + 1, CORE_SIZE);
  const updatedAddresses: number[] = [];
  
  const getVal = (pc: number, mode: Mode, value: number, field: 'A' | 'B'): number => {
      if (mode === 'IMMEDIATE') {
          return value;
      }
      const addr = getEffectiveAddress(pc, mode, value, core);
      const targetInstruction = core[addr];
      return field === 'A' ? targetInstruction.valA : targetInstruction.valB;
  };

  const addrA = getEffectiveAddress(process.pc, instruction.modeA, instruction.valA, core);
  const addrB = getEffectiveAddress(process.pc, instruction.modeB, instruction.valB, core);
  
  // Get source value (ValA) and destination field/value (ValB)
  const valA = getVal(process.pc, instruction.modeA, instruction.valA, 'A');

  switch (instruction.op) {
    case 'DAT':
      // DAT instruction kills the process
      processKilled = true;
      log(`[W${warrior.id}] Process ${process.processId} executed DAT at ${process.pc}. Killed.`);
      break;

    case 'MOV':
      // MOV.I (Move both fields). Copies instruction at A-address to B-address.
      // Source instruction is core[addrA]
      // Destination is core[addrB]
      if (instruction.modeA === 'IMMEDIATE') {
         // MOV #X, Y: Should move the immediate value X into the B-field of the instruction at Y
         // Simplified: move immediate value into ValB of instruction at addrB
         newCore[addrB] = {
             ...newCore[addrB],
             ownerId: warrior.id,
             valB: valA // Use valA since it's the immediate value
         };
         updatedAddresses.push(addrB);
      } else {
          // Standard MOV.I
          newCore[addrB] = {
              ...newCore[addrA],
              ownerId: warrior.id, // New instruction belongs to this warrior
          };
          updatedAddresses.push(addrB);
      }
      break;

    case 'ADD':
      // ADD.I: Adds A-field value to B-field value, stores result in B-field's instruction's B-field.
      newCore[addrB] = {
        ...newCore[addrB],
        ownerId: warrior.id,
        valB: mod(newCore[addrB].valB + valA, CORE_SIZE),
        // If it was ADD.F, it would also modify valA. For simplicity, we only modify valB (standard ADD.I)
      };
      updatedAddresses.push(addrB);
      break;

    case 'SUB':
      // SUB.I: Subtracts A-field value from B-field value, stores result in B-field's instruction's B-field.
      newCore[addrB] = {
        ...newCore[addrB],
        ownerId: warrior.id,
        valB: mod(newCore[addrB].valB - valA, CORE_SIZE),
      };
      updatedAddresses.push(addrB);
      break;

    case 'JMP':
      // JMP: Jumps execution to the address calculated from the A-field.
      nextPc = mod(process.pc + instruction.valA, CORE_SIZE); 
      break;

    case 'SPL': {
      // SPL: Starts a new process at the address calculated from the A-field.
      const newProcessAddr = mod(process.pc + instruction.valA, CORE_SIZE);

      if (warrior.processes.length < MAX_PROCESSES) {
        newProcesses.push({
          pc: newProcessAddr,
          processId: Math.random(), // Simple unique ID
        });
        log(`[W${warrior.id}] SPL created new process at ${newProcessAddr}`);
      }
      break;
    }
      
    case 'NOP':
    default:
      // NOP: No operation. Simply proceeds to the next instruction (+1)
      break;
  }

  return { newCore, newProcesses, processKilled, nextPc, updatedAddresses };
};


// --- WARRIOR DEFINITION TYPE ---

/** Warrior definition for UI (before loading into core) */
interface WarriorDefinition {
  id: number;
  name: string;
  redcode: string;
  color: string;
}

// --- REACT COMPONENT ---

export default function CoreWarGame() {
  // Predefined warrior colors
  const WARRIOR_COLORS = ['#4ade80', '#f87171', '#fbbf24', '#60a5fa'];
  
  // Warrior definitions (UI state)
  const [warriorDefs, setWarriorDefs] = useState<WarriorDefinition[]>([
    { id: 1, name: 'The Imp', redcode: 'MOV 0, 1', color: WARRIOR_COLORS[0] }
  ]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  
  // Track selected warrior ID based on active tab
  const selectedWarriorId = warriorDefs[activeTabIndex]?.id || 0;
  
  // Core state
  const [core, setCore] = useState<Instruction[]>([]);
  const [warriors, setWarriors] = useState<Warrior[]>([]);
  const [activeProcessIndex, setActiveProcessIndex] = useState(0);
  const [activeWarriorIndex, setActiveWarriorIndex] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [updatedAddresses, setUpdatedAddresses] = useState<Set<number>>(new Set());
  const [updatingWarriorId, setUpdatingWarriorId] = useState<number>(0);

  const log = useCallback((message: string) => {
    setLogs(prev => [new Date().toLocaleTimeString() + " " + message, ...prev.slice(0, 49)]);
  }, []);

  const resetCore = useCallback(() => {
    log("Core reset.");
    const emptyCore: Instruction[] = Array.from({ length: CORE_SIZE }, () => ({
      ownerId: 0,
      op: 'DAT',
      modeA: 'IMMEDIATE', valA: DEFAULT_DAT_VALUE,
      modeB: 'IMMEDIATE', valB: DEFAULT_DAT_VALUE,
      modifier: 'I',
    }));
    setCore(emptyCore);
    setWarriors([]);
    setActiveProcessIndex(0);
    setActiveWarriorIndex(0);
    setCycles(0);
    setIsRunning(false);
  }, [log]);

  useEffect(() => {
    resetCore();
  }, [resetCore]);


  /**
   * Calculate evenly spaced starting positions for warriors with minimum separation
   */
  const calculateWarriorPositions = useCallback((numWarriors: number): number[] => {
    const minSeparation = Math.floor(CORE_SIZE / numWarriors);
    const positions: number[] = [];
    
    for (let i = 0; i < numWarriors; i++) {
      // Evenly space warriors around the core with some randomization
      const basePos = i * minSeparation;
      const randomOffset = Math.floor(Math.random() * (minSeparation / 4)); // Add some randomness
      positions.push(mod(basePos + randomOffset, CORE_SIZE));
    }
    
    return positions;
  }, []);

  const loadWarriors = useCallback(() => {
    resetCore();

    const newCore = Array.from({ length: CORE_SIZE }, () => ({
      ownerId: 0,
      op: 'DAT' as OpCode,
      modeA: 'IMMEDIATE' as Mode, valA: DEFAULT_DAT_VALUE,
      modeB: 'IMMEDIATE' as Mode, valB: DEFAULT_DAT_VALUE,
      modifier: 'I',
    }));

    const loadedWarriors: Warrior[] = [];
    const positions = calculateWarriorPositions(warriorDefs.length);

    // Parse and load each warrior definition
    for (let w = 0; w < warriorDefs.length; w++) {
      const def = warriorDefs[w];
      const lines = def.redcode.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0 && !line.startsWith(';'));
      const instructions: Instruction[] = [];
      let loadError: string | null = null;

      for (const line of lines) {
        const instruction = parseRedcodeLine(line, def.id);
        if (instruction) {
          instructions.push(instruction);
        } else {
          loadError = `Error parsing line in ${def.name}: "${line}"`;
          break;
        }
      }

      if (loadError) {
        log(`Load Error: ${loadError}`);
        return;
      }

      const startAddr = positions[w];
      
      // Copy instructions into the core
      for (let i = 0; i < instructions.length; i++) {
        const addr = mod(startAddr + i, CORE_SIZE);
        newCore[addr] = instructions[i];
      }

      const initialProcess: Process = {
        pc: startAddr,
        processId: Math.random(),
      };

      const newWarrior: Warrior = {
        id: def.id,
        name: def.name,
        startAddr: startAddr,
        processes: [initialProcess],
      };

      loadedWarriors.push(newWarrior);
      log(`${def.name} (W${def.id}) loaded: ${instructions.length} instructions at ${startAddr}.`);
    }

    setCore(newCore);
    setWarriors(loadedWarriors);

  }, [warriorDefs, log, resetCore, calculateWarriorPositions]);

  // --- WARRIOR DEFINITION HANDLERS ---
  
  const handleTabChange = useCallback((index: number) => {
    setActiveTabIndex(index);
  }, []);

  const handleWarriorChange = useCallback((index: number, field: 'name' | 'redcode', value: string) => {
    setWarriorDefs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const handleAddWarrior = useCallback(() => {
    if (warriorDefs.length >= 4) return;
    
    const newId = Math.max(...warriorDefs.map(w => w.id)) + 1;
    const colorIndex = warriorDefs.length % WARRIOR_COLORS.length;
    
    setWarriorDefs(prev => [...prev, {
      id: newId,
      name: `Warrior ${newId}`,
      redcode: 'MOV 0, 1',
      color: WARRIOR_COLORS[colorIndex]
    }]);
    setActiveTabIndex(warriorDefs.length); // Switch to new tab
  }, [warriorDefs, WARRIOR_COLORS]);

  const handleRemoveWarrior = useCallback((index: number) => {
    if (warriorDefs.length <= 1) return; // Keep at least one
    
    setWarriorDefs(prev => prev.filter((_, i) => i !== index));
    // Adjust active tab if needed
    setActiveTabIndex(prev => Math.min(prev, warriorDefs.length - 2));
  }, [warriorDefs.length]);
  
  // --- CORE EXECUTION CYCLE ---
  const runCycle = useCallback(() => {
    if (warriors.length === 0 || !core) return;
    
    const newWarriors = [...warriors];
    let newCore = [...core];

    // Determine whose turn it is (simple round-robin between warriors)
    const currentWarriorIndex = mod(activeWarriorIndex, newWarriors.length);
    const currentWarrior = newWarriors[currentWarriorIndex];
    
    if (currentWarrior.processes.length === 0) {
        log(`${currentWarrior.name} has no processes left. Eliminated!`);
        newWarriors.splice(currentWarriorIndex, 1);
        setWarriors(newWarriors);
        // Recalculate which warrior is next
        setActiveWarriorIndex(mod(activeWarriorIndex, newWarriors.length));
        
        if (newWarriors.length === 0) {
            setIsRunning(false);
        } else if (newWarriors.length === 1) {
            const winner = newWarriors[0];
            log(`🏆 GAME OVER: ${winner.name} is the winner!`);
            setIsRunning(false);
        }
        return; // Skip cycle if warrior is removed
    }

    // Determine which process to execute for the current warrior
    const currentProcessIndex = mod(activeProcessIndex, currentWarrior.processes.length);
    const currentProcess = currentWarrior.processes[currentProcessIndex];

    const { newCore: updatedCore, newProcesses, processKilled, nextPc, updatedAddresses: changedAddrs } = executeInstruction(
      newCore,
      currentWarrior,
      currentProcess,
      currentWarrior.processes,
      log
    );

    newCore = updatedCore;
    
    // Update the set of changed addresses for visual feedback
    if (changedAddrs.length > 0) {
      setUpdatedAddresses(new Set(changedAddrs));
      setUpdatingWarriorId(currentWarrior.id);
      // Clear the flash after a short delay
      setTimeout(() => {
        setUpdatedAddresses(new Set());
        setUpdatingWarriorId(0);
      }, 150);
    }
    
    // Update the warrior's processes for the next cycle
    if (processKilled) {
      currentWarrior.processes.splice(currentProcessIndex, 1);
      // The activeProcessIndex doesn't need to advance, as the next process is now at the same index
      // If the index is now out of bounds, it will wrap around correctly in the next iteration.
    } else {
      // Update the program counter of the current process
      currentProcess.pc = nextPc;
      // Replace the old process list with the new one (handles SPL)
      currentWarrior.processes = newProcesses;
      
      // Advance to the next process in this warrior's queue
      setActiveProcessIndex(mod(currentProcessIndex + 1, currentWarrior.processes.length));
    }
    
    // Advance to the next warrior for the next overall cycle
    setActiveWarriorIndex(mod(activeWarriorIndex + 1, newWarriors.length));

    setCore(newCore);
    setWarriors(newWarriors);
    setCycles(c => c + 1);
    
  }, [warriors, core, activeWarriorIndex, activeProcessIndex, cycles, log]);

  // --- Auto-Run Effect ---
  useEffect(() => {
    let interval: number;
    if (isRunning) {
      interval = setInterval(() => {
        runCycle();
        if (warriors.length === 0) {
          clearInterval(interval);
          setIsRunning(false);
        }
      }, 50); // Run at a reasonable speed

      return () => clearInterval(interval);
    }
  }, [isRunning, runCycle, warriors.length]);

  const toggleRun = () => setIsRunning(prev => !prev);
  const step = () => runCycle();

  // --- UI RENDERING ---


  return (
    <div className="corewar-container">
      <div className="corewar-content">
        <h1 className="corewar-title">
          Core War Redcode Emulator (MARS)
        </h1>

        <div className="corewar-layout">
          
          {/* CONTROL PANEL & REDCODE INPUT */}
          <div className="control-column">
            <TabbedWarriorDefinition
              warriorDefs={warriorDefs}
              activeTabIndex={activeTabIndex}
              onTabChange={handleTabChange}
              onWarriorChange={handleWarriorChange}
              onAddWarrior={handleAddWarrior}
              onRemoveWarrior={handleRemoveWarrior}
              onLoadWarriors={loadWarriors}
              onToggleRun={toggleRun}
              onStep={step}
              onReset={resetCore}
              isRunning={isRunning}
              hasWarriors={warriors.length > 0}
            />
          </div>

          {/* CORE DISPLAY */}
          <div className="display-column">
            <div className="panel memory-grid-panel">
              <h2 className="panel-title">Core Memory Visualization ({CORE_SIZE} cells)</h2>
              <div className="memory-grid-wrapper">
                <MemoryGrid 
                  core={core} 
                  coreSize={CORE_SIZE}
                  warriorColors={WARRIOR_COLORS}
                  updatedAddresses={updatedAddresses}
                />
              </div>
            </div>
            
            <CoreMemorySnippet
              core={core}
              warriors={warriors}
              warriorDefs={warriorDefs}
              selectedWarriorId={selectedWarriorId}
              updatedAddresses={updatedAddresses}
              updatingWarriorId={updatingWarriorId}
            />
          </div>
        </div>
        
        {/* LOGS */}
        <div className="panel log-container">
            <h2 className="panel-title">Execution Log</h2>
            <div className="log-layout">
              <div className="log-stats">
                <div className="log-stat-item">
                  <div className="log-stat-label">Cycle</div>
                  <div className="log-stat-value">{cycles}</div>
                </div>
                <div className="log-stat-item">
                  <div className="log-stat-label">Warriors</div>
                  <div className="log-stat-value">{warriors.length}</div>
                </div>
                <div className="log-stat-item">
                  <div className="log-stat-label">Processes</div>
                  <div className="log-stat-value">{warriors.reduce((sum, w) => sum + w.processes.length, 0)}</div>
                </div>
              </div>
              <div className="log-content">
                  {logs.map((log, index) => (
                      <p key={index} className="log-entry">{log}</p>
                  ))}
              </div>
            </div>
        </div>
        
      </div>
    </div>
  );
}
