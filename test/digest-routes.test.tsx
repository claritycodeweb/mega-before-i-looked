import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

let runsDir: string;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  const line = (job: string, status: string, owner: string | null, extra = {}) =>
    JSON.stringify({ at: '2026-11-01T09:00:00+01:00', job, status, owner, ...extra });
  writeFileSync(
    join(runsDir, '2026-11-01.jsonl'),
    [
      line('a/one', 'ok', 'x'),
      line('a/one', 'ok', 'x'),
      line('b/two', 'fail', null, { error: 'boom' }),
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, '2026-11-02.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-11-03.jsonl'),
    [
      JSON.stringify({ at: '2026-11-03T09:00:00+01:00', job: 'c/three', status: 'ok', owner: 'y' }),
      '{"at":"2026',
    ].join('\n') + '\n',
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const app = () =>
  createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });

describe('digest routes', () => {
  it('HTML /digest/2026-11-01 lists the jobs in order, with — for a null owner', async () => {
    const res = await app().request('/digest/2026-11-01');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('a/one');
    expect(html).toContain('b/two');
    expect(html).toContain('—');
    expect(html.indexOf('a/one')).toBeLessThan(html.indexOf('b/two'));
  });

  it('JSON /api/digest/2026-11-01 returns the rows in order', async () => {
    const res = await app().request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.rows.map((r) => r.job)).toEqual(['a/one', 'b/two']);
    expect(body.badLines).toBe(0);
  });

  it('HTML /digest/2026-11-09 404s a night with no file', async () => {
    const res = await app().request('/digest/2026-11-09');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for this night');
  });

  it('JSON /api/digest/2026-11-09 404s a night with no file', async () => {
    const res = await app().request('/api/digest/2026-11-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night', night: '2026-11-09' });
  });

  it('HTML /digest/2026-11-02 shows "nothing ran" for an empty night', async () => {
    const res = await app().request('/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('JSON /api/digest/2026-11-02 has no rows and no bad lines for an empty night', async () => {
    const res = await app().request('/api/digest/2026-11-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('HTML /digest/2026-11-03 says one line did not parse', async () => {
    const res = await app().request('/digest/2026-11-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('1 line did not parse');
  });

  it('JSON /api/digest/2026-11-03 counts the bad line and keeps the good row', async () => {
    const res = await app().request('/api/digest/2026-11-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['c/three']);
  });
});
