import { JSX } from 'preact';

interface WarriorDefinitionProps {
  redcode: string;
  onRedcodeChange: (value: string) => void;
  onLoadWarrior: () => void;
  onToggleRun: () => void;
  onStep: () => void;
  onReset: () => void;
  isRunning: boolean;
  hasWarriors: boolean;
  status: string;
  cycles: number;
  warriorCount: number;
  processCount: number;
}

export default function WarriorDefinition({
  redcode,
  onRedcodeChange,
  onLoadWarrior,
  onToggleRun,
  onStep,
  onReset,
  isRunning,
  hasWarriors,
  status,
  cycles,
  warriorCount,
  processCount,
}: WarriorDefinitionProps): JSX.Element {
  return (
    <div className="panel">
      <h2 className="panel-title">Warrior Definition</h2>
      <textarea
        value={redcode}
        onInput={(e) => onRedcodeChange((e.target as HTMLTextAreaElement).value)}
        rows={8}
        className="redcode-editor"
        placeholder="Enter Redcode here (e.g., MOV 0, 1)"
      />
      <button
        type="button"
        onClick={onLoadWarrior}
        className="load-warrior-button"
      >
        Load Warrior
      </button>
      
      {/* CONTROLS */}
      <div className="controls-buttons" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          onClick={onToggleRun}
          disabled={!hasWarriors}
          className={`button ${isRunning ? 'button-pause' : 'button-run'}`}
          title={isRunning ? 'Pause' : 'Run'}
        >
          {isRunning ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          onClick={onStep}
          disabled={isRunning || !hasWarriors}
          className="button button-step"
          title="Step Cycle"
        >
          ⏭
        </button>
        <button
          type="button"
          onClick={onReset}
          className="button button-reset"
          title="Reset"
        >
          ↻
        </button>
      </div>
      <div className="status-info">
        <p>Status: <span className="status-value">{status}</span></p>
        <p>Cycle: <span className="status-value">{cycles}</span></p>
        <p>Warriors: <span className="status-value">{warriorCount}</span></p>
        <p>Processes: <span className="status-value">{processCount}</span></p>
      </div>
    </div>
  );
}
