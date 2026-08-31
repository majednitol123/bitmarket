import { rpcCircuitBreaker } from "./circuitBreaker";

describe("RpcCircuitBreaker", () => {
  beforeEach(() => {
    rpcCircuitBreaker.resetAll();
    jest.restoreAllMocks();
  });

  it("should initially be closed for any chain", () => {
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(false);
    expect(rpcCircuitBreaker.hasOpenCircuits()).toBe(false);
    expect(rpcCircuitBreaker.getFailedChains()).toEqual([]);
  });

  it("should stay closed after 1 failure", () => {
    rpcCircuitBreaker.recordFailure("evm-1");
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(false);
    expect(rpcCircuitBreaker.hasOpenCircuits()).toBe(false);
  });

  it("should open after 2 consecutive failures", () => {
    rpcCircuitBreaker.recordFailure("evm-1");
    rpcCircuitBreaker.recordFailure("evm-1");
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);
    expect(rpcCircuitBreaker.hasOpenCircuits()).toBe(true);
    expect(rpcCircuitBreaker.getFailedChains()).toEqual(["evm-1"]);
  });

  it("should reset/close the circuit upon success", () => {
    rpcCircuitBreaker.recordFailure("evm-1");
    rpcCircuitBreaker.recordFailure("evm-1");
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);

    rpcCircuitBreaker.recordSuccess("evm-1");
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(false);
    expect(rpcCircuitBreaker.hasOpenCircuits()).toBe(false);
  });

  it("should track chains independently", () => {
    rpcCircuitBreaker.recordFailure("evm-1");
    rpcCircuitBreaker.recordFailure("evm-1");
    rpcCircuitBreaker.recordSuccess("evm-2");

    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);
    expect(rpcCircuitBreaker.isOpen("evm-2")).toBe(false);
  });

  it("should half-open after 5 minutes, allowing a probe", () => {
    const startTime = 1000000000000;
    const dateSpy = jest.spyOn(Date, "now").mockReturnValue(startTime);

    rpcCircuitBreaker.recordFailure("evm-1");
    rpcCircuitBreaker.recordFailure("evm-1");
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);

    // Mock time forward by 4 min 59 sec (still open)
    dateSpy.mockReturnValue(startTime + 4 * 60 * 1000 + 59 * 1000);
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);

    // Mock time forward by 5 min (half-open: isOpen is false to allow a probe)
    dateSpy.mockReturnValue(startTime + 5 * 60 * 1000);
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(false);
  });

  it("should re-open circuit if half-open probe fails", () => {
    const startTime = 1000000000000;
    const dateSpy = jest.spyOn(Date, "now").mockReturnValue(startTime);

    rpcCircuitBreaker.recordFailure("evm-1");
    rpcCircuitBreaker.recordFailure("evm-1");
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);

    // Move time forward past recovery window (5 minutes)
    const recoveryTime = startTime + 5 * 60 * 1000;
    dateSpy.mockReturnValue(recoveryTime);
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(false); // probe allowed

    // Record failure (probe fails) -> should immediately re-trip the circuit
    rpcCircuitBreaker.recordFailure("evm-1");
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);

    // Probe failure should reset the timer: 4 minutes after probe failure, still open
    dateSpy.mockReturnValue(recoveryTime + 4 * 60 * 1000);
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);

    // 5 minutes after probe failure, open for probe again
    dateSpy.mockReturnValue(recoveryTime + 5 * 60 * 1000);
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(false);
  });

  it("should close circuit if half-open probe succeeds", () => {
    const startTime = 1000000000000;
    const dateSpy = jest.spyOn(Date, "now").mockReturnValue(startTime);

    rpcCircuitBreaker.recordFailure("evm-1");
    rpcCircuitBreaker.recordFailure("evm-1");
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);

    // Move time forward past recovery window
    dateSpy.mockReturnValue(startTime + 5 * 60 * 1000);
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(false); // probe allowed

    // Record success (probe succeeds)
    rpcCircuitBreaker.recordSuccess("evm-1");
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(false);
  });

  it("should lock out concurrent probes when half-open", () => {
    const startTime = 1000000000000;
    const dateSpy = jest.spyOn(Date, "now").mockReturnValue(startTime);

    rpcCircuitBreaker.recordFailure("evm-1");
    rpcCircuitBreaker.recordFailure("evm-1");
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);

    // Move time forward past recovery window
    dateSpy.mockReturnValue(startTime + 5 * 60 * 1000);

    // First call to isOpen: probe is allowed, lock is engaged
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(false);

    // Second call to isOpen (concurrent request): lock is active, should return true (skip)
    expect(rpcCircuitBreaker.isOpen("evm-1")).toBe(true);
  });
});
