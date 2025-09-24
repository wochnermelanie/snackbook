// netlify/functions/insta.mjs
// Instagram import with oEmbed -> HTML scrape fallback.
// Returns: { title, image, text, source, ingredients[], steps[], tags[], macros }

import * as cheerio from 'cheerio';

const OK = (obj) => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(obj),
});

const ERR = (msg, code = 400) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ error: msg }),
});

const isInstaUrl = (u) => {
  try {
    const { hostname, pathname } = new URL(u);
    if (!/instagram\.com$/i.test(hostname)) return false;
    // akzeptiere /p/, /reel/, /tv/, /stories/… (stories führen meist zu Loginwall, aber nicht schlimm)
    return /\/(p|reel|tv|stories)\//i.test(pathname);
  } catch {
    return false;
  }
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

export const handler = async (event) => {
  try {
    const url = (event.queryStringParameters?.url || '').trim();

    if (!url || !isInstaUrl(url)) {
      return ERR('Bitte einen gültigen Instagram-Post/Reel-Link senden.');
    }

    // 1) oEmbed versuchen, falls ENV da ist (funktioniert erst NACH Meta-Review)
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET; // oder Client Token, falls du das bevorzugst
    if (appId && appSecret) {
      try {
        const accessToken = `${appId}|${appSecret}`;
        const oembed = new URL('https://graph.facebook.com/v21.0/instagram_oembed');
        oembed.searchParams.set('url', url);
        oembed.searchParams.set('omitscript', 'true');
        oembed.searchParams.set('access_token', accessToken);

        const r = await fetch(oembed, { headers: { 'User-Agent': UA } });
        if (r.ok) {
          const data = await r.json();
          // oEmbed liefert title, author_name, thumbnail_url, html (iframe) …
          return OK({
            title: data.title || 'Instagram',
            image: data.thumbnail_url || '',
            text: data.author_name ? `von ${data.author_name}` : '',
            source: url,
            ingredients: [],
            steps: [],
            tags: ['Import'],
            macros: null,
          });
        } else {
          // Wenn Feature nicht freigeschaltet (code 10), einfach zum Scrape-Fallback
          // const err = await r.text(); // optional loggen
        }
      } catch {
        // stiller Fallback
      }
    }

    // 2) Fallback: öffentliche Seite scrapen (OG-Tags)
    const resp = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        // kleiner Hint, damit Instagram eine öffentliche Variante liefert
        'Cookie': 'ig_pr=1; ig_nrcb=1',
      },
    });

    if (!resp.ok) return ERR(`Fehler beim Laden (${resp.status}).`, 502);

    const html = await resp.text();
    const $ = cheerio.load(html);

    // OG-Tags
    const og = (prop) => $(`meta[property="${prop}"]`).attr('content')?.trim() || '';
    const title =
      og('og:title') ||
      $('title').text().trim() ||
      'Instagram';
    const image =
      og('og:image') ||
      og('og:image:secure_url') ||
      '';
    const desc =
      og('og:description') ||
      $('meta[name="description"]').attr('content')?.trim() ||
      '';

    // Lightweight Heuristik: Zutaten/Zubereitung aus Caption (wenn vorhanden)
    // – sehr defensiv, oft ist nichts strukturiert.
    const ingredients = [];
    const steps = [];
    const caption = desc || '';
    // einfache Erkennung von Zutaten-Linien (Bulletpoints/Zeilenumbrüche)
    if (caption) {
      const lines = caption.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const ingGuess = lines.filter((l) =>
        /^[•\-–\*]\s|\d+\s?(g|ml|EL|TL|Stk|Stück|Scheiben|Tassen)\b/i.test(l)
      );
      if (ingGuess.length >= 2) ingGuess.forEach((l) => ingredients.push(l.replace(/^[•\-–\*]\s?/, '')));
      const stepGuess = lines.filter((l) => /^(\d+[\.\)]|Schritt\s?\d+)/i.test(l));
      if (stepGuess.length >= 1) stepGuess.forEach((l) => steps.push(l.replace(/^(\d+[\.\)]|Schritt\s?\d+)\s?/, '')));
    }

    return OK({
      title,
      image,
      text: caption,
      source: url,
      ingredients,
      steps,
      tags: ['Import'],
      macros: null,
    });
  } catch (e) {
    return ERR(`Unerwarteter Fehler: ${e.message || e}`, 500);
  }
};
