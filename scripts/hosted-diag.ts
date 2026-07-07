// Diagnoses DATABASE_URL_HOSTED auth without printing any secret:
// parses the URL manually and tries the password raw and URL-decoded.
import '../src/lib/env.js';
import pg from 'pg';

const url = process.env.DATABASE_URL_HOSTED;
if (!url) throw new Error('DATABASE_URL_HOSTED not set');

const noScheme = url.replace(/^postgres(ql)?:\/\//, '');
const at = noScheme.lastIndexOf('@');
const creds = noScheme.slice(0, at);
const hostPart = noScheme.slice(at + 1);
const colon = creds.indexOf(':');
const user = creds.slice(0, colon);
const rawPass = creds.slice(colon + 1);
const [hostPort = '', database = 'postgres'] = hostPart.split('/');
const [host, port = '5432'] = hostPort.split(':');

console.log('user:', user, '| host:', host, '| port:', port, '| db:', database);
console.log('password length (chars):', rawPass.length, '| contains %:', rawPass.includes('%'));

async function attempt(label: string, password: string): Promise<boolean> {
  const client = new pg.Client({
    host,
    port: Number(port),
    database,
    user,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const r = await client.query('select current_user');
    console.log(`${label}: OK (current_user=${r.rows[0].current_user})`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`${label}: ${(err as Error).message}`);
    await client.end().catch(() => {});
    return false;
  }
}

const rawOk = await attempt('raw password', rawPass);
if (!rawOk && rawPass.includes('%')) {
  await attempt('url-decoded password', decodeURIComponent(rawPass));
}
