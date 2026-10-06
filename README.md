# verdiercam.fr — le site de VerdierCAM

Site statique de VerdierCAM, la CAO/FAO de la défonceuse de l'Atelier du Verdier.
Engendré par un script Python, servi par GitHub Pages sur **<https://verdiercam.fr>**.

```bash
python3 site/generer.py        # régénère site/public/
python3 site/publier.py        # régénère, puis force-push sur gh-pages
python3 site/chemins.py        # dit ce qui manque, d'un coup
```

`site/public/` est reconstruit à chaque passage et n'est pas versionné.

## Rien n'est recopié à la main

| ce qui est affiché | lu à la génération dans |
|---|---|
| la version | `CMakeLists.txt` de `logiciels/verdiercam-imgui` |
| les familles d'opérations, leur nom, leur phrase | `src/cam/Operation.h` (`FamilyLabel`, `FamilyTip`, `FamilyIsImplemented`) |
| les captures et les clips | `realisations/presentation-verdiercam` (`captures/`, `clips/`) |
| le logo | `ressources/logo-verdiercam.svg` |

Une famille d'opérations nouvelle que `GROUPES` ne range nulle part, une capture citée
par la page et que rien ne publie, une marque `{{…}}` restée vide : la génération
**s'arrête**. Rien d'à moitié engendré ne part en ligne.

**Les captures ne sont pas dans ce dépôt.** Elles se refont dans la présentation, en
rejouant des scénarios dans le vrai logiciel :

```bash
cd ~/Projets/realisations/presentation-verdiercam
VCAM_BIN=<binaire> VCAM_WCS_INI=<repere.ini> HOME=<jetable> XDG_CONFIG_HOME=<jetable>/config ./capturer.sh
```

Puis `python3 site/generer.py` ici. Les images sont publiées en WebP et **nommées par
l'empreinte de leur contenu** : une capture refaite change d'adresse, le cache ne sert
pas l'ancienne.

## La charte

`kit/` vient du portail (`atelierduverdier/site`) : `outils/diffuser_kit.py` de ce
dépôt-là y pose la charte entière, les gabarits `entete.html` / `pied.html` et le logo
en ligne. **On n'édite pas `kit/` ici** : la prochaine diffusion écraserait la retouche.
Ce qui est propre à ce site (les quatre établis, la grille des familles, le logo du
héros) est dans `CSS_LOCAL`, en tête de `site/generer.py`.

## Le domaine

`verdiercam.fr` et `verdiercam.com`, pris chez OVH le 06/10/2026. Le `CNAME` est écrit
dans `site/public/` à chaque génération. La fréquentation remonte au GoatCounter de
l'atelier, préfixée `/verdiercam`.
