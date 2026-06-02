import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const app = createApp({ config });

app.listen(config.port, config.host, () => {
  console.log(`SSO auth center listening on ${config.issuer}`);
});
