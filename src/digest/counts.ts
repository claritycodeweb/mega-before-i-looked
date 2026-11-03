import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';
import type { RunStatus } from './types.js';

export type LineCounts = Record<RunStatus, number>;

// Counts run lines by status (rows only keep the last status). Bad lines are not counted.
export function countLines(text: string): LineCounts {
  const counts: LineCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const l = parseLine(raw);
    if (l) counts[l.status]++;
  }
  return counts;
}

// null when the night file cannot be read.
export function readCounts(runsDir: string, night: string): LineCounts | null {
  try {
    return countLines(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return null;
  }
}
