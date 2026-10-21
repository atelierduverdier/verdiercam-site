# =========================================================================
# logiciel-a-jour.sh — le VRAI logiciel, remis sur GitHub et construit, pour les scripts qui le font tourner
# =========================================================================
# À SOURCER, pas à lancer : « source "$(dirname "$0")/logiciel-a-jour.sh" ». Partagé le 21/10/2026 par
# capturer-pieces.sh (une capture par pièce) et exporter-trace.sh (le G-code du tracé de l'accueil) : une seule copie de
# travail, une seule construction.
#
# Une copie de travail À PART, remise sur GitHub (origin/main) à chaque passage — le dossier de travail du logiciel
# porte souvent le travail en cours d'autres sessions. Construite sous plafond mémoire.
#
# Entrée : JOURNAL_CONSTRUCTION, le fichier où écrire la sortie de la construction.
# Sortie : LOGICIEL (la copie de travail) et EXE (le binaire construit).

LOGICIEL=${VERDIERCAM_CAPTURES:-$HOME/Projets/logiciels/verdiercam-captures}
DEPOT=$HOME/Projets/logiciels/verdiercam-imgui

if [ ! -d "$LOGICIEL" ]; then
    git -C "$DEPOT" worktree add -q --detach "$LOGICIEL" origin/main
fi
git -C "$LOGICIEL" fetch -q origin
git -C "$LOGICIEL" checkout -q --detach origin/main
# Les sous-modules (vendor/entt, vendor/imgui) : la copie de travail ne sait pas les cloner d'un chemin local ; on les
# reprend du clone du minuteur du site, aux mêmes commits.
CLONE_MINUTEUR=$HOME/.local/state/verdiercam-site/verdiercam-imgui
for m in entt imgui; do
    if [ ! -e "$LOGICIEL/vendor/$m/CMakeLists.txt" ] && [ ! -e "$LOGICIEL/vendor/$m/imgui.h" ]; then
        rsync -a --exclude .git "$CLONE_MINUTEUR/vendor/$m/" "$LOGICIEL/vendor/$m/"
    fi
done
[ -f "$LOGICIEL/build/build.ninja" ] || cmake -S "$LOGICIEL" -B "$LOGICIEL/build" -G Ninja -DCMAKE_BUILD_TYPE=RelWithDebInfo > /dev/null
echo "construction du logiciel ($(git -C "$LOGICIEL" log --oneline -1 | cut -c1-60))…"
systemd-run --user --scope -q -p MemoryMax=10G cmake --build "$LOGICIEL/build" --target verdiercam -j3 > "$JOURNAL_CONSTRUCTION" 2>&1 \
    || { tail -20 "$JOURNAL_CONSTRUCTION"; exit 1; }
EXE=$LOGICIEL/build/src/app/verdiercam
