// Serverless function for Vercel: /api/compare-prices
// Requires Node 18+ (global fetch).

function badRequest(res, msg) {
  res.statusCode = 400;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: msg }));
}

function unauthorized(res) {
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "unauthorized" }));
}

export default async function handler(req, res) {
  try {
    const API_KEY = process.env.API_KEY;
    const SERPAPI_KEY = process.env.SERPAPI_KEY;

    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET");
      return res.end("Method Not Allowed");
    }

    if (req.headers["x-api-key"] !== API_KEY) {
      return unauthorized(res);
    }

    const { brand, model, countries, gtin } = req.query || {};
    if (!brand || !model) return badRequest(res, "brand and model are required");

    const query = `${brand} ${model}`.trim();
    const list = (typeof countries === "string" ? countries.split(",") : Array.isArray(countries) ? countries : ["MX","US","CO"])
      .map(s => s.trim().toUpperCase())
      .filter(s => ["MX","US","CO"].includes(s));

    // 1) FX to USD
    const fxResp = await fetch("https://api.exchangerate.host/latest?base=USD");
    const fx = await fxResp.json();
    const toUSD = (amount, currency) => {
      if (amount == null || !currency) return null;
      if (currency === "USD") return Number(Number(amount).toFixed(2));
      const r = fx && fx.rates && fx.rates[currency];
      if (!r) return null;
      return Number((Number(amount) * (1 / r)).toFixed(2));
    };

    const offers = [];

    // 2) Mercado Libre
    const meliSites = { MX: "MLM", CO: "MCO" };
    for (const c of list.filter(x => ["MX","CO"].includes(x))) {
      const site = meliSites[c];
      const url = `https://api.mercadolibre.com/sites/${site}/search?q=${encodeURIComponent(query)}`;
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        for (const it of (data.results || []).slice(0, 8)) {
          const price = it.price;
          const currency = it.currency_id || (c === "MX" ? "MXN" : "COP");
          offers.push({
            country: c,
            marketplace: "Mercado Libre",
            title: it.title,
            url: it.permalink,
            seller: (it.seller && it.seller.nickname) || "",
            price,
            currency,
            price_usd: toUSD(price, currency)
          });
        }
      }
    }

    // 3) Google Shopping via SerpAPI (optional but recommended)
    async function serpFor(countryCode) {
      if (!SERPAPI_KEY) return;
      const params = new URLSearchParams({
        engine: "google_shopping",
        q: query,
        api_key: SERPAPI_KEY,
        gl: countryCode === "MX" ? "mx" : countryCode === "CO" ? "co" : "us",
        hl: countryCode === "US" ? "en" : "es"
      });
      const serpUrl = `https://serpapi.com/search?${params.toString()}`;
      const s = await fetch(serpUrl);
      if (!s.ok) return;
      const j = await s.json();
      for (const r of (j.shopping_results || []).slice(0, 8)) {
        const priceNum = r.extracted_price || (r.price && parseFloat(String(r.price).replace(/[^\d.]/g, "")));
        if (!priceNum) continue;
        const cur = countryCode === "MX" ? "MXN" : countryCode === "CO" ? "COP" : "USD";
        offers.push({
          country: countryCode,
          marketplace: r.source || "Google Shopping",
          title: r.title,
          url: r.product_link || r.link,
          seller: r.source || "",
          price: priceNum,
          currency: cur,
          price_usd: toUSD(priceNum, cur)
        });
      }
    }
    for (const c of list) await serpFor(c);

    // 4) Best by country
    const bestByCountry = {};
    for (const c of list) {
      const inC = offers.filter(o => o.country === c && o.price_usd != null);
      if (inC.length) {
        const best = inC.reduce((a, b) => (a.price_usd < b.price_usd ? a : b));
        bestByCountry[c] = { marketplace: best.marketplace, price_usd: best.price_usd, title: best.title, url: best.url };
      } else {
        bestByCountry[c] = null;
      }
    }

    const payload = {
      query: query,
      ts: new Date().toISOString(),
      base_currency: "USD",
      offers,
      summary: { best_by_country: bestByCountry }
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(JSON.stringify(payload));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
