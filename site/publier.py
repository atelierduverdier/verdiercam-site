#!/usr/bin/env python3
# =========================================================================
# publier.py — régénère le site, puis le pousse sur la branche gh-pages
# =========================================================================
# Même geste que le portail : site/public/ devient un dépôt jetable d'un seul
# commit, poussé en force sur gh-pages. L'historique vit sur `main`, dans les
# sources ; gh-pages n'est qu'une sortie.
#
#   python3 site/publier.py          régénère et pousse
#   python3 site/publier.py --sec    régénère seulement
# =========================================================================

import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
PUBLIC = RACINE / 'site' / 'public'
BRANCHE = 'gh-pages'


def courir(cmd, **kw):
    r = subprocess.run(cmd, cwd=kw.pop('cwd', RACINE), text=True,
                       capture_output=True, **kw)
    if r.returncode != 0:
        sys.exit(f"publier : échec de {' '.join(cmd)}\n{r.stderr.strip()}")
    return r.stdout.strip()


def main() -> None:
    r = subprocess.run([sys.executable, str(RACINE / 'site' / 'generer.py')], cwd=RACINE)
    if r.returncode != 0:
        sys.exit("publier : la génération a échoué — rien n'est poussé.")
    # Un champ de site/editeur.json resté vide s'affiche « À REMPLIR » : une page
    # légale incomplète ne part pas en ligne.
    incompletes = [f.name for f in PUBLIC.glob('*.html')
                   if 'class="a-remplir"' in f.read_text(encoding='utf-8')]
    if incompletes:
        sys.exit("publier : « À REMPLIR » dans " + ', '.join(incompletes)
                 + " — compléter site/editeur.json. Rien n'est poussé.")

    if '--sec' in sys.argv:
        print("(--sec : génération seule, rien n'est poussé)")
        return

    distant = courir(['git', 'remote', 'get-url', 'origin'])
    git_jetable = PUBLIC / '.git'
    if git_jetable.exists():
        courir(['rm', '-rf', str(git_jetable)])
    courir(['git', 'init', '-q', '-b', BRANCHE], cwd=PUBLIC)
    courir(['git', 'add', '-A'], cwd=PUBLIC)
    version = courir(['git', 'rev-parse', '--short', 'HEAD'])
    courir(['git', 'commit', '-q', '-m',
            f"Site engendré depuis {version} — ne pas éditer ici"], cwd=PUBLIC)
    courir(['git', 'push', '--force', distant, f'{BRANCHE}:{BRANCHE}'], cwd=PUBLIC)
    courir(['rm', '-rf', str(git_jetable)])
    print(f"poussé sur {BRANCHE} (engendré depuis {version})")


if __name__ == '__main__':
    main()
