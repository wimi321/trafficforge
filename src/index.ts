import process from 'node:process';
import { loadConfig } from './config.js';
import { createApiServer } from './api.js';
import { ProxyService } from './proxy.js';
import { SessionStore } from './storage.js';

async function main() {
  const cwd = process.cwd();
  const config = loadConfig(cwd);
  const store = new SessionStore(config.dataDir);
  const proxy = new ProxyService(config, store);
  await proxy.start();
  const api = await createApiServer(config, store, proxy);

  console.log('Zhuabao is live.');
  console.log(`Dashboard: http://127.0.0.1:${config.dashboardPort}`);
  console.log(`HTTP proxy: http://127.0.0.1:${config.proxyPort}`);
  console.log('Set HTTP_PROXY and HTTPS_PROXY to the proxy endpoint to capture traffic.');

  const shutdown = async () => {
    await api.close();
    await proxy.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
