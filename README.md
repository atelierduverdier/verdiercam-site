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
| la durée de l'essai | `src/scene/Licence.h` (`kJoursEssai`) |
| les numéros de version de la page Nouveautés | l'historique git du logiciel, jour par jour (le texte, lui, est écrit dans `site/nouveautes.json`) |
| le tracé de l'accueil (parcours de fraise, puis la pièce) | le G-code d'une pièce du catalogue (`TRACE_PIECE` dans `site/chemins.py`), exporté par le vrai logiciel : `outils/exporter-trace.sh`, dessiné par `site/trace_piece.py` |
| le mode d'emploi, sous `/mode-emploi/` | `realisations/manuel-verdiercam/sortie/web`, fabriqué là-bas par `python3 fabriquer.py --web` (sans le laser) |

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

## L'identité

Le site a **sa propre identité**, à part de l'Atelier du Verdier (demandé le 06/10/2026 :
« plus moderne, ne suis pas ma charte, pas sombre »).

**Le style « plan »** (20/11/2026). Christophe avait vu le site d'un autre logiciel du même domaine au même dessin que
le nôtre — fond crème, un seul orange, grotesque serrée, cartes arrondies à ombre douce, pastilles, bande de chiffres,
coches : le gabarit des pages faites par une IA (« je cherche quelque chose de professionnel, design, léger et qui ne
ressemble pas à de l'IA […] qui me ressemble »). Des quatre directions dessinées (catalogue d'outillage, planche
gravée, plan, carnet d'atelier), il a pris **le plan, avec la photo de l'atelier**. La page se lit comme un **dessin
technique d'atelier** : blanc franc, encre noire, une grille fine là où l'on dessine, des cadres au trait, **aucun
arrondi, aucune ombre, aucun dégradé**, les repères de section dans une petite case en mono, et l'orange de l'oiseau
— c'est aussi celui de la machine — pour ce qui est parcours ou action. Polices : **IBM Plex** (libre, OFL), l'étroite
pour les titres, la normale pour le texte, la mono pour les cotes ; dans `site/polices/`, réduites au latin et servies
d'ici en WOFF2 : la page ne demande rien à Google.

La page d'accueil : une **feuille** et ses repères de colonnes — à gauche le titre, à droite la **vue de dessus** d'une
vraie pièce, **le tracé** (le parcours de fraise de l'engrenage du catalogue, lu dans son G-code, qui se dessine en
sept secondes puis laisse la roue découpée ; CSS seul, d'emblée fini si le visiteur a demandé moins d'animations), et
sous elle le **cartouche**, signé par l'oiseau qui se dessine. Puis la capture de la gravure florale et sa **loupe**
(`RECADRAGES` dans `generer.py`), **la photo de la machine** de l'atelier (`site/photos/`, `PHOTOS`) avec l'histoire
de Christophe, la présentation en vidéo, **le parcours** — quatre jalons fixés à gauche pendant que les quatre vues
défilent à droite (croquis, usinage, simulation, pilotage) — et les sections de détail, la sortie, les questions.

Le mode d'emploi et le configurateur viennent d'ailleurs avec leur propre feuille : le site pose après elle une
**surcouche « plan »** (`site/style/mode-emploi.css`, `site/style/configurateur.css`, fonction `surcouche` de
`generer.py`) — mêmes polices, encre noire, cadres au trait. Ni le manuel (son PDF, les fiches F1) ni le dépôt du
logiciel ne changent.

| fichier | rôle |
|---|---|
| `site/gabarits/page.html` | le squelette de chaque page : barre, pied, visionneuse |
| `site/style/verdiercam.css` | toute la mise en page |
| `site/style/verdiercam.js` | l'oiseau qui se dessine, l'apparition des blocs, les vidéos, la visionneuse |

**L'orange n'écrit pas de texte courant** : sur fond clair il ne fait que 2,9:1. Le texte
orange prend `--orange-encre`, et le bouton plein met une encre sombre sur l'orange.

Tout est facultatif côté script : sans lui, l'oiseau est dessiné, les blocs sont visibles,
les vidéos ont leurs boutons, les quatre jalons sont en encre pleine. L'apparition au
défilement se mesure au `scroll` (pas d'IntersectionObserver, qui laissait des blocs
invisibles après un saut d'ancre) et, passé deux secondes, tout se montre quoi qu'il arrive.

## Le domaine

`verdiercam.fr` et `verdiercam.com`, pris chez OVH le 06/10/2026. Le `CNAME` est écrit
dans `site/public/` à chaque génération. La fréquentation remonte au GoatCounter de
l'atelier, préfixée `/verdiercam`.
