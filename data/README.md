# data/

Plek voor JSON-importbestanden voor veilingen.

## Conventie

Bestandsnaam: `<huis>-<jaar>-import.json`

Voorbeelden:
- `aloga-2026-import.json`
- `zangersheide-2026-import.json`

Importbestanden worden ingelezen door scripts in `../scripts/` en mappen op de
kolommen van de `lots`-tabel (zie `../supabase/migrations/0001_init.sql`).
