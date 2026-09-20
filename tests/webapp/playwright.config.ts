import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  testDir: fileURLToPath(new URL('./', import.meta.url)),
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  outputDir: fileURLToPath(new URL('../../.test-artifacts/webapp', import.meta.url)),
  reporter: [['list'], ['json', {outputFile: fileURLToPath(new URL('../../.test-artifacts/webapp-results.json', import.meta.url))}]],
  use: {
    baseURL: 'http://127.0.0.1:4174/mi-nomina-mir-madrid/',
    viewport: {width: 390, height: 844},
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    serviceWorkers: 'allow',
    launchOptions: {
      executablePath: process.env.NOMINA_CHROME_PATH || '/usr/bin/google-chrome',
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/preview-webapp.mjs',
    cwd: projectRoot,
    url: 'http://127.0.0.1:4174/mi-nomina-mir-madrid/',
    reuseExistingServer: false,
    timeout: 20000,
  },
});
