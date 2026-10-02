import { useContext, useSyncExternalStore } from 'react';
import { LiveStoreContext } from '../store/context';
import type { LiveSnapshot, LiveStore } from '../store/liveStore';

export function useLiveStoreApi(): LiveStore {
  const store = useContext(LiveStoreContext);
  if (!store) throw new Error('useLiveStoreApi must be used inside LiveStoreContext.Provider');
  return store;
}
export function useLiveSelector<T>(selector: (snapshot: LiveSnapshot) => T): T {
  const store = useLiveStoreApi();
  return useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()));
}
