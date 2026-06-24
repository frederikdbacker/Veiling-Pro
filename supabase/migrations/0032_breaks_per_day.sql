-- Migratie 0032: pauzes per veilingdag.
--
-- Vervolg op 0031 (collection_days). Een pauze (BIS-blok) hoort bij een
-- specifieke avond: bij een meerdaagse verkoop heeft elke dag een eigen
-- doorkomstvolgorde en eigen pauzes. We voegen daarom een nullable
-- `collection_day_id` toe aan `collection_breaks` en koppelen bestaande
-- pauzes aan dag 1 van hun collectie.
--
-- VEILIG: additief + idempotent. `collection_id` blijft staan (een pauze
-- hoort nog steeds bij de collectie; de dag is een extra verfijning).
-- on delete cascade: verdwijnt de dag, dan verdwijnt zijn pauze mee
-- (een pauze zonder avond heeft geen betekenis).
--
-- ⚠️ Voer eerst 0031 uit. BACK-UP VÓÓR UITVOEREN.

begin;

alter table collection_breaks
  add column if not exists collection_day_id uuid
  references collection_days(id) on delete cascade;

create index if not exists idx_collection_breaks_day
  on collection_breaks(collection_day_id);

-- Backfill: koppel bestaande pauzes aan dag 1 van hun collectie.
update collection_breaks b
set collection_day_id = d.id
from collection_days d
where d.collection_id = b.collection_id
  and d.day_index = 1
  and b.collection_day_id is null;

commit;

-- Verificatie (handmatig): pauzes zonder dag overblijven? Verwacht 0.
--   select count(*) from collection_breaks where collection_day_id is null;
