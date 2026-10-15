# Vendre VerdierCAM — ce que le site fait, et ce qu'il reste à régler ailleurs

Écrit le 6 octobre 2026. Les pages légales sont **à faire relire** (avocat, ou au moins le service
juridique d'une CCI / CMA) avant la première vente : elles suivent le code de la consommation, mais
personne de qualifié ne les a encore lues.

## Ce qui est dans le site

| page | ce qu'elle porte |
|---|---|
| `mentions-legales.html` | éditeur (EI), hébergeur GitHub, médiateur, propriété intellectuelle — loi LCEN art. 1-1 |
| `cgv.html` | conditions de vente : licence perpétuelle, un an de mises à jour puis renouvellement facultatif, rétractation et son exception (art. L221-28 13°), formulaire type, garantie de conformité des contenus numériques, responsabilité, médiation |
| `licence.html` | licence d'utilisation : nominative, `installations` ordinateurs pour une personne, ce qui est interdit, ce qui reste à l'utilisateur |
| `confidentialite.html` | RGPD : pas de cookie, GoatCounter, courriel, paiement, durées, droits |
| `acheter.html` | deux cases à cocher (conditions + renoncement exprès), bouton de paiement verrouillé tant qu'elles ne sont pas cochées |

Les informations que **seul Christophe peut remplir** sont dans `site/editeur.json`. Un champ vide
s'affiche « À REMPLIR » dans l'aperçu, et **`publier.py` refuse d'envoyer le site** tant qu'il en
reste un.

## À faire avant la première vente

1. **Déclarer l'activité** « édition et vente de licences de logiciels » comme activité secondaire de
   la micro-entreprise, sur le guichet unique de l'INPI. Faire confirmer la catégorie de cotisations
   (prestations de services BIC, 21,2 % en 2026, d'après la plupart des guides).
2. **Choisir un médiateur de la consommation** (obligatoire, même en micro-entreprise ; quelques
   dizaines d'euros par an) et remplir `mediateur_nom`, `mediateur_adresse`, `mediateur_site`. La
   plateforme européenne RLL a fermé le 20 juillet 2025 : n'y renvoyer nulle part.
3. **Remplir `site/editeur.json`** : nom tel qu'au répertoire SIRENE, adresse, téléphone, SIRET.
4. **Décider** le nombre d'ordinateurs par licence (`installations`, 3 par défaut) et les prix
   (lancement, normal, renouvellement, fin du prix de lancement) — les écrire sur la page d'accueil.
5. ~~**Régler la page de paiement**~~ — fait le 15/10/2026 (ci-dessous) ; son adresse de production va
   dans `lien_paiement`.
6. **Héberger les paquets** : les **Releases** de ce dépôt (public), `releases/latest`, où pointent le
   courriel de livraison et la page Installer. Les paquets de vente (`outils/construire-vente.sh` du
   logiciel : Linux, Windows, Raspberry Pi 5) ne se publient qu'à l'ouverture.
7. **Les CGV et la licence d'utilisation en PDF**, datées du jour de l'ouverture : jointes à chaque
   courriel de livraison (la confirmation sur support durable « reprend ces conditions », art. L221-13).
8. **Ouvrir** : `vente_ouverte` à `true`, `date_conditions` à jour, `python3 site/publier.py`.
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

## Annoncer une nouvelle version (07/10/2026)

Le logiciel lit au lancement `https://verdiercam.fr/version.json` et montre sa version en **vert** (à jour) ou en
**rouge** avec le numéro publié (un clic ouvre la page). Ce fichier vient de `site/version-publiee.json`, que
`generer.py` recopie tel quel ; **on le change à la main, une fois le paquet réellement téléchargeable** — c'est
l'interrupteur : sans lui, aucun client ne voit passer une version.

```json
{"version": "0.9.160", "page": "https://verdiercam.fr/#telecharger", "notes": "Pignons, script façon OpenSCAD"}
```

Absent, le site ne publie pas de manifeste et le logiciel reste en gris.
