import { URL } from 'node:url';
import type { RedactionOptions } from './types.js';

const DEFAULT_HEADERS = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'proxy-authorization'];
const DEFAULT_QUERY = ['token', 'access_token', 'refresh_token', 'code', 'key', 'signature'];

export function redactHeaders(
  headers: Record<string, string | string[] | undefined>,
  options: RedactionOptions = {},
): Record<string, string | string[] | undefined> {
  const redactSet = new Set((options.headerNames ?? DEFAULT_HEADERS).map((item) => item.toLowerCase()));
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      redactSet.has(key.toLowerCase()) ? '[REDACTED]' : value,
    ]),
  );
}

export function redactUrl(input: string, options: RedactionOptions = {}): string {
  try {
    const parsed = new URL(input);
    const redactSet = new Set((options.queryParams ?? DEFAULT_QUERY).map((item) => item.toLowerCase()));
    for (const key of [...parsed.searchParams.keys()]) {
      if (redactSet.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return input;
  }
}
