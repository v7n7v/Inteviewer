'use client';

export type ResumeStudioStage = 'source' | 'target' | 'shape' | 'review' | 'design' | 'ship';

const STAGES: { id: ResumeStudioStage; label: string }[] = [
  { id: 'source', label: 'Source' },
  { id: 'target', label: 'Target' },
  { id: 'shape', label: 'Shape' },
  { id: 'review', label: 'Review' },
  { id: 'design', label: 'Design' },
  { id: 'ship', label: 'Ship' },
];

export function ResumeStudioProgress({ current }: { current: ResumeStudioStage }) {
  const currentIndex = STAGES.findIndex(stage => stage.id === current);

  return (
    <nav className="resume-studio-progress" aria-label="Resume Studio progress">
      <ol>
        {STAGES.map((stage, index) => {
          const isCurrent = stage.id === current;
          const isComplete = index < currentIndex;
          return (
            <li
              key={stage.id}
              className={isCurrent ? 'is-current' : isComplete ? 'is-complete' : undefined}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="resume-studio-progress__marker" aria-hidden="true">
                {isComplete
                  ? <span className="material-symbols-rounded">check</span>
                  : index + 1}
              </span>
              <span className="resume-studio-progress__label">{stage.label}</span>
              {isComplete && <span className="sr-only">Completed</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
