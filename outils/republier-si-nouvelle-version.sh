#!/usr/bin/env bash
# REPUBLIER LE SITE QUAND LA VERSION DU LOGICIEL CHANGE (07/10/2026, Christophe : « fais le minuteur systemd »).
# Lancé chaque soir par ~/.config/systemd/user/verdiercam-site.timer. Le site lit la version dans le CMakeLists de
# verdiercam-imgui à la génération : un clone propre, remis sur GitHub (voir plus bas), puis on republie si la version a bougé
# depuis la dernière fois. Le manifeste de mise à jour (site/version-publiee.json) n'est PAS touché : c'est
# l'interrupteur, il reste à la main.
set -uo pipefail
SITE="$HOME/Projets/site/Site_VerdierCAM"
VCAM="$HOME/Projets/logiciels/verdiercam-imgui"
ETAT="${XDG_STATE_HOME:-$HOME/.local/state}/verdiercam-site"
mkdir -p "$ETAT"
prevenir() { command -v notify-send >/dev/null && notify-send -a "Site VerdierCAM" "$@"; }

# LE CLONE DU MINUTEUR (15/10/2026) : le dossier de travail du logiciel porte presque toujours le travail en cours d'une
# session (des fichiers modifiés que GitHub a aussi changés) — « git pull --ff-only » y échouait et rien ne partait. Le
# minuteur a donc son clone à lui, qu'il remet chaque fois sur la branche main de GitHub (rien n'y est jamais modifié à la
# main) ; le site le lit par VERDIERCAM_DEPOT. Le premier passage le crée (~300 Mo).
CLONE="$ETAT/verdiercam-imgui"
if [ ! -d "$CLONE/.git" ]; then
    git clone -q "$(git -C "$VCAM" remote get-url origin)" "$CLONE" 2>"$ETAT/pull.log" || {
        prevenir -u critical "Site VerdierCAM" "Le clone du logiciel ne se fait pas (voir $ETAT/pull.log) : rien de republié."; exit 1; }
fi
if ! { git -C "$CLONE" fetch -q origin && git -C "$CLONE" reset -q --hard origin/main \
       && git -C "$CLONE" submodule -q update --init --recursive; } 2>"$ETAT/pull.log"; then
    prevenir -u critical "Site VerdierCAM" "Le logiciel ne se met pas à jour depuis GitHub (voir $ETAT/pull.log) : rien de republié."
    exit 1
fi
VCAM="$CLONE"
export VERDIERCAM_DEPOT="$CLONE"
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
# LES CAPTURES DES PIÈCES (16/10/2026) : celles des pièces nouvelles ou changées, refaites dans le vrai logiciel
# (outils/capturer-pieces.sh, sa propre copie de travail construite à part). Une capture ratée n'arrête pas la
# publication : la page « Pièces » montre « capture à venir » à sa place, et on le dit.
if ! "$SITE/outils/capturer-pieces.sh" >"$ETAT/captures.log" 2>&1; then
    prevenir "Site VerdierCAM" "Des captures de pièces ont raté (voir $ETAT/captures.log) : la page les annonce « à venir »."
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
