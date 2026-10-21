#!/bin/bash
# =========================================================================
# capturer-pieces.sh — une capture par pièce du catalogue, pour la page « Pièces » du site
# =========================================================================
# 16/10/2026, Christophe : « faire un screenshot de chaque pièce dans la liste afin de le mettre sur le site avec le nom
# de la pièce ; ça me permettra aussi de la voir pour valider ».
#
# Chaque pièce est rejouée dans le VRAI logiciel, comme à la main : Dessin › Pièces paramétriques, la pièce choisie
# dans la galerie, Insérer, Usiner, puis la simulation en 3D de la pièce finie. La vue 3D seule est gardée (recadrée,
# sans les panneaux), dans PRESENTATION/pieces/<pièce>.png — le site la lit là (site/chemins.py, CAPTURES_PIECES).
#
# Le logiciel : une copie de travail À PART, remise sur GitHub (origin/main) et construite à chaque passage — le
# dossier de travail du logiciel porte souvent le travail en cours d'autres sessions. Seules les pièces dont le script
# a changé depuis leur capture sont refaites (l'empreinte du .vcs est notée à côté de la capture) ; --toutes les refait.
#
#   outils/capturer-pieces.sh [--toutes] [pièce …]
#
# Le thème Clair (16/10/2026, Christophe : « et prends le thème clair ») : celui du site. Sans fenêtre à soi : HOME et XDG_CONFIG_HOME jetables (les réglages de Christophe ne sont ni lus ni écrits), chaque
# capture sous plafond mémoire et minuterie.
set -euo pipefail

SORTIE=$HOME/Projets/realisations/presentation-verdiercam/pieces
TOUTES=0
CHOIX=()
for a in "$@"; do
    case "$a" in
        --toutes) TOUTES=1 ;;
        *) CHOIX+=("$a") ;;
    esac
done
mkdir -p "$SORTIE"

# ── Le logiciel, à jour et construit (partagé avec exporter-trace.sh) ──
JOURNAL_CONSTRUCTION=$SORTIE/.construction.log
source "$(dirname "$(readlink -f "$0")")/logiciel-a-jour.sh"

# Le thème que la galerie ouvre d'office : celui de la première pièce par ordre de nom (comme scene::ListerPieces).
THEME_OUVERT=$(python3 - "$LOGICIEL/ressources/pieces" <<'PY'
import glob, os, re, sys
pieces = []
for f in glob.glob(os.path.join(sys.argv[1], '*.vcs')):
    t = open(f, encoding='utf-8').read().split('\n')
    l0 = t[0][2:].strip() if t and t[0].startswith('//') else ''
    nom = os.path.splitext(os.path.basename(f))[0].replace('-', ' ').replace('_', ' ')
    if ' — ' in l0 and l0.index(' — ') <= 60 and not re.search(r'[a-zàâçéèêëîïôûùüÿ]', l0[:l0.index(' — ')]):
        nom = l0[:l0.index(' — ')].strip().lower()
    nom = nom[:1].upper() + nom[1:]
    theme = next((x.split(':', 1)[1].strip() for x in t if x.startswith('// thème :')), '')
    pieces.append((nom.encode('utf-8'), theme or 'Autres'))
print(sorted(pieces)[0][1])
PY
)

MAISON=$(mktemp -d)
trap 'rm -rf "$MAISON"' EXIT
faites=0; gardees=0; ratees=()
for vcs in "$LOGICIEL"/ressources/pieces/*.vcs; do
    P=$(basename "$vcs" .vcs)
    if [ ${#CHOIX[@]} -gt 0 ] && [[ ! " ${CHOIX[*]} " =~ " $P " ]]; then continue; fi
    EMPREINTE=$(sha1sum "$vcs" | cut -c1-40)
    if [ $TOUTES = 0 ] && [ ${#CHOIX[@]} = 0 ] && [ -f "$SORTIE/$P.png" ] && [ "$(cat "$SORTIE/$P.sha1" 2>/dev/null)" = "$EMPREINTE" ]; then
        gardees=$((gardees + 1)); continue
    fi
    T=$(grep -m1 "^// thème :" "$vcs" | sed 's/^\/\/ thème : //' || true); T=${T:-Autres}   # sans thème : « Autres »
    R=""
    [ "$T" != "$THEME_OUVERT" ] && R="+clic:pieces:theme:$THEME_OUVERT+attendre:150+clic:pieces:theme:$T+attendre:150"
    BRUTE=$MAISON/$P.png
    systemd-run --user --scope -q -p MemoryMax=6G timeout -s KILL 300 env HOME="$MAISON" XDG_CONFIG_HOME="$MAISON/config" \
        "$EXE" --capture "$BRUTE" --taille 1536x1024 --theme Clair \
        --scenario "ctrl:N+attendre:300+clic:menu:Dessin+clic:article:Pièces paramétriques+attendre:500$R+clic:pieces:$P+attendre:2500+clic:pieces:Insérer+attendre:3000+px:1234,211+attendre:300+onglet:Simulation+attendre:500+vue:3D+attendre:300+sim:Pièce finie+attendre:15000+touches:0+attendre:1500" \
        > "$MAISON/$P.log" 2>&1 || true
    if grep -q "choisie « $P »" "$MAISON/$P.log" && [ -s "$BRUTE" ]; then
        # La vue 3D seule : sous la barre de la vue, entre l'arbre du projet et le panneau de droite.
        python3 -c "
from PIL import Image
Image.open('$BRUTE').convert('RGB').crop((308, 162, 1224, 790)).save('$SORTIE/$P.png', optimize=True)"
        echo "$EMPREINTE" > "$SORTIE/$P.sha1"
        faites=$((faites + 1)); echo "  ok  $P"
    else
        ratees+=("$P"); echo "  RATÉE  $P ($(grep -E '^pièces|inconnue' "$MAISON/$P.log" | head -1 | cut -c1-100))"
    fi
done
echo "$faites capture(s) faite(s), $gardees gardée(s)${ratees:+, ratées : ${ratees[*]}}"
[ ${#ratees[@]} = 0 ]
