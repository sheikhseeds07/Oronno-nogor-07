/**
 * Run with Node 24: node scripts/check-usage.ts --snapshot=/secure/usage.json
 * The documented Management API does not expose verified billing GB totals.
 * Never substitute log queries or request counts for billing usage.
 * A fresh dashboard/billing export must supply the snapshot below; missing,
 * stale, or malformed input exits nonzero (never reports a false healthy state).
 */
import { readFile } from 'node:fs/promises';

export function assessUsage(value: unknown, now = Date.now()) {
  const data = value as Record<string, unknown>;
  if (!data || typeof data !== 'object') throw new Error('Invalid usage snapshot');
  const observed = Date.parse(String(data.observedAt ?? ''));
  if (!Number.isFinite(observed) || now - observed > 26 * 3600_000 || observed > now + 60_000) throw new Error('Usage snapshot missing or stale');
  const names = ['logQueryGB', 'uncachedEgressGB', 'cachedEgressGB'] as const;
  for (const name of names) if (typeof data[name] !== 'number' || !Number.isFinite(data[name]) || (data[name] as number) < 0) throw new Error(`Invalid ${name}`);
  const thresholds = { logQueryGB: 10, uncachedEgressGB: 4, cachedEgressGB: 4 };
  const alerts = names.filter(name => (data[name] as number) >= thresholds[name]);
  return { healthy: alerts.length === 0, alerts, productionVerboseLogging: false, hardCapGuaranteed: false };
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const project = process.env.SUPABASE_PROJECT_REF ?? 'frtzlibogmethppqmhtr';
  if (!/^[a-z]{20}$/.test(project)) throw new Error('Invalid project reference');
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN required (Management PAT, never a browser key)');
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Management API HTTP ${response.status}`);
  const file = process.argv.find(arg => arg.startsWith('--snapshot='))?.slice(11);
  if (!file) throw new Error('No verified public Management API for billing GB totals; provide a fresh --snapshot. Monitoring is NOT active.');
  const snapshot = JSON.parse(await readFile(file, 'utf8'));
  if (snapshot.projectRef !== project) throw new Error('Snapshot belongs to a different project');
  const result = assessUsage(snapshot);
  process.stdout.write(JSON.stringify(result) + '\n');
  if (!result.healthy) {
    process.stderr.write(`USAGE ALERT: ${result.alerts.join(', ')}. Production verbose logging is already disabled.\n`);
    process.exitCode = 1;
  }
}
if (process.argv[1]?.endsWith('/check-usage.ts') || process.argv[1] === 'scripts/check-usage.ts') {
  main().catch(() => { process.stderr.write('Usage check failed: configuration, API access, or fresh billing snapshot required. Do not assume quotas are safe.\n'); process.exitCode = 2; });
}
