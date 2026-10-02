import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_WINDOW_SEC, type AppConfig } from '../config';
import { StreamClient } from '../services/streamClient';
import { createLiveStore, type LiveStore } from '../store/liveStore';

export interface LiveStream {
  store: LiveStore;
  retry: () => void;
}

export function useLiveStream({ wsUrl, symbol, bufferSize, flushIntervalMs }: AppConfig): LiveStream {
  const [store] = useState(() => createLiveStore({ bufferSize, flushIntervalMs, maxWindowSec: MAX_WINDOW_SEC }));
  const clientRef = useRef<StreamClient | null>(null);

  useEffect(() => {
    store.start();
    const client = new StreamClient({
      url: wsUrl,
      symbol,
      onMessage: store.ingest,
      onStatus: store.setConnection,
      onMalformed: store.recordMalformed,
      onDropped: store.recordDropped,
    });
    clientRef.current = client;
    client.connect();

    const handleOnline = () => client.retryNow();
    const handleOffline = () => client.networkLost();
    const handleVisibility = () => store.setVisible(document.visibilityState === 'visible');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
      client.disconnect();
      clientRef.current = null;
      store.stop();
    };
  }, [store, wsUrl, symbol]);

  const retry = useCallback(() => clientRef.current?.retryNow(), []);

  return { store, retry };
}
