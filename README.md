# Price Comparator API (MX/US/CO)

Un backend mínimo para tu **Action** en ChatGPT que compara precios por marca + modelo
en México, USA y Colombia usando:
- Mercado Libre (API pública)
- Google Shopping vía SerpAPI (para tiendas como Walmart, BestBuy, Target, Falabella, Éxito, Linio, etc.)
- (Opcional) eBay Browse API si agregas EBAY_OAUTH_TOKEN

## Rápido inicio (Vercel)
1) Crea una cuenta en https://vercel.com e inicia sesión.
2) Sube este proyecto a un repositorio en GitHub (botón “+” en tu cuenta de GitHub → **New repository** → arrastra y suelta esta carpeta).
3) En Vercel, clic en **Add New → Project** → **Import Git Repository** y selecciona tu repo.
4) En **Environment Variables**, agrega:
   - `API_KEY` → (elige un secreto, ej. `pon_un_secret_largo`)
   - `SERPAPI_KEY` → tu clave de SerpAPI (https://serpapi.com)
   - (Opcional) `EBAY_OAUTH_TOKEN` → token OAuth de eBay Browse API
5) Deploy.
6) Copia la URL del endpoint: `https://TU-PROYECTO.vercel.app/api/compare-prices`

## Cómo conectar la Action en tu GPT
- En el Editor de GPTs → **Configure → Actions → Add Action → Import from file** y usa el archivo `openapi.yaml` (ajusta el `servers.url` con tu dominio de Vercel).
- Autenticación: **API Key** con nombre de header `X-API-Key` y valor el mismo de tu variable `API_KEY`.

## Endpoint
`GET /api/compare-prices?brand=Samsung&model=Galaxy%20A55&countries=MX,US,CO`

**Headers**: `X-API-Key: TU_API_KEY`

## Respuesta
```json
{
  "query": "Samsung Galaxy A55",
  "ts": "2025-09-28T00:00:00.000Z",
  "base_currency": "USD",
  "offers": [ ... ],
  "summary": { "best_by_country": { "MX": {...}, "US": {...}, "CO": {...} } }
}
```

## Notas
- Los resultados de SerpAPI dependen de indexación/región. Si no configuras `SERPAPI_KEY`, el sistema sigue funcionando con Mercado Libre.
- exchangerate.host se usa para convertir a USD.
- Este proyecto está pensado para **novatos**: solo necesitas subir a GitHub y conectar en Vercel.
