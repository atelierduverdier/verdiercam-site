#!/usr/bin/env bash
# LES CONDITIONS EN PDF (15/10/2026) : les CGV et la licence d'utilisation, à joindre à chaque courriel de livraison
# (outils/licence.py signer --courriel, dans le dépôt du logiciel). La confirmation de commande sur support durable
# doit « reprendre ces conditions » (art. L221-13) : un lien vers une page qui peut changer ne suffit pas.
#
#     outils/conditions-pdf.sh [dossier]      → VerdierCAM-CGV-<date>.pdf et VerdierCAM-licence-<date>.pdf
#
# Le site est engendré dans une COPIE jetable, vente ouverte (les deux pages n'existent qu'ainsi), avec la date des
# conditions de site/editeur.json : à relancer chaque fois que cette date change. Rien n'est écrit dans site/public/,
# rien n'est publié. Impression par WeasyPrint (pacman -S python-weasyprint), la copie servie sur 127.0.0.1 le temps
# de l'impression : les pages citent leur feuille depuis la racine (/style/…), qu'un file:// ne trouverait pas. Pas de
# navigateur : Brave sans écran restait bloqué, et aucun script ne tourne (la mesure d'audience ne compte rien).
set -euo pipefail
DEPOT="$(cd "$(dirname "$0")/.." && pwd)"
SORTIE="${1:-$HOME/Documents/VerdierCAM-vente}"
if ! python3 -c "import weasyprint" 2> /dev/null; then
    echo "Il faut WeasyPrint : sudo pacman -S python-weasyprint" >&2
    exit 1
fi
COPIE="$(mktemp -d)"
trap 'rm -rf "${COPIE:?}"' EXIT
cp -r "$DEPOT/site" "$COPIE/site"
rm -rf "${COPIE:?}/site/public" "${COPIE:?}/site/__pycache__"

# Vente ouverte dans la copie seulement ; la date des conditions donne le nom des fichiers (6 octobre 2026 → 2026-10-06).
DATE="$(python3 - "$COPIE/site/editeur.json" <<'FIN'
import json, re, sys
chemin = sys.argv[1]
editeur = json.load(open(chemin, encoding="utf-8"))
editeur["vente_ouverte"] = True
json.dump(editeur, open(chemin, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre",
        "décembre"]
m = re.fullmatch(r"(\d{1,2})(?:er)? (\S+) (\d{4})", editeur["date_conditions"].strip())
if not m or m.group(2) not in mois:
    sys.exit(f"date_conditions illisible : « {editeur['date_conditions']} » (attendu : 6 octobre 2026)")
print(f"{m.group(3)}-{mois.index(m.group(2)) + 1:02d}-{int(m.group(1)):02d}")
FIN
)"
python3 "$COPIE/site/generer.py" > "$COPIE/generer.log" || { cat "$COPIE/generer.log" >&2; exit 1; }
if grep -q "À REMPLIR" "$COPIE/site/public/cgv.html" "$COPIE/site/public/licence.html"; then
    echo "Un champ « À REMPLIR » reste dans les conditions : site/editeur.json d'abord." >&2
    exit 1
fi

mkdir -p "$SORTIE"
python3 - "$COPIE/site/public" "$SORTIE" "$DATE" <<'FIN'
import functools, http.server, logging, pathlib, sys, threading
import weasyprint
public, sortie, date = sys.argv[1], pathlib.Path(sys.argv[2]), sys.argv[3]
logging.getLogger("weasyprint").setLevel(logging.ERROR)
class Discret(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Discret, directory=public))
threading.Thread(target=serveur.serve_forever, daemon=True).start()
try:
    for source, nom in (("cgv", "CGV"), ("licence", "licence")):
        fichier = sortie / f"VerdierCAM-{nom}-{date}.pdf"
        weasyprint.HTML(f"http://127.0.0.1:{serveur.server_port}/{source}.html").write_pdf(fichier)
        print(fichier)
finally:
    serveur.shutdown()
FIN
