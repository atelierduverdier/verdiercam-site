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
# Le configurateur de pièces (15/10/2026) : son cœur WebAssembly et pieces.json ne sont pas dans git — ils se
# reconstruisent depuis les pièces COMMITÉES du logiciel. Sans ce pas, le site repartait avec le configurateur d'avant.
if ! "$VCAM/outils/construire-wasm.sh" >"$ETAT/wasm.log" 2>&1; then
    prevenir -u critical "Site VerdierCAM" "Le configurateur ne se construit pas (voir $ETAT/wasm.log) : rien de republié."
    exit 1
fi
# REPUBLIER_SEC=1 : tout refaire sans rien pousser (pour essayer le minuteur).
if python3 "$SITE/site/publier.py" ${REPUBLIER_SEC:+--sec} >"$ETAT/publier.log" 2>&1; then
    [ -n "${REPUBLIER_SEC:-}" ] && { echo "essai : généré, rien poussé"; exit 0; }
    echo "$version" >"$ETAT/version"
    prevenir "Site VerdierCAM" "Republié : version $version."
else
    prevenir -u critical "Site VerdierCAM" "La publication a échoué (voir $ETAT/publier.log)."
    exit 1
fi
