import { createClient } from '@supabase/supabase-js'

// ============================================================
// Centrale login (Supabase Auth) — LOSSTAAND van het data-project.
//
// De app haalt haar veilingdata uit een eigen Supabase-project
// (zie src/lib/supabase.js). Inloggen + rollen leven in een ánder,
// centraal Supabase-project (igunbmpreaqrlyqnxeud). Daarom een
// tweede, aparte client met eigen env-vars en een eigen storageKey,
// zodat de twee sessies elkaar nooit overschrijven.
//
// Beheer van gebruikers gebeurt elders (central-auth admin-pagina);
// deze app logt enkel in en controleert de toegang.
// ============================================================

const url = import.meta.env.VITE_CENTRAL_AUTH_URL
const key = import.meta.env.VITE_CENTRAL_AUTH_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Centrale-login env vars ontbreken. Zet VITE_CENTRAL_AUTH_URL en ' +
      'VITE_CENTRAL_AUTH_ANON_KEY in .env.local (zie .env.example).'
  )
}

// Rol-waarde voor deze app in de centrale user_roles-tabel.
export const PROJECT_KEY = 'veiling_pro'

export const centralAuth = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Eigen storageKey → geen botsing met een eventuele sessie van het
    // data-project in dezelfde browser.
    storageKey: 'veilingpro-central-auth',
  },
})
