'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface AdminSegmentOption<Value extends string> {
  value: Value;
  label: ReactNode;
  disabled?: boolean;
}

interface AdminSegmentedControlProps<Value extends string> {
  value: Value;
  options: readonly AdminSegmentOption<Value>[];
  label: string;
  onChange: (value: Value) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function AdminSegmentedControl<Value extends string>({
  value,
  options,
  label,
  onChange,
  size = 'sm',
  className = '',
}: AdminSegmentedControlProps<Value>) {
  const groupRef = useRef<HTMLDivElement>(null);

  function moveSelection(event: KeyboardEvent<HTMLDivElement>, direction: -1 | 1) {
    event.preventDefault();
    const enabledOptions = options.filter(option => !option.disabled);
    if (!enabledOptions.length) return;
    const currentIndex = enabledOptions.findIndex(option => option.value === value);
    const nextIndex = (Math.max(currentIndex, 0) + direction + enabledOptions.length) % enabledOptions.length;
    const next = enabledOptions[nextIndex];
    onChange(next.value);
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)');
    buttons?.[nextIndex]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      className={`admin-segmented-control is-${size} ${className}`}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') moveSelection(event, -1);
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') moveSelection(event, 1);
        if (event.key === 'Home') {
          event.preventDefault();
          const first = options.find(option => !option.disabled);
          if (first) onChange(first.value);
        }
        if (event.key === 'End') {
          event.preventDefault();
          const last = [...options].reverse().find(option => !option.disabled);
          if (last) onChange(last.value);
        }
      }}
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className="admin-segmented-option"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
