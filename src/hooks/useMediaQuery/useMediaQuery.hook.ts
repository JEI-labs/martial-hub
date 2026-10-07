import * as React from 'react';

/**
 * Subscribing through useSyncExternalStore rather than syncing into state from
 * an effect: no cascading render, and the value is correct on first paint.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const result = matchMedia(query);
      result.addEventListener('change', onStoreChange);
      return () => result.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false, // server render has no viewport; matches the old initial value
  );
}
