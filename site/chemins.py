#!/usr/bin/env python3
# =========================================================================
# chemins.py — où vit ce dont le site de VerdierCAM tire sa matière
# =========================================================================
# UN SEUL ENDROIT, comme pour le portail atelierduverdier.fr : au prochain
# rangement de ~/Projets, c'est ce fichier qu'on corrige, et lui seul.
#
#   python3 site/chemins.py      dit ce qui manque, d'un coup
# =========================================================================

import os
from pathlib import Path

PROJETS = Path.home() / 'Projets'

# Le logiciel : la version dans le CMakeLists, les familles d'opérations
# dans le noyau, le logo dans les ressources. Lus, jamais recopiés.
# VERDIERCAM_DEPOT (15/10/2026) : le minuteur de republication y met son propre clone, propre et remis sur GitHub à chaque
# passage — le dossier de travail, lui, porte souvent le travail en cours d'autres sessions.
VERDIERCAM = Path(os.environ['VERDIERCAM_DEPOT']) if os.environ.get('VERDIERCAM_DEPOT') else PROJETS / 'logiciels' / 'verdiercam-imgui'
VERDIERCAM_CMAKE = VERDIERCAM / 'CMakeLists.txt'
VERDIERCAM_OPERATION = VERDIERCAM / 'src' / 'cam' / 'Operation.h'
VERDIERCAM_LOGO = VERDIERCAM / 'ressources' / 'logo-verdiercam.svg'
# La durée de l'essai (kJoursEssai) : le site l'annonce, le logiciel la tient.
VERDIERCAM_LICENCE = VERDIERCAM / 'src' / 'scene' / 'Licence.h'
POLICES = VERDIERCAM / 'ressources' / 'polices'        # Inter, JetBrains Mono
# Le configurateur de pièces (10/10/2026) : la page et le cœur WebAssembly, construit par outils/construire-wasm.sh
# du logiciel (le .wasm n'est pas versionné : il se construit, puis le site le recopie).
CONFIGURATEUR = VERDIERCAM / 'web' / 'configurateur'

# Les captures et les clips : refaits par capturer.sh, dans le vrai logiciel.
PRESENTATION = PROJETS / 'realisations' / 'presentation-verdiercam'
CAPTURES = PRESENTATION / 'captures'
CLIPS = PRESENTATION / 'clips'
# Une capture par pièce du catalogue (16/10/2026), refaite par outils/capturer-pieces.sh dans le vrai logiciel. Pas dans
# TOUT : une pièce sans capture est signalée à la génération, elle ne l'arrête pas (une pièce poussée hier soir n'a pas
# encore la sienne quand le minuteur republie).
CAPTURES_PIECES = PRESENTATION / 'pieces'
# Le tracé de l'accueil (21/10/2026) : le G-code d'une pièce du catalogue, exporté par le vrai logiciel
# (outils/exporter-trace.sh), dont la page dessine le parcours de fraise (site/trace_piece.py).
TRACE_PIECE = 'engrenage'
TRACE_GCODE = PRESENTATION / 'trace' / f'{TRACE_PIECE}.ngc'

# Le mode d'emploi complet (21/10/2026) : sa version web, fabriquée dans son dossier par « python3 fabriquer.py --web »
# (une page et ses images WebP nommées par leur empreinte, sans les passages laser), recopiée telle quelle sous
# /mode-emploi/.
MODE_EMPLOI = PROJETS / 'realisations' / 'manuel-verdiercam' / 'sortie' / 'web'
# Sa vignette de partage (Facebook…) part d'une de ses captures d'écran, refaites par son capturer.sh.
MODE_EMPLOI_VIGNETTE = PROJETS / 'realisations' / 'manuel-verdiercam' / 'captures' / '00-atelier-simulation.png'

TOUT = {
    'CMakeLists (version)': VERDIERCAM_CMAKE,
    'Operation.h (familles)': VERDIERCAM_OPERATION,
    'logo VerdierCAM': VERDIERCAM_LOGO,
    'Licence.h (durée de l\'essai)': VERDIERCAM_LICENCE,
    'captures': CAPTURES,
    'clips': CLIPS,
    "G-code du tracé de l'accueil (outils/exporter-trace.sh)": TRACE_GCODE,
    'polices du logiciel': POLICES,
    'configurateur (page)': CONFIGURATEUR / 'index.html',
    'configurateur (cœur WebAssembly, outils/construire-wasm.sh)': CONFIGURATEUR / 'verdiercam-coeur.wasm',
    'configurateur (liste des pièces, outils/construire-wasm.sh)': CONFIGURATEUR / 'pieces.json',
    "mode d'emploi (manuel-verdiercam : python3 fabriquer.py --web)": MODE_EMPLOI / 'index.html',
    "mode d'emploi (capture de sa vignette)": MODE_EMPLOI_VIGNETTE,
}


def verifier() -> list:
    """Rend la liste des (nom, chemin) qui n'existent pas."""
    return [(nom, c) for nom, c in TOUT.items() if not c.exists()]


if __name__ == '__main__':
    manquants = verifier()
    for nom, chemin in TOUT.items():
        print(f"  {'OK    ' if chemin.exists() else 'ABSENT'}  {nom:<24} {chemin}")
    print(f"\n{len(TOUT) - len(manquants)}/{len(TOUT)} présents")
    if manquants:
        raise SystemExit(f"{len(manquants)} chemin(s) à corriger dans ce fichier.")
