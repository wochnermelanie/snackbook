import cheerio from 'cheerio';
export async function handler(event){
  const url = (event.queryStringParameters||{}).url;
  if(!url) return { statusCode:400, body:'url missing' };
  const r = await fetch(url); const html = await r.text();
  const $ = cheerio.load(html); const title = title.first().text().trim();
  return { statusCode:200, headers:{'content-type':'application/json'}, body: JSON.stringify({ ok:true, title }) };
}