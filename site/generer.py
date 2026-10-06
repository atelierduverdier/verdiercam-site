#!/usr/bin/env python3
# =========================================================================
# generer.py — le site de VerdierCAM (verdiercam.fr)
# =========================================================================
# Bâti comme le portail atelierduverdier.fr, dont il prend la charte :
# `kit/` est DIFFUSÉ par outils/diffuser_kit.py du dépôt du portail — on ne
# l'édite pas ici, on corrige là-bas et on rediffuse.
#
# La règle de la maison tient ici aussi : rien n'est recopié à la main.
#
#   ce qui est affiché            lu à la génération dans
#   la version                    CMakeLists.txt de verdiercam-imgui
#   les familles d'opérations     src/cam/Operation.h (FamilyLabel, FamilyTip)
#   les captures et les clips     realisations/presentation-verdiercam
#   le logo                       ressources/logo-verdiercam.svg
#
# Une clé absente, une famille sans groupe, une capture manquante ARRÊTENT
# la génération : rien d'à moitié engendré ne part en ligne.
#
#   python3 site/generer.py       régénère site/public/
#   python3 site/publier.py       régénère, puis pousse sur gh-pages
# =========================================================================

import hashlib
import html
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import chemins  # noqa: E402

SITE = Path(__file__).resolve().parent
RACINE = SITE.parent
KIT = RACINE / 'kit'
CONTENU = SITE / 'contenu'
PUBLIC = SITE / 'public'

DOMAINE = 'verdiercam.fr'
ANNEE = '2026'

# GoatCounter : le compte de l'atelier, commun à tous ses sites. Il
# n'enregistre PAS le nom d'hôte : sans préfixe, le « / » d'ici et celui du
# portail tomberaient dans le même seau.
PREFIXE_COMPTEUR = '/verdiercam'

PAGES = [
    {
        'contenu': 'index.html',
        'sortie': 'index.html',
        'titre': "VerdierCAM — du croquis au copeau, sans changer de logiciel",
        'description': "Logiciel de CAO/FAO pour la défonceuse CNC : croquis "
                       "contraint, {{verdiercam.familles}} familles d'opérations, "
                       "simulation de la matière et pilotage de la machine dans "
                       "une seule fenêtre. Linux et Windows. Sortie prochaine.",
        'resume': "CAO/FAO pour défonceuse CNC : dessiner, usiner, simuler, "
                  "piloter. Sortie prochaine.",
    },
    {
        'contenu': '404.html',
        'sortie': '404.html',
        'titre': "VerdierCAM — page introuvable",
        'description': "Cette adresse ne mène à aucune page de verdiercam.fr.",
        'resume': "CAO/FAO pour défonceuse CNC.",
    },
]

# La barre du haut : les sections de la page d'accueil, et le retour à
# l'atelier. Les ancres sont absolues (« / » d'abord) pour servir aussi
# depuis la page 404, qui peut être servie à n'importe quelle profondeur.
NAV = [
    ('/#croquis', 'Fonctions'),
    ('/#modes', 'Modes'),
    ('/#sortie', 'La sortie'),
    ('/#questions', 'Questions'),
    ('https://atelierduverdier.fr', "L'atelier"),
]

LIENS_PIED = [
    ('https://ko-fi.com/atelierduverdier', '☕ Soutenir sur Ko-fi'),
    ('https://atelierduverdier.fr', 'Atelier du Verdier'),
    ('mailto:contact@verdiercam.fr', 'contact@verdiercam.fr'),
]

# La tasse de Ko-fi, au trait des pictos du portail (site/pictos.py là-bas).
TASSE = ('<svg class="picto" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
         'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" '
         'aria-hidden="true" focusable="false">'
         '<path d="M4.5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-4Z"/>'
         '<path d="M15.5 11.5h1.2a2.6 2.6 0 0 1 0 5.2h-2"/>'
         '<path d="M8 3.5c-.9 1 .9 2.2 0 3.5"/>'
         '<path d="M12 3.5c-.9 1 .9 2.2 0 3.5"/></svg>')

# Ce que la page ajoute au kit : les quatre établis côte à côte, la grille
# des familles, le logo du héros.
CSS_LOCAL = """<style>
.logo-produit{display:block;width:72px;height:72px;margin:0 0 14px}
.cols-4{grid-template-columns:repeat(4,1fr)}
@media(max-width:980px){.cols-4{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.cols-4{grid-template-columns:1fr}}
.cols.familles{grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));margin:26px 0}
.panel ul{margin:.4em 0 0;padding-left:1.1em}
.panel li{margin:.3em 0}
/* L'OUVERTURE : l'oiseau du logo, dessiné comme un parcours (voir OISEAU_JS). */
.ouverture{padding:0 0 34px;text-align:center}
.ouverture .oiseau{display:block;width:min(300px,62vw);height:auto;margin:0 auto;overflow:visible}
.ouverture .fraise{fill:#fff;opacity:0;filter:drop-shadow(0 0 6px #ff8a00) drop-shadow(0 0 14px #ff6d00)}
.ouverture .rapide{fill:none;stroke:var(--fg-3);stroke-width:3;stroke-dasharray:2 10;opacity:0}
.nom-produit{font-size:clamp(2.4rem,7vw,3.6rem);font-weight:800;letter-spacing:-.02em;margin:.15em 0 0;
  color:var(--fg);transition:opacity .9s,transform .9s}
.nom-produit b{color:#ff8a00;font-weight:800}
.ouverture.anime .nom-produit{opacity:0;transform:translateY(10px)}
.ouverture.fini .nom-produit{opacity:1;transform:none}
</style>"""


# --- Les captures --------------------------------------------------------
# nom dans la présentation -> nom servi (sans extension). Les PNG font
# 2880 × 1620 : ramenés à 1920 de large, le texte de l'interface ne perd
# rien à l'écran et la page s'allège d'autant.
IMAGES = {
    'assiette_decoree_bois': 'assiette-decoree',
    'boite_couvercle_bois': 'boite',
    'cadre_parcours': 'cadre-parcours',
    'croquis_contraint': 'croquis',
    'levier_croquis': 'levier',
    'accueil_trois_modes': 'trois-modes',
    'debutant_profondeurs': 'debutant-profondeurs',
    'debutant_vcarve': 'debutant-vcarve',
    'gravure25d_schema': '25d-schema',
    'gravure25d_bois': '25d-bois',
    'pilotage_pupitre': 'pupitre',
}
LARGEUR = 1920

# Le héros : la fenêtre entière y ferait 500 px de large, l'interface y
# deviendrait une bouillie grise. On n'en garde que la vue 3D — la pièce
# dans le bois, qui se lit à toute taille. Boîte en pixels de la capture.
RECADRES = {
    'heros': ('assiette_bois', (880, 360, 2200, 1240)),
}

CLIPS = {
    'croquis_cote_tapee': 'clip-cote',
    'debutant_profondeurs_reglage': 'clip-debutant',
    'simulation_creuse': 'clip-simulation',
}

def publier_captures() -> dict:
    """Écrit les captures dans public/captures/, nommées par empreinte.

    Rend {nom servi sans empreinte : nom avec empreinte}. **Un nom qui ne
    change pas est un mensonge que le cache répète** : contenu différent,
    adresse différente. Le WebP est essayé sans perte ET à q92, et le plus
    petit est gardé — sans perte gagne sur les aplats de l'interface, q92 sur
    les vues 3D.
    """
    from PIL import Image

    cible = PUBLIC / 'captures'
    cible.mkdir(parents=True, exist_ok=True)
    empreintes, manquants = {}, []

    def servir(image, nom):
        dest = cible / f'{nom}.webp'
        image.save(dest, 'WEBP', lossless=True, method=6)
        sp = dest.stat().st_size
        image.save(dest, 'WEBP', quality=92, method=6)
        if sp <= dest.stat().st_size:
            image.save(dest, 'WEBP', lossless=True, method=6)
        marque = hashlib.sha256(dest.read_bytes()).hexdigest()[:8]
        final = cible / f'{nom}.{marque}.webp'
        dest.replace(final)
        empreintes[f'{nom}.webp'] = final.name

    for src, nom in IMAGES.items():
        f = chemins.CAPTURES / f'{src}.png'
        if not f.is_file():
            manquants.append(f)
            continue
        im = Image.open(f).convert('RGB')
        if im.width > LARGEUR:
            im = im.resize((LARGEUR, round(im.height * LARGEUR / im.width)), Image.LANCZOS)
        servir(im, nom)

    for nom, (src, boite) in RECADRES.items():
        f = chemins.CAPTURES / f'{src}.png'
        if not f.is_file():
            manquants.append(f)
            continue
        servir(Image.open(f).convert('RGB').crop(boite), nom)

    for src, nom in CLIPS.items():
        video, affiche = chemins.CLIPS / f'{src}.mp4', chemins.CLIPS / f'{src}.png'
        if not video.is_file() or not affiche.is_file():
            manquants.append(video)
            continue
        marque = hashlib.sha256(video.read_bytes()).hexdigest()[:8]
        shutil.copy2(video, cible / f'{nom}.{marque}.mp4')
        empreintes[f'{nom}.mp4'] = f'{nom}.{marque}.mp4'
        servir(Image.open(affiche).convert('RGB'), nom)

    if manquants:
        sys.exit("generer : captures absentes — relancer capturer.sh dans "
                 f"{chemins.PRESENTATION} :\n  " + '\n  '.join(map(str, manquants)))
    poids = sum(f.stat().st_size for f in cible.iterdir())
    print(f"  {len(list(cible.iterdir()))} capture(s) et clip(s) — {poids // 1024} Ko")
    return empreintes


def empreinter(corps: str, empreintes: dict, nom: str) -> str:
    """Remplace `captures/x.webp` par `captures/x.<empreinte>.webp`.

    Une capture citée par la page et que rien n'a publiée ARRÊTE la
    génération : une image cassée en ligne ne se voit qu'une fois en ligne.
    """
    def remplacer(m):
        fichier = m.group(1)
        if fichier not in empreintes:
            sys.exit(f"generer : {nom} cite captures/{m.group(1)}, que rien ne publie "
                     f"— l'ajouter à IMAGES, RECADRES ou CLIPS.")
        return f'captures/{empreintes[fichier]}'
    return re.sub(r'captures/([\w.-]+\.(?:webp|mp4))', remplacer, corps)


# --- VerdierCAM : version et familles ------------------------------------
# LE RANGEMENT EN GROUPES est la seule chose écrite ici. Une famille nouvelle
# que ce tableau ne range nulle part ARRÊTE la génération : sinon elle
# manquerait à la page sans que personne ne le voie.
GROUPES = [
    ('Découper et évider', ['Profile', 'Pocket', 'Facing', 'Slot', 'Finish']),
    ('Percer et fileter', ['Drill', 'Helical', 'ThreadMill']),
    ('Graver', ['Engrave', 'VCarve', 'Deburr', 'PhotoV', 'Texture']),
    ('Volumes et reliefs', ['Roughing3D', 'Moulding', 'Revolution']),
    ('Usiner les deux faces', ['Dowels', 'Fence']),
]


def faits_verdiercam() -> dict:
    """Version et familles d'opérations, lues dans le dépôt du logiciel."""
    m = re.search(r'project\(\s*\w+\s+VERSION\s+([\d.]+)',
                  chemins.VERDIERCAM_CMAKE.read_text(encoding='utf-8'))
    if not m:
        sys.exit(f"generer : pas de VERSION dans {chemins.VERDIERCAM_CMAKE}")

    texte = chemins.VERDIERCAM_OPERATION.read_text(encoding='utf-8')

    def corps_fonction(nom):
        debut = texte.index(nom)
        return texte[debut:texte.index('\n}\n', debut)]

    motif = r'case OperationFamily::(\w+):\s*return "([^"]+)";'
    noms = dict(re.findall(motif, corps_fonction('FamilyLabel(')))
    phrases = dict(re.findall(motif, corps_fonction('FamilyTip(')))
    faites = re.findall(r'OperationFamily::(\w+)', corps_fonction('FamilyIsImplemented('))
    if not noms or not faites:
        sys.exit(f"generer : familles illisibles dans {chemins.VERDIERCAM_OPERATION}")

    oubliees = sorted(set(faites) - {f for _, fam in GROUPES for f in fam})
    if oubliees:
        sys.exit(f"generer : famille(s) sans groupe : {', '.join(oubliees)} "
                 f"— les ranger dans GROUPES.")

    # Trois phrases commencent par le nom de leur famille (« Moulure : deux
    # formes… ») : en liste, derrière ce même nom en gras, il se lirait deux fois.
    for f, nom_f in noms.items():
        if f in phrases and phrases[f].startswith(nom_f):
            phrases[f] = phrases[f][len(nom_f):].lstrip(' :')

    blocs = []
    for titre, familles in GROUPES:
        lignes = [f'<li><b>{html.escape(noms[f], quote=False)}</b> — '
                  f'{html.escape(phrases[f], quote=False)}.</li>'
                  for f in familles if f in faites]
        if lignes:
            blocs.append(f'<div class="panel famille">\n  <h3>{html.escape(titre)}</h3>\n'
                         '  <ul>\n    ' + '\n    '.join(lignes) + '\n  </ul>\n</div>')
    return {'version': m.group(1), 'familles': str(len(set(faites))),
            'liste_familles': '\n'.join(blocs)}


def injecter_verdiercam(texte: str, faits: dict, nom: str) -> str:
    """Remplace les {{verdiercam.xxx}}. Une clé inconnue arrête tout."""
    inconnues = sorted(set(re.findall(r'\{\{verdiercam\.(\w+)\}\}', texte)) - set(faits))
    if inconnues:
        sys.exit(f"generer : {nom} — clé(s) verdiercam inconnue(s) : {', '.join(inconnues)}")
    return re.sub(r'\{\{verdiercam\.(\w+)\}\}', lambda m: faits[m.group(1)], texte)


# --- L'oiseau qui se dessine --------------------------------------------
# Le logo, LU dans les ressources du logiciel et collé dans la page : ses
# traits deviennent le parcours d'une fraise. Sans JavaScript, ou quand le
# visiteur a demandé moins d'animations, il s'affiche simplement entier —
# l'animation n'est posée que par le script, jamais par la feuille de style.
def oiseau_en_ligne() -> str:
    s = chemins.VERDIERCAM_LOGO.read_text(encoding='utf-8')
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    m = re.search(r'<svg[^>]*viewBox="([^"]+)"[^>]*>(.*)</svg>', s, re.S)
    if not m or '<path' not in m.group(2):
        sys.exit(f"generer : logo illisible — {chemins.VERDIERCAM_LOGO}")
    vue, dedans = m.group(1), m.group(2).strip()
    # Les traits (dans le groupe sans remplissage) deviennent des passes ; le
    # plein, qui suit le dernier trait, se pose à la fin comme une poche vidée.
    dedans = re.sub(r'<path (d="[^"]*"/>)', r'<path class="passe" \1', dedans)
    dedans = re.sub(r'<path (d="[^"]*" fill=)', r'<path class="plein" \1', dedans)
    # La fraise et ses rapides vivent DANS le groupe transformé : mêmes
    # coordonnées que les traits, getPointAtLength les y place sans calcul.
    dernier = dedans.rfind('</g>')
    dedans = (dedans[:dernier] + '<path class="rapide" d="M0 0"/>'
              '<circle class="fraise" r="13" cx="0" cy="0"/>' + dedans[dernier:])
    return (f'<svg class="oiseau" viewBox="{vue}" role="img" '
            f'aria-label="L\'oiseau de VerdierCAM">{dedans}</svg>')


OISEAU_JS = """<script>
// L'oiseau se dessine comme un parcours d'usinage : chaque trait du logo est
// une passe, menée à vitesse constante (comme une avance) par une fraise
// lumineuse ; entre deux passes, un rapide en pointillés. Le plein vient en
// dernier, comme une poche. Rien de tout cela si le visiteur a demandé moins
// d'animations : l'oiseau reste entier, tel que la page l'a servi.
(function(){
  var bloc=document.querySelector('.ouverture'); if(!bloc) return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var passes=[].slice.call(bloc.querySelectorAll('.passe'));
  var plein=bloc.querySelector('.plein'), fraise=bloc.querySelector('.fraise'),
      rapide=bloc.querySelector('.rapide');
  if(!passes.length||!fraise||!passes[0].getTotalLength) return;
  var AVANCE=900, RAPIDE=2600;        // unités du dessin par seconde
  var etapes=[], t=0, avant=null;
  passes.forEach(function(p){
    var L=p.getTotalLength(), debut=p.getPointAtLength(0);
    p.style.strokeDasharray=L+' '+L; p.style.strokeDashoffset=L;
    if(avant){var dx=debut.x-avant.x, dy=debut.y-avant.y, d=Math.sqrt(dx*dx+dy*dy);
      etapes.push({rapide:true,de:avant,a:debut,t0:t,t1:t+d/RAPIDE}); t+=d/RAPIDE;}
    etapes.push({p:p,L:L,t0:t,t1:t+L/AVANCE}); t+=L/AVANCE;
    avant=p.getPointAtLength(L);
  });
  if(plein){plein.style.opacity=0; plein.style.transition='opacity .5s';}
  bloc.classList.add('anime');
  var total=t, depart=null;
  function poser(x,y){fraise.setAttribute('cx',x); fraise.setAttribute('cy',y);}
  function image(ms){
    if(depart===null) depart=ms;
    var s=(ms-depart)/1000-0.35;          // un temps d'arrêt, broche lancée
    fraise.style.opacity=s<0?0:1;
    etapes.forEach(function(e){
      var k=Math.max(0,Math.min(1,(s-e.t0)/(e.t1-e.t0)));
      if(e.rapide){
        if(s>=e.t0&&s<e.t1){var x=e.de.x+(e.a.x-e.de.x)*k, y=e.de.y+(e.a.y-e.de.y)*k;
          poser(x,y); rapide.setAttribute('d','M'+e.de.x+' '+e.de.y+'L'+x+' '+y);
          rapide.style.opacity=.9;}
        else if(s>=e.t1) rapide.style.opacity=0;
      } else {
        e.p.style.strokeDashoffset=e.L*(1-k);
        if(s>=e.t0&&s<e.t1){var q=e.p.getPointAtLength(e.L*k); poser(q.x,q.y);}
      }
    });
    if(s<total) requestAnimationFrame(image);
    else{ fraise.style.transition='opacity .6s'; fraise.style.opacity=0;
          if(plein) plein.style.opacity=1; bloc.classList.add('fini'); }
  }
  requestAnimationFrame(image);
})();
</script>"""


# --- Les gabarits --------------------------------------------------------
def remplir(gabarit: str, valeurs: dict, nom: str) -> str:
    """Remplit les {{MARQUES}} d'un gabarit. Une marque restante arrête tout."""
    for cle, valeur in valeurs.items():
        gabarit = gabarit.replace('{{' + cle + '}}', valeur)
    reste = re.findall(r'\{\{[A-Z_]+\}\}', gabarit)
    if reste:
        sys.exit(f"generer : {nom} — marque(s) non remplie(s) : {', '.join(sorted(set(reste)))}")
    return gabarit


def logo_en_ligne() -> str:
    """Le logo de l'atelier, collé dans la page pour suivre le bouton de thème."""
    s = (KIT / 'logo-inline.svg').read_text(encoding='utf-8')
    return s[s.index('<svg'):].strip()


def nav() -> str:
    return '\n      '.join(f'<a href="{h}">{html.escape(t)}</a>' for h, t in NAV)


def liens_pied() -> str:
    return '\n      '.join(f'<a href="{h}">{html.escape(t)}</a>' for h, t in LIENS_PIED)


def compteur_prefixe() -> str:
    return ('<script>\n  window.goatcounter = {\n'
            f"    path: function (p) {{ return '{PREFIXE_COMPTEUR}' + p }}\n"
            '  };\n</script>')


# --- La carte de partage -------------------------------------------------
# 1200 × 630, ce que Facebook, Mastodon et LinkedIn attendent. En JPEG : le
# robot de Facebook ne lit pas le WebP. Le héros recadré, et un bandeau au
# nom du logiciel.
def carte_partage() -> str:
    from PIL import Image, ImageDraw, ImageFont
    L, H, bandeau = 1200, 630, 110
    nom_src, boite = RECADRES['heros']
    carte = Image.new('RGB', (L, H), (18, 18, 20))
    im = Image.open(chemins.CAPTURES / f'{nom_src}.png').convert('RGB').crop(boite)
    im = im.resize((L, round(im.height * L / im.width)), Image.LANCZOS)
    haut = (im.height - (H - bandeau)) // 2
    carte.paste(im.crop((0, haut, L, haut + H - bandeau)), (0, 0))
    d = ImageDraw.Draw(carte)
    d.rectangle([(0, H - bandeau), (L, H)], fill=(18, 18, 20))
    d.line([(0, H - bandeau), (L, H - bandeau)], fill=(255, 109, 0), width=4)
    d.text((40, H - bandeau + 18), "VerdierCAM",
           font=ImageFont.truetype(chemins.POLICE % '-Bold', 44), fill=(240, 240, 240))
    d.text((42, H - bandeau + 70), "CAO/FAO pour défonceuse CNC  ·  verdiercam.fr",
           font=ImageFont.truetype(chemins.POLICE % '', 24), fill=(255, 143, 0))
    cible = PUBLIC / 'partage'
    cible.mkdir(parents=True, exist_ok=True)
    dest = cible / 'carte.jpg'
    carte.save(dest, 'JPEG', quality=88, optimize=True)
    marque = hashlib.sha256(dest.read_bytes()).hexdigest()[:8]
    final = cible / f'carte.{marque}.jpg'
    dest.replace(final)
    return final.name


def main() -> None:
    manquants = chemins.verifier()
    if manquants:
        sys.exit("generer : chemins absents — voir site/chemins.py :\n  "
                 + '\n  '.join(f'{n} : {c}' for n, c in manquants))
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    PUBLIC.mkdir(parents=True)

    for source, servi in (('verdier.css', 'verdier.css'), ('verdier.js', 'verdier.js'),
                          ('verdier-chapeau.svg', 'chapeau.svg')):
        shutil.copy2(KIT / source, PUBLIC / servi)
    shutil.copy2(chemins.VERDIERCAM_LOGO, PUBLIC / 'logo-verdiercam.svg')
    (PUBLIC / 'CNAME').write_text(DOMAINE + '\n', encoding='utf-8')

    empreintes = publier_captures()
    carte = carte_partage()
    faits = faits_verdiercam()
    entete = (KIT / 'entete.html').read_text(encoding='utf-8')
    pied = (KIT / 'pied.html').read_text(encoding='utf-8')
    logo = logo_en_ligne()

    for page in PAGES:
        corps = (CONTENU / page['contenu']).read_text(encoding='utf-8')
        corps = injecter_verdiercam(corps, faits, page['contenu'])
        corps = corps.replace('{{TASSE}}', TASSE)
        if '{{OISEAU}}' in corps:
            corps = corps.replace('{{OISEAU}}', oiseau_en_ligne())
        corps = empreinter(corps, empreintes, page['contenu'])
        # Toutes les pages sont à la racine : le préfixe est vide. La 404, elle,
        # peut être servie à n'importe quelle profondeur — d'où « / ».
        racine = '/' if page['sortie'] == '404.html' else ''
        corps = corps.replace('{{RACINE}}', racine)
        description = injecter_verdiercam(page['description'], faits, page['contenu'])
        url = f"https://{DOMAINE}/" + ('' if page['sortie'] == 'index.html' else page['sortie'])
        texte = (remplir(entete, {
                     'TITRE': page['titre'], 'DESCRIPTION': description,
                     'RACINE': racine, 'SOUS_TITRE': 'VerdierCAM', 'NAV': nav(),
                     'LOCAL_CSS': CSS_LOCAL, 'LOGO': logo, 'OG_URL': url,
                     'OG_IMAGE': f"https://{DOMAINE}/partage/{carte}",
                     'OG_ALT': 'VerdierCAM'}, 'entete.html')
                 + '\n' + corps + '\n'
                 + remplir(pied, {
                     'RACINE': racine, 'SOUS_TITRE': 'VerdierCAM', 'RESUME': page['resume'],
                     'LIENS': liens_pied(), 'ANNEE': ANNEE,
                     'LOCAL_JS': OISEAU_JS if 'class="oiseau"' in corps else '', 'LOGO': logo,
                     'COMPTEUR_PREFIXE': compteur_prefixe()}, 'pied.html'))
        reste = re.findall(r'\{\{[^}]*\}\}', texte)
        if reste:
            sys.exit(f"generer : {page['contenu']} — marque(s) restante(s) : {sorted(set(reste))}")
        (PUBLIC / page['sortie']).write_text(texte, encoding='utf-8')
        print(f"  {page['sortie']:<14} {len(texte.encode()):>7} o")

    poids = sum(f.stat().st_size for f in PUBLIC.rglob('*') if f.is_file())
    print(f"\nVerdierCAM {faits['version']} · {faits['familles']} familles — "
          f"public/ pèse {poids // 1024} Ko")
    print(f"à ouvrir : {PUBLIC / 'index.html'}")


if __name__ == '__main__':
    main()
