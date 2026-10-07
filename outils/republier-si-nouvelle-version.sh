#!/usr/bin/env bash
# REPUBLIER LE SITE QUAND LA VERSION DU LOGICIEL CHANGE (07/10/2026, Christophe : « fais le minuteur systemd »).
# Lancé chaque soir par ~/.config/systemd/user/verdiercam-site.timer. Le site lit la version dans le CMakeLists de
# verdiercam-imgui à la génération : on rapproche d'abord ce dépôt de GitHub (avance rapide seulement — jamais de
# fusion, jamais rien d'écrasé ; une session en cours garde ses fichiers), puis on republie si la version a bougé
# depuis la dernière fois. Le manifeste de mise à jour (site/version-publiee.json) n'est PAS touché : c'est
# l'interrupteur, il reste à la main.
set -uo pipefail
SITE="$HOME/Projets/site/Site_VerdierCAM"
VCAM="$HOME/Projets/logiciels/verdiercam-imgui"
ETAT="${XDG_STATE_HOME:-$HOME/.local/state}/verdiercam-site"
mkdir -p "$ETAT"
prevenir() { command -v notify-send >/dev/null && notify-send -a "Site VerdierCAM" "$@"; }

if ! git -C "$VCAM" pull -q --ff-only 2>"$ETAT/pull.log"; then
    prevenir -u critical "Site VerdierCAM" "Le dépôt du logiciel ne s'avance pas tout seul (voir $ETAT/pull.log) : rien de republié."
    exit 1
fi
version=$(sed -n 's/^project(VerdierCAM_ImGui VERSION \([0-9.]*\).*/\1/p' "$VCAM/CMakeLists.txt")
[ -n "$version" ] || { prevenir -u critical "Site VerdierCAM" "Version illisible dans le CMakeLists."; exit 1; }
if [ "$version" = "$(cat "$ETAT/version" 2>/dev/null)" ]; then
    exit 0
fi
if python3 "$SITE/site/publier.py" >"$ETAT/publier.log" 2>&1; then
    echo "$version" >"$ETAT/version"
    prevenir "Site VerdierCAM" "Republié : version $version."
else
    prevenir -u critical "Site VerdierCAM" "La publication a échoué (voir $ETAT/publier.log)."
    exit 1
fi
