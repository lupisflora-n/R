import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// The fixed origin is also the existing LINE menu target and browser storage origin.
const origin = 'https://docpdf-line-test.pages.dev';
export async function verifyPublication(expected, {
  fetchBuild = fetch,
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  attempts = 12
} = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchBuild(`${origin}/build.json?verify=${encodeURIComponent(expected.build)}`, {
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const actual = await response.json();
      if (actual.build !== expected.build || actual.files !== expected.files) {
        throw new Error('The fixed URL has not received the expected build yet');
      }
      return actual;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(5000);
    }
  }
  throw new Error(`Deployment was requested but fixed-URL verification failed: ${lastError?.message}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const expected = JSON.parse(await readFile('dist/build.json', 'utf8'));
  await verifyPublication(expected);
  console.log(`Verified ${origin}: build ${expected.build}, files ${expected.files}`);
}
