import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 testDir:'tests/e2e',fullyParallel:false,workers:1,timeout:60000,
 outputDir:'.test-artifacts/browser',reporter:[['list'],['json',{outputFile:'.test-artifacts/browser-results.json'}]],
 use:{baseURL:'http://127.0.0.1:4173',viewport:{width:390,height:844},locale:'es-ES',timezoneId:'Europe/Madrid',
  launchOptions:{executablePath:process.env.NOMINA_CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'npm run preview -- --port 4173 --strictPort',cwd:fileURLToPath(new URL('.',import.meta.url)),url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:20000}
});
