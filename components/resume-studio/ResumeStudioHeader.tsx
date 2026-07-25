'use client';

import type { ReactNode } from 'react';
import { ResumeStudioProgress, type ResumeStudioStage } from './ResumeStudioProgress';

interface ResumeStudioHeaderProps {
  current: ResumeStudioStage;
  candidateName?: string;
  candidateDetail?: string;
  targetLabel?: string;
  saveLabel?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}

export function ResumeStudioHeader({
  current,
  candidateName,
  candidateDetail,
  targetLabel,
  saveLabel = 'Saved locally',
  primaryAction,
  secondaryAction,
}: ResumeStudioHeaderProps) {
  return (
    <header className="resume-studio-header">
      <div className="resume-studio-header__top">
        <div className="resume-studio-header__brand">
          <span className="material-symbols-rounded" aria-hidden="true">description</span>
          <strong>Resume Studio</strong>
        </div>

        <ResumeStudioProgress current={current} />

        <div className="resume-studio-header__context" aria-label="Resume Studio context">
          <div className="resume-studio-header__context-item">
            <span className="material-symbols-rounded" aria-hidden="true">person</span>
            <p>
              <strong>{candidateName || 'New resume'}</strong>
              <span>{candidateDetail || 'Candidate'}</span>
            </p>
          </div>
          <div className="resume-studio-header__context-item">
            <span className="material-symbols-rounded" aria-hidden="true">work</span>
            <p>
              <strong>{targetLabel || 'Role target pending'}</strong>
              <span>Target role</span>
            </p>
          </div>
          <div className="resume-studio-header__context-item is-trust">
            <span className="material-symbols-rounded" aria-hidden="true">verified_user</span>
            <p>
              <strong>Truth Lock on</strong>
              <span>{saveLabel}</span>
            </p>
          </div>
        </div>

        {(primaryAction || secondaryAction) && (
          <div className="resume-studio-header__actions">
            {secondaryAction}
            {primaryAction}
          </div>
        )}
      </div>
    </header>
  );
}
