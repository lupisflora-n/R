import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export function loadPlaywright() {
  const locations = ['playwright', 'playwright-core', '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright', '/opt/codex/runtimes/cua/lib/node_modules/playwright-core'];
  for (const name of locations) {
    try { return require(name); }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  const error = new Error('Playwright is unavailable; no browser test ran.');
  error.code = 'MODULE_NOT_FOUND'; throw error;
}
