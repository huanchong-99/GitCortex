import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const getMatches = () =>
    globalThis.window === undefined ? false : globalThis.window.matchMedia(query).matches;

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (globalThis.window === undefined) return;

    const mql = globalThis.window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    mql.addEventListener('change', handler);

    setMatches(mql.matches);

    return () => {
      mql.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}
