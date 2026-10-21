#!/usr/bin/env python3
# =========================================================================
# trace_piece.py — le parcours réel de la fraise, dessiné en tête de l'accueil
# =========================================================================
# 21/10/2026 (maquette validée par Christophe, puis « branche-la sur la génération du site ») : le G-code d'une pièce du
# catalogue, EXPORTÉ PAR LE VRAI LOGICIEL (outils/exporter-trace.sh), rejoué en SVG animé. Rien n'est retouché :
#
#   - le trait orange       le centre de la fraise, passe la plus profonde de chaque contour (les passes du dessus
#                           repassent au même endroit) ;
#   - la fraise             un tiret de longueur nulle à bout rond qui avance sur LE MÊME chemin que le trait, au même
#                           rythme : il ne peut pas s'en écarter (offset-path et animateMotion, essayés, le plaçaient
#                           à quelques millimètres) ;
#   - les déplacements      en gris fin, trois fois plus vite qu'une coupe ;
#   - le trait de scie      ce même centre, épaissi au Ø de la fraise lu dans l'en-tête, à bouts et coins ronds : c'est
#                           exactement la matière enlevée ; là où la dernière passe remonte (les onglets), le bois reste ;
#   - la pièce              l'intérieur du contour le plus long, moins l'intérieur des autres ;
#   - le perçage (G81…)     un trou du Ø de l'outil.
#
# Animation en CSS seul (aucun script) ; quand le visiteur a demandé moins d'animations, la pièce finie s'affiche
# d'emblée. Les classes portent toutes « trace- » : la page a déjà ses .tete et .fraise.
#
#   python3 site/trace_piece.py <pièce.ngc> <sortie.svg>     pour la regarder seule
# =========================================================================

import math
import re
import sys
from pathlib import Path

RAPIDE = 3.0          # à l'écran, un déplacement à vide va trois fois plus vite qu'une coupe
MARGE = 8.0           # autour de la pièce, en mm
PLACE_COTE = 12.0     # sous la pièce, pour sa cote

_MOT = re.compile(r'([A-Z])(-?\d+(?:\.\d+)?)')


def lire(gcode: str) -> dict:
    """Les mouvements du programme, les perçages, les Ø d'outils, la version qui l'a écrit."""
    lignes = gcode.splitlines()
    entete = '\n'.join(lignes[:20])
    diametres = {int(t): float(d) for t, d in re.findall(r'\(\s*T(\d+)\s*-\s*Ø([\d.]+)', entete)}
    version = re.search(r'Généré par VerdierCAM ([\d.]+)', entete)
    x = y = 0.0
    z = 50.0
    mode, outil = 0, 1
    mouvements, percages = [], []
    for brute in lignes:
        texte = re.sub(r'\(.*?\)', '', brute).strip()
        if not texte:
            continue
        mots = _MOT.findall(texte)
        g = [float(v) for lettre, v in mots if lettre == 'G']
        v = {lettre: float(val) for lettre, val in mots if lettre != 'G'}
        if 'T' in v and 'M' in v:
            outil = int(v['T'])
        if any(c in g for c in (73, 81, 82, 83)):
            x, y = v.get('X', x), v.get('Y', y)
            percages.append((x, y, diametres.get(outil, 3.0)))
            continue
        for c in g:
            if c in (0, 1, 2, 3):
                mode = int(c)
        if not any(k in v for k in 'XYZ'):
            continue
        nx, ny, nz = v.get('X', x), v.get('Y', y), v.get('Z', z)
        mouvements.append((mode, x, y, z, nx, ny, nz, v.get('I', 0.0), v.get('J', 0.0)))
        x, y, z = nx, ny, nz
    if not mouvements:
        raise ValueError("aucun mouvement dans le G-code")
    return {'mouvements': mouvements, 'percages': percages, 'fraise': diametres.get(1, 3.0),
            'version': version.group(1) if version else '', 'lignes': len(lignes)}


def dernieres_passes(mouvements: list) -> list:
    """[(z du fond, [mouvements de la dernière passe])] — un contour par morceau de coupe entre deux remontées."""
    contours, courant = [], []
    for mv in mouvements:
        if mv[0] == 0 or mv[6] > 0:
            if courant:
                contours.append(courant)
                courant = []
            continue
        courant.append(mv)
    if courant:
        contours.append(courant)
    passes = []
    for c in contours:
        zmin = min(mv[6] for mv in c)
        # depuis le premier mouvement qui ARRIVE au fond ; les onglets qui suivent en font partie. S'il y DESCEND (la fin
        # d'une rampe d'entrée), on part du suivant : la rampe en zigzag de l'alésage de l'engrenage (0.99.108) finit par un
        # arc qui traverse le trou, et le remplir laissait un croissant de bois au milieu. Le tour au fond se referme de
        # toute façon sur son départ.
        debut = next(k for k, mv in enumerate(c) if abs(mv[6] - zmin) < 1e-3)
        if c[debut][3] > zmin + 1e-3 and debut + 1 < len(c):
            debut += 1
        passe = [mv for mv in c[debut:] if not (mv[1] == mv[4] and mv[2] == mv[5])]   # sans les mouvements en Z seuls
        if passe:
            passes.append((zmin, passe))
    return passes


def svg(gcode: str, duree: float = 7.0, legende: str = '') -> dict:
    """Le SVG animé et ce qu'on en dit : {'svg', 'version', 'lignes', 'largeur'} (largeur de la pièce, en mm)."""
    lu = lire(gcode)
    passes = dernieres_passes(lu['mouvements'])
    if not passes:
        raise ValueError("aucune passe de coupe dans le G-code")
    fraise = lu['fraise']

    points = [(mv[4], mv[5]) for _, p in passes for mv in p] + [(px, py) for px, py, _ in lu['percages']]
    xmin, xmax = min(a for a, _ in points), max(a for a, _ in points)
    ymin, ymax = min(b for _, b in points), max(b for _, b in points)
    X0, Y0 = xmin - MARGE, ymin - MARGE
    L = (xmax - xmin) + 2 * MARGE
    H = (ymax - ymin) + 2 * MARGE + PLACE_COTE
    haut = (ymax - ymin) + 2 * MARGE          # la zone de la pièce, au-dessus de la cote

    def P(a, b):  # l'écran retourne y : le dessin reste le même, vu de dessus
        return f'{a - X0:.2f} {haut - (b - Y0):.2f}'

    def segment(mv):
        t, x0, y0, _, x1, y1, _, i, j = mv
        if t in (2, 3):
            r = math.hypot(i, j)
            cx, cy = x0 + i, y0 + j
            a0, a1 = math.atan2(y0 - cy, x0 - cx), math.atan2(y1 - cy, x1 - cx)
            balayage = ((a1 - a0) if t == 3 else (a0 - a1)) % (2 * math.pi) or 2 * math.pi
            # le dessin vu de dessus garde son sens : G2 reste horaire, et l'horaire de SVG est le drapeau 1
            sens = 1 if t == 2 else 0
            if balayage > 2 * math.pi - 1e-6:   # un cercle entier : deux demi-arcs
                return (f'A{r:.3f} {r:.3f} 0 0 {sens} {P(2 * cx - x0, 2 * cy - y0)}'
                        f'A{r:.3f} {r:.3f} 0 0 {sens} {P(x1, y1)}', r * balayage)
            return f'A{r:.3f} {r:.3f} 0 {1 if balayage > math.pi else 0} {sens} {P(x1, y1)}', r * balayage
        return f'L{P(x1, y1)}', math.hypot(x1 - x0, y1 - y0)

    coupes = []   # (d, longueur, passe, z du fond)
    for zmin, passe in passes:
        d, longueur = f'M{P(passe[0][1], passe[0][2])}', 0.0
        for mv in passe:
            s, l = segment(mv)
            d += s
            longueur += l
        coupes.append((d, longueur, passe, zmin))

    # L'ordre du programme : chaque passe, et entre deux, le déplacement à vide. (genre, d, durée relative, perçage)
    sequence, pos = [], None
    for c in coupes:
        debut = (c[2][0][1], c[2][0][2])
        if pos is not None:
            sequence.append(('vide', f'M{P(*pos)}L{P(*debut)}', math.dist(pos, debut) / RAPIDE, None))
        sequence.append(('coupe', c[0], c[1], None))
        pos = (c[2][-1][4], c[2][-1][5])
    for px, py, dd in lu['percages']:
        sequence.append(('vide', f'M{P(*pos)}L{P(px, py)}', math.dist(pos, (px, py)) / RAPIDE, None))
        sequence.append(('percage', '', 4.0, (px, py, dd)))
        pos = (px, py)

    total = sum(e[2] for e in sequence)
    t, traits, fraises = 0.0, [], []
    for genre, d, poids, trou in sequence:
        debut, temps = t / total * duree, max(poids / total * duree, 0.02)
        t += poids
        if genre == 'percage':
            px, py, dd = trou
            x, y = P(px, py).split()
            traits.append(f'<circle class="trace-percage" cx="{x}" cy="{y}" r="{dd / 2:.2f}" style="animation-delay:{debut:.3f}s"/>')
            continue
        traits.append(f'<path class="trace-{genre}" pathLength="1" d="{d}" '
                      f'style="animation-delay:{debut:.3f}s,var(--fin);animation-duration:{temps:.3f}s,.8s"/>')
        fraises.append(f'<path class="trace-fraise" pathLength="1" d="{d}" '
                       f'style="animation-delay:{debut:.3f}s;animation-duration:{temps:.3f}s"/>')

    # La pièce : le contour le plus long est l'extérieur, les autres sont des jours.
    exterieur = max(coupes, key=lambda c: c[1])
    interieurs = [c for c in coupes if c is not exterieur]

    def scie(c):
        """Les morceaux de la dernière passe qui vont au fond : le trait de scie. Les onglets en sont exclus."""
        morceaux, d = [], ''
        for mv in c[2]:
            if mv[3] <= c[3] + 1e-3 and mv[6] <= c[3] + 1e-3:
                d = (d or f'M{P(mv[1], mv[2])}') + segment(mv)[0]
            elif d:
                morceaux.append(d)
                d = ''
        return morceaux + ([d] if d else [])

    scies = [d for c in coupes for d in scie(c)]
    trous = [f'<circle class="trace-jour" cx="{P(px, py).split()[0]}" cy="{P(px, py).split()[1]}" r="{dd / 2:.2f}"/>'
             for px, py, dd in lu['percages']]

    # La cote : la largeur de la PIÈCE (le centre de la fraise passe un rayon au-dehors), sous elle, au trait.
    ex = [(mv[4], mv[5]) for mv in exterieur[2]]
    gauche, droite = min(a for a, _ in ex) + fraise / 2, max(a for a, _ in ex) - fraise / 2
    largeur = droite - gauche
    yc = haut + PLACE_COTE * .25
    xg, xd = gauche - X0, droite - X0
    cote = (f'<path class="trace-cote-trait" d="M{xg:.2f} {yc - 2.2:.2f}V{yc + 2.2:.2f}M{xd:.2f} {yc - 2.2:.2f}V{yc + 2.2:.2f}'
            f'M{xg:.2f} {yc:.2f}H{xd:.2f}"/>'
            f'<text class="trace-cote" x="{(xg + xd) / 2:.2f}" y="{yc + PLACE_COTE * .55:.2f}">'
            f'{f"{largeur:.1f}".replace(".", ",")} mm</text>')

    fin = duree + .2
    trait = L / 125      # l'épaisseur des traits suit la taille de la pièce
    pas = 10.0
    # le quadrillage tombe sur les dizaines de millimètres de la pièce, pas sur le bord du dessin
    grille = ''.join(f'M{(-X0) % pas + k * pas:.2f} 0V{H:.1f}' for k in range(int(L // pas) + 1)) + \
             ''.join(f'M0 {(haut + Y0) % pas + k * pas:.2f}H{L:.1f}' for k in range(int(H // pas) + 1))
    dessin = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {L:.2f} {H:.2f}" class="trace-piece" role="img"
     aria-label="{legende or 'Le parcours de la fraise, tiré du G-code réel, puis la pièce découpée'}">
<style>
.trace-piece{{--fin:{fin:.2f}s}}
.trace-piece .trace-grille{{fill:none;stroke:rgba(21,23,28,.06);stroke-width:{trait * .25:.3f}}}
.trace-piece .trace-coupe{{fill:none;stroke:#ff6d00;stroke-width:{trait:.3f};stroke-linecap:round;stroke-linejoin:round;
  stroke-dasharray:1 2;stroke-dashoffset:1.01;animation:trace-tracer linear forwards,trace-estomper ease forwards}}
.trace-piece .trace-vide{{fill:none;stroke:#6a7080;stroke-width:{trait * .4:.3f};stroke-dasharray:1 2;stroke-dashoffset:1.01;
  opacity:.55;animation:trace-tracer linear forwards,trace-eteindre forwards}}
.trace-piece .trace-fraise{{fill:none;stroke:#15171c;stroke-width:{fraise + trait * .6:.3f};stroke-linecap:round;
  stroke-dasharray:0 3;opacity:0;animation:trace-avancer linear}}
.trace-piece .trace-percage{{fill:#fdfcfa;stroke:#ff6d00;stroke-width:{trait * .6:.3f};transform-box:fill-box;
  transform-origin:center;transform:scale(0);animation:trace-percer .35s forwards}}
.trace-piece .trace-bois,.trace-piece .trace-apres{{opacity:0;animation:trace-montrer .8s var(--fin) forwards}}
.trace-piece .trace-apres{{animation-delay:calc(var(--fin) + .4s)}}
.trace-piece .trace-scie{{fill:none;stroke:#fdfcfa;stroke-width:{fraise:.2f};stroke-linejoin:round;stroke-linecap:round}}
.trace-piece .trace-jour{{fill:#fdfcfa}}
.trace-piece .trace-cote-trait{{fill:none;stroke:#6a7080;stroke-width:{trait * .3:.3f}}}
.trace-piece .trace-cote{{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:{L / 30:.2f}px;fill:#474c57;
  text-anchor:middle}}
@keyframes trace-tracer{{from{{stroke-dashoffset:1}}to{{stroke-dashoffset:0}}}}
@keyframes trace-avancer{{from{{opacity:1;stroke-dashoffset:0}}to{{opacity:1;stroke-dashoffset:-1}}}}
@keyframes trace-eteindre{{to{{opacity:0}}}}
@keyframes trace-estomper{{to{{opacity:.28}}}}
@keyframes trace-montrer{{to{{opacity:1}}}}
@keyframes trace-percer{{to{{transform:scale(1)}}}}
@media (prefers-reduced-motion:reduce){{
  .trace-piece .trace-coupe{{animation:none;stroke-dashoffset:0;opacity:.28}}
  .trace-piece .trace-vide,.trace-piece .trace-fraise{{display:none}}
  .trace-piece .trace-percage{{animation:none;transform:none}}
  .trace-piece .trace-bois,.trace-piece .trace-apres{{animation:none;opacity:1}}
}}
</style>
<defs>
  <linearGradient id="trace-fil-du-bois" x1="0" y1="0" x2="1" y2=".25">
    <stop offset="0" stop-color="#ecd3a8"/><stop offset=".55" stop-color="#e3c391"/><stop offset="1" stop-color="#d9b47d"/>
  </linearGradient>
  <filter id="trace-ombre" x="-10%" y="-10%" width="120%" height="120%">
    <feDropShadow dx="0" dy="{trait * .9:.2f}" stdDeviation="{trait * 1.3:.2f}" flood-color="#15171c" flood-opacity=".18"/>
  </filter>
</defs>
<path class="trace-grille" d="{grille}"/>
<g class="trace-bois" filter="url(#trace-ombre)">
<path d="{exterieur[0]}Z" fill="url(#trace-fil-du-bois)"/>
{''.join(f'<path class="trace-jour" d="{c[0]}Z"/>' for c in interieurs)}{''.join(trous)}
{''.join(f'<path class="trace-scie" d="{d}"/>' for d in scies)}
</g>
<g>
{chr(10).join(traits)}
</g>
<g>
{chr(10).join(fraises)}
</g>
<g class="trace-apres">{cote}</g>
</svg>'''
    return {'svg': dessin, 'version': lu['version'], 'lignes': lu['lignes'], 'largeur': largeur}


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit("python3 site/trace_piece.py <pièce.ngc> <sortie.svg>")
    r = svg(Path(sys.argv[1]).read_text(encoding='utf-8'))
    Path(sys.argv[2]).write_text(r['svg'], encoding='utf-8')
    print(f"{r['lignes']} lignes de G-code (VerdierCAM {r['version'] or '?'}), pièce de {r['largeur']:.1f} mm, "
          f"{len(r['svg']) // 1024} Ko")
