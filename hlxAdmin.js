// Make sure to run this commands in the terminal:
// npm install --save-dev dotenv axios
// add a .env file with the content: AEM_AUTH_TOKEN=your-auth-token
// Add npm scripts in package.json:
// "clear-cache": "node clearCache.js cache"
// "reindex": "node clearCache.js reindex"
// Then run the script using: npm run clear-cache or npm run reindex
//
// Optional path parameter (defaults to /*):
// node clearCache.js cache /specific/path
// node clearCache.js reindex /docs/*

require('dotenv').config();
const axios = require('axios');

const ORG = 'knennigtri';
const REPO = 'aem-ue-summit';
const BRANCH = 'main';

const operations = {
  cache: {
    endpoint: 'cache',
    method: 'POST',
    description: 'Cache cleared',
  },
  reindex: {
    endpoint: 'index',
    method: 'POST',
    description: 'Reindex completed',
  },
};

(async () => {
  const operation = process.argv[2];
  const path = process.argv[3] || '/*';

  if (!operation || !operations[operation]) {
    // eslint-disable-next-line no-console
    console.error('❌ Please specify operation: cache or reindex');
    // eslint-disable-next-line no-console
    console.error('Usage: node clearCache.js [cache|reindex] [path]');
    process.exit(1);
  }

  const config = operations[operation];
  const url = `https://admin.hlx.page/${config.endpoint}/${ORG}/${REPO}/${BRANCH}${path}`;

  try {
    // eslint-disable-next-line no-console
    console.log(`🔄 Starting ${operation} for path: ${path}`);
    // eslint-disable-next-line no-console
    console.log(`📍 URL: ${url}`);

    const response = await axios({
      method: config.method,
      url,
      headers: {
        'User-Agent': 'insomnia/10.1.1-adobe',
        'x-hlx-auth': process.env.AEM_AUTH_TOKEN,
      },
    });

    // eslint-disable-next-line no-console
    console.log(`✅ ${config.description} for ${path}:`, response.data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`❌ Failed to ${operation} ${path}:`, err.response?.data || err.message);
    process.exit(1);
  }
})();
