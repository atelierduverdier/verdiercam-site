// LE CONFIGURATEUR DE PIÈCES, CÔTÉ PAGE (10/10/2026). Sans framework.
//
// pieces.json donne les pièces (écrit par outils/construire-wasm.sh : tout le catalogue du logiciel, rangé par thème
// comme sa galerie) ; chacune pointe vers un script .vcs. Les variables de tête du script (le cœur les lit :
// `variables`) font le formulaire, leur commentaire est le libellé — un nombre, une case vrai/faux, ou un texte (le
// prénom d'un porte-clés, les mots d'une enseigne). À chaque changement, après un court délai,
// le script est rejoué par le cœur WebAssembly dans un Web Worker (travailleur.js) : l'aperçu, le SVG, le DXF.
// Une valeur aberrante ou un croquis insoluble : le message du cœur, l'ancien aperçu gardé (pâli), les
// téléchargements fermés tant que les valeurs ne donnent pas de pièce. Un calcul qui ne rend pas la main en
// DELAI_MAX ms, ou un cœur qui plante : le travailleur est tué et relancé — la page ne casse jamais.
// Depuis le 16/10/2026 : l'adresse garde les valeurs (« #boite?L=120 », « Copier le lien »), et « Pour l'usiner » dit
// l'usinage que la pièce déclare, à ces valeurs.
'use strict';

(function () {
  // L'EMPREINTE DES FICHIERS (16/10/2026, Christophe : « je ne vois pas la 3D sur mon navigateur » — le cache gardait
  // l'ancien script). Le générateur du site appelle ce script « configurateur.js?v=<empreinte du configurateur> » ; on
  // reporte la même empreinte sur ce qu'on charge ensuite (le travailleur, le cœur, la liste et les pièces) : une version
  // neuve change toutes les adresses, le cache ne sert plus l'ancienne. Sans empreinte (en essai local) : rien.
  const VERSION_FICHIERS = (() => {
    try { return new URL(document.currentScript.src).search; } catch (e) { return ''; }
  })();
  const DELAI_SAISIE = 250;    // ms entre la dernière frappe et le calcul
  const DELAI_MAX = 8000;      // ms au-delà desquelles un calcul est abandonné

  const $ = (id) => document.getElementById(id);
  const el = {
    piece: $('piece'), titrePiece: $('titre-piece'), description: $('description'), formulaire: $('formulaire'), origine: $('origine'),
    cadre: $('cadre'), dessin: $('dessin'), attente: $('attente'), etat: $('etat'), erreur: $('erreur'),
    svg: $('svg'), dxf: $('dxf'), vcs: $('vcs'), script: $('script'), copier: $('copier'), copie: $('copie'),
    lien: $('lien'), lienCopie: $('lien-copie'),
    usinageBloc: $('usinage-bloc'), usinagePlanche: $('usinage-planche'), usinage: $('usinage'), usinageCompte: $('usinage-compte'),
    scriptBloc: $('script-bloc'),
    ongletDessin: $('onglet-dessin'), onglet3d: $('onglet-3d'), canevas3d: $('vue3d'), note3d: $('note3d'), vues3d: $('vues3d'),
  };

  // LES DEUX VUES (16/10/2026) : le dessin, ou la 3D simplifiée de ce que l'usinage enlève (vue3d.js) — l'onglet 3D ne
  // paraît que si la pièce déclare un usinage.
  const vue3d = window.Vue3D ? window.Vue3D.creer(el.canevas3d) : null;
  let en3d = false;
  function choisirVue(trois) {
    en3d = trois && !!vue3d;
    el.ongletDessin.classList.toggle('actif', !en3d);
    el.onglet3d.classList.toggle('actif', en3d);
    el.ongletDessin.setAttribute('aria-selected', String(!en3d));
    el.onglet3d.setAttribute('aria-selected', String(en3d));
    el.canevas3d.hidden = !en3d;
    el.note3d.hidden = !en3d;
    el.vues3d.hidden = !en3d;
    if (dernier) el.dessin.hidden = en3d;
    if (en3d && dernier) { vue3d.montrer(dernier); }
  }

  // UN NOMBRE À LA FRANÇAISE : « 22,3 », sans zéros inutiles.
  const nombre = (x) => (Math.round(x * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });

  // CE QU'IL FAUT POUR L'USINER (16/10/2026) : chaque « usinage(…) » du script, aux valeurs du formulaire — la famille, ce
  // qu'elle vise, la fraise, la profondeur et ses passes. Une profondeur qui suit l'épaisseur (« profondeur = e + 0.3 »)
  // change avec elle.
  const FAMILLES = {
    poche: 'Poche', contour: 'Contour', rainure: 'Rainure', gravure: 'Gravure', 'gravure-v': 'Gravure en V',
    percage: 'Perçage', 'perçage': 'Perçage', helicoidal: 'Perçage hélicoïdal', ebavurer: 'Ébavurage', revolution: 'Révolution',
  };
  const COTES = { exterieur: 'extérieur', interieur: 'intérieur', sur: 'sur le trait' };
  function montrerUsinage(r) {
    const liste = (r && r.usinages) || [];
    el.usinageBloc.hidden = liste.length === 0;
    el.usinage.textContent = '';
    if (!liste.length) return;
    const p = r.planche || {};
    el.usinageCompte.textContent = `— ${liste.length} opération${liste.length > 1 ? 's' : ''}`;
    el.usinagePlanche.textContent = p.epaisseur > 0
      ? `Planche ${nombre(p.largeur)} × ${nombre(p.longueur)} mm, ${nombre(p.epaisseur)} mm d'épaisseur.` : '';
    for (const u of liste) {
      const li = document.createElement('li');
      const quoi = document.createElement('div');
      quoi.className = 'quoi';
      const famille = FAMILLES[u.famille] || u.famille;
      quoi.textContent = (u.nom ? u.nom + ' — ' : '') + famille
        + (u.famille === 'contour' && COTES[u.cote] ? ' ' + COTES[u.cote] : '')
        + ` de « ${u.cible} »` + (u.formes > 1 ? ` (${u.formes} formes)` : '');
      const detail = document.createElement('div');
      detail.className = 'detail';
      const morceaux = [];
      morceaux.push(u.outil || 'fraise de votre choix');
      if (u.profondeur > 0) {
        let t = (u.depart > 0 ? `de ${nombre(u.depart)} à ${nombre(u.depart + u.profondeur)} mm` : `profondeur ${nombre(u.profondeur)} mm`);
        if (u.passe > 0) {
          const passes = Math.max(1, Math.ceil(u.profondeur / u.passe - 1e-9));
          t += ` en ${passes} passe${passes > 1 ? 's' : ''} de ${nombre(u.passe)} mm au plus`;
        }
        morceaux.push(t);
      }
      if (u.onglets > 0) morceaux.push(`${u.onglets} onglet${u.onglets > 1 ? 's' : ''} de maintien`);
      if (u.coins === 'dogbone') morceaux.push('coins dégagés (dogbone)');
      else if (u.coins && u.coins !== 'aucun') morceaux.push(`coins dégagés (${u.coins})`);
      detail.textContent = morceaux.join(' · ');
      li.append(quoi, detail);
      // Ce qui mérite qu'on s'y arrête : une cible absente, une profondeur au-delà de la planche.
      const fond = u.depart + u.profondeur;
      if (u.formes === 0 || (p.epaisseur > 0 && fond > p.epaisseur + 0.5)) {
        const a = document.createElement('div');
        a.className = 'detail alerte';
        a.textContent = u.formes === 0 ? 'Aucune forme ne porte ce nom avec ces valeurs.'
          : `Plus profond que la planche (${nombre(fond)} mm pour ${nombre(p.epaisseur)}) : le martyr sera entamé.`;
        li.append(a);
      } else if (p.epaisseur > 0 && fond >= p.epaisseur - 0.01) {
        const a = document.createElement('div');
        a.className = 'detail';
        a.textContent = 'Traverse la planche.';
        li.append(a);
      }
      el.usinage.append(li);
    }
  }

  // LE LIEN QUI GARDE LES VALEURS (16/10/2026) : « #boite?L=120&e=22 » — la pièce, puis les seules valeurs changées.
  // Ouvert, il remplit le formulaire avec elles ; chaque calcul réussi le tient à jour (sans ajouter à l'historique).
  function lireAdresse() {
    const brut = location.hash.slice(1);
    const q = brut.indexOf('?');
    const id = decodeURIComponent(q < 0 ? brut : brut.slice(0, q));
    const valeurs = {};
    if (q >= 0) for (const [k, v] of new URLSearchParams(brut.slice(q + 1))) valeurs[k] = v;
    return { id, valeurs };
  }
  function adresse(valeurs) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(valeurs)) q.set(k, typeof v === 'boolean' ? (v ? 'vrai' : 'faux') : v);
    const s = q.toString();
    return '#' + encodeURIComponent(piece.id) + (s ? '?' + s : '');
  }

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
    travailleur = new Worker('travailleur.js' + VERSION_FICHIERS);
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
    el.svg.disabled = el.dxf.disabled = el.vcs.disabled = el.lien.disabled = !ouvert;
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
      const origine = v.booleen ? v.valeur !== 0 : v.chaine !== undefined ? v.chaine : v.texte;
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
      } else if (v.chaine !== undefined) {
        // Un texte : le clavier entier, sans guillemets (le cœur les remet en réécrivant le script).
        input.type = 'text';
        input.value = v.chaine;
        input.spellcheck = false;
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
    const avecUsinage = !!(r.usinages && r.usinages.length && vue3d);
    el.onglet3d.hidden = !avecUsinage;
    if (en3d && !avecUsinage) choisirVue(false);
    if (en3d) { el.dessin.hidden = true; vue3d.montrer(r); }
    const ici = adresse(valeurs);
    if (location.hash !== ici) history.replaceState(null, '', ici);
    montrerUsinage(r);
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
  async function choisir(id, valeursDemandees) {
    piece = pieces.find((p) => p.id === id) || pieces[0];
    if (!piece) return;
    const demandees = piece.id === id ? (valeursDemandees || {}) : {};
    if (lireAdresse().id !== piece.id) history.replaceState(null, '', '#' + encodeURIComponent(piece.id));
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
      const reponse = await fetch(piece.fichier + VERSION_FICHIERS);
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
    // Les valeurs du lien : posées dans le formulaire (une variable inconnue est ignorée).
    for (const [nom, v] of Object.entries(demandees)) {
      const input = el.formulaire.elements[nom];
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = v === 'vrai' || v === 'true' || v === '1';
      else input.value = v;
    }
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
  el.vues3d.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && vue3d) vue3d.vue(b.dataset.vue); });
  el.ongletDessin.addEventListener('click', () => choisirVue(false));
  el.onglet3d.addEventListener('click', () => choisirVue(true));
  el.lien.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      el.lienCopie.textContent = 'Lien copié.';
    } catch (e) {
      el.lienCopie.textContent = 'Copiez l\'adresse dans la barre du navigateur.';
    }
    setTimeout(() => { el.lienCopie.textContent = ''; }, 2500);
  });
  // Un lien collé dans la barre d'adresse (une autre pièce, ou d'autres valeurs) : la pièce et ses valeurs.
  window.addEventListener('hashchange', () => {
    if (!pieces.length) return;
    const a = lireAdresse();
    if (a.id !== piece.id || location.hash !== adresse(valeursDuFormulaire())) choisir(a.id, a.valeurs);
  });

  // REPLIÉS AU TÉLÉPHONE (16/10/2026, Christophe : « replie le script et l'usinage sur téléphone ») : l'aperçu vient d'abord,
  // le formulaire ensuite ; ouverts, le script et la liste d'usinage les séparaient de plusieurs écrans. Repliés une fois
  // au chargement — un titre touché les rouvre, et ils restent comme on les laisse.
  const PLIER_AU_TELEPHONE = window.matchMedia('(max-width: 760px)').matches;
  if (PLIER_AU_TELEPHONE) {
    el.scriptBloc.open = false;
    el.usinageBloc.open = false;
  }

  demarrer();
  pret.catch((e) => {
    el.attente.textContent = '';
    montrerErreur(`Le cœur de calcul ne se charge pas : ${e.message}. Le navigateur doit accepter WebAssembly, `
                  + 'et la page être servie par un serveur web (pas ouverte comme un fichier).');
  });
  fetch('pieces.json' + VERSION_FICHIERS)
    .then((r) => { if (!r.ok) throw new Error('pieces.json : ' + r.status); return r.json(); })
    .then((liste) => {
      pieces = (liste.pieces || []).filter((p) => p && p.id && p.fichier);
      el.piece.textContent = '';
      // Un groupe par thème, dans l'ordre de pieces.json (celui de la galerie du logiciel).
      let groupe = null;
      for (const p of pieces) {
        const theme = p.theme || 'Autres';
        if (!groupe || groupe.label !== theme) {
          groupe = document.createElement('optgroup');
          groupe.label = theme;
          el.piece.append(groupe);
        }
        groupe.append(new Option(p.nom || p.id, p.id));
      }
      el.titrePiece.textContent = `Pièce — ${pieces.length} au catalogue`;
      el.piece.disabled = pieces.length === 0;
      if (!pieces.length) throw new Error('aucune pièce dans pieces.json');
      const a = lireAdresse();
      choisir(a.id, a.valeurs);
    })
    .catch((e) => {
      el.attente.textContent = '';
      montrerErreur(`La liste des pièces ne se charge pas (${e.message}).`);
    });
})();
