import { describe, expect, it } from "vitest";
import { DEFAULT_SCANNER, ScanRouter, type RouterEvent } from "./ScanRouter";

class FakeClock {
  now = 0;
  private nextId = 1;
  private timers: { id: number; fire: number; fn: () => void }[] = [];

  setTimeout = (fn: () => void, ms?: number) => {
    const id = this.nextId++;
    this.timers.push({ id, fire: this.now + (ms ?? 0), fn });
    return id as unknown as ReturnType<typeof setTimeout>;
  };

  clearTimeout = (handle: ReturnType<typeof setTimeout>) => {
    const id = handle as unknown as number;
    this.timers = this.timers.filter((t) => t.id !== id);
  };

  advance(ms: number) {
    this.now += ms;
    const due = this.timers.filter((t) => t.fire <= this.now).sort((a, b) => a.fire - b.fire);
    this.timers = this.timers.filter((t) => t.fire > this.now);
    for (const t of due) t.fn();
  }
}

function collect() {
  const events: RouterEvent[] = [];
  const clock = new FakeClock();
  const router = new ScanRouter(DEFAULT_SCANNER, (e) => events.push(e), clock);
  return { events, clock, router };
}

function burst(router: ScanRouter, chars: string, start: number, gap: number) {
  let t = start;
  for (const ch of chars) {
    router.handleKey(ch, t);
    t += gap;
  }
  return t - gap;
}

describe("ScanRouter", () => {
  it("13 chars 5ms apart plus Enter is one scan", () => {
    const { events, router } = collect();
    const last = burst(router, "1234567890123", 0, 5);
    router.handleKey("Enter", last + 5);
    expect(events).toEqual([{ type: "scan", code: "1234567890123" }]);
  });

  it("slow 3 then Enter is human char plus key", () => {
    const { events, router } = collect();
    router.handleKey("3", 0);
    router.handleKey("Enter", 200);
    expect(events).toEqual([
      { type: "char", char: "3" },
      { type: "key", key: "Enter" },
    ]);
  });

  it("13 chars with no suffix become a scan after idle", () => {
    const { events, clock, router } = collect();
    burst(router, "1234567890123", 0, 5);
    expect(events).toEqual([]);
    clock.advance(60);
    expect(events).toEqual([{ type: "scan", code: "1234567890123" }]);
  });

  it("swallows Enter 20ms after a scan", () => {
    const { events, router } = collect();
    const last = burst(router, "1234567890123", 0, 5);
    router.handleKey("Enter", last + 5);
    router.handleKey("Enter", last + 25);
    expect(events).toEqual([{ type: "scan", code: "1234567890123" }]);
  });

  it("dedups the same code within 200ms", () => {
    const { events, router } = collect();
    const last = burst(router, "1234567890123", 0, 5);
    router.handleKey("Enter", last + 5);
    const last2 = burst(router, "1234567890123", last + 50, 5);
    router.handleKey("Enter", last2 + 5);
    expect(events).toEqual([{ type: "scan", code: "1234567890123" }]);
  });

  it("accepts the same code again after 500ms", () => {
    const { events, router } = collect();
    const last = burst(router, "1234567890123", 0, 5);
    router.handleKey("Enter", last + 5);
    const last2 = burst(router, "1234567890123", 500, 5);
    router.handleKey("Enter", last2 + 5);
    expect(events).toEqual([
      { type: "scan", code: "1234567890123" },
      { type: "scan", code: "1234567890123" },
    ]);
  });

  it("two fast digits shorter than minLength flush as chars", () => {
    const { events, clock, router } = collect();
    router.handleKey("1", 0);
    router.handleKey("2", 30);
    clock.advance(60);
    expect(events).toEqual([
      { type: "char", char: "1" },
      { type: "char", char: "2" },
    ]);
  });

  it("keeps uppercase letters and dashes in a scan", () => {
    const { events, router } = collect();
    const last = burst(router, "ABC-123", 0, 5);
    router.handleKey("Enter", last + 5);
    expect(events).toEqual([{ type: "scan", code: "ABC-123" }]);
  });

  it("treats a 100ms mid-stream gap as human then a new buffer", () => {
    const { events, router } = collect();
    burst(router, "1234", 0, 5);
    const last = burst(router, "567890", 15 + 100, 5);
    router.handleKey("Enter", last + 5);
    expect(events).toEqual([
      { type: "char", char: "1" },
      { type: "char", char: "2" },
      { type: "char", char: "3" },
      { type: "char", char: "4" },
      { type: "scan", code: "567890" },
    ]);
  });
});
