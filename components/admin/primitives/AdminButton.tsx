import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type AdminButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type AdminButtonSize = 'sm' | 'md';

interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  icon?: string;
  trailingIcon?: string;
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  busy?: boolean;
}

export function AdminButton({
  children,
  icon,
  trailingIcon,
  variant = 'secondary',
  size = 'md',
  busy = false,
  className = '',
  disabled,
  type = 'button',
  ...props
}: AdminButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`admin-button is-${variant} is-${size} ${className}`}
      {...props}
    >
      {busy ? (
        <span className="material-symbols-rounded admin-button-spinner" aria-hidden="true">progress_activity</span>
      ) : icon ? (
        <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>
      ) : null}
      <span>{children}</span>
      {trailingIcon ? <span className="material-symbols-rounded" aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  );
}
