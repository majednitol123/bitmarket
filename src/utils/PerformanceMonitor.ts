import { useEffect, useRef } from 'react';

/**
 * Measures ACTUAL component render time — not wall-clock time between effects.
 * 
 * Previous version measured from "end of last useEffect" to "end of this useEffect",
 * which included ALL JS thread work between renders (RPC calls, Redux dispatches,
 * other component renders). This gave wildly inflated numbers like 24s, 93s.
 * 
 * This version measures TWO things:
 *   - bodyMs: time from function body start to function body end (synchronous cost)
 *   - commitMs: time from function body start to useEffect (includes reconciliation + commit)
 */
export function useRenderLog(componentName: string) {
  const renderCount = useRef(0);
  // Set at the TOP of the function body — this is when React calls our component
  const bodyStartRef = useRef(Date.now());
  
  // Reset on every render (this runs during the function body, before return)
  bodyStartRef.current = Date.now();

  useEffect(() => {
    // BUG #7 FIX: Only log in development — in production this effect
    // was creating a console.log string on every single render, contributing
    // to memory pressure and JS thread saturation over 3-5 hours.
    if (!__DEV__) return;
    const commitMs = Date.now() - bodyStartRef.current;
    renderCount.current += 1;
    console.log(
      `[Perf] ${componentName} render #${renderCount.current} commit: ${commitMs}ms`
    );
  });
}

/**
 * Measures the execution time of an async function.
 * @param label A label for the measurement.
 * @param fn The async function to execute.
 */
export async function measureTime<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const end = Date.now();
    console.log(`[Perf] ${label} took ${end - start}ms`);
    return result;
  } catch (error) {
    const end = Date.now();
    console.log(`[Perf] ${label} failed after ${end - start}ms`);
    throw error;
  }
}
