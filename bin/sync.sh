#!/usr/bin/env bash
#
# sync.sh — veilige sync tussen MacBook en Mac mini.
#
# Veilige sync; kan NOOIT iets onomkeerbaars doen:
#   - pull alleen fast-forward (--ff-only); bij uiteenlopende takken stopt
#     het met een duidelijke melding i.p.v. te mergen of te overschrijven
#   - done pusht NOOIT geforceerd en commit niets als de build faalt
#
# Gebruik:
#   bin/sync.sh                 # status: lopen we voor/achter op GitHub?
#   bin/sync.sh pull            # veilig ophalen (fast-forward) vóór je werkt
#   bin/sync.sh done "tekst"    # sessie-einde: build-check → commit → push
#                               # (alleen gevolgde wijzigingen; nieuwe
#                               #  bestanden enkel met:  done "tekst" +new)
#
# Onderdeel 3 (dit een vaste gewoonte maken in de werkwijze-docs) volgt
# na akkoord.

set -euo pipefail

# Altijd vanuit de repo-root werken, ongeacht waar het script wordt gestart.
cd "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"

branch="$(git rev-parse --abbrev-ref HEAD)"

say()  { printf '%s\n' "$*"; }
ok()   { printf '✅ %s\n' "$*"; }
warn() { printf '⚠️  %s\n' "$*"; }
err()  { printf '❌ %s\n' "$*" >&2; }

status() {
  git fetch origin --quiet

  if ! git rev-parse --verify --quiet "origin/$branch" >/dev/null; then
    warn "Tak '$branch' bestaat nog niet op GitHub (nog niets om mee te vergelijken)."
    return 0
  fi

  local ahead behind
  behind="$(git rev-list --count "HEAD..origin/$branch")"
  ahead="$(git rev-list --count "origin/$branch..HEAD")"

  say "Tak: $branch"
  if [ "$behind" = 0 ] && [ "$ahead" = 0 ]; then
    ok "Volledig in sync met GitHub."
  elif [ "$behind" -gt 0 ] && [ "$ahead" = 0 ]; then
    warn "Je loopt $behind commit(s) ACHTER op GitHub. Doe: bin/sync.sh pull"
  elif [ "$ahead" -gt 0 ] && [ "$behind" = 0 ]; then
    warn "Je hebt $ahead lokale commit(s) die nog niet op GitHub staan (nog niet gepusht)."
  else
    warn "Takken lopen UITEEN: $ahead lokaal vs $behind op GitHub. Niet automatisch oplosbaar — vraag Claude om dit veilig samen te voegen."
  fi

  if ! git diff --quiet || ! git diff --cached --quiet; then
    warn "Je hebt niet-opgeslagen wijzigingen in de werkmap."
  fi
}

pull() {
  git fetch origin --quiet

  if ! git rev-parse --verify --quiet "origin/$branch" >/dev/null; then
    warn "Tak '$branch' staat niet op GitHub — niets om op te halen."
    return 0
  fi

  local behind ahead
  behind="$(git rev-list --count "HEAD..origin/$branch")"
  ahead="$(git rev-list --count "origin/$branch..HEAD")"

  if [ "$behind" = 0 ]; then
    ok "Al up-to-date met GitHub ($branch)."
    [ "$ahead" -gt 0 ] && warn "Wel $ahead nog-niet-gepushte lokale commit(s)."
    return 0
  fi

  if [ "$ahead" -gt 0 ]; then
    err "Takken lopen uiteen ($ahead lokaal vs $behind op GitHub)."
    err "Fast-forward kan niet zonder mogelijk werk te raken."
    err "STOP — vraag Claude om dit veilig samen te voegen. Er is niets gewijzigd."
    exit 1
  fi

  say "↓ $behind commit(s) ophalen van GitHub ($branch)…"
  if git pull --ff-only origin "$branch" --quiet; then
    ok "Bijgewerkt naar de laatste versie. (Tip: 'npm install' als bibliotheken wijzigden.)"
  else
    err "Pull geweigerd door git (waarschijnlijk niet-opgeslagen wijzigingen)."
    err "Niets overschreven. Sla je werk op of vraag Claude om hulp."
    exit 1
  fi
}

# Onderdeel 2 — veilig sessie-einde: build-check → commit → push.
# Pusht NOOIT geforceerd. Faalt de build → niets gecommit/gepusht.
done_session() {
  local msg="${1:-}"
  local flag="${2:-}"          # "+new" = ook untracked bestanden meenemen

  # Reeds gevolgde, gewijzigde/verwijderde bestanden.
  local tracked_changes="" ; git diff --quiet || tracked_changes=1
  git diff --cached --quiet || tracked_changes=1
  # Nieuwe (untracked) bestanden, .gitignore gerespecteerd.
  local untracked ; untracked="$(git ls-files --others --exclude-standard)"

  local ahead=0
  if git rev-parse --verify --quiet "origin/$branch" >/dev/null; then
    ahead="$(git rev-list --count "origin/$branch..HEAD")"
  fi

  if [ -z "$tracked_changes" ] && [ -z "$untracked" ] && [ "$ahead" = 0 ]; then
    ok "Niets te doen — alles al opgeslagen én gepusht."
    return 0
  fi

  # Untracked bestanden NOOIT stilzwijgend meenemen (anders sleep je losse
  # bestanden mee die er niet bij horen). Alleen met expliciete '+new'.
  local include_new=""
  if [ -n "$untracked" ]; then
    if [ "$flag" = "+new" ]; then
      include_new=1
      warn "Nieuwe bestanden worden óók vastgelegd (+new):"
      printf '   %s\n' $untracked
    else
      warn "Niet-gevolgde bestanden worden NIET meegenomen:"
      printf '   %s\n' $untracked
      warn 'Hoort één ervan er wél bij? Gebruik: bin/sync.sh done "tekst" +new'
    fi
  fi

  if [ -z "$tracked_changes" ] && [ -z "$include_new" ]; then
    if [ "$ahead" -gt 0 ]; then
      say "Geen nieuwe wijzigingen om vast te leggen; wel $ahead commit(s) om te pushen."
    else
      ok "Niets vast te leggen (alleen niet-gevolgde bestanden, bewust overgeslagen)."
      return 0
    fi
  fi

  if { [ -n "$tracked_changes" ] || [ -n "$include_new" ]; } && [ -z "$msg" ]; then
    err "Er zijn wijzigingen, maar geen omschrijving meegegeven."
    err 'Gebruik: bin/sync.sh done "korte omschrijving van wat je deed"'
    exit 1
  fi

  # Verplichte build-check vóór elke commit (werkmethode-principe).
  say "🔨 Build-check (npm run build)…"
  if ! npm run build >/tmp/sync-build.log 2>&1; then
    err "Build FAALT — er wordt NIETS gecommit of gepusht."
    err "Laatste regels:"
    tail -n 12 /tmp/sync-build.log >&2
    exit 1
  fi
  ok "Build geslaagd."

  if [ -n "$tracked_changes" ] || [ -n "$include_new" ]; then
    git add -u                       # gevolgde wijzigingen
    [ -n "$include_new" ] && git add -A   # + expliciet gevraagde nieuwe
    say "Wordt vastgelegd:"
    git diff --cached --name-status
    git commit -q -m "$msg

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
    ok "Vastgelegd: $msg"
  fi

  say "↑ Pushen naar GitHub ($branch)…"
  if git push -u origin "$branch" --quiet 2>/tmp/sync-push.log; then
    ok "Gepusht. Andere Mac kan nu 'bin/sync.sh pull' doen."
  else
    err "Push geweigerd (waarschijnlijk lopen de takken uiteen)."
    err "Je commit staat veilig lokaal. NIET geforceerd."
    err "Doe eerst: bin/sync.sh pull   (of vraag Claude om te helpen samenvoegen)."
    tail -n 5 /tmp/sync-push.log >&2
    exit 1
  fi
}

case "${1:-status}" in
  status) status ;;
  pull)   pull ;;
  done)   done_session "${2:-}" "${3:-}" ;;
  *)      err "Onbekend commando '${1}'. Gebruik: bin/sync.sh [status|pull|done]"; exit 1 ;;
esac
