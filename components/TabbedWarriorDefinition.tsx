import { JSX } from 'preact';

interface WarriorDefinition {
  id: number;
  name: string;
  redcode: string;
  color: string;
}

interface TabbedWarriorDefinitionProps {
  warriorDefs: WarriorDefinition[];
  activeTabIndex: number;
  onTabChange: (index: number) => void;
  onWarriorChange: (index: number, field: 'name' | 'redcode', value: string) => void;
  onAddWarrior: () => void;
  onRemoveWarrior: (index: number) => void;
  onLoadWarriors: () => void;
  onToggleRun: () => void;
  onStep: () => void;
  onReset: () => void;
  isRunning: boolean;
  hasWarriors: boolean;
  maxWarriors?: number;
}

export default function TabbedWarriorDefinition({
  warriorDefs,
  activeTabIndex,
  onTabChange,
  onWarriorChange,
  onAddWarrior,
  onRemoveWarrior,
  onLoadWarriors,
  onToggleRun,
  onStep,
  onReset,
  isRunning,
  hasWarriors,
  maxWarriors = 4,
}: TabbedWarriorDefinitionProps): JSX.Element {
  const canAddWarrior = warriorDefs.length < maxWarriors;
  const canRemoveWarrior = warriorDefs.length > 1;
  const activeWarrior = warriorDefs[activeTabIndex];

  return (
    <div className="panel">
      <h2 className="panel-title">Warrior Definitions</h2>
      
      {/* Tabs */}
      <div className="warrior-tabs">
        {warriorDefs.map((def, index) => (
          <button
            key={def.id}
            type="button"
            onClick={() => onTabChange(index)}
            className={`warrior-tab ${index === activeTabIndex ? 'warrior-tab-active' : ''}`}
            style={{
              borderBottomColor: index === activeTabIndex ? def.color : 'transparent',
            }}
          >
            <span 
              className="warrior-tab-color-indicator"
              style={{ backgroundColor: def.color }}
            />
            {def.name || `Warrior ${def.id}`}
          </button>
        ))}
        
        {canAddWarrior && (
          <button
            type="button"
            onClick={onAddWarrior}
            className="warrior-tab warrior-tab-add"
            title={`Add warrior (${warriorDefs.length}/${maxWarriors})`}
          >
            + Add
          </button>
        )}
      </div>

      {/* Active Warrior Editor */}
      {activeWarrior && (
        <div className="warrior-editor">
          <div className="warrior-name-row">
            <label className="warrior-label">
              Name:
              <input
                type="text"
                value={activeWarrior.name}
                onInput={(e) => onWarriorChange(activeTabIndex, 'name', (e.target as HTMLInputElement).value)}
                className="warrior-name-input"
                placeholder={`Warrior ${activeWarrior.id}`}
                maxLength={30}
              />
            </label>
            
            {canRemoveWarrior && (
              <button
                type="button"
                onClick={() => onRemoveWarrior(activeTabIndex)}
                className="warrior-remove-button"
                title="Remove this warrior"
              >
                × Remove
              </button>
            )}
          </div>
          
          <textarea
            value={activeWarrior.redcode}
            onInput={(e) => onWarriorChange(activeTabIndex, 'redcode', (e.target as HTMLTextAreaElement).value)}
            rows={8}
            className="redcode-editor"
            placeholder="Enter Redcode here (e.g., MOV 0, 1)"
          />
        </div>
      )}
      
      <button
        type="button"
        onClick={onLoadWarriors}
        className="load-warrior-button"
      >
        Load All Warriors ({warriorDefs.length})
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
    </div>
  );
}
