#!/usr/bin/env python3
# =========================================================================
# chemins.py — où vit ce dont le site de VerdierCAM tire sa matière
# =========================================================================
# UN SEUL ENDROIT, comme pour le portail atelierduverdier.fr : au prochain
# rangement de ~/Projets, c'est ce fichier qu'on corrige, et lui seul.
#
#   python3 site/chemins.py      dit ce qui manque, d'un coup
# =========================================================================

from pathlib import Path

PROJETS = Path.home() / 'Projets'

# Le logiciel : la version dans le CMakeLists, les familles d'opérations
# dans le noyau, le logo dans les ressources. Lus, jamais recopiés.
VERDIERCAM = PROJETS / 'logiciels' / 'verdiercam-imgui'
VERDIERCAM_CMAKE = VERDIERCAM / 'CMakeLists.txt'
VERDIERCAM_OPERATION = VERDIERCAM / 'src' / 'cam' / 'Operation.h'
VERDIERCAM_LOGO = VERDIERCAM / 'ressources' / 'logo-verdiercam.svg'
POLICES = VERDIERCAM / 'ressources' / 'polices'        # Inter, JetBrains Mono

# Les captures et les clips : refaits par capturer.sh, dans le vrai logiciel.
PRESENTATION = PROJETS / 'realisations' / 'presentation-verdiercam'
CAPTURES = PRESENTATION / 'captures'
CLIPS = PRESENTATION / 'clips'

TOUT = {
    'CMakeLists (version)': VERDIERCAM_CMAKE,
    'Operation.h (familles)': VERDIERCAM_OPERATION,
    'logo VerdierCAM': VERDIERCAM_LOGO,
    'captures': CAPTURES,
    'clips': CLIPS,
    'polices du logiciel': POLICES,
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
