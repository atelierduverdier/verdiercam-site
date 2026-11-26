# Vendre VerdierCAM — ce que le site fait, et ce qu'il reste à régler ailleurs

Écrit le 6 octobre 2026. Les pages légales **ont été relues** par quelqu'un de qualifié (Christophe, 26/11/2026).
La règle des séries (conditions de vente, article 3 ; licence, article 2), écrite le 26/11/2026, est venue après cette
relecture.

## Ce qui est dans le site

| page | ce qu'elle porte |
|---|---|
| `mentions-legales.html` | éditeur (EI), hébergeur GitHub, médiateur, propriété intellectuelle — loi LCEN art. 1-1 |
| `cgv.html` | conditions de vente : licence perpétuelle, un an de mises à jour puis renouvellement facultatif, rétractation et son exception (art. L221-28 13°), formulaire type, garantie de conformité des contenus numériques, responsabilité, médiation |
| `licence.html` | licence d'utilisation : nominative, une personne sur autant d'ordinateurs qu'elle veut, ce qui est interdit, ce qui reste à l'utilisateur |
| `confidentialite.html` | RGPD : pas de cookie, GoatCounter, courriel, paiement, durées, droits |
| `acheter.html` | deux cases à cocher (conditions + renoncement exprès), bouton de paiement verrouillé tant qu'elles ne sont pas cochées |

Les informations que **seul Christophe peut remplir** sont dans `site/editeur.json`. Un champ vide
s'affiche « À REMPLIR » dans l'aperçu, et **`publier.py` refuse d'envoyer le site** tant qu'il en
reste un.

## À faire avant la première vente

1. **Déclarer l'activité** « édition et vente de licences de logiciels » comme activité secondaire de
   la micro-entreprise, sur le guichet unique de l'INPI. Faire confirmer la catégorie de cotisations
   (prestations de services BIC, 21,2 % en 2026, d'après la plupart des guides). **Pas encore fait au 26/11/2026** :
   la fiche de l'entreprise (data.inpi.fr, SIREN 481 773 240) ne porte que « Activités photographiques », APE 7420Z,
   nature libérale non réglementée et artisanale, début d'activité le 18/07/2015. À ajouter par une déclaration de
   modification sur le guichet unique (Christophe crée son compte INPI le 26/11/2026).
2. ~~**Choisir un médiateur de la consommation**~~ — CM2C, adhésion signée (Christophe, 26/11/2026). La
   plateforme européenne RLL a fermé le 20 juillet 2025 : n'y renvoyer nulle part.
3. **Remplir `site/editeur.json`** : nom tel qu'au répertoire SIRENE, adresse, téléphone, SIRET.
4. Les prix sont décidés (Christophe, 05/11/2026) : **59 € du 1er au 31 décembre 2026, 79 € à partir de
   janvier 2027**, renouvellement 29 € par an. Le 1er janvier, changer le prix à la main : le site
   (`site/contenu/index.html`, `acheter.html`) et le produit Stripe. Le nombre d'ordinateurs est décidé : aucune limite pour une même personne (Christophe,
   03/11/2026 : « il n'y a pas de limite »).
5. ~~**Régler la page de paiement**~~ — fait le 15/10/2026 (ci-dessous) ; son adresse de production va
   dans `lien_paiement`.
6. **Héberger les paquets** : les **Releases** de ce dépôt (public), `releases/latest`, où pointent le
   courriel de livraison et la page Installer. Les paquets de vente (`outils/construire-vente.sh` du
   logiciel : Linux, Windows, Raspberry Pi 5) ne se publient qu'à l'ouverture.
7. **Les CGV et la licence d'utilisation en PDF**, datées du jour de l'ouverture : jointes à chaque
   courriel de livraison (la confirmation sur support durable « reprend ces conditions », art. L221-13).
   `outils/conditions-pdf.sh` les imprime (WeasyPrint) d'une copie du site engendrée vente ouverte, dans
   `~/Documents/VerdierCAM-vente/` : à relancer chaque fois que `date_conditions` change.
8. **Ouvrir** : `date_conditions` à jour, puis `outils/conditions-pdf.sh`, la Release (« Publier une
   version » ci-dessous), `vente_ouverte` à `true`, `python3 site/publier.py`.
9. **Suivre le total** des ventes à des particuliers des autres pays de l'UE : au-delà de 10 000 €
   par an, la TVA du pays de l'acheteur est due (guichet OSS), même en franchise.

## La page de paiement : là où se garde la preuve

La case de `acheter.html` est une précaution de présentation : **elle ne prouve rien**, puisque le
navigateur du client peut la contourner. Le renoncement au droit de rétractation doit être **exprès**,
**préalable** et **confirmé sur un support durable** (art. L221-13) — c'est le prestataire de paiement
qui le garde.

Avec un **lien de paiement Stripe** (Payment Link) — **réglé le 15/10/2026**, en test puis copié en
production :

- l'adresse des conditions dans les informations publiques du compte : `https://verdiercam.fr/cgv.html` ;
- sur le lien, **« Exiger le consentement du client à vos Conditions d'utilisation »** : case
  obligatoire ; Stripe garde `consent.terms_of_service: accepted` dans chaque `checkout.session.completed` ;
- le **texte de cette case** remplacé (`custom_text.terms_of_service_acceptance`, par l'API — le
  Dashboard ne le propose pas ; Stripe Shell ne marche qu'en test, la copie en production l'a gardé) :
  « J'accepte les conditions générales de vente et la licence d'utilisation. Je demande à recevoir
  VerdierCAM immédiatement et je renonce expressément à mon droit de rétractation dès la fourniture du
  lien de téléchargement et de la clé (art. L221-28 13° du code de la consommation). »
- le **nom complet** de l'acheteur demandé (il figure dans la clé de licence), l'entreprise facultative ;
- la **confirmation sur support durable** : non pas le reçu Stripe (son pied ne se règle pas) mais le
  courriel de livraison, que `outils/licence.py signer … --courriel` écrit dans le dépôt du logiciel, la
  phrase reprise mot pour mot. L'une ne change pas sans l'autre.

## Dans le logiciel

La licence (au nom de l'acheteur, date de fin des mises à jour comparée à la date de la version),
l'essai de quinze jours et la révocation existent depuis le 07/10/2026 : `docs/licence.md` du
logiciel.

## Une série par an, le 1er décembre (26/11/2026)

Christophe, 26/11/2026 : les nouveautés arrivent dans la série en cours (1.2.1, 1.2.2…), et **une nouvelle série sort
chaque 1er décembre**, jour anniversaire du lancement : la 1.3.0 le 1er décembre 2027, la 1.4.0 le 1er décembre 2028…
(« beaucoup de gens m'ont dit ça sera mon cadeau de Noël »). Une série en janvier aurait fait manquer la 1.3 d'un mois
aux acheteurs de décembre 2026.

La licence le fait sans rien changer au logiciel : une x.y.z compte à la date de la x.y.0 (`docs/licence.md`, « La date
de la série »), donc une licence ouvre toute série dont la x.y.0 date d'avant la fin de ses mises à jour. Avec une série
chaque 1er décembre, tout acheteur a la série en cours et la suivante, chacune jusqu'à sa dernière version : entre un et
deux ans de nouveautés. Les conditions de vente (article 3) et la licence d'utilisation (article 2) disent la règle de
la série, sans calendrier ; le 1er décembre n'est que sur l'accueil et la page Acheter : une série en retard de quelques
jours n'est pas un manquement au contrat.

**Le piège : commiter la x.y.0 au plus tard le 30 novembre**, la publier le 1er décembre. Elle compte à la date de son
commit (`series.txt`), et `licence.py signer` compte 365 jours, pas une année : une licence achetée le 1er décembre 2027
finit le 30 novembre 2028 (2028 est bissextile). Une 1.4.0 commitée le 1er décembre 2028 manquerait à cet acheteur.

## Annoncer une nouvelle version (07/10/2026)

Le logiciel lit au lancement `https://verdiercam.fr/version.json` et montre sa version en **vert** (à jour) ou en
**rouge** avec le numéro publié (un clic ouvre la page). Ce fichier vient de `site/version-publiee.json`, que
`generer.py` recopie tel quel ; **on le change à la main, une fois le paquet réellement téléchargeable** — c'est
l'interrupteur : sans lui, aucun client ne voit passer une version.

```json
{"version": "0.9.160", "page": "https://verdiercam.fr/#telecharger", "notes": "Pignons, script façon OpenSCAD", "date": "2026-10-14"}
```

**`date` : le jour de la publication, AAAA-MM-JJ, jamais plus tard qu'aujourd'hui.** Le logiciel la retient et ne revient
jamais en arrière : c'est ce qui tient l'essai de 30 jours. Une date fausse (2027 au lieu de 2026, ou la date de sortie
prévue mise trop tôt) finirait l'essai de tous les postes, sans retour possible. `generer.py` refuse de publier une date
mal écrite ou dans le futur.

Absent, le site ne publie pas de manifeste et le logiciel reste en gris.

**Les paquets à télécharger directement** (facultatifs : sans eux, « Télécharger » ouvre la page) : un par machine, sous
SA clé — `"linux"` le PC (`…-linux-x86_64.tar.gz`), `"linux-aarch64"` le Raspberry Pi (`…-linux-aarch64.tar.gz`),
`"windows"` (`…-windows-x64.zip`), chacun `{"url": …, "taille": …, "sha256": …}`. **Le piège du Pi (22/11/2026)** :
jusqu'à la 1.0.1, VerdierCAM prenait `"linux"` aussi sur le Pi, et y aurait téléchargé le paquet du PC, qui n'y démarre
pas. Depuis la correction (verdiercam-imgui, `scene::PaquetPour`), le Pi ne lit que `"linux-aarch64"`. Tant qu'un Pi
tourne encore en 1.0.0 ou 1.0.1 (celui de l'atelier, ceux des testeurs), ne pas mettre `"linux"` dans le manifeste : le
passer d'abord à une version corrigée. Le Comptoir annonce `"linux"` (le PC) et `"windows"`, pas encore le Pi.
**Le 26/11/2026, Christophe : tous les Pi (atelier, testeurs) sont au-delà de la 1.0.1** — le manifeste de la vente peut
porter les trois clés.

**`date_licence` : pour une version corrective (22/11/2026, Christophe : « Date de la x.y.0 »).** Une x.y.z (z > 0) compte
pour la licence à la date de la x.y.0 de sa série (verdiercam-imgui, `ressources/licence/series.txt`) : les conditions de
vente promettent ces corrections même sans renouvellement (article 3). Le manifeste d'une x.y.z porte donc
`"date_licence": "<date de la x.y.0>"` (pour la 1.0 : `"2026-11-21"`) à côté de `date`, qui reste le jour de la
publication. Sans lui, la fenêtre « Nouvelle version » d'une licence échue dirait la correction « hors des mises à jour ».
Le Comptoir ne l'écrit pas encore. Et à la livraison d'une x.y.0, la ligne « x.y AAAA-MM-JJ » de `series.txt` s'ajoute
dans le dépôt du logiciel : sans elle, la construction de vente des x.y.z suivantes s'arrête.

## Publier une version (15/10/2026)

Vente ouverte, la page Installer montre trois boutons (bloc `<!--vente-->`) qui visent les paquets de la
version **du manifeste** (`{{verdiercam.publiee}}`, lu dans `site/version-publiee.json`) :

    https://github.com/atelierduverdier/verdiercam-site/releases/download/v<version>/VerdierCAM-<version>-linux-x86_64.tar.gz
                                                                          …/VerdierCAM-<version>-windows-x64.zip
                                                                          …/VerdierCAM-<version>-linux-aarch64.tar.gz

Dans l'ordre, pour qu'aucun lien ne vise un fichier absent :

1. `outils/construire-vente.sh` dans le dépôt du logiciel, **arbre propre** (`git status` vide : un paquet
   emporte tout `ressources/`, fichiers non commités compris) — « NE PAS PUBLIER » s'il le dit.
2. La Release `v<version>` de ce dépôt, ses trois fichiers sous leur nom de `dist/` :
   `gh release create v<version> --repo atelierduverdier/verdiercam-site --title "VerdierCAM <version>" <les trois>`.
3. `site/version-publiee.json` à cette version, puis `python3 site/publier.py`.

### Avec la mise à jour en un clic (23/11/2026, dès la version qui porte la boîte)

Le logiciel n'installe de lui-même que ce que dit **la liste signée des versions** (verdiercam-imgui,
`docs/chantiers/mise-a-jour-en-un-clic.md`), signée sur ce poste avec la clé des versions (`~/.config/verdiercam-vente/`,
à part de celle des licences). Entre les étapes 1 et 2 ci-dessus, et à l'étape 3 :

1. **Signer chaque paquet, avant tout le reste** (la signature va DANS le paquet et change le fichier) — dans le dépôt du
   logiciel : `python3 outils/versions.py signer-paquet dist/VerdierCAM-<version>-linux-x86_64.tar.gz --date <AAAA-MM-JJ>`,
   de même pour `…-windows-x64.zip` et `…-linux-aarch64.tar.gz`. La date est celle de la version ; pour une x.y.z, l'outil
   met lui-même celle de la x.y.0 (ce que la licence compare). `verifier-paquet` les relit.
2. La Release (étape 2 ci-dessus) avec ces paquets signés.
3. **La liste** : une description `liste.json` (toutes les versions publiées, gardées : une licence échue reçoit la
   dernière que couvre son année ; `serie` monte de un à chaque liste ; pour chaque version ses notes en français et en
   anglais, deux ou trois lignes, et ses paquets avec `"fichier": "dist/…"` et l'adresse de la Release), puis
   `python3 outils/versions.py signer liste.json -o ~/Projets/site/Site_VerdierCAM/site/versions-signees.txt`.
4. `site/version-publiee.json` à la même version, puis `python3 site/publier.py`. `generer.py` relit la liste avec la clé
   publique du logiciel et refuse de publier une liste mal signée, une liste qui ne finit pas à la version du manifeste,
   ou un paquet qui n'est pas en https. La 1.0 ignore ce champ : elle garde la fenêtre « Nouvelle version ».

Sans `site/versions-signees.txt`, rien ne change : pas de boîte, le numéro rouge et la fenêtre d'avant.

**Le paragraphe « Mettre à jour » de `site/contenu/confidentialite.html`** (sous « En utilisant le logiciel ») : retiré le
23/11/2026 pour que la page ne parle pas d'un bouton que la 1.0 n'a pas, **remis le 25/11/2026**, quand le site est passé à la
1.1 (Christophe : « mets le site a jour avec toutes les nouveautés ») — la version qu'on vendra porte la boîte. Si une 1.0.x
devait encore se vendre, le retirer à nouveau.

Ce qu'une page dit tant qu'on ne vend pas (« le lien arrive par courriel ») se met entre `<!--hors-vente-->`
et `<!--/hors-vente-->` : retiré à l'ouverture, comme `<!--vente-->` est retiré avant.
