// LE CONFIGURATEUR DE PIÈCES, CÔTÉ PAGE (10/10/2026). Sans framework.
//
// pieces.json donne les pièces ; chacune pointe vers un script .vcs. Les variables de tête du script (le cœur les
// lit : `variables`) font le formulaire, leur commentaire est le libellé. À chaque changement, après un court délai,
// le script est rejoué par le cœur WebAssembly dans un Web Worker (travailleur.js) : l'aperçu, le SVG, le DXF.
// Une valeur aberrante ou un croquis insoluble : le message du cœur, l'ancien aperçu gardé (pâli), les
// téléchargements fermés tant que les valeurs ne donnent pas de pièce. Un calcul qui ne rend pas la main en
// DELAI_MAX ms, ou un cœur qui plante : le travailleur est tué et relancé — la page ne casse jamais.
'use strict';

(function () {
  const DELAI_SAISIE = 250;    // ms entre la dernière frappe et le calcul
  const DELAI_MAX = 8000;      // ms au-delà desquelles un calcul est abandonné

  const $ = (id) => document.getElementById(id);
  const el = {
    piece: $('piece'), description: $('description'), formulaire: $('formulaire'), origine: $('origine'),
    cadre: $('cadre'), dessin: $('dessin'), attente: $('attente'), etat: $('etat'), erreur: $('erreur'),
    svg: $('svg'), dxf: $('dxf'), vcs: $('vcs'), script: $('script'), copier: $('copier'), copie: $('copie'),
  };

  // LE SCRIPT SOUS LE DESSIN : ligne à ligne (la ligne d'une erreur surlignée), avec les valeurs du formulaire.
  function montrerScript(texte, ligneErreur) {
    el.script.textContent = '';
    const lignes = String(texte || '').split('\n');
    lignes.forEach((l, i) => {
      const span = document.createElement('span');
      span.className = 'script-ligne' + (ligneErreur > 0 && i + 1 === ligneErreur ? ' script-erreur' : '')
                       + (/^\s*\/\//.test(l) ? ' script-commentaire' : '');
      span.textContent = l + (i < lignes.length - 1 ? '\n' : '');
      el.script.appendChild(span);
    });
    el.copier.disabled = !texte;
    if (ligneErreur > 0) {
      const fautive = el.script.querySelector('.script-erreur');
      if (fautive) el.script.scrollTop = Math.max(0, fautive.offsetTop - el.script.clientHeight / 2);
    }
  }

  let pieces = [];
  let piece = null;            // la pièce choisie
  let source = '';             // son script
  let variables = [];          // ses variables de tête
  let dernier = null;          // le dernier résultat SANS erreur (l'aperçu montré)
  let courant = null;          // le résultat des valeurs du formulaire (peut porter des erreurs)
  let urlApercu = null;
  let minuterie = 0;

  // ── Le travailleur ──────────────────────────────────────────────────────────────────────────────
  let travailleur = null;
  let pret = null;             // promesse : le cœur est chargé
  let numero = 0;
  const attentes = new Map();  // id → { resoudre, rejeter, minuterie }

  function demarrer() {
    if (travailleur) travailleur.terminate();
    for (const a of attentes.values()) { clearTimeout(a.minuterie); a.rejeter(new Error('Calcul relancé.')); }
    attentes.clear();
    travailleur = new Worker('travailleur.js');
    pret = new Promise((resoudre, rejeter) => {
      travailleur.onmessage = (e) => {
        const m = e.data;
        if (m.pret) return resoudre();
        if (m.echecChargement) return rejeter(new Error(m.echecChargement));
        const a = attentes.get(m.id);
        if (!a) return;
        attentes.delete(m.id);
        clearTimeout(a.minuterie);
        if (m.perdu) demarrer();   // le module a planté : une instance neuve pour la suite
        if (m.erreur) a.rejeter(new Error(m.erreur));
        else a.resoudre(m.resultat);
      };
      travailleur.onerror = (e) => {
        e.preventDefault();
        rejeter(new Error(e.message || 'le cœur de calcul ne se charge pas'));
        for (const a of attentes.values()) { clearTimeout(a.minuterie); a.rejeter(new Error(e.message || 'erreur du calcul')); }
        attentes.clear();
      };
    });
    pret.catch(() => {});
  }

  function demander(quoi, valeurs) {
    return pret.then(() => new Promise((resoudre, rejeter) => {
      const id = ++numero;
      const minuterie = setTimeout(() => {
        attentes.delete(id);
        demarrer();
        rejeter(new Error('Le calcul prend trop de temps avec ces valeurs (une boucle trop longue ?) : il a été arrêté.'));
      }, DELAI_MAX);
      attentes.set(id, { resoudre, rejeter, minuterie });
      travailleur.postMessage({ id, quoi, source, valeurs });
    }));
  }

  // ── L'affichage ─────────────────────────────────────────────────────────────────────────────────
  function montrerErreur(texte) {
    el.erreur.textContent = texte;
    el.erreur.hidden = !texte;
  }

  // L'aperçu : le SVG du cœur, son trait rendu lisible à toute taille (le fichier téléchargé, lui, reste tel quel).
  function montrerApercu(svg) {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const racine = doc.documentElement;
    if (racine.nodeName !== 'svg' || doc.getElementsByTagName('parsererror').length) return false;
    racine.setAttribute('width', '100%');
    racine.removeAttribute('height');
    for (const n of racine.querySelectorAll('[stroke]')) {
      n.setAttribute('stroke', '#2F3540');
      n.setAttribute('stroke-width', '1.4');
      n.setAttribute('vector-effect', 'non-scaling-stroke');
    }
    // Le cadre de la planche, en pointillé orange, sous le dessin.
    const vb = (racine.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb.every(Number.isFinite)) {
      const cadre = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
      for (const [k, v] of [['x', vb[0]], ['y', vb[1]], ['width', vb[2]], ['height', vb[3]], ['fill', '#FFF8EE'],
                            ['stroke', '#FF8F00'], ['stroke-width', '1'], ['stroke-dasharray', '6 4'],
                            ['vector-effect', 'non-scaling-stroke']])
        cadre.setAttribute(k, v);
      racine.insertBefore(cadre, racine.firstChild);
    }
    const texte = new XMLSerializer().serializeToString(racine);
    if (urlApercu) URL.revokeObjectURL(urlApercu);
    urlApercu = URL.createObjectURL(new Blob([texte], { type: 'image/svg+xml' }));
    el.dessin.src = urlApercu;
    el.dessin.hidden = false;
    el.attente.hidden = true;
    return true;
  }

  function ouvrirTelechargements(ouvert) {
    el.svg.disabled = el.dxf.disabled = el.vcs.disabled = !ouvert;
  }

  function marquerChamp(ligne) {
    for (const input of el.formulaire.querySelectorAll('input')) {
      const fautif = ligne > 0 && Number(input.dataset.ligne) === ligne;
      input.setAttribute('aria-invalid', fautif ? 'true' : 'false');
    }
  }

  // ── Le formulaire ───────────────────────────────────────────────────────────────────────────────
  function valeursDuFormulaire() {
    const valeurs = {};
    for (const v of variables) {
      const input = el.formulaire.elements[v.nom];
      if (!input) continue;
      const x = v.booleen ? input.checked : input.value;
      const origine = v.booleen ? v.valeur !== 0 : v.texte;
      if (x !== origine) valeurs[v.nom] = x;   // seules les valeurs changées : le script garde son écriture
    }
    return valeurs;
  }

  function construireFormulaire() {
    el.formulaire.textContent = '';
    for (const v of variables) {
      const champ = document.createElement('div');
      champ.className = v.booleen ? 'champ case' : 'champ';
      const id = 'v-' + v.nom;
      const input = document.createElement('input');
      input.id = id;
      input.name = v.nom;
      input.dataset.ligne = v.ligne;
      if (v.booleen) {
        input.type = 'checkbox';
        input.checked = v.valeur !== 0;
      } else {
        input.type = 'text';
        input.inputMode = 'decimal';
        input.value = v.texte;
        input.spellcheck = false;
      }
      const label = document.createElement('label');
      label.htmlFor = id;
      label.textContent = v.commentaire || v.nom;
      const nom = document.createElement('span');
      nom.className = 'nom';
      nom.textContent = v.nom;
      if (v.booleen) champ.append(input, label);
      else champ.append(label, input, nom);
      if (v.commentaire && v.booleen) label.title = v.nom;
      el.formulaire.append(champ);
    }
    el.origine.disabled = variables.length === 0;
  }

  async function calculer() {
    clearTimeout(minuterie);
    const valeurs = valeursDuFormulaire();
    const pour = piece;
    el.cadre.setAttribute('aria-busy', 'true');
    let r;
    try {
      r = await demander('rejouer', valeurs);
    } catch (e) {
      if (pour !== piece) return;
      r = { erreurs: [e.message], ligne: 0, svg: '', dxf: '' };
    }
    if (pour !== piece) return;
    // Une réponse dépassée (les valeurs ont encore changé depuis) : la suivante arrive.
    if (JSON.stringify(valeurs) !== JSON.stringify(valeursDuFormulaire())) return;
    el.cadre.setAttribute('aria-busy', 'false');
    courant = r;
    // Une valeur refusée ne rend pas de script : le dernier valable reste montré, la ligne fautive surlignée.
    montrerScript(r.source || (dernier && dernier.source) || source, r.erreurs.length ? r.ligne : 0);
    if (r.erreurs.length || !r.svg || !montrerApercu(r.svg)) {
      const message = r.erreurs.length ? r.erreurs.join(' ') : 'Le dessin rendu est illisible.';
      montrerErreur((r.ligne > 0 ? `Ligne ${r.ligne} du script : ` : '') + message
                    + (dernier ? ' L\'aperçu montre les dernières valeurs valables.' : ''));
      el.cadre.classList.toggle('perime', !!dernier);
      el.etat.textContent = '';
      marquerChamp(r.ligne);
      ouvrirTelechargements(false);
      return;
    }
    dernier = r;
    montrerErreur('');
    marquerChamp(0);
    el.cadre.classList.remove('perime');
    el.etat.textContent = `${r.formes} forme${r.formes > 1 ? 's' : ''} · aperçu à jour`;
    ouvrirTelechargements(true);
  }

  function planifier() {
    clearTimeout(minuterie);
    el.cadre.classList.add('perime');
    minuterie = setTimeout(calculer, DELAI_SAISIE);
  }

  // ── Les pièces ──────────────────────────────────────────────────────────────────────────────────
  async function choisir(id) {
    piece = pieces.find((p) => p.id === id) || pieces[0];
    if (!piece) return;
    if (location.hash !== '#' + piece.id) history.replaceState(null, '', '#' + piece.id);
    el.piece.value = piece.id;
    el.description.textContent = piece.description || '';
    dernier = courant = null;
    el.dessin.hidden = true;
    el.attente.hidden = false;
    el.attente.textContent = 'Calcul…';
    ouvrirTelechargements(false);
    montrerErreur('');
    const pour = piece;
    try {
      const reponse = await fetch(piece.fichier);
      if (!reponse.ok) throw new Error(`${piece.fichier} : ${reponse.status}`);
      const texte = await reponse.text();
      if (pour !== piece) return;
      source = texte;
      variables = await demander('variables');
      if (pour !== piece) return;
    } catch (e) {
      if (pour !== piece) return;
      source = '';
      variables = [];
      construireFormulaire();
      el.attente.textContent = '';
      montrerErreur(`Cette pièce ne se charge pas (${e.message}).`);
      return;
    }
    construireFormulaire();
    calculer();
  }

  function telecharger(texte, nom, type) {
    const url = URL.createObjectURL(new Blob([texte], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  el.formulaire.addEventListener('input', planifier);
  el.formulaire.addEventListener('submit', (e) => { e.preventDefault(); calculer(); });
  el.piece.addEventListener('change', () => choisir(el.piece.value));
  el.origine.addEventListener('click', () => { construireFormulaire(); calculer(); });
  el.svg.addEventListener('click', () => courant && courant.svg && telecharger(courant.svg, piece.id + '.svg', 'image/svg+xml'));
  el.dxf.addEventListener('click', () => courant && courant.dxf && telecharger(courant.dxf, piece.id + '.dxf', 'application/dxf'));
  el.vcs.addEventListener('click', () => courant && courant.source && telecharger(courant.source, piece.id + '.vcs', 'text/plain'));
  el.copier.addEventListener('click', async () => {
    if (!courant || !courant.source) return;
    try {
      await navigator.clipboard.writeText(courant.source);
      el.copie.textContent = 'Copié.';
    } catch (e) {
      // Pas de presse-papiers (page hors https, refus) : le texte se sélectionne, Ctrl+C fait le reste.
      const s = window.getSelection(), plage = document.createRange();
      plage.selectNodeContents(el.script);
      s.removeAllRanges();
      s.addRange(plage);
      el.copie.textContent = 'Sélectionné : Ctrl+C pour copier.';
    }
    setTimeout(() => { el.copie.textContent = ''; }, 2500);
  });
  window.addEventListener('hashchange', () => { if (pieces.length && location.hash.slice(1) !== piece.id) choisir(location.hash.slice(1)); });

  demarrer();
  pret.catch((e) => {
    el.attente.textContent = '';
    montrerErreur(`Le cœur de calcul ne se charge pas : ${e.message}. Le navigateur doit accepter WebAssembly, `
                  + 'et la page être servie par un serveur web (pas ouverte comme un fichier).');
  });
  fetch('pieces.json')
    .then((r) => { if (!r.ok) throw new Error('pieces.json : ' + r.status); return r.json(); })
    .then((liste) => {
      pieces = (liste.pieces || []).filter((p) => p && p.id && p.fichier);
      el.piece.textContent = '';
      for (const p of pieces) el.piece.append(new Option(p.nom || p.id, p.id));
      el.piece.disabled = pieces.length === 0;
      if (!pieces.length) throw new Error('aucune pièce dans pieces.json');
      choisir(location.hash.slice(1));
    })
    .catch((e) => {
      el.attente.textContent = '';
      montrerErreur(`La liste des pièces ne se charge pas (${e.message}).`);
    });
})();
