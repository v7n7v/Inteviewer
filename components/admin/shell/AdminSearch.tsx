'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  ADMIN_NAVIGATION,
  adminNavigationAllowed,
  type AdminNavigationItem,
} from './admin-navigation';
import { useAdminVisualReview } from '@/components/admin/visual-review/AdminVisualReviewContext';
import { useAdminSession } from './AdminSessionProvider';

function visualReviewHref(href: string) {
  if (href === '/suite/admin') return '/suite/admin-preview?module=overview';
  if (href === '/suite/admin/observability') {
    return '/suite/admin-preview?module=observability';
  }
  return href;
}

function matches(item: AdminNavigationItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return [
    item.label,
    item.description,
    ...item.keywords,
  ].some(value => value.toLowerCase().includes(normalizedQuery));
}

export function AdminSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const visualReview = useAdminVisualReview();
  const { session } = useAdminSession();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const allowedItems = useMemo(
    () => ADMIN_NAVIGATION.filter(
      item => session
        ? adminNavigationAllowed(item, session.permissions, session.role, session.features)
        : false,
    ),
    [session],
  );
  const results = useMemo(
    () => allowedItems.filter(item => matches(item, query)).slice(0, 7),
    [allowedItems, query],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopImmediatePropagation();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, [pathname]);

  useEffect(() => {
    setActiveIndex(current => Math.min(current, Math.max(results.length - 1, 0)));
  }, [results.length]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const activeResult = results[activeIndex] || results[0];
    if (!activeResult) return;
    router.push(visualReview ? visualReviewHref(activeResult.href) : activeResult.href);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(current => results.length ? (current + 1) % results.length : 0);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(current => results.length ? (current - 1 + results.length) % results.length : 0);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`admin-search${open ? ' is-mobile-open' : ''}`}>
      <button
        type="button"
        className="admin-mobile-search-trigger"
        aria-label="Open Admin search"
        aria-expanded={open}
        onClick={() => {
          setOpen(current => !current);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <span className="material-symbols-rounded" aria-hidden="true">search</span>
      </button>
      <form role="search" onSubmit={submit} className="admin-search-form">
        <span className="material-symbols-rounded admin-search-icon" aria-hidden="true">search</span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
          aria-label="Search Admin modules"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-activedescendant={open && results.length ? `${listboxId}-option-${activeIndex}` : undefined}
          placeholder="Search Admin modules..."
          className="admin-search-input"
        />
        <kbd className="admin-search-shortcut" aria-hidden="true">Ctrl K</kbd>
      </form>

      {open ? (
        <div id={listboxId} role="listbox" aria-label="Admin search results" className="admin-search-results">
          <p className="admin-search-results-label">Available to your role</p>
          {results.length ? results.map((item, index) => (
            <Link
              key={item.href}
              id={`${listboxId}-option-${index}`}
              href={visualReview ? visualReviewHref(item.href) : item.href}
              role="option"
              aria-selected={activeIndex === index}
              data-admin-search-result
              className={`admin-search-result${activeIndex === index ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
              <span className="admin-search-result-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              <span className="material-symbols-rounded admin-search-result-arrow" aria-hidden="true">arrow_forward</span>
            </Link>
          )) : (
            <div className="admin-search-empty">
              <span className="material-symbols-rounded" aria-hidden="true">search_off</span>
              <span>No matching Admin section</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
