import { X } from 'lucide-react';
import { SYSTEM_BUCKETS, ALLOWED_EXPERIMENT_BUCKETS } from '../../config/constants';

interface ExperimentsTabProps {
  expList: string[];
  isStaff: boolean;
  handleRemoveExperiment: (exp: string) => void;
  expInput: string;
  setExpInput: (val: string) => void;
  handleAddExperiment: () => void;
  loading: boolean;
  handleSaveExperiments: () => void;
}

export default function ExperimentsTab({
  expList, isStaff, handleRemoveExperiment, expInput, setExpInput, handleAddExperiment, loading, handleSaveExperiments
}: ExperimentsTabProps) {
  return (
    <div className="auth-form">
      <div className="auth-exp-info">
        Experiment Buckets control custom UI behaviors, dynamic layout variants, and algorithm feature flags assigned to your account.
      </div>

      <div className="auth-exp-container">
        <div className="auth-exp-header">EXPERIMENTS: []</div>
        <div className="auth-flex-wrap">
          {expList.map((exp) => {
            const isSystemBucket = SYSTEM_BUCKETS.includes(exp);
            const canRemove = isStaff || !isSystemBucket;
            return (
              <span 
                key={exp} 
                className={`auth-exp-badge ${isSystemBucket ? 'system' : ''}`}
              >
                {exp} {isSystemBucket && <span className="auth-exp-allowed">(System)</span>}
                {canRemove && (
                  <X size={12} color="#aaa" className="auth-exp-badge-remove" onClick={() => handleRemoveExperiment(exp)} />
                )}
              </span>
            );
          })}
          {expList.length === 0 && <span className="auth-exp-info">No active experiment buckets.</span>}
        </div>
      </div>

      <div className="auth-flex-row">
        <input 
          type="text" 
          placeholder="e.g. 2026-07_auto_play_next_video"
          value={expInput}
          onChange={(e) => setExpInput(e.target.value)}
          className="auth-input"
        />
        <button onClick={handleAddExperiment} className="auth-signout-btn">
          Add Bucket
        </button>
      </div>
      <div className="auth-exp-allowed">
        Allowed buckets: {ALLOWED_EXPERIMENT_BUCKETS.join(', ')}
      </div>

      <button 
        onClick={handleSaveExperiments}
        disabled={loading}
        className="auth-btn-primary"
      >
        Save Experiment Buckets
      </button>
    </div>
  );
}
