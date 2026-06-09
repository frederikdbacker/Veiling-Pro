-- Migratie 0026: leeftijdscategorieën als lot_types
--
-- Toevoegen: 2-jarigen en 3-jarigen. Plaats tussen Veulen (10) en
-- Embryo (20) zodat de leeftijdsketen Veulen → 2-jarigen → 3-jarigen
-- → Sportpaard logisch is in de drop-down.
--
-- Veilig: pure inserts in seed-tabel. on conflict (key) do nothing.

insert into lot_types (key, name_nl, display_order) values
  ('two-year-old',   '2-jarigen', 11),
  ('three-year-old', '3-jarigen', 12)
on conflict (key) do nothing;
