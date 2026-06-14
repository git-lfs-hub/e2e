import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { $ } from 'bun';

export type Vars = { title: string; lfs: { server: string }; github: { adminHome: string } };

export async function sh(cmd: $.ShellPromise): Promise<$.ShellOutput> {
  const r = await cmd.nothrow().quiet();
  if (r.exitCode !== 0) {
    const parts = [`shell command failed (exit ${r.exitCode})`];
    const out = r.stdout.toString().trim();
    const err = r.stderr.toString().trim();
    if (out) parts.push(`stdout:\n${out}`);
    if (err) parts.push(`stderr:\n${err}`);
    throw new Error(parts.join('\n'));
  }
  return r;
}

const e2eDir = dirname(fileURLToPath(import.meta.url));
const varsPath = join(e2eDir, 'vars.json');
export const vars = (await Bun.file(varsPath).json()) as Vars;

export function requireEnv<K extends string>(...names: K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  const missing: K[] = [];
  for (const n of names) {
    const v = process.env[n];
    if (v) out[n] = v;
    else missing.push(n);
  }
  if (missing.length) throw new Error(`required env: ${missing.join(', ')}`);
  return out;
}
