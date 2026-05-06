-- Migratie 0023: debrief-tekst per collectie.
--
-- Bij "Veiling afgesloten" in de cockpit kan Frederik nu nog een
-- debrief-tekst meegeven (vrij veld voor opmerkingen, terugblik,
-- bijzonderheden, etc.). Wordt zichtbaar op de summary-pagina en
-- bewerkbaar via de metadata-editor op CollectionPage.
--
-- Additieve migratie, geen impact op bestaande data.

alter table collections add column debrief_text text;
