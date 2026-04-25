'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { getResumeVersions, type ResumeVersion } from '@/lib/database-suite';
import { showToast } from '@/components/Toast';

interface ResumeLibraryPickerProps {
  onSelect: (resume: ResumeVersion) => void;
  selectedId?: string | null;
  selectedName?: string;
  compact?: boolean;
}

export default function ResumeLibraryPicker({
  onSelect,
  selectedId,
  selectedName,
  compact = false,
}: ResumeLibraryPickerProps) {
  const { user } = useStore();
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    getResumeVersions()
      .then(r => { if (r.success && r.data) setResumes(r.data); })
      .finally(() => setLoading(false));
  }, [user]);

  if (!user || (resumes.length === 0 && !loading)) return null;

  const handleSelect = (rv: ResumeVersion) => {
    onSelect(rv);
    setOpen(false);
    showToast(`Loaded: ${rv.version_name}`, 'check_circle');
  };

  return (
    <>
      {/* Trigger row */}
      <div className="flex items-center gap-2">
        {/* Selected indicator */}
        {selectedId && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="material-symbols-rounded text-[14px] text-emerald-500">check_circle</span>
            <span className="text-[11px] font-semibold text-emerald-500 max-w-[120px] truncate">
              {selectedName || 'Resume loaded'}
            </span>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
        >
          <span className="material-symbols-rounded text-[14px] text-blue-500">description</span>
          {!compact && (
            <span className="text-[11px] font-semibold text-blue-500">
              {resumes.length > 0 ? `Resumes (${resumes.length})` : 'Resumes'}
            </span>
          )}
        </button>
      </div>

      {/* Expandable panel */}
      <AnimatePresence>
        {open && resumes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden col-span-full"
          >
            <div
              className="rounded-2xl p-5 mt-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span className="material-symbols-rounded text-blue-500 text-lg">description</span>
                  Select a resume to work with
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <span className="material-symbols-rounded text-lg">close</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {resumes.map(rv => (
                  <button
                    key={rv.id}
                    onClick={() => handleSelect(rv)}
                    className={`p-3 rounded-xl text-left transition-all border ${
                      selectedId === rv.id
                        ? 'border-blue-500/40 bg-blue-500/10'
                        : 'border-[var(--border-subtle)] hover:border-[var(--text-tertiary)]'
                    }`}
                    style={{ background: selectedId === rv.id ? undefined : 'var(--bg-elevated)' }}
                  >
                    <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">
                      {rv.version_name}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                      {new Date(rv.created_at).toLocaleDateString()}
                      {rv.mode ? ` • ${rv.mode}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
