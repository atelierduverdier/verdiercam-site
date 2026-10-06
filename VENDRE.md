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
5. **Régler la page de paiement** (ci-dessous), puis mettre son adresse dans `lien_paiement`.
6. **Suivre le total** des ventes à des particuliers des autres pays de l'UE : au-delà de 10 000 €
   par an, la TVA du pays de l'acheteur est due (guichet OSS), même en franchise.

## La page de paiement : là où se garde la preuve

La case de `acheter.html` est une précaution de présentation : **elle ne prouve rien**, puisque le
navigateur du client peut la contourner. Le renoncement au droit de rétractation doit être **exprès**,
**préalable** et **confirmé sur un support durable** (art. L221-13) — c'est le prestataire de paiement
qui le garde.

Avec un **lien de paiement Stripe** (Payment Link) :

- dans les réglages du compte, renseigner l'adresse des conditions : `https://verdiercam.fr/cgv.html` ;
- sur le lien de paiement, activer **« Exiger l'acceptation des conditions d'utilisation »** (case
  obligatoire, horodatée par Stripe) ;
- ajouter un **texte personnalisé** près du bouton de paiement, mot pour mot :
  « Je demande à recevoir VerdierCAM immédiatement et je renonce expressément à mon droit de
  rétractation dès la fourniture du lien de téléchargement et de la clé (art. L221-28 13° du code de
  la consommation). »
- dans le **pied du reçu** envoyé par courriel, reprendre cette phrase : c'est la confirmation sur
  support durable ;
- demander le **nom** de l'acheteur (il figure dans la clé de licence).

Vérifier ces libellés dans le tableau de bord Stripe au moment de le faire : ils peuvent changer.

## Ce qui manque encore dans le logiciel

VerdierCAM actuel n'a **ni clé de licence ni vérification de version** (elles n'existaient que dans
l'ancien verdiercam-cpp). Il faudra, avant la vente : une clé au nom de l'acheteur portant la date
de fin des mises à jour, comparée à la date de la version — sans verrou anti-copie, le nom suffit.
