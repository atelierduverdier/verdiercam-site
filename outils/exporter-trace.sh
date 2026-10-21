#!/bin/bash
# =========================================================================
# exporter-trace.sh — le G-code de la pièce dont l'accueil du site dessine le parcours
# =========================================================================
# 21/10/2026, Christophe : « branche-la sur la génération du site » (la maquette du tracé : l'engrenage du catalogue,
# son parcours de fraise dessiné en tête de page, puis la roue découpée).
#
# La pièce est rejouée dans le VRAI logiciel, à ses valeurs d'origine (console « executer <pièce>.vcs »), puis son
# programme exporté (console « exporter-gcode »), dans PRESENTATION/trace/<pièce>.ngc — le site le lit là
# (site/chemins.py, TRACE_GCODE) et le dessine (site/trace_piece.py). Refait à chaque passage : le G-code dépend du noyau
# autant que du script de la pièce.
#
#   outils/exporter-trace.sh [pièce]        (par défaut, TRACE_PIECE de site/chemins.py)
#
# Sans fenêtre à soi : HOME et XDG_CONFIG_HOME jetables (les réglages de Christophe ne sont ni lus ni écrits), sous
# plafond mémoire et minuterie.
set -euo pipefail

# La pièce par défaut : celle que le site dessine (TRACE_PIECE dans site/chemins.py), lue, pas recopiée.
PIECE=${1:-$(cd "$(dirname "$(readlink -f "$0")")/../site" && python3 -c 'import chemins; print(chemins.TRACE_PIECE)')}
SORTIE=$HOME/Projets/realisations/presentation-verdiercam/trace
mkdir -p "$SORTIE"

# ── Le logiciel, à jour et construit (partagé avec capturer-pieces.sh) ──
JOURNAL_CONSTRUCTION=$SORTIE/.construction.log
source "$(dirname "$(readlink -f "$0")")/logiciel-a-jour.sh"

VCS=$LOGICIEL/ressources/pieces/$PIECE.vcs
[ -f "$VCS" ] || { echo "pas de pièce « $PIECE » dans $LOGICIEL/ressources/pieces"; exit 1; }

MAISON=$(mktemp -d)
trap 'rm -rf "$MAISON"' EXIT
NGC=$MAISON/$PIECE.ngc
systemd-run --user --scope -q -p MemoryMax=6G timeout -s KILL 300 env HOME="$MAISON" XDG_CONFIG_HOME="$MAISON/config" \
    "$EXE" --capture "$MAISON/capture.png" --taille 1536x1024 --mode usinage \
    --scenario "attendre:300+clic:console:commande+texte:executer $VCS+touche:Return+attendre:3000+patience:120000+attendre:500+clic:console:commande+texte:exporter-gcode $NGC+touche:Return+attendre:800" \
    > "$MAISON/journal.log" 2>&1 || true

# Le dossier jetable est neuf à chaque passage : un fichier non vide qui commence par l'en-tête du logiciel est le
# programme de CE passage. (Ne pas lire le journal : son dernier message n'est pas toujours celui de l'export — le
# 21/10/2026, « Zéro : coin avant gauche… » le suivait.) Pas de fichier : l'export a été refusé (heurt du mandrin, post
# de la machine…) ; on garde le G-code d'avant et on le dit.
if [ -s "$NGC" ] && head -1 "$NGC" | grep -q "Généré par VerdierCAM"; then
    cp "$NGC" "$SORTIE/$PIECE.ngc"
    echo "  ok  $PIECE.ngc — $(wc -l < "$NGC") lignes, $(head -1 "$NGC" | grep -o 'VerdierCAM [0-9.]*')"
else
    echo "  RATÉ  $PIECE.ngc : $(grep -E '^journal' "$MAISON/journal.log" | tail -1 | cut -c1-160)"
    exit 1
fi
