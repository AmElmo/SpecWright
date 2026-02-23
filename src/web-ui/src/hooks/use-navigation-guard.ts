import { useEffect, useCallback } from 'react';

interface UseNavigationGuardOptions {
  isDirty: boolean;
  message?: string;
}

const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to leave?';

export function useNavigationGuard({ isDirty, message }: UseNavigationGuardOptions) {
  const msg = message || DEFAULT_MESSAGE;

  // Block browser refresh / close / external navigation
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Block client-side back/forward navigation
  const handlePopState = useCallback(() => {
    if (!isDirty) return;

    if (!window.confirm(msg)) {
      // Push state back to cancel the navigation
      window.history.pushState(null, '', window.location.href);
    }
  }, [isDirty, msg]);

  useEffect(() => {
    if (!isDirty) return;

    // Push a sentinel state so we can intercept back navigation
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty, handlePopState]);

  // Block client-side link clicks (React Router <Link> uses <a> tags)
  useEffect(() => {
    if (!isDirty) return;

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;

      // Internal link — check if it's navigating away from current path
      if (href !== window.location.pathname) {
        if (!window.confirm(msg)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // Use capture phase to intercept before React Router handles the click
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isDirty, msg]);
}
