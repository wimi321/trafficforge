import path from 'node:path';

export interface ZhuabaoConfig {
  proxyPort: number;
  dashboardPort: number;
  dataDir: string;
  rulesPath: string;
  bodyLimit: number;
}

export function loadConfig(cwd: string): ZhuabaoConfig {
  return {
    proxyPort: Number(process.env.ZHUABAO_PROXY_PORT ?? 8787),
    dashboardPort: Number(process.env.ZHUABAO_DASHBOARD_PORT ?? 8788),
    dataDir: process.env.ZHUABAO_DATA_DIR ?? path.join(cwd, '.zhuabao'),
    rulesPath: process.env.ZHUABAO_RULES ?? path.join(cwd, 'zhuabao.rules.yaml'),
    bodyLimit: Number(process.env.ZHUABAO_BODY_LIMIT ?? 512_000),
  };
}
