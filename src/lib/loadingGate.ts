export const FIXED_PROCESSING_MS = 45_000;
export const FIXED_PROCESSING_MESSAGE =
  "Securing your data and preparing your workspace...";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runWithFixedProcessingDelay<T>(
  operation: Promise<T>,
  delayMs: number = FIXED_PROCESSING_MS
): Promise<T> {
  const guarded = operation.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error })
  );

  await sleep(delayMs);
  const result = await guarded;

  if (!result.ok) {
    throw result.error;
  }

  return result.value;
}