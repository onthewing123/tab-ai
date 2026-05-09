require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const puppeteer = require('puppeteer');

const app = express();
const port = process.env.PORT || 3001;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const stripMarkdown = (text) => {
  text = text.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return text.trim();
};

app.post('/api/read-menu', async (req, res) => {
  const { base64, mediaType } = req.body;

  if (!base64 || !mediaType) {
    return res.status(400).json({ error: 'Missing base64 or mediaType in request body' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            mediaType === 'application/pdf'
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
              : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            {
              type: 'text',
              text: `Analyze this restaurant menu image. Determine whether it is a set menu / prix fixe menu (fixed price tiers with course choices) or an à la carte menu (items each with their own price).

If à la carte, return exactly:
{"type":"alacarte","items":[{"section":string,"name":string,"description":string,"price":number}]}

If set or prix fixe, return exactly:
{"type":"set","options":[{"label":string,"price":number}],"courses":[{"name":string,"items":[{"name":string,"description":string,"supplement":number}]}]}

For set menus: "options" are the price tiers (e.g. Lunch £32.95 / Dinner £38.95, or 2 courses £28 / 3 courses £35). "courses" are the meal stages (Starter, Main, Dessert etc). "supplement" is the extra charge above the base price, or 0 if none. All prices as numbers in GBP.

Return ONLY valid JSON. No markdown, no backticks, no explanation.`,
            },
          ],
        },
      ],
    });

    const raw = stripMarkdown(message.content[0].text);
    console.log('[read-menu] raw response:', raw);
    const parsed = JSON.parse(raw);

    if (parsed.type === 'set') {
      if (!Array.isArray(parsed.options) || !Array.isArray(parsed.courses)) {
        return res.status(422).json({ error: 'Invalid set menu structure' });
      }
      res.json({ type: 'set', options: parsed.options, courses: parsed.courses });
    } else {
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(422).json({ error: 'No menu items found in image' });
      }
      res.json({ type: 'alacarte', items });
    }
  } catch (err) {
    console.error('[read-menu] message:', err.message);
    console.error('[read-menu] status:', err.status);
    console.error('[read-menu] full error:', JSON.stringify(err, null, 2));
    if (err.response) {
      console.error('[read-menu] response body:', JSON.stringify(err.response, null, 2));
    }
    const status = err.status ?? 500;
    res.status(status).json({ error: err.message || 'Failed to process menu' });
  }
});

app.post('/api/scrape-menu', async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: 'Missing url in request body' });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('bad protocol');
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (compatible; TabAI/1.0)');
    await page.goto(parsedUrl.href, { waitUntil: 'networkidle2', timeout: 30000 });

    const text = await page.evaluate(() => {
      document.querySelectorAll('script, style, nav, footer, [aria-hidden="true"]').forEach(el => el.remove());
      return document.body?.innerText || '';
    });

    await browser.close();
    browser = null;

    if (!text || text.length < 50) {
      return res.status(422).json({ error: 'Could not extract content from that page' });
    }

    const truncated = text.slice(0, 12000);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze this restaurant menu text extracted from a webpage. Determine whether it is a set menu / prix fixe menu (fixed price tiers with course choices) or an à la carte menu (items each with their own price).

If à la carte, return exactly:
{"type":"alacarte","items":[{"section":string,"name":string,"description":string,"price":number}]}

If set or prix fixe, return exactly:
{"type":"set","options":[{"label":string,"price":number}],"courses":[{"name":string,"items":[{"name":string,"description":string,"supplement":number}]}]}

For set menus: "options" are the price tiers (e.g. Lunch £32.95 / Dinner £38.95, or 2 courses £28 / 3 courses £35). "courses" are the meal stages (Starter, Main, Dessert etc). "supplement" is the extra charge above the base price, or 0 if none. All prices as numbers in GBP.

Return ONLY valid JSON. No markdown, no backticks, no explanation.

Menu text:
${truncated}`,
        },
      ],
    });

    const raw = stripMarkdown(message.content[0].text);
    console.log('[scrape-menu] raw response:', raw);
    const parsed = JSON.parse(raw);

    if (parsed.type === 'set') {
      if (!Array.isArray(parsed.options) || !Array.isArray(parsed.courses)) {
        return res.status(422).json({ error: 'Invalid set menu structure' });
      }
      res.json({ type: 'set', options: parsed.options, courses: parsed.courses });
    } else {
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(422).json({ error: 'No menu items found on that page' });
      }
      res.json({ type: 'alacarte', items });
    }
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('[scrape-menu] message:', err.message);
    console.error('[scrape-menu] status:', err.status);
    console.error('[scrape-menu] full error:', JSON.stringify(err, null, 2));
    const status = err.status ?? 500;
    res.status(status).json({ error: err.message || 'Failed to scrape menu' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, 'client/dist')));
  app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, 'client/dist/index.html'))
  );
}

app.listen(port, () => {
  console.log(`Tab AI server → http://localhost:${port}`);
});
