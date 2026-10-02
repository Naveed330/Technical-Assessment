import { memo } from 'react';
import { useCountdown } from '../hooks/useCountdown';
import { useLiveSelector } from '../hooks/useLiveSelector';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { ConnectionInfo, ConnectionStatus } from '../types/event';
import { formatTime } from '../utils/helpers';

export type FeedState = ConnectionStatus | 'paused';

export const FEED_STATE_LABELS: Record<FeedState, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  live: 'Live',
  paused: 'Paused',
  reconnecting: 'Reconnecting',
  error: 'Disconnected',
};

function describeConnection(
  connection: ConnectionInfo,
  symbol: string,
  secondsLeft: number | null,
  online: boolean,
): string {
  switch (connection.status) {
    case 'connecting':
      return `Connecting to the ${symbol} market stream…`;
    case 'live':
      return `Streaming ${symbol} trades and 24h ticker.`;
    case 'reconnecting': {
      const cause = online ? 'Connection lost.' : 'You are offline.';
      const attempt = `attempt ${connection.attempt} of ${connection.maxAttempts}`;
      return secondsLeft !== null && secondsLeft > 0
        ? `${cause} Retrying in ${secondsLeft}s (${attempt}).`
        : `${cause} Reconnecting (${attempt})…`;
    }
    case 'error':
      return online
        ? `Could not reach the market data feed after ${connection.maxAttempts} attempts. Check your connection and retry.`
        : 'No network connection. The feed will reconnect automatically once you are back online.';
    default:
      return 'Not connected.';
  }
}

interface ConnectionBarProps {
  symbol: string;
  onRetry: () => void;
}

export const ConnectionBar = memo(function ConnectionBar({ symbol, onRetry }: ConnectionBarProps) {
  const connection = useLiveSelector((s) => s.connection);
  const paused = useLiveSelector((s) => s.paused);
  const pausedAt = useLiveSelector((s) => s.pausedAt);
  const staleSince = useLiveSelector((s) =>
    s.connection.status === 'reconnecting' || s.connection.status === 'error' ? s.stats.lastMessageAt : null,
  );
  const online = useOnlineStatus();
  const secondsLeft = useCountdown(connection.status === 'reconnecting' ? connection.nextRetryAt : null);

  const state: FeedState = paused ? 'paused' : connection.status;
  const canRetry = connection.status === 'reconnecting' || connection.status === 'error';

  let detail = describeConnection(connection, symbol, secondsLeft, online);
  if (staleSince !== null) detail += ` Figures below are from ${formatTime(staleSince)}.`;
  if (paused) {
    const frozenAt = pausedAt === null ? '' : ` at ${formatTime(pausedAt)}`;
    detail = `View frozen${frozenAt}; data keeps buffering in the background.`;
    if (connection.status !== 'live') detail += ` Connection: ${FEED_STATE_LABELS[connection.status]}.`;
  }

  return (
    <div className={`connection-bar connection-bar--${state}`} role="status" aria-live="polite">
      <span className="connection-bar__dot" aria-hidden="true" />
      <strong className="connection-bar__label">{FEED_STATE_LABELS[state]}</strong>
      <span className="connection-bar__detail">{detail}</span>
      {canRetry && (
        <button type="button" className="btn btn--small" onClick={onRetry}>
          Retry now
        </button>
      )}
    </div>
  );
});
