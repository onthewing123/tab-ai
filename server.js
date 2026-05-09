require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { FirecrawlClient } = require('@mendable/firecrawl-js');

const app = express();
const port = process.env.PORT || 3001;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const firecrawl = new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY });

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const stripMarkdown = (text) => {
  text = text.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return text.trim();
};

const MENU_PROMPT_SUFFIX = `Determine the menu name/type (e.g. "A La Carte", "Set Lunch Menu", "Drinks Menu", "Dessert Menu", "Prix Fixe", "Tasting Menu" — infer from the content). Then determine whether it is a set menu / prix fixe menu (fixed price tiers with course choices) or an à la carte menu (items each with their own price).

If à la carte, return exactly:
{"type":"alacarte","menuName":string,"items":[{"section":string,"name":string,"description":string,"price":number}]}

If set or prix fixe, return exactly:
{"type":"set","menuName":string,"options":[{"label":string,"price":number}],"courses":[{"name":string,"items":[{"name":string,"description":string,"supplement":number}]}]}

For set menus: "options" are the price tiers (e.g. Lunch £32.95 / Dinner £38.95, or 2 courses £28 / 3 courses £35). "courses" are the meal stages (Starter, Main, Dessert etc). "supplement" is the extra charge above the base price, or 0 if none. All prices as numbers in GBP.

Return ONLY valid JSON. No markdown, no backticks, no explanation.`;

const parseAndRespond = (raw, res) => {
  const parsed = JSON.parse(raw);
  const menuName = parsed.menuName || '';
  if (parsed.type === 'set') {
    if (!Array.isArray(parsed.options) || !Array.isArray(parsed.courses)) {
      return res.status(422).json({ error: 'Invalid set menu structure' });
    }
    res.json({ type: 'set', menuName, options: parsed.options, courses: parsed.courses });
  } else {
    const items = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({ error: 'No menu items found' });
    }
    res.json({ type: 'alacarte', menuName, items });
  }
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

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
              text: `Analyze this restaurant menu image. ${MENU_PROMPT_SUFFIX}`,
            },
          ],
        },
      ],
    });

    const raw = stripMarkdown(message.content[0].text);
    console.log('[read-menu] raw response:', raw);
    parseAndRespond(raw, res);
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

  console.log('[scrape-menu] received url:', url);

  if (!url) return res.status(400).json({ error: 'Missing url in request body' });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('URL must start with http:// or https://');
  } catch (urlErr) {
    console.error('[scrape-menu] url parse error:', urlErr.message);
    return res.status(400).json({ error: urlErr.message });
  }

  const IMAGE_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  const extMatch = parsedUrl.pathname.match(/\.([a-z]+)$/i);
  const imageMediaType = extMatch ? IMAGE_TYPES['.'+extMatch[1].toLowerCase()] : null;

  try {
    if (imageMediaType) {
      console.log('[scrape-menu] detected image url, media type:', imageMediaType);
      const imageResponse = await fetch(parsedUrl.href);
      if (!imageResponse.ok) {
        return res.status(422).json({ error: 'Could not fetch image from that URL' });
      }
      const base64 = Buffer.from(await imageResponse.arrayBuffer()).toString('base64');

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageMediaType, data: base64 } },
            { type: 'text', text: `Analyze this restaurant menu image. ${MENU_PROMPT_SUFFIX}` },
          ],
        }],
      });

      const raw = stripMarkdown(message.content[0].text);
      console.log('[scrape-menu] claude image response:', raw);
      return parseAndRespond(raw, res);
    }

    const scrapeResult = await firecrawl.scrape(parsedUrl.href, {
      formats: ['markdown'],
      waitFor: 3000,
    });
    console.log('[scrape-menu] firecrawl response:', JSON.stringify(scrapeResult, null, 2));

    if (!scrapeResult.markdown) {
      return res.status(422).json({ error: 'Could not extract content from that page' });
    }

    const truncated = scrapeResult.markdown.slice(0, 12000);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this restaurant menu text extracted from a webpage. ${MENU_PROMPT_SUFFIX}\n\nMenu text:\n${truncated}`,
      }],
    });

    const raw = stripMarkdown(message.content[0].text);
    console.log('[scrape-menu] raw response:', raw);
    parseAndRespond(raw, res);
  } catch (err) {
    console.error('[scrape-menu] error message:', err.message);
    console.error('[scrape-menu] error status:', err.status);
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
