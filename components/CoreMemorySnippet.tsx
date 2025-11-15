import { useMemo, useState } from 'preact/hooks';

/** The memory size for the Core War simulator. */
const CORE_SIZE = 8000;

/** Structure of a single instruction in the core. */
interface Instruction {
  ownerId: number;
  op: string;
  modeA: string;
  valA: number;
  modeB: string;
  valB: number;
  modifier: string;
}

/** Structure of a single running process. */
interface Process {
  pc: number;
  processId: number;
}

/** Structure of a warrior. */
interface Warrior {
  id: number;
  name: string;
  startAddr: number;
  processes: Process[];
}

/** Warrior definition for UI. */
interface WarriorDefinition {
  id: number;
  name: string;
  redcode: string;
  color: string;
}

interface CoreMemorySnippetProps {
  core: Instruction[];
  warriors: Warrior[];
  warriorDefs: WarriorDefinition[];
  selectedWarriorId: number;
  updatedAddresses: Set<number>;
  updatingWarriorId: number;
}

/** Helper function for modulo arithmetic */
const mod = (n: number, m: number): number => {
  return ((n % m) + m) % m;
};

export default function CoreMemorySnippet({
  core,
  warriors,
  warriorDefs,
  selectedWarriorId,
  updatedAddresses,
  updatingWarriorId
}: CoreMemorySnippetProps) {
  
  const [isOpen, setIsOpen] = useState(false);
  
  const coreSnippet = useMemo(() => {
    // Skip computation when closed to save CPU time
    if (!isOpen) return [];
    
    if (!core.length) return [];
    
    // Find the selected warrior and their active process
    const selectedWarrior = warriors.find(w => w.id === selectedWarriorId);
    if (!selectedWarrior || selectedWarrior.processes.length === 0) {
      return [];
    }
    
    // Use the first process of the selected warrior as the center point
    const selectedWarriorPC = selectedWarrior.processes[0].pc;
    
    const windowSize = 25; // Display 25 instructions around the PC
    const start = mod(selectedWarriorPC - Math.floor(windowSize / 2), CORE_SIZE);
    
    const snippet = [];
    for (let i = 0; i < windowSize; i++) {
      const addr = mod(start + i, CORE_SIZE);
      const instruction = core[addr];
      
      // ONLY show instructions that belong to the selected warrior OR were just updated by them
      const belongsToSelected = instruction.ownerId === selectedWarriorId;
      const isUpdatedBySelected = updatedAddresses.has(addr) && updatingWarriorId === selectedWarriorId;
      
      // Skip instructions that don't belong to the selected warrior (unless they're empty DAT cells for context)
      if (!belongsToSelected && !isUpdatedBySelected && instruction.ownerId !== 0) {
        continue; // Skip this instruction entirely
      }
      
      // Check if any process of the selected warrior is at this address
      const isPC = selectedWarrior.processes.some(p => p.pc === addr);
      
      // Find which warrior owns this instruction
      const owner = warriors.find(w => w.id === instruction.ownerId);
      const ownerDef = warriorDefs.find(d => d.id === instruction.ownerId);
      
      const instructionText = `${instruction.op}${instruction.modifier === 'I' ? '' : '.' + instruction.modifier} ${instruction.modeA === 'IMMEDIATE' ? '#' : instruction.modeA === 'INDIRECT_B' ? '@' : ''}${instruction.valA}, ${instruction.modeB === 'IMMEDIATE' ? '#' : instruction.modeB === 'INDIRECT_B' ? '@' : ''}${instruction.valB}`;

      snippet.push({
        addr,
        instruction: instructionText,
        ownerId: instruction.ownerId,
        ownerName: owner?.name || 'None',
        ownerColor: ownerDef?.color || '#6b7280',
        isPC: isPC,
        isUpdated: isUpdatedBySelected,
      });
    }
    return snippet;
  }, [core, warriors, warriorDefs, selectedWarriorId, updatedAddresses, updatingWarriorId, isOpen]);

  return (
    <div className="panel">
      <h2 className="panel-title" onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        Core Memory Snippet (Selected Warrior) {isOpen ? '▼' : '▶'}
      </h2>
      {isOpen && (
        <div className="core-memory-container">
          {coreSnippet.map((c) => (
            <div 
              key={c.addr} 
              className={`core-memory-row ${c.isPC ? 'core-memory-row-active' : c.ownerId !== 0 ? 'core-memory-row-owned' : ''}`}
            >
              <span className="core-memory-address">{c.addr.toString().padStart(4, '0')}</span>
              <span 
                className="core-memory-instruction"
                style={{ color: c.ownerId !== 0 ? c.ownerColor : '#9ca3af' }}
              >
                {c.instruction}
              </span>
              <span className="core-memory-owner" style={{ color: c.ownerColor }}>
                {c.ownerId !== 0 ? c.ownerName : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
