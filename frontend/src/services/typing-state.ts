export const TYPING_IDLE_TIMEOUT_MS = 1_500;
export const TYPING_HEARTBEAT_INTERVAL_MS = 2_500;
export const REMOTE_TYPING_STALE_TIMEOUT_MS = 4_000;

type TimerHandle = ReturnType<typeof setTimeout>;

export class TypingSignalController {
  private active = false;
  private idleTimer: TimerHandle | null = null;
  private heartbeatTimer: TimerHandle | null = null;

  constructor(
    private readonly emit: (active: boolean) => void,
    private readonly idleTimeoutMs = TYPING_IDLE_TIMEOUT_MS,
    private readonly heartbeatIntervalMs = TYPING_HEARTBEAT_INTERVAL_MS,
  ) {}

  update(value: string): void {
    if (!value.trim()) {
      this.stop();
      return;
    }

    if (!this.active) {
      this.active = true;
      this.emit(true);
      this.scheduleHeartbeat();
    }

    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => this.stop(), this.idleTimeoutMs);
  }

  stop(): void {
    this.clearTimers();
    if (!this.active) return;
    this.active = false;
    this.emit(false);
  }

  reset(): void {
    this.clearTimers();
    this.active = false;
  }

  dispose(): void {
    this.stop();
  }

  private scheduleHeartbeat(): void {
    this.clearHeartbeatTimer();
    this.heartbeatTimer = setTimeout(() => {
      this.heartbeatTimer = null;
      if (!this.active) return;
      this.emit(true);
      this.scheduleHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  private clearIdleTimer(): void {
    if (!this.idleTimer) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private clearHeartbeatTimer(): void {
    if (!this.heartbeatTimer) return;
    clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private clearTimers(): void {
    this.clearIdleTimer();
    this.clearHeartbeatTimer();
  }
}
