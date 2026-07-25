import { createElement, type ElementType, type ReactNode } from 'react';

interface AdminPanelProps {
  title?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  as?: ElementType;
  className?: string;
  contentClassName?: string;
  labelledBy?: string;
}

export function AdminPanel({
  title,
  description,
  eyebrow,
  toolbar,
  children,
  footer,
  as: Component = 'section',
  className = '',
  contentClassName = '',
  labelledBy,
}: AdminPanelProps) {
  const hasHeader = title || description || eyebrow || toolbar;

  const header = hasHeader ? (
    <header className="admin-panel-header">
      <div className="admin-panel-heading">
        {eyebrow ? <p className="admin-panel-eyebrow">{eyebrow}</p> : null}
        {title ? <h2 id={labelledBy} className="admin-panel-title">{title}</h2> : null}
        {description ? <p className="admin-panel-description">{description}</p> : null}
      </div>
      {toolbar ? <div className="admin-panel-toolbar">{toolbar}</div> : null}
    </header>
  ) : null;

  return createElement(
    Component,
    {
      className: `admin-panel ${className}`,
      'aria-labelledby': labelledBy,
    },
    header,
    <div key="content" className={`admin-panel-content ${contentClassName}`}>{children}</div>,
    footer ? <footer key="footer" className="admin-panel-footer">{footer}</footer> : null,
  );
}
