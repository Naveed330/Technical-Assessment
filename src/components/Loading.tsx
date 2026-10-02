import { memo } from 'react';

interface LoadingProps {
  label?: string;
}

export const Loading = memo(function Loading({ label = 'Loading…' }: LoadingProps) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
});
