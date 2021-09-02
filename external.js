require('dotenv').config();

const kapi = require('kucoin-node-api');
const { Telegraf } = require('telegraf');

const config = {
  apiKey: process.env.KC_API_KEY,
  secretKey: process.env.KC_API_SECRET,
  passphrase: process.env.KC_API_PASSPHRASE,
  environment: 'live',
};

kapi.init(config);

async function getAssets() {
  const { data } = await kapi.getAccounts();
  return data;
}

async function getTickers(pretty= true) {
  const { data } = await kapi.getAllTickers();
  if (!pretty) return data.ticker;

  const obj = {};
  data.ticker.forEach((ticker) => {
    const { symbol } = ticker;
    obj[symbol] = ticker;
  });
  return obj;
}

async function getStatus() {
  const assets = await getAssets();
  const tickers = await getTickers();

  const prices = {};
  const data = {};

  assets.forEach((asset) => {
    const { type, currency } = asset;
    if (type !== 'margin' || ['USDC', 'USDT', 'USD'].includes(currency)) return;
    const symbol = `${currency}-USDT`;
    const symbolTicker = tickers[symbol];
    const { last } = symbolTicker;
    const price = Number(last);
    prices[currency] = price;

    let { balance, available } = asset;
    balance = Number(balance);
    available = Number(available);

    if (balance === 0) return;

    data[currency] = {
      symbol: currency,
      price,
      amount: {
        base: available,
        quote: Number((available*price).toFixed(2)),
      }
    };
  });

  return data;
}

async function showStatus(ctx, next) {
  const data = await getStatus();

  const msg = [];

  Object.keys(data).forEach((symbol) => {
    const { price, amount: { base: baseAmt, quote: quoteAmt } } = data[symbol];
    msg.push(`${symbol}: ${baseAmt} @ ${price}, total ${quoteAmt}`);
  });
  
  await ctx.reply(msg.join('\n'));

  return next();
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply('Welcome'));
bot.command('status', showStatus);
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

(async () => {
  try {
    await getStatus();
  } catch(err) {
    console.log(err)
  } 
})();
