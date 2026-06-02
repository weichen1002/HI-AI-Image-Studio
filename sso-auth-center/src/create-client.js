import { loadConfig } from './config.js';
import { openDatabase, AuthRepository } from './db.js';
import { randomToken } from './crypto-utils.js';

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function printHelp() {
  console.log(`Usage:
  npm run create-client -- --id my-web --name "My Web" --type confidential --redirect https://app.example.com/auth/callback --scopes "openid profile email offline_access"
  npm run create-client -- --id mobile-app --name "Mobile App" --type public --redirect com.example.app:/oauth/callback

Options:
  --id        Client ID
  --name      Client display name
  --type      public | confidential
  --secret    Client secret. Generated when omitted for confidential clients.
  --redirect  Redirect URI. Repeat or separate with comma.
  --scopes    Allowed scopes. Default: openid profile email
  --trusted   Mark as trusted first-party client
`);
}

if (hasFlag('help') || hasFlag('h')) {
  printHelp();
  process.exit(0);
}

const id = readArg('id');
const name = readArg('name');
const type = readArg('type', 'public');
const redirectArgs = process.argv
  .map((value, index) => (value === '--redirect' ? process.argv[index + 1] : ''))
  .filter(Boolean);
const redirectUris = redirectArgs.flatMap((value) =>
  String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);
const scopes = readArg('scopes', 'openid profile email');
const generatedSecret = type === 'confidential' ? randomToken(32) : '';
const secret = readArg('secret', generatedSecret);

try {
  const config = loadConfig();
  const db = openDatabase(config);
  const repo = new AuthRepository(db, config);
  const client = repo.createClient({
    id,
    name,
    type,
    secret,
    redirectUris,
    allowedScopes: scopes,
    trusted: hasFlag('trusted'),
  });

  console.log(JSON.stringify({
    id: client.id,
    name: client.name,
    type: client.type,
    redirectUris: client.redirectUris,
    allowedScopes: client.allowedScopes,
    trusted: client.trusted,
    ...(client.type === 'confidential' ? { clientSecret: secret } : {}),
  }, null, 2));
} catch (error) {
  console.error(error.message);
  printHelp();
  process.exit(1);
}
