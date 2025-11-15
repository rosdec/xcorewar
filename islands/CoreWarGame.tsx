import { useState, useCallback, useEffect, useMemo } from 'preact/hooks';
import '../assets/corewar-game.css';

// --- CORE WAR TYPES AND CONSTANTS ---

// Using a simplified ICWS '94 subset for the initial implementation

/** The memory size for the Core War simulator. A standard size is 8000. */
const CORE_SIZE = 8000;
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
): { newCore: Instruction[], newProcesses: Process[], processKilled: boolean, nextPc: number } => {
  const instruction = core[process.pc];
  let newCore = [...core];
  let newProcesses = [...processes];
  let processKilled = false;
  let nextPc = mod(process.pc + 1, CORE_SIZE);
  
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
  const valB = getVal(process.pc, instruction.modeB, instruction.valB, 'B');

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
      } else {
          // Standard MOV.I
          newCore[addrB] = {
              ...newCore[addrA],
              ownerId: warrior.id, // New instruction belongs to this warrior
          };
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
      break;

    case 'SUB':
      // SUB.I: Subtracts A-field value from B-field value, stores result in B-field's instruction's B-field.
      newCore[addrB] = {
        ...newCore[addrB],
        ownerId: warrior.id,
        valB: mod(newCore[addrB].valB - valA, CORE_SIZE),
      };
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

  return { newCore, newProcesses, processKilled, nextPc };
};


// --- REACT COMPONENT ---

export default function CoreWarGame() {
  const initialRedcode = "MOV 0, 1\nDAT #0, #0";
  const [redcode, setRedcode] = useState(initialRedcode);
  const [core, setCore] = useState<Instruction[]>([]);
  const [warriors, setWarriors] = useState<Warrior[]>([]);
  const [activeProcessIndex, setActiveProcessIndex] = useState(0);
  const [activeWarriorIndex, setActiveWarriorIndex] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState("Ready to load warrior.");

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
    setStatus("Core initialized.");
  }, [log]);

  useEffect(() => {
    resetCore();
  }, [resetCore]);


  const loadWarrior = useCallback(() => {
    resetCore();

    const warriorId = 1;
    let newCore = Array.from({ length: CORE_SIZE }, () => ({
      ownerId: 0,
      op: 'DAT' as OpCode,
      modeA: 'IMMEDIATE' as Mode, valA: DEFAULT_DAT_VALUE,
      modeB: 'IMMEDIATE' as Mode, valB: DEFAULT_DAT_VALUE,
      modifier: 'I',
    }));

    const lines = redcode.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith(';'));
    let instructions: Instruction[] = [];
    let loadError: string | null = null;

    for (const line of lines) {
      const instruction = parseRedcodeLine(line, warriorId);
      if (instruction) {
        instructions.push(instruction);
      } else {
        loadError = `Error parsing line: "${line}"`;
        break;
      }
    }

    if (loadError) {
      log(`Load Error: ${loadError}`);
      setStatus(`Load failed: ${loadError}`);
      return;
    }

    // Place warrior at a random, safe location (e.g., CORE_SIZE / 4)
    const startAddr = Math.floor(Math.random() * (CORE_SIZE / 2)); 
    
    // Copy instructions into the new core
    for (let i = 0; i < instructions.length; i++) {
      const addr = mod(startAddr + i, CORE_SIZE);
      newCore[addr] = instructions[i];
    }

    const initialProcess: Process = {
      pc: startAddr,
      processId: Math.random(),
    };

    const newWarrior: Warrior = {
      id: warriorId,
      name: 'The Imp', // Or user-provided name
      startAddr: startAddr,
      processes: [initialProcess],
    };

    setCore(newCore);
    setWarriors([newWarrior]);
    setStatus(`Warrior loaded at address ${startAddr}. Core ready.`);
    log(`Warrior 1 loaded: ${instructions.length} instructions at ${startAddr}.`);

  }, [redcode, log, resetCore]);
  
  // --- CORE EXECUTION CYCLE ---
  const runCycle = useCallback(() => {
    if (warriors.length === 0 || !core) return;
    
    let newWarriors = [...warriors];
    let newCore = [...core];

    // Determine whose turn it is (simple round-robin between warriors)
    const currentWarriorIndex = mod(activeWarriorIndex, newWarriors.length);
    const currentWarrior = newWarriors[currentWarriorIndex];
    
    if (currentWarrior.processes.length === 0) {
        log(`Warrior ${currentWarrior.id} has no processes left. Removing.`);
        newWarriors.splice(currentWarriorIndex, 1);
        setWarriors(newWarriors);
        // Recalculate which warrior is next
        setActiveWarriorIndex(mod(activeWarriorIndex, newWarriors.length));
        if (newWarriors.length === 0) {
            setStatus("Game over! All warriors killed.");
            setIsRunning(false);
        }
        return; // Skip cycle if warrior is removed
    }

    // Determine which process to execute for the current warrior
    const currentProcessIndex = mod(activeProcessIndex, currentWarrior.processes.length);
    const currentProcess = currentWarrior.processes[currentProcessIndex];

    const { newCore: updatedCore, newProcesses, processKilled, nextPc } = executeInstruction(
      newCore,
      currentWarrior,
      currentProcess,
      currentWarrior.processes,
      log
    );

    newCore = updatedCore;
    
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
    setStatus(`Cycle ${cycles + 1}: Executed W${currentWarrior.id} at PC ${currentProcess.pc}.`);
    
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

  // Generate a snippet of the core around the active PC for display
  const activeWarrior = warriors[activeWarriorIndex];
  const activePC = activeWarrior?.processes[mod(activeProcessIndex, activeWarrior.processes.length)]?.pc ?? 0;
  
  const coreSnippet = useMemo(() => {
    if (!core.length) return [];
    const windowSize = 25; // Display 25 instructions around the PC
    const start = mod(activePC - Math.floor(windowSize / 2), CORE_SIZE);
    
    let snippet = [];
    for (let i = 0; i < windowSize; i++) {
      const addr = mod(start + i, CORE_SIZE);
      const instruction = core[addr];
      
      // Check if any process is at this address
      const isPC = warriors.some(w => w.processes.some(p => p.pc === addr));
      
      const instructionText = `${instruction.op}${instruction.modifier === 'I' ? '' : '.' + instruction.modifier} ${instruction.modeA === 'IMMEDIATE' ? '#' : instruction.modeA === 'INDIRECT_B' ? '@' : ''}${instruction.valA}, ${instruction.modeB === 'IMMEDIATE' ? '#' : instruction.modeB === 'INDIRECT_B' ? '@' : ''}${instruction.valB}`;

      snippet.push({
        addr,
        instruction: instructionText,
        ownerId: instruction.ownerId,
        isPC: isPC,
      });
    }
    return snippet;
  }, [core, activePC, warriors]);


  return (
    <div className="corewar-container">
      <div className="corewar-content">
        <h1 className="corewar-title">
          Core War Redcode Emulator (MARS)
        </h1>

        <div className="corewar-layout">
          
          {/* CONTROL PANEL & REDCODE INPUT */}
          <div className="control-column">
            <div className="panel">
              <h2 className="panel-title">Warrior Definition</h2>
              <textarea
                value={redcode}
                onInput={(e) => setRedcode((e.target as HTMLTextAreaElement).value)}
                rows={8}
                className="redcode-editor"
                placeholder="Enter Redcode here (e.g., MOV 0, 1)"
              />
              <button
                onClick={loadWarrior}
                className="load-warrior-button"
              >
                Load Warrior
              </button>
            </div>
            
            {/* CONTROLS */}
            <div className="panel">
              <h2 className="panel-title">Controls</h2>
              <div className="controls-buttons">
                <button
                  onClick={toggleRun}
                  disabled={warriors.length === 0}
                  className={`button ${isRunning ? 'button-pause' : 'button-run'}`}
                >
                  {isRunning ? 'Pause' : 'Run'}
                </button>
                <button
                  onClick={step}
                  disabled={isRunning || warriors.length === 0}
                  className="button button-step"
                >
                  Step Cycle
                </button>
                <button
                  onClick={resetCore}
                  className="button button-reset"
                >
                  Reset
                </button>
              </div>
              <div className="status-info">
                <p>Status: <span className="status-value">{status}</span></p>
                <p>Cycle: <span className="status-value">{cycles}</span></p>
                <p>Warriors: <span className="status-value">{warriors.length}</span></p>
                <p>Processes: <span className="status-value">{warriors.reduce((sum, w) => sum + w.processes.length, 0)}</span></p>
              </div>
            </div>
          </div>

          {/* CORE DISPLAY */}
          <div className="display-column">
            <div className="panel">
              <h2 className="panel-title">Core Memory Snippet (PC Centered)</h2>
              <div className="core-memory-container">
                {coreSnippet.map((c) => (
                  <div 
                    key={c.addr} 
                    className={`core-memory-row ${c.isPC ? 'core-memory-row-active' : c.ownerId !== 0 ? 'core-memory-row-owned' : ''}`}
                  >
                    <span className="core-memory-address">{c.addr.toString().padStart(4, '0')}</span>
                    <span className={`core-memory-instruction ${c.ownerId === 1 ? 'core-memory-instruction-warrior1' : 'core-memory-instruction-warrior2'}`}>{c.instruction}</span>
                    <span className="core-memory-owner">W{c.ownerId}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* LOGS */}
        <div className="panel log-container">
            <h2 className="panel-title">Execution Log</h2>
            <div className="log-content">
                {logs.map((log, index) => (
                    <p key={index} className="log-entry">{log}</p>
                ))}
            </div>
        </div>
        
      </div>
    </div>
  );
}
