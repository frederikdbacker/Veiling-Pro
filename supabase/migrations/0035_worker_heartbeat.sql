-- Migratie 0035: worker_heartbeat — "ik leef nog"-tijdstempel van de scrape-worker.
--
-- Context (zie docs/plan-plak-collectielink-ingest.md): de worker draait op de
-- Mac mini. De webapp toont een online/offline-lampje zodat Frederik vanaf elk
-- toestel ziet of een ingediende import verwerkt zal worden. De worker schrijft
-- elke ~30s `last_seen` weg (op een eigen klokje, ook tijdens een lange scrape);
-- de webapp noemt de worker "online" als die hartslag < 2 min oud is.
--
-- Eén vaste rij (id = 'scrape-worker'). Géén historie/audit — dit is pure
-- live-status, mag overschreven worden.
--
-- VEILIG: additief + idempotent (create table if not exists, drop policy if
-- exists → create policy). RLS permissive, consistent met de rest van het schema.

begin;

create table if not exists worker_heartbeat (
  id          text primary key,         -- vaste sleutel, bv. 'scrape-worker'
  last_seen   timestamptz not null default now(),
  started_at  timestamptz,
  hostname    text,
  note        text
);

alter table worker_heartbeat enable row level security;

drop policy if exists "anon read/write worker_heartbeat" on worker_heartbeat;
create policy "anon read/write worker_heartbeat"
  on worker_heartbeat for all
  using (true) with check (true);

commit;
