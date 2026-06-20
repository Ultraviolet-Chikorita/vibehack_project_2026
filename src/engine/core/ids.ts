/** Deterministic, readable id generation for engine records. */

const counters: Record<string, number> = {};

/**
 * Sequential ids keyed by prefix, so the same processing run produces stable,
 * inspectable ids (e.g. ev_001). Reset between isolated runs via {@link resetIds}.
 */
export function nextId(prefix: string): string {
  counters[prefix] = (counters[prefix] ?? 0) + 1;
  return `${prefix}_${String(counters[prefix]).padStart(3, "0")}`;
}

export function resetIds(): void {
  for (const key of Object.keys(counters)) delete counters[key];
}
