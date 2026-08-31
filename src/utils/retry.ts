/**
 * generic retry helper for async functions
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 2000,
  onRetry?: (error: any, attempt: number) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    
    if (onRetry) onRetry(error, retries);
    
    // exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 1.5, onRetry);
  }
}
