'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { AriaAttributes, MouseEventHandler, ReactNode } from 'react';

export interface NavigationRailRowProps {
    icon: ReactNode;
    label: string;
    description?: string;
    active?: boolean;
    trailing?: ReactNode;
    compact?: boolean;
    href?: string;
    onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
    className?: string;
    iconClassName?: string;
    markerLayoutId?: string;
    title?: string;
    interactive?: boolean;
    ariaLabel?: string;
    ariaCurrent?: AriaAttributes['aria-current'];
    ariaPressed?: boolean;
    ariaExpanded?: boolean;
    ariaControls?: string;
    role?: string;
    tabIndex?: number;
    disabled?: boolean;
}

const inactiveClasses = [
    'text-[var(--text-secondary)]',
    'hover:bg-[var(--theme-surface-hover)]',
    'hover:text-[var(--text-primary)]',
    'border-transparent',
].join(' ');

const activeClasses = [
    'bg-[var(--theme-surface-active)]',
    'text-[var(--text-primary)]',
    'border-[var(--theme-border)]',
    'shadow-lg',
].join(' ');

function NavigationRailRowContent({
    icon,
    label,
    description,
    active,
    trailing,
    compact,
    iconClassName,
    markerLayoutId,
}: Pick<
    NavigationRailRowProps,
    | 'icon'
    | 'label'
    | 'description'
    | 'active'
    | 'trailing'
    | 'compact'
    | 'iconClassName'
    | 'markerLayoutId'
>) {
    const materialSymbol = typeof icon === 'string';

    return (
        <>
            <span
                aria-hidden="true"
                className={[
                    'flex h-6 w-6 shrink-0 items-center justify-center text-2xl leading-none',
                    compact ? '' : 'mr-2',
                    materialSymbol ? 'material-symbols-rounded' : '',
                    iconClassName || '',
                ].join(' ')}
            >
                {icon}
            </span>

            {!compact && (
                <span className="min-w-0 flex-1">
                    <span
                        className={[
                            'block truncate text-sm font-medium leading-5',
                            active ? 'text-[var(--text-primary)]' : '',
                        ].join(' ')}
                    >
                        {label}
                    </span>
                    {description && (
                        <span className="block truncate text-xs leading-4 text-[var(--text-secondary)]">
                            {description}
                        </span>
                    )}
                </span>
            )}

            {!compact && trailing}

            {!compact && active && (
                <motion.span
                    layoutId={markerLayoutId}
                    aria-hidden="true"
                    className="h-8 w-1.5 shrink-0 rounded-full bg-emerald-500"
                />
            )}

            {compact && active && (
                <motion.span
                    layoutId={markerLayoutId}
                    aria-hidden="true"
                    className="absolute right-1 h-8 w-1.5 rounded-full bg-emerald-500"
                />
            )}
        </>
    );
}

export function NavigationRailRow({
    icon,
    label,
    description,
    active = false,
    trailing,
    compact = false,
    href,
    onClick,
    className = '',
    iconClassName = '',
    markerLayoutId,
    title,
    interactive = true,
    ariaLabel,
    ariaCurrent,
    ariaPressed,
    ariaExpanded,
    ariaControls,
    role,
    tabIndex,
    disabled = false,
}: NavigationRailRowProps) {
    const rootClassName = [
        'group relative w-full border text-left transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg-card)]',
        compact
            ? 'flex min-h-11 items-center justify-center gap-0 rounded-xl px-2 py-2'
            : 'flex min-h-[62px] items-center gap-3 rounded-xl px-4 py-3',
        active ? activeClasses : inactiveClasses,
        disabled ? 'cursor-not-allowed opacity-50' : '',
        className,
    ].join(' ');

    const content = (
        <NavigationRailRowContent
            icon={icon}
            label={label}
            description={description}
            active={active}
            trailing={trailing}
            compact={compact}
            iconClassName={iconClassName}
            markerLayoutId={markerLayoutId}
        />
    );

    if (!interactive) {
        return (
            <div
                className={rootClassName}
                aria-label={ariaLabel}
                aria-current={ariaCurrent}
                aria-expanded={ariaExpanded}
                aria-controls={ariaControls}
                role={role}
                title={title}
            >
                {content}
            </div>
        );
    }

    if (href) {
        return (
            <Link
                href={href}
                onClick={disabled
                    ? (event) => event.preventDefault()
                    : onClick as MouseEventHandler<HTMLAnchorElement>}
                className={rootClassName}
                aria-label={ariaLabel || (compact ? label : undefined)}
                aria-current={ariaCurrent}
                aria-expanded={ariaExpanded}
                aria-controls={ariaControls}
                aria-disabled={disabled || undefined}
                role={role}
                title={title}
                tabIndex={disabled ? -1 : tabIndex}
            >
                {content}
            </Link>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick as MouseEventHandler<HTMLButtonElement>}
            className={rootClassName}
            aria-label={ariaLabel || (compact ? label : undefined)}
            aria-current={ariaCurrent}
            aria-pressed={ariaPressed}
            aria-expanded={ariaExpanded}
            aria-controls={ariaControls}
            role={role}
            title={title}
            tabIndex={tabIndex}
            disabled={disabled}
        >
            {content}
        </button>
    );
}
