import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only API: POST /api/import-collection { url, name, house, location, date, status }
// Draait de scraper + Supabase-import server-side (Node), zodat er geen CORS
// is en de browser enkel op een knop hoeft te klikken. Werkt tijdens `npm run dev`.
function importCollectionApi(env) {
  return {
    name: 'import-collection-api',
    configureServer(server) {
      server.middlewares.use('/api/import-collection', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end('Method Not Allowed')
        }
        const json = (code, obj) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        }
        try {
          const SUPABASE_URL = env.VITE_SUPABASE_URL
          const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY
          if (!SUPABASE_URL || !SUPABASE_KEY) {
            return json(500, { error: 'Supabase env ontbreekt in .env.local (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).' })
          }

          let body = ''
          for await (const chunk of req) body += chunk
          const params = JSON.parse(body || '{}')
          if (!params.url) return json(400, { error: 'url ontbreekt' })

          const [{ createClient }, { importCollection }] = await Promise.all([
            import('@supabase/supabase-js'),
            import('./scripts/lib/import-collection.mjs'),
          ])
          const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

          const result = await importCollection({
            supabase,
            url: params.url,
            name: params.name,
            house: params.house,
            location: params.location,
            date: params.date,
            status: params.status || 'planned',
            lotTypeKey: params.lotTypeKey || 'foal',
            updateExisting: params.updateExisting,
            enrich: params.enrich !== false,
          })
          json(200, result)
        } catch (e) {
          json(500, { error: e?.message || String(e) })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), importCollectionApi(env)],
  }
})
