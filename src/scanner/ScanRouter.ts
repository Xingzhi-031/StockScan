export interface ScannerConfig {
  maxGapMs: number;
  minLength: number;
  idleFlushMs: number;
  dedupMs: number;
}

export type RouterEvent =
  | { type: "scan"; code: string }
  | { type: "char"; char: string }
  | { type: "key"; key: string };

interface Buffered {
  ch: string;
  t: number;
}

export type Clock = {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> | number;
  clearTimeout: (id: ReturnType<typeof setTimeout> | number) => void;
};

export const DEFAULT_SCANNER: ScannerConfig = {
  maxGapMs: 35,
  minLength: 6,
  idleFlushMs: 60,
  dedupMs: 300,
};

export class ScanRouter {
  private buf: Buffered[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastScan = { code: "", t: -Infinity };
  private swallowTerminatorUntil = -Infinity;

  constructor(
    private cfg: ScannerConfig,
    private emit: (e: RouterEvent) => void,
    private clock: Clock = {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
    },
  ) {}

  /** t uses KeyboardEvent.timeStamp. true = caller should preventDefault(). */
  handleKey(key: string, t: number): boolean {
    if (key === "Enter" || key === "Tab") {
      if (t < this.swallowTerminatorUntil) return true;
      if (this.looksLikeScan(t)) {
        this.emitScan(t);
        return true;
      }
      this.flushHuman();
      this.emit({ type: "key", key });
      return true;
    }

    if (key.length !== 1) {
      this.flushHuman();
      this.emit({ type: "key", key });
      return true;
    }

    const last = this.buf[this.buf.length - 1];
    if (last && t - last.t > this.cfg.maxGapMs) this.flushHuman();
    this.buf.push({ ch: key, t });
    this.armIdle();
    return true;
  }

  dispose() {
    if (this.timer) this.clock.clearTimeout(this.timer);
    this.timer = null;
    this.buf = [];
  }

  private looksLikeScan(t: number): boolean {
    if (this.buf.length < this.cfg.minLength) return false;
    return t - this.buf[this.buf.length - 1].t <= this.cfg.maxGapMs;
  }

  private armIdle() {
    if (this.timer) this.clock.clearTimeout(this.timer);
    this.timer = this.clock.setTimeout(() => this.onIdle(), this.cfg.idleFlushMs);
  }

  private onIdle() {
    this.timer = null;
    if (this.buf.length >= this.cfg.minLength) {
      this.emitScan(this.buf[this.buf.length - 1].t);
    } else {
      this.flushHuman();
    }
  }

  private emitScan(t: number) {
    if (this.timer) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    const code = this.buf.map((b) => b.ch).join("").trim();
    this.buf = [];
    this.swallowTerminatorUntil = t + 100;
    if (!code) return;
    if (code === this.lastScan.code && t - this.lastScan.t < this.cfg.dedupMs) return;
    this.lastScan = { code, t };
    this.emit({ type: "scan", code });
  }

  private flushHuman() {
    if (this.timer) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    const pending = this.buf;
    this.buf = [];
    for (const b of pending) this.emit({ type: "char", char: b.ch });
  }
}
