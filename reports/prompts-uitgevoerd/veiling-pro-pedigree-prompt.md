# Veiling Pro — Pedigree Sport Level & Result Fields (Lot Admin Page)

## Context

This is an existing system called Veiling Pro. I want to add new fields to the pedigree section on the **lot admin page**. Do not touch any other admin pages or shared pedigree forms.

---

## What to build

For each of the three dam lines in the pedigree, add two linked fields:

1. A **sport level dropdown** (optional)
2. A **result dropdown** — only shown when a sport level is selected

The three dam lines are: **dam**, **dam's dam**, and **dam's dam's dam**.

---

## Field names (database)

Add 6 new nullable fields to the lot model/table:

```
dam_sport_level          (nullable string/enum)
dam_result               (nullable string/enum)
damsdam_sport_level      (nullable string/enum)
damsdam_result           (nullable string/enum)
damsdamsdam_sport_level  (nullable string/enum)
damsdamsdam_result       (nullable string/enum)
```

---

## Dropdown values

**Sport level** (same list for all three):
```
(blank — not set)
1.20m
1.25m
1.30m
1.35m
1.40m
1.45m
1.50m
1.55m
1.60m
Grand Prix
```

**Result** (same list for all three):
```
(blank — not set)
Placed
Winner
```

---

## Behaviour

- The result dropdown is **hidden** when sport level is blank
- The result dropdown **appears** as soon as any sport level value is selected
- If sport level is reset to blank, the result field resets to blank and hides again
- All six fields are fully optional — nothing is required

---

## Scope

- Changes apply to the **lot admin page only**
- Values are stored per lot in the database
- Both values are shown on the **public lot detail page** if set, next to the mare's name — e.g. `Grand Prix – Winner`
- No layout changes to the public page beyond displaying the value when present

---

## Instructions

1. First, locate and show me where lot fields are currently defined: model, database migration, admin form, and public detail template
2. Write the database migration to add the 6 new nullable fields
3. Update the lot admin page with the three field pairs and the conditional show/hide logic (pure JS or whatever pattern is already used in this codebase — match the existing style)
4. Update the public lot detail page to display the values when set
5. Show me every changed file in full
