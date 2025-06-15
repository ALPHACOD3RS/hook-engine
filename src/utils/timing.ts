/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Add jitter to a delay value to prevent thundering herd
 */
export function addJitter(delayMs: number, jitterFactor: number = 0.1): number {
  const jitter = delayMs * jitterFactor * Math.random();
  return Math.floor(delayMs + jitter);
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  multiplier: number = 2,
  maxDelayMs: number = 30000,
  jitter: boolean = true
): number {
  const delay = Math.min(baseDelayMs * Math.pow(multiplier, attempt - 1), maxDelayMs);
  return jitter ? addJitter(delay) : delay;
}

/**
 * Performance timer for measuring execution time
 */
export class Timer {
  private startTime: number;
  private endTime?: number;

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Stop the timer and return elapsed time in milliseconds
   */
  stop(): number {
    this.endTime = performance.now();
    return this.elapsed();
  }

  /**
   * Get elapsed time in milliseconds (without stopping the timer)
   */
  elapsed(): number {
    const end = this.endTime || performance.now();
    return Math.round(end - this.startTime);
  }

  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = performance.now();
    this.endTime = undefined;
  }
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    })
  ]);
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => Promise<T> | T,
  label?: string
): Promise<{ result: T; duration: number }> {
  const timer = new Timer();
  
  try {
    const result = await fn();
    const duration = timer.stop();
    
    if (label) {
      console.log(`${label} took ${duration}ms`);
    }
    
    return { result, duration };
  } catch (error) {
    const duration = timer.stop();
    
    if (label) {
      console.log(`${label} failed after ${duration}ms`);
    }
    
    throw error;
  }
} 