#!/usr/bin/env python3
# =========================================================================
# generer.py — le site de VerdierCAM (verdiercam.fr)
# =========================================================================
# Une identité À PART de l'Atelier du Verdier (06/10/2026, Christophe :
# « plus moderne, ne suis pas ma charte, quelque chose de neuf, pas sombre,
# avec des captures d'écran et des explications »). Gabarit, feuille de
# style et script vivent ici, dans site/gabarits/ et site/style/.
#
# La règle de l'atelier tient toujours : rien n'est recopié à la main.
#
#   ce qui est affiché            lu à la génération dans
#   la version                    CMakeLists.txt de verdiercam-imgui
#   les familles d'opérations     src/cam/Operation.h (FamilyLabel, FamilyTip)
#   les captures et les clips     realisations/presentation-verdiercam
#   le logo, l'oiseau animé       ressources/logo-verdiercam.svg
#   les polices Inter et Mono     ressources/polices/ du logiciel
#
# Une clé absente, une famille sans groupe, une capture manquante, une
# marque {{…}} restée vide ARRÊTENT la génération : rien d'à moitié engendré
# ne part en ligne.
#
#   python3 site/generer.py       régénère site/public/
#   python3 site/publier.py       régénère, puis pousse sur gh-pages
# =========================================================================

import hashlib
import html
import io
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import chemins  # noqa: E402

SITE = Path(__file__).resolve().parent
CONTENU = SITE / 'contenu'
GABARITS = SITE / 'gabarits'
STYLE = SITE / 'style'
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
        'titre': "VerdierCAM — du croquis au copeau, dans une seule fenêtre",
        'description': "Logiciel de CAO/FAO pour la défonceuse CNC : croquis "
                       "contraint, {{verdiercam.familles}} familles d'opérations, "
                       "simulation de la matière et pilotage de la machine dans "
                       "une seule fenêtre. Linux et Windows. Sortie prochaine.",
    },
    {
        'contenu': 'premiers-pas.html',
        'sortie': 'premiers-pas.html',
        'titre': "VerdierCAM — Premiers pas, une plaque du croquis au G-code",
        'description': "Onze étapes avec une capture du vrai logiciel : ouvrir VerdierCAM en "
                       "mode Débutant, tracer une plaque percée, la coter, choisir les "
                       "opérations et la fraise, simuler, puis exporter le G-code.",
    },
    # Les pages légales. Celles marquées « vente » ne partent en ligne que si
    # editeur.json dit « vente_ouverte » : publier des conditions de vente et un
    # bouton d'achat pour un logiciel qu'on ne vend pas encore serait trompeur.
    {
        'contenu': 'mentions-legales.html',
        'sortie': 'mentions-legales.html',
        'titre': "VerdierCAM — mentions légales",
        'description': "Éditeur, hébergeur et informations légales du site verdiercam.fr.",
    },
    {
        'contenu': 'confidentialite.html',
        'sortie': 'confidentialite.html',
        'titre': "VerdierCAM — confidentialité",
        'description': "Ce que verdiercam.fr sait de ses visiteurs et de ses clients : aucun cookie, "
                       "une mesure d'audience sans cookie, et les données d'une commande.",
    },
    {
        'contenu': 'cgv.html',
        'sortie': 'cgv.html',
        'vente': True,
        'titre': "VerdierCAM — conditions générales de vente",
        'description': "Conditions de vente de la licence VerdierCAM : licence perpétuelle, mises à "
                       "jour, droit de rétractation, garanties, médiation.",
    },
    {
        'contenu': 'licence.html',
        'sortie': 'licence.html',
        'vente': True,
        'titre': "VerdierCAM — licence d'utilisation",
        'description': "La licence d'utilisation de VerdierCAM : ce qu'elle permet, ce qu'elle interdit.",
    },
    {
        'contenu': 'acheter.html',
        'sortie': 'acheter.html',
        'vente': True,
        'titre': "VerdierCAM — acheter une licence",
        'description': "Acheter une licence VerdierCAM : licence perpétuelle à votre nom, un an de "
                       "mises à jour compris.",
    },
    {
        'contenu': '404.html',
        'sortie': '404.html',
        'titre': "VerdierCAM — page introuvable",
        'description': "Cette adresse ne mène à aucune page de verdiercam.fr.",
    },
]

# Les ancres sont précédées de RACINE : seule la page d'accueil vit à la
# racine du site, donc elle seule porte les sections #parcours, #usinage…
# Toutes les autres pages (« Premiers pas », la 404, qui peut être servie à
# n'importe quelle profondeur) y renvoient par un chemin ABSOLU.
NAV = [
    ('#parcours', 'Le parcours'),
    ('#usinage', 'Opérations'),
    ('#modes', 'Modes'),
    ('premiers-pas.html', 'Premiers pas'),
    ('#sortie', 'Sortie'),
    ('#questions', 'Questions'),
]

LIENS_PIED = [
    ('mailto:contact@verdiercam.fr', 'contact@verdiercam.fr'),
    ('https://ko-fi.com/atelierduverdier', 'Ko-fi'),
    ('https://atelierduverdier.fr', 'Atelier du Verdier'),
    ('{{RACINE}}mentions-legales.html', 'Mentions légales'),
    ('{{RACINE}}confidentialite.html', 'Confidentialité'),
]
# Seulement quand la vente est ouverte.
LIENS_PIED_VENTE = [
    ('{{RACINE}}cgv.html', 'Conditions de vente'),
    ('{{RACINE}}licence.html', 'Licence'),
]


# --- L'éditeur : les informations que seul Christophe peut donner ---------
# Lues dans site/editeur.json. Un champ vide n'arrête PAS la génération —
# l'aperçu doit rester possible pendant qu'on le remplit — mais il s'affiche
# en rouge « À REMPLIR », et publier.py refuse d'envoyer une page qui en porte.
EDITEUR = SITE / 'editeur.json'
A_REMPLIR = 'class="a-remplir"'


def lire_editeur() -> dict:
    import json
    return json.loads(EDITEUR.read_text(encoding='utf-8'))


def injecter_editeur(texte: str, editeur: dict, nom: str) -> str:
    def remplacer(m):
        cle = m.group(1)
        if cle not in editeur:
            sys.exit(f"generer : {nom} — clé « editeur.{cle} » absente de {EDITEUR.name}")
        valeur = str(editeur[cle]).strip()
        return (html.escape(valeur, quote=True) if valeur
                else f'<mark {A_REMPLIR}>À REMPLIR : {cle}</mark>')
    return re.sub(r'\{\{editeur\.(\w+)\}\}', remplacer, texte)


def blocs_de_vente(texte: str, ouverte: bool) -> str:
    """Garde ou retire les passages entre <!--vente--> et <!--/vente-->."""
    if ouverte:
        return texte.replace('<!--vente-->', '').replace('<!--/vente-->', '')
    return re.sub(r'<!--vente-->.*?<!--/vente-->', '', texte, flags=re.S)

# La tasse de Ko-fi, au trait.
TASSE = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
         '<path d="M4.5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-4Z"/>'
         '<path d="M15.5 11.5h1.2a2.6 2.6 0 0 1 0 5.2h-2"/>'
         '<path d="M8 3.5c-.9 1 .9 2.2 0 3.5"/><path d="M12 3.5c-.9 1 .9 2.2 0 3.5"/></svg>')


def empreinte(donnees: bytes) -> str:
    """Huit caractères du contenu. **Un nom qui ne change pas est un mensonge
    que le cache répète** : contenu différent, adresse différente."""
    return hashlib.sha256(donnees).hexdigest()[:8]


def servir(donnees: bytes, dossier: Path, nom: str, ext: str) -> str:
    """Écrit `donnees` sous `nom.<empreinte>.ext` ; rend le chemin depuis public/."""
    dossier.mkdir(parents=True, exist_ok=True)
    final = f'{nom}.{empreinte(donnees)}.{ext}'
    (dossier / final).write_bytes(donnees)
    return (dossier / final).relative_to(PUBLIC).as_posix()


# --- Les polices ---------------------------------------------------------
# Celles du logiciel, servies D'ICI : pas de Google Fonts, donc rien n'est
# demandé à un tiers au chargement de la page. Réduites au latin (accents
# français, guillemets, flèches) et passées en WOFF2.
POLICES = {
    'POLICE_TEXTE': 'Inter-Regular.ttf',
    'POLICE_GRAS': 'Inter-SemiBold.ttf',
    'POLICE_MONO': 'JetBrainsMono-Medium.ttf',
}
JEU = ('U+0020-007E,U+00A0-00FF,U+0152-0153,U+0178,U+02C6,U+2009,U+2013-2014,'
       'U+2018-201E,U+2022,U+2026,U+202F,U+2190-2193,U+2713')


def publier_polices() -> dict:
    from fontTools import subset
    servies = {}
    for marque, fichier in POLICES.items():
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['kern', 'liga', 'calt', 'tnum']
        police = subset.load_font(str(chemins.POLICES / fichier), opts)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=subset.parse_unicodes(JEU))
        sub.subset(police)
        tampon = io.BytesIO()
        subset.save_font(police, tampon, opts)
        servies[marque] = servir(tampon.getvalue(), PUBLIC / 'polices',
                                 Path(fichier).stem, 'woff2')
    for licence in ('OFL-Inter.txt', 'OFL-JetBrainsMono.txt'):
        shutil.copy2(chemins.POLICES / licence, PUBLIC / 'polices' / licence)
    poids = sum((PUBLIC / c).stat().st_size for c in servies.values())
    print(f"  {len(servies)} police(s) en WOFF2 — {poids // 1024} Ko")
    return servies


# --- Les captures --------------------------------------------------------
# nom dans la présentation -> nom servi. Les PNG font 2880 × 1620 : ramenés
# à 1920 de large, le texte de l'interface ne perd rien à l'écran.
IMAGES = {
    'drakkar_bois': 'drakkar',
    'boite_couvercle_bois': 'boite',
    'cadre_parcours': 'cadre-parcours',
    'levier_croquis': 'levier',
    'accueil_trois_modes': 'trois-modes',
    'debutant_profondeurs': 'debutant-profondeurs',
    'debutant_vcarve': 'debutant-vcarve',
    'gravure25d_schema': '25d-schema',
    'gravure25d_bois': '25d-bois',
    'pilotage_pupitre': 'pupitre',
    # La page « Premiers pas » : onze étapes, une plaque percée du croquis au G-code.
    'pp_01_accueil': 'pp-accueil',
    'pp_02_brut': 'pp-brut',
    'pp_03_tracer': 'pp-tracer',
    'pp_04_trous': 'pp-trous',
    'pp_05_cotes': 'pp-cotes',
    'pp_06_usinage': 'pp-usinage',
    'pp_07_fraise': 'pp-fraise',
    'pp_08_profondeurs': 'pp-profondeurs',
    'pp_09_parcours': 'pp-parcours',
    'pp_10_simulation': 'pp-simulation',
    'pp_11_export': 'pp-export',
}
LARGEUR = 1920

# La carte de partage montre le drakkar seul, sans l'interface autour
# (06/10/2026, Christophe : « une assiette c'est pas terrible, met le
# drakkar »). Boîte en pixels de la capture 2880 × 1620.
RECADRAGE_CARTE = ('drakkar_bois', (790, 300, 2250, 1274))

# Des DÉTAILS tirés des captures : une loupe posée sur le relief du drakkar,
# en tête de page. Boîte en pixels de la capture 2880 × 1620, et largeur
# servie. On lit toujours la source dans chemins.CAPTURES, jamais une copie.
RECADRAGES = {
    'drakkar-detail': ('drakkar_bois', (1000, 520, 1800, 970), 1200),
}

CLIPS = {
    'croquis_cote_tapee': 'clip-cote',
    'simulation_creuse': 'clip-simulation',
}


def publier_captures() -> dict:
    """Écrit les captures dans public/captures/ ; rend {nom.ext : servi}.

    Le WebP est essayé sans perte ET à q92, et le plus petit est gardé —
    sans perte gagne sur les aplats de l'interface, q92 sur les vues 3D.
    """
    from PIL import Image

    cible = PUBLIC / 'captures'
    servies, manquants = {}, []

    def en_webp(image, nom):
        sans_perte, q92 = io.BytesIO(), io.BytesIO()
        image.save(sans_perte, 'WEBP', lossless=True, method=6)
        image.save(q92, 'WEBP', quality=92, method=6)
        meilleur = min(sans_perte.getvalue(), q92.getvalue(), key=len)
        servies[f'{nom}.webp'] = servir(meilleur, cible, nom, 'webp')

    for src, nom in IMAGES.items():
        f = chemins.CAPTURES / f'{src}.png'
        if not f.is_file():
            manquants.append(f)
            continue
        im = Image.open(f).convert('RGB')
        if im.width > LARGEUR:
            im = im.resize((LARGEUR, round(im.height * LARGEUR / im.width)), Image.LANCZOS)
        en_webp(im, nom)

    for nom, (src, boite, largeur) in RECADRAGES.items():
        f = chemins.CAPTURES / f'{src}.png'
        if not f.is_file():
            manquants.append(f)
            continue
        im = Image.open(f).convert('RGB').crop(boite)
        if im.width > largeur:
            im = im.resize((largeur, round(im.height * largeur / im.width)), Image.LANCZOS)
        en_webp(im, nom)

    for src, nom in CLIPS.items():
        video, affiche = chemins.CLIPS / f'{src}.mp4', chemins.CLIPS / f'{src}.png'
        if not video.is_file() or not affiche.is_file():
            manquants.append(video)
            continue
        servies[f'{nom}.mp4'] = servir(video.read_bytes(), cible, nom, 'mp4')
        en_webp(Image.open(affiche).convert('RGB'), nom)

    if manquants:
        sys.exit("generer : captures absentes — relancer capturer.sh dans "
                 f"{chemins.PRESENTATION} :\n  " + '\n  '.join(map(str, manquants)))
    poids = sum(f.stat().st_size for f in cible.iterdir())
    print(f"  {len(servies)} capture(s) et clip(s) — {poids // 1024} Ko")
    return servies


def empreinter(corps: str, servies: dict, nom: str, racine: str) -> str:
    """Remplace `{{RACINE}}captures/x.webp` par l'adresse empreinte.

    Une capture citée par la page et que rien n'a publiée ARRÊTE la
    génération : une image cassée ne se voit qu'une fois en ligne.
    """
    def remplacer(m):
        if m.group(1) not in servies:
            sys.exit(f"generer : {nom} cite captures/{m.group(1)}, que rien ne publie "
                     f"— l'ajouter à IMAGES ou CLIPS.")
        return racine + servies[m.group(1)]
    return re.sub(r'\{\{RACINE\}\}captures/([\w.-]+\.(?:webp|mp4))', remplacer, corps)


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
    # formes… ») : sous ce même nom en gras, il se lirait deux fois.
    for f, nom_f in noms.items():
        if f in phrases and phrases[f].startswith(nom_f):
            reste = phrases[f][len(nom_f):].lstrip(' :')
            phrases[f] = reste[:1].upper() + reste[1:]

    blocs = []
    for titre, familles in GROUPES:
        lignes = [f'<li><b>{html.escape(noms[f], quote=False)}</b>'
                  f'{html.escape(phrases[f], quote=False)}.</li>'
                  for f in familles if f in faites]
        if lignes:
            blocs.append(f'<div class="groupe">\n  <h3>{html.escape(titre)}</h3>\n'
                         '  <ul>\n    ' + '\n    '.join(lignes) + '\n  </ul>\n</div>')
    return {'version': m.group(1), 'familles': str(len(set(faites))),
            'liste_familles': '\n'.join(blocs)}


def injecter_verdiercam(texte: str, faits: dict, nom: str) -> str:
    """Remplace les {{verdiercam.xxx}}. Une clé inconnue arrête tout."""
    inconnues = sorted(set(re.findall(r'\{\{verdiercam\.(\w+)\}\}', texte)) - set(faits))
    if inconnues:
        sys.exit(f"generer : {nom} — clé(s) verdiercam inconnue(s) : {', '.join(inconnues)}")
    return re.sub(r'\{\{verdiercam\.(\w+)\}\}', lambda m: faits[m.group(1)], texte)


# --- L'oiseau qui se dessine ---------------------------------------------
# Le logo, LU dans les ressources du logiciel et collé dans la page : ses
# traits deviennent le parcours d'une fraise (style/verdiercam.js). Sans
# script, ou quand le visiteur a demandé moins d'animations, il s'affiche
# simplement entier : l'animation n'est posée que par le script.
def oiseau_en_ligne() -> str:
    s = chemins.VERDIERCAM_LOGO.read_text(encoding='utf-8')
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    m = re.search(r'<svg[^>]*viewBox="([^"]+)"[^>]*>(.*)</svg>', s, re.S)
    if not m or '<path' not in m.group(2):
        sys.exit(f"generer : logo illisible — {chemins.VERDIERCAM_LOGO}")
    vue, dedans = m.group(1), m.group(2).strip()
    # Les traits deviennent des passes ; le plein se pose à la fin.
    dedans = re.sub(r'<path (d="[^"]*"/>)', r'<path class="passe" \1', dedans)
    dedans = re.sub(r'<path (d="[^"]*" fill=)', r'<path class="plein" \1', dedans)
    # La fraise et ses rapides vivent DANS le groupe transformé : mêmes
    # coordonnées que les traits, getPointAtLength les y place sans calcul.
    dernier = dedans.rfind('</g>')
    dedans = (dedans[:dernier] + '<path class="rapide" d="M0 0"/>'
              '<circle class="fraise" r="13" cx="0" cy="0"/>' + dedans[dernier:])
    return (f'<svg class="oiseau" viewBox="{vue}" role="img" '
            f'aria-label="L\'oiseau de VerdierCAM">{dedans}</svg>')


# --- La carte de partage -------------------------------------------------
# 1200 × 630, ce que Facebook, Mastodon et LinkedIn attendent. En JPEG : le
# robot de Facebook ne lit pas le WebP.
def carte_partage() -> str:
    from PIL import Image, ImageDraw, ImageFont
    L, H, bandeau = 1200, 630, 116
    src, boite = RECADRAGE_CARTE
    carte = Image.new('RGB', (L, H), (251, 250, 247))
    im = Image.open(chemins.CAPTURES / f'{src}.png').convert('RGB').crop(boite)
    im = im.resize((L, round(im.height * L / im.width)), Image.LANCZOS)
    haut = (im.height - (H - bandeau)) // 2
    carte.paste(im.crop((0, haut, L, haut + H - bandeau)), (0, 0))
    d = ImageDraw.Draw(carte)
    d.rectangle([(0, H - bandeau), (L, H)], fill=(251, 250, 247))
    d.line([(0, H - bandeau), (L, H - bandeau)], fill=(255, 109, 0), width=4)
    gras = ImageFont.truetype(str(chemins.POLICES / 'Inter-SemiBold.ttf'), 46)
    texte = ImageFont.truetype(str(chemins.POLICES / 'Inter-Regular.ttf'), 24)
    d.text((44, H - bandeau + 16), "Verdier", font=gras, fill=(22, 24, 29))
    d.text((44 + d.textlength("Verdier", font=gras), H - bandeau + 16), "CAM",
           font=gras, fill=(255, 109, 0))
    d.text((46, H - bandeau + 74), "CAO/FAO pour défonceuse CNC  ·  verdiercam.fr",
           font=texte, fill=(74, 79, 90))
    tampon = io.BytesIO()
    carte.save(tampon, 'JPEG', quality=88, optimize=True)
    return servir(tampon.getvalue(), PUBLIC / 'partage', 'carte', 'jpg')


# --- Les pages -----------------------------------------------------------
def remplir(gabarit: str, valeurs: dict, nom: str) -> str:
    for cle, valeur in valeurs.items():
        gabarit = gabarit.replace('{{' + cle + '}}', valeur)
    reste = re.findall(r'\{\{[^}]*\}\}', gabarit)
    if reste:
        sys.exit(f"generer : {nom} — marque(s) non remplie(s) : {', '.join(sorted(set(reste)))}")
    return gabarit


def main() -> None:
    manquants = chemins.verifier()
    if manquants:
        sys.exit("generer : chemins absents — voir site/chemins.py :\n  "
                 + '\n  '.join(f'{n} : {c}' for n, c in manquants))
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    PUBLIC.mkdir(parents=True)
    (PUBLIC / 'CNAME').write_text(DOMAINE + '\n', encoding='utf-8')

    polices = publier_polices()
    # La feuille vit dans style/ : elle cite les polices depuis là.
    css = (STYLE / 'verdiercam.css').read_text(encoding='utf-8')
    for marque, chemin in polices.items():
        css = css.replace('{{' + marque + '}}', '../' + chemin)
    css_servi = servir(css.encode('utf-8'), PUBLIC / 'style', 'verdiercam', 'css')
    js_servi = servir((STYLE / 'verdiercam.js').read_bytes(), PUBLIC / 'style', 'verdiercam', 'js')
    favicon = servir(chemins.VERDIERCAM_LOGO.read_bytes(), PUBLIC, 'oiseau', 'svg')

    captures = publier_captures()
    carte = carte_partage()
    faits = faits_verdiercam()
    gabarit = (GABARITS / 'page.html').read_text(encoding='utf-8')
    oiseau = oiseau_en_ligne()

    editeur = lire_editeur()
    vente = bool(editeur.get('vente_ouverte'))
    liens_pied = LIENS_PIED + (LIENS_PIED_VENTE if vente else [])
    a_remplir = []

    for page in PAGES:
        if page.get('vente') and not vente:
            continue
        # Seule la page d'accueil vit à la racine : les autres (404, Premiers
        # pas) partent toujours de « / », où que le site les serve.
        racine = '' if page['sortie'] == 'index.html' else '/'
        corps = (CONTENU / page['contenu']).read_text(encoding='utf-8')
        corps = blocs_de_vente(corps, vente)
        corps = corps.replace('{{CLASSE_ACHAT}}', '' if editeur.get('lien_paiement') else 'sans-lien')
        if not editeur.get('lien_paiement'):
            corps = corps.replace('href="{{editeur.lien_paiement}}"', 'href="#"')
        corps = injecter_editeur(corps, editeur, page['contenu'])
        if A_REMPLIR in corps:
            a_remplir.append(page['sortie'])
        corps = injecter_verdiercam(corps, faits, page['contenu'])
        corps = corps.replace('{{TASSE}}', TASSE).replace('{{OISEAU}}', oiseau)
        corps = empreinter(corps, captures, page['contenu'], racine)
        corps = corps.replace('{{RACINE}}', racine)
        url = f"https://{DOMAINE}/" + ('' if page['sortie'] == 'index.html' else page['sortie'])
        nav = '\n      '.join(f'<a href="{racine}{h}">{html.escape(t)}</a>' for h, t in NAV)
        liens = '\n      '.join(f'<a href="{h.replace("{{RACINE}}", racine)}">{html.escape(t)}</a>'
                                 for h, t in liens_pied)
        texte = remplir(gabarit, {
            'TITRE': page['titre'],
            'DESCRIPTION': injecter_verdiercam(page['description'], faits, page['contenu']),
            'URL': url, 'RACINE': racine, 'FAVICON': favicon, 'CSS': css_servi,
            'JS': js_servi, 'POLICE_TEXTE': polices['POLICE_TEXTE'],
            'CARTE': f"https://{DOMAINE}/{carte}", 'NAV': nav, 'LIENS': liens,
            'ANNEE': ANNEE, 'PREFIXE_COMPTEUR': PREFIXE_COMPTEUR, 'CORPS': corps,
        }, page['contenu'])
        (PUBLIC / page['sortie']).write_text(texte, encoding='utf-8')
        print(f"  {page['sortie']:<14} {len(texte.encode()):>7} o")

    print(f"  vente {'OUVERTE' if vente else 'fermée (Acheter, CGV, Licence non publiées)'}")
    if a_remplir:
        print(f"  ! À REMPLIR dans site/editeur.json — pages concernées : {', '.join(a_remplir)}"
              f" (publier.py refusera)")
    poids = sum(f.stat().st_size for f in PUBLIC.rglob('*') if f.is_file())
    print(f"\nVerdierCAM {faits['version']} · {faits['familles']} familles — "
          f"public/ pèse {poids // 1024} Ko")
    print(f"à ouvrir : {PUBLIC / 'index.html'}")


if __name__ == '__main__':
    main()
