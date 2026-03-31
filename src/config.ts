import path from 'node:path';

export interface TrafficForgeConfig {
  proxyPort: number;
  dashboardPort: number;
  dataDir: string;
  rulesPath: string;
  bodyLimit: number;
}

export function loadConfig(cwd: string): TrafficForgeConfig {
  return {
    proxyPort: Number(process.env.TRAFFICFORGE_PROXY_PORT ?? process.env.ZHUABAO_PROXY_PORT ?? 8787),
    dashboardPort: Number(process.env.TRAFFICFORGE_DASHBOARD_PORT ?? process.env.ZHUABAO_DASHBOARD_PORT ?? 8788),
    dataDir: process.env.TRAFFICFORGE_DATA_DIR ?? process.env.ZHUABAO_DATA_DIR ?? path.join(cwd, '.trafficforge'),
    rulesPath: process.env.TRAFFICFORGE_RULES ?? process.env.ZHUABAO_RULES ?? path.join(cwd, 'trafficforge.rules.yaml'),
    bodyLimit: Number(process.env.TRAFFICFORGE_BODY_LIMIT ?? process.env.ZHUABAO_BODY_LIMIT ?? 512_000),
  };
}
