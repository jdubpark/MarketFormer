require('dotenv').config()

const crypto = require('crypto');
const qs = require('querystring');

const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

class Kucoin {
  constructor() {
    const baseURL = 'https://api.kucoin.com';
    this.api = axios.create({
      baseURL,
    });

    // private api
    this.papi = axios.create({
      baseURL,
      headers: {
        'KC-API-KEY': process.env.KC_API_KEY,
        'KC-API-KEY-VERSION': 2,
      },
    });

    this.papi.interceptors.request.use(config => {
      const timestamp = Date.now() + ''; // nonce
      const { method, url: endpoint, params, data } = config;
      const secretKey = process.env.KC_API_SECRET;
      console.log(timestamp, method, endpoint, params, data);
   
      // timestamp + method + endpoint + body
      let strToSign = `${timestamp}+${method.toUpperCase()}+${endpoint}`;

      if (method === 'post' && data) {
        strToSign = `${strToSign}+${JSON.stringify(data)}`;
      } else if (method === 'get' && params && JSON.stringify(params).length !== 2) {
        strToSign = `${strToSign}+${qs.stringify(params)}`;
      } else {
        strToSign = `${strToSign}+`;
      }

      console.log(strToSign);

      const signedKey = crypto.createHmac('sha256', secretKey).update(strToSign).digest('base64');
      const signedPassphrase = crypto.createHmac('sha256', secretKey).update(process.env.KC_API_PASSPHRASE).digest('base64');

      config.headers['KC-API-KEY-TIMESTAMP'] = timestamp;
      config.headers['KC-API-PASSPHRASE'] = signedPassphrase;
      config.headers['KC-API-SIGN'] = signedKey;

      return config;
    });
  }
}


const kucoin = new Kucoin();

async function showStatus(ctx, next) {
  const ledgers = await kucoin.papi.get('/api/v1/accounts/ledgers');
  await ctx.reply(ledgers)
  return next();
}

(async () => {
  try {
    const url = '/api/v1/accounts'; // /api/v1/accounts/ledgers
    const ledgers = await kucoin.papi.get(url);
    console.log(ledgers);
  } catch (e) {
    console.log(e);
  }
})();

/*
bot.start((ctx) => ctx.reply('Welcome'));
bot.command('status', showStatus);
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
*/

