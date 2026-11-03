import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders a night, and 404s a night with no file', async () => {
    const app = createApp(config);
    const ok = await app.request('/digest/2026-10-28');
    const html = await ok.text();
    expect(ok.status).toBe(200);
    expect(html).toContain('<th>last error</th>');
    expect(html).toContain('lane/sync');
    const missing = await app.request('/digest/2026-01-01');
    expect(missing.status).toBe(404);
  });
});
