-- Migratie 0034: scrape_jobs — wachtrij + onuitwisbaar audit-spoor voor de URL-ingest.
--
-- Context (zie docs/plan-plak-collectielink-ingest.md):
-- Veiling Pro heeft geen backend; een statische SPA kan zelf geen scraper
-- draaien. De gekozen architectuur: de frontend schrijft alleen een job-rij
-- (de geplakte URL + huis-context); een lokale WORKER op de Mac mini pikt de
-- job op, kiest via de gedeelde scraper-registry het juiste bestaande script,
-- draait scraper + import-lots, en schrijft status/voortgang terug. De SPA
-- toont dat live via Supabase realtime (met polling-fallback).
--
-- Audit-discipline (CLAUDE.md §8): een scrape_jobs-rij wordt NOOIT overschreven
-- om historie te wissen. Elke nieuwe poging is een NIEUWE rij (her-scrape =
-- nieuwe job die naar dezelfde collection_id kan wijzen). Alleen de
-- status/progress/log/error-velden van DIE ene run worden tijdens de run
-- bijgewerkt — dat is live-status, geen correctie van een fout.
--
-- VEILIG: volledig additief + idempotent (create table if not exists,
-- drop policy if exists → create policy). Geen bestaande tabel/kolom geraakt.
-- RLS permissive, consistent met de rest van het MVP-schema (single-user).
--
-- ⚠️ BACK-UP VÓÓR UITVOEREN (projectregel: backup vóór elke schemawijziging).
-- Draai dit bestand één keer in de Supabase SQL Editor, NÁ 0033.

begin;

-- 1. Tabel scrape_jobs -------------------------------------------------------
create table if not exists scrape_jobs (
  id            uuid primary key default gen_random_uuid(),
  source_url    text not null,                                    -- de geplakte collectie-link
  house_id      uuid references auction_houses(id) on delete set null,
  collection_id uuid references collections(id)    on delete set null, -- doel (refresh) of resultaat (create)
  scraper_key   text,                  -- door de registry bepaald, bv. 'weauction' / 'fences-catalogus'
  mode          text not null default 'create',  -- 'create' (nieuwe collectie) | 'refresh' (bestaande vullen)
  status        text not null default 'queued',  -- queued | running | done | failed | canceled
  progress      jsonb,                 -- { phase, scraped, expected } voor de voortgangsweergave
  lots_imported int,
  log           text,                  -- mensvriendelijke stappen + scraper-stdout-staart
  error         text,                  -- korte foutmelding in mensentaal voor de UI
  attempts      int  not null default 0,
  created_by    text,                  -- 'frederik' (toekomst: user-id); audit
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create index if not exists idx_scrape_jobs_status  on scrape_jobs(status);
create index if not exists idx_scrape_jobs_house   on scrape_jobs(house_id);
create index if not exists idx_scrape_jobs_created on scrape_jobs(created_at desc);

-- 2. RLS — permissive, consistent met de rest van het schema -----------------
alter table scrape_jobs enable row level security;

drop policy if exists "anon read/write scrape_jobs" on scrape_jobs;
create policy "anon read/write scrape_jobs"
  on scrape_jobs for all
  using (true) with check (true);

-- 3. Realtime — zodat de SPA live de status van een job kan volgen -----------
-- Idempotent: enkel toevoegen aan de realtime-publicatie als de tabel er nog
-- niet in zit. Faalt niet als de publicatie 'supabase_realtime' niet bestaat
-- (dan valt de UI sowieso terug op polling).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'scrape_jobs'
     )
  then
    execute 'alter publication supabase_realtime add table scrape_jobs';
  end if;
end $$;

commit;
