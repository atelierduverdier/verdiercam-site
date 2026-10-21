#!/usr/bin/env bash
# REPUBLIER LE SITE QUAND LA VERSION DU LOGICIEL CHANGE (07/10/2026, Christophe : « fais le minuteur systemd »).
# Lancé chaque soir par ~/.config/systemd/user/verdiercam-site.timer. Le site lit la version dans le CMakeLists de
# verdiercam-imgui à la génération : un clone propre, remis sur GitHub (voir plus bas), puis on republie si la version a bougé
# depuis la dernière fois. Le manifeste de mise à jour (site/version-publiee.json) n'est PAS touché : c'est
# l'interrupteur, il reste à la main. Le site comme le logiciel se lisent dans des clones à lui, remis sur GitHub : seul
# ce qui est commité et poussé part en ligne.
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
# LE SITE AUSSI, DEPUIS SA COPIE PROPRE (16/10/2026, Christophe : « fais publier le minuteur depuis une copie propre ») :
# publier.py publie tout ce qu'il trouve dans le dossier — le dossier de travail du site porte souvent le travail en cours
# d'une autre session (une page à moitié écrite partait en ligne). Le minuteur a son clone du site, remis chaque fois sur
# la branche main de GitHub : seul ce qui est commité et poussé est publié.
SITE_PROPRE="$ETAT/site"
if [ ! -d "$SITE_PROPRE/.git" ]; then
    git clone -q "$(git -C "$SITE" remote get-url origin)" "$SITE_PROPRE" 2>"$ETAT/pull.log" || {
        prevenir -u critical "Site VerdierCAM" "Le clone du site ne se fait pas (voir $ETAT/pull.log) : rien de republié."; exit 1; }
fi
if ! { git -C "$SITE_PROPRE" fetch -q origin && git -C "$SITE_PROPRE" reset -q --hard origin/main; } 2>"$ETAT/pull.log"; then
    prevenir -u critical "Site VerdierCAM" "Le site ne se met pas à jour depuis GitHub (voir $ETAT/pull.log) : rien de republié."
    exit 1
fi
SITE="$SITE_PROPRE"
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
# LE TRACÉ DE L'ACCUEIL (21/10/2026) : le G-code de la pièce dont la page dessine le parcours, réexporté par le logiciel
# de cette version (outils/exporter-trace.sh, même copie de travail que les captures). Raté : le G-code d'avant reste, la
# génération le dessine et dit de quelle version il vient.
if ! "$SITE/outils/exporter-trace.sh" >"$ETAT/trace.log" 2>&1; then
    prevenir "Site VerdierCAM" "Le G-code du tracé de l'accueil n'a pas été refait (voir $ETAT/trace.log) : celui d'avant est gardé."
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
