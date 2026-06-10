import type { RunEvent } from '@prisma/client';

type Listener = (event: RunEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribeRunEvents(runId: string, listener: Listener): () => void {
  const runListeners = listeners.get(runId) ?? new Set<Listener>();
  runListeners.add(listener);
  listeners.set(runId, runListeners);

  return () => {
    runListeners.delete(listener);
    if (runListeners.size === 0) {
      listeners.delete(runId);
    }
  };
}

export function publishRunEvent(event: RunEvent): void {
  const runListeners = listeners.get(event.runId);
  if (!runListeners) {
    return;
  }

  for (const listener of runListeners) {
    listener(event);
  }
}
