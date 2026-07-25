export const WORKSPACE_AUTH_BOOTSTRAP_TIMEOUT_MS = 8_000;

type TimerHandle = ReturnType<typeof setTimeout>;

interface WorkspaceBootstrapWatchdogOptions {
  onTimeout: () => void;
  timeoutMs?: number;
  schedule?: (callback: () => void, timeoutMs: number) => TimerHandle;
  cancel?: (handle: TimerHandle) => void;
}

export function createWorkspaceBootstrapWatchdog({
  onTimeout,
  timeoutMs = WORKSPACE_AUTH_BOOTSTRAP_TIMEOUT_MS,
  schedule = setTimeout,
  cancel = clearTimeout,
}: WorkspaceBootstrapWatchdogOptions) {
  let terminal = false;
  const handle = schedule(() => {
    if (terminal) return;
    terminal = true;
    onTimeout();
  }, timeoutMs);

  return {
    complete() {
      if (terminal) return false;
      terminal = true;
      cancel(handle);
      return true;
    },
    dispose() {
      if (!terminal) {
        terminal = true;
        cancel(handle);
      }
    },
  };
}
