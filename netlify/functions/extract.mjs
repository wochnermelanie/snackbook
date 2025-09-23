export async function handler(event) {
  try {
    const { url } = JSON.parse(event.body);

    if (!url || !url.includes("instagram.com")) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Ungültige URL" })
      };
    }

    // HTML von Instagram holen
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    const html = await res.text();

    // OG Meta Tags extrahieren
    const ogImage = html.match(/property="og:image" content="([^"]+)"/)?.[1] || "";
    const ogTitle = html.match(/property="og:title" content="([^"]+)"/)?.[1] || "";
    const ogDesc = html.match(/property="og:description" content="([^"]+)"/)?.[1] || "";

    // Rezept-Objekt bauen
    const recipe = {
      title: ogTitle || "Instagram Import",
      image: ogImage,
      description: ogDesc,
      ingredients: ogDesc ? ogDesc.split(/\n|,|;/).filter(x => x.length > 3) : [],
      steps: [],
      source: url,
      createdAt: Date.now()
    };

    return {
      statusCode: 200,
      body: JSON.stringify(recipe)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
