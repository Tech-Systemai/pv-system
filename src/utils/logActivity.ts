// Fire-and-forget activity logger for client components.
// Errors are silently swallowed so logging never blocks user actions.
export function logActivity(payload: {
  userId?: string;
  userName?: string;
  module: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}): void {
  fetch('/api/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
