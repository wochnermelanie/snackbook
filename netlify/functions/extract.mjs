import cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

export async function handler(event) {
  try {
    const url = (event.queryStringParameters?.url || '').trim();
    if (!url) return json(400, { error: 'Bitte URL angeben ?url=' });

    // Nur http(s)
    if (!/^https?:\/\//i.test(url)) return json(400, { error: 'Ungültige URL' });

    // Instagram / Threads / Facebook Reels erlauben
    const host = new URL(url).hostname.replace(/^www\./,'');
    const allowed = ['instagram.com','www.instagram.com','m.instagram.com'];
    if (!allowed.includes(host)) {
      // Für andere Seiten kannst du später allgemeines Scraping ergänzen
      return json(200, baseRecord({ url, title: '', image: '', caption: '' }));
    }

    // Seite abrufen (Server-zu-Server, keine CORS-Probleme)
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de,en;q=0.9' } });
    const html = await res.text();
    const $ = cheerio.load(html);

    // 1) OG-Daten
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const ogDesc  = $('meta[property="og:description"]').attr('content') || '';

    // 2) JSON-LD, falls vorhanden
    let ldTitle = '', ldImage = '', ldDesc = '';
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).text());
        if (data && typeof data === 'object') {
          ldTitle = data.headline || data.name || ldTitle;
          ldImage = (typeof data.image === 'string' ? data.image : (Array.isArray(data.image) ? data.image[0] : '')) || ldImage;
          ldDesc  = data.caption || data.description || ldDesc;
        }
      } catch {}
    });

    // 3) Caption heuristisch (OG oder JSON-LD oder Fallback auf Seitentext)
    const caption = (ldDesc || ogDesc || '').trim();

    // 4) Titel priorisieren
    const title = (ldTitle || ogTitle || 'Instagram').replace(/\s*\|\s*Instagram\s*$/i,'').trim();

    // 5) Zutaten/Schritte heuristisch aus Caption (grob; kann man später schärfen)
    const { ingredients, steps, tags } = captionToRecipe(caption);

    return json(200, {
      title,
      image: ldImage || ogImage || '',
      caption,
      ingredients,
      steps,
      tags: tags.length ? tags : ['Instagram','Import'],
      source: url,
      macros: null
    });
  } catch (e) {
    return json(500, { error: e.message || 'Extractor Fehler' });
  }
}

// ——— helpers ———
function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) };
}

function baseRecord({ url, title, image, caption }) {
  return { title: title || 'Import', image: image || '', caption: caption || '', ingredients: [], steps: [], tags: ['Import'], source: url, macros: null };
}

function captionToRecipe(txt) {
  if (!txt) return { ingredients: [], steps: [], tags: [] };

  // Split in Zeilen
  const lines = txt.replace(/\r/g,'').split('\n').map(l => l.trim()).filter(Boolean);

  // ganz simple Heuristik:
  const ingredients = [];
  const steps = [];
  const tags = [];

  // #tags einsammeln
  lines.forEach(l => {
    const m = l.match(/#[\p{L}\p{N}_]+/gu);
    if (m) tags.push(...m.map(t=>t.slice(1)));
  });

  // Zutaten: Zeilen mit Mengenangaben (g, ml, EL, TL, Stk, Stück, etc.)
  const ingRe = /(^|\s)(\d+[.,]?\d*\s?(g|ml|l|EL|TL|stk|stück|Stk|Stück)|\d+\s?(x|X)\s?\d+)/i;
  lines.forEach(l => {
    if (ingRe.test(l)) ingredients.push(l);
  });

  // Schritte: Nummerierte oder Listenpunkte
  const stepRe = /^(\d+[\).:]|\*|-)\s+/;
  lines.forEach(l => {
    if (stepRe.test(l)) steps.push(l.replace(stepRe,'').trim());
  });

  // Wenn nichts erkannt, nimm Caption als Notiz in Schritt 1
  if (!ingredients.length && !steps.length && txt) steps.push(txt);

  return { ingredients, steps, tags: Array.from(new Set(tags)).slice(0,20) };
}
