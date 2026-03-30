import fs from 'node:fs';
import YAML from 'yaml';
import { z } from 'zod';

const ruleSchema = z.object({
  id: z.string(),
  match: z.object({
    method: z.string().optional(),
    urlIncludes: z.string().optional(),
    urlRegex: z.string().optional(),
  }),
  action: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('stub-json'),
      status: z.number().default(200),
      body: z.any(),
      headers: z.record(z.string(), z.string()).optional(),
    }),
    z.object({
      type: z.literal('stub-text'),
      status: z.number().default(200),
      body: z.string(),
      headers: z.record(z.string(), z.string()).optional(),
    }),
    z.object({
      type: z.literal('rewrite-request'),
      updateHeaders: z.record(z.string(), z.string()).optional(),
      replaceBody: z.string().optional(),
    }),
    z.object({
      type: z.literal('rewrite-response'),
      updateHeaders: z.record(z.string(), z.string()).optional(),
      replaceBody: z.string().optional(),
    }),
  ]),
});

export type ZhuabaoRule = z.infer<typeof ruleSchema>;

export function loadRules(rulesPath: string): ZhuabaoRule[] {
  if (!fs.existsSync(rulesPath)) return [];
  const parsed = YAML.parse(fs.readFileSync(rulesPath, 'utf8'));
  const rawRules = Array.isArray(parsed?.rules) ? parsed.rules : [];
  return z.array(ruleSchema).parse(rawRules);
}
