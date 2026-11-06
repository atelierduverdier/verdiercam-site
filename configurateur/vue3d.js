// LA 3D SIMPLIFIÉE DU CONFIGURATEUR (16/10/2026, Christophe : « voir la version 3D de la pièce qui serait usinée »).
//
// Pas les trajets de la fraise — ils demandent le noyau d'usinage (OpenCascade), absent du module web —, mais la planche
// et ce que chaque « usinage(…) » du script ENLÈVE, à sa profondeur. Le trait de chaque opération vient du cœur
// (`usinages[i].svg`, dans le repère de la planche : mm, Y vers le bas).
//
// UNE CARTE DES HAUTEURS, DESSINÉE AVEC UN TAMPON DE PROFONDEUR (16/10/2026, Christophe sur le labyrinthe : « on ne voit
// pas tout, on dirait une face cachée »). La première version triait des faces du fond vers l'avant (le peintre) : le
// fond de la feuillure, une seule grande face opaque, passait devant ou derrière les canaux selon l'angle, et une rainure
// n'était qu'une paroi sans épaisseur le long de son axe. Maintenant, chaque opération se trace sur un petit canevas caché
// à l'échelle de la planche (Path2D lit le chemin SVG tel quel) — la poche remplie, la rainure du Ø de sa fraise, le
// contour d'une bande de fraise du bon côté, la gravure en V à sa largeur — et chaque case garde, par niveau de
// profondeur, la part couverte (couvertures). Les bords passent là où cette part vaut ½, entre les cases, sur le vrai
// trait (maillage : « beaucoup moins beau » en escalier de cases, le même jour, sur le jeu de go). Fonds, parois et dessous
// se dessinent en WebGL, avec un tampon de profondeur : chaque point montre ce qui est vraiment devant. Sans WebGL,
// l'ancien dessin (le peintre) reste. Un doigt (ou la souris) tourne, deux doigts pincés ou la molette rapprochent, un
// double-clic revient à la vue de départ ; des boutons donnent les vues de dessus, de dessous, de face, 3/4. Aucune
// bibliothèque : rien n'est chargé d'ailleurs.
'use strict';

(function () {
  const FAMILLES_FOND = new Set(['poche', 'percage', 'perçage', 'helicoidal']);   // un fond, en plus des parois
  const COULEURS = {
    planche: '232,201,160', plancheBord: '170,130,85', fond: '255,143,0', paroi: '230,81,0', trait: '47,53,64',
  };

  // Le trait d'une opération → des boucles de points [x, y] (mm, Y vers le bas comme le SVG), et si elles sont fermées.
  function boucles(svgTexte, hote, pasMm = 1.5) {
    const doc = new DOMParser().parseFromString(svgTexte, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length) return [];
    const ns = 'http://www.w3.org/2000/svg';
    const sortie = [];
    for (const n of doc.querySelectorAll('path')) {
      const d = n.getAttribute('d') || '';
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      hote.appendChild(p);
      const L = p.getTotalLength();
      const pas = Math.max(8, Math.min(400, Math.ceil(L / pasMm)));
      const pts = [];
      for (let i = 0; i <= pas; i++) {
        const q = p.getPointAtLength((L * i) / pas);
        pts.push([q.x, q.y]);
      }
      hote.removeChild(p);
      const ferme = /[zZ]\s*$/.test(d);
      if (ferme) pts.pop();
      if (pts.length >= 2) sortie.push({ pts, ferme });
    }
    for (const c of doc.querySelectorAll('circle')) {
      const cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy'), r = +c.getAttribute('r');
      const pas = Math.max(24, Math.min(160, Math.ceil(2 * Math.PI * r / 1.5)));
      const pts = [];
      for (let i = 0; i < pas; i++) pts.push([cx + r * Math.cos((2 * Math.PI * i) / pas), cy + r * Math.sin((2 * Math.PI * i) / pas)]);
      sortie.push({ pts, ferme: true });
    }
    return sortie;
  }

  // Le Ø d'une fraise et l'angle d'une pointe en V, lus dans son nom (« Boule Ø6 », « Pointe V 90 »).
  function outilDe(u) {
    const nom = String(u.outil || '');
    const d = /Ø\s*(\d+(?:[.,]\d+)?)/.exec(nom);
    const v = /\bV\s*(\d+(?:[.,]\d+)?)/.exec(nom);
    return { diametre: d ? parseFloat(d[1].replace(',', '.')) : 6, angleV: v ? parseFloat(v[1].replace(',', '.')) : 0 };
  }

  // Les chemins d'une opération, prêts pour un canevas : un Path2D par trait, et tous ensemble.
  function chemins(svgTexte) {
    const doc = new DOMParser().parseFromString(svgTexte, 'image/svg+xml');
    const tout = new Path2D();
    if (doc.getElementsByTagName('parsererror').length) return tout;
    for (const n of doc.querySelectorAll('path')) tout.addPath(new Path2D(n.getAttribute('d') || ''));
    for (const c of doc.querySelectorAll('circle')) {
      const q = new Path2D();
      q.arc(+c.getAttribute('cx'), +c.getAttribute('cy'), +c.getAttribute('r'), 0, 2 * Math.PI);
      q.closePath();
      tout.addPath(q);
    }
    return tout;
  }

  const CASES = 640;   // cases sur le grand côté de la planche (510 mm : 0,8 mm la case ; les bords passent entre)

  // LES COUVERTURES : chaque opération (chaque couche d'une gravure en V) se trace sur un petit canevas caché à
  // l'échelle de la planche ; le canevas lisse ses bords, et chaque case garde la PART couverte (0 à 255), pas un simple
  // oui ou non. Par niveau de profondeur L (les fonds distincts, la traversée t en dernier) : la plus grande part couverte
  // par une opération qui descend au moins à L. Une rangée de cases de garde, tout autour, est traversée : le bord de la
  // planche se fait comme les autres.
  function couvertures(resultat) {
    const p = resultat.planche;
    const l = p.largeur, w = p.longueur, t = Math.max(p.epaisseur, 0.5);
    const pasMax = Math.max(l, w) / CASES;
    const nx = Math.max(1, Math.round(l / pasMax)), ny = Math.max(1, Math.round(w / pasMax));
    const px = l / nx, py = w / ny;   // la planche tombe juste sur les cases
    const cv = document.createElement('canvas');
    cv.width = nx;
    cv.height = ny;
    const c = cv.getContext('2d', { willReadFrequently: true });
    const creusages = [];   // { bas, a : la part couverte, case par case }
    const creuser = (dessin, bas) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, nx, ny);
      c.setTransform(1 / px, 0, 0, 1 / py, 0, 0);
      c.fillStyle = c.strokeStyle = '#000';
      c.lineCap = c.lineJoin = 'round';
      dessin(c);
      const d = c.getImageData(0, 0, nx, ny).data, a = new Uint8Array(nx * ny);
      for (let k = 0; k < nx * ny; k++) a[k] = d[4 * k + 3];
      creusages.push({ bas, a });
    };
    // Un trait plus fin qu'une case et demie se voit quand même : en dessous, sa couverture n'atteint ½ que par endroits
    // (les anneaux du jeu de go, en pointillés).
    const large = (x) => Math.max(x, 1.6 * Math.max(px, py));
    for (const u of resultat.usinages || []) {
      if (!u.svg) continue;
      const haut = Math.max(u.depart || 0, 0);
      const bas = Math.min(haut + (u.profondeur > 0 ? u.profondeur : Math.min(t, 1)), t);
      const tout = chemins(u.svg);
      const { diametre: D, angleV } = outilDe(u);
      switch (u.famille) {
        case 'poche': case 'percage': case 'perçage': case 'helicoidal':
        case 'revolution':   // une révolution creuse un bol ; ici, son fond à la profondeur dite, comme une poche
          creuser((g) => g.fill(tout, 'evenodd'), bas);
          break;
        case 'gravure':
          if (angleV > 0) {
            // Le V : sa largeur au quart de la profondeur, 1,5 (bas − haut) tan(angle/2), jusqu'au fond. Une seule couche :
            // chaque couche de plus est un niveau, et des milliers de carrés de bord à découper (le jeu de go : 4 millions
            // de sommets avec trois couches).
            const tg = Math.tan((angleV * Math.PI) / 360);
            creuser((g) => { g.lineWidth = large(1.5 * (bas - haut) * tg); g.stroke(tout); }, bas);
          } else creuser((g) => { g.lineWidth = large(D); g.stroke(tout); }, bas);
          break;
        case 'contour':
          // La fraise passe À CÔTÉ du trait : une bande de son Ø, dehors ou dedans ; « sur le trait », à cheval dessus.
          creuser((g) => {
            if (u.cote === 'exterieur' || u.cote === 'interieur') {
              const zone = new Path2D();
              if (u.cote === 'exterieur') zone.rect(-1e5, -1e5, 2e5, 2e5);
              zone.addPath(tout);
              g.save();
              g.clip(zone, 'evenodd');
              g.lineWidth = 2 * D;
              g.stroke(tout);
              g.restore();
            } else {
              g.lineWidth = large(D);
              g.stroke(tout);
            }
          }, bas);
          break;
        default:   // rainure, et ce qui viendra : le trait, du Ø de la fraise
          creuser((g) => { g.lineWidth = large(D); g.stroke(tout); }, bas);
      }
    }
    // Les niveaux : 0 (le dessus), chaque fond distinct, et t (traversée) en dernier.
    const rond = (b) => Math.round(b * 1e4) / 1e4;
    const niveaux = [0, ...new Set(creusages.map((x) => rond(x.bas)).filter((b) => b > 0 && b < t))].sort((a, b) => a - b);
    niveaux.push(t);
    const k = niveaux.length - 1;
    const indice = (b) => { const r = rond(b); return r >= t ? k : niveaux.indexOf(r); };
    const NX = nx + 2, NY = ny + 2;   // avec la garde
    // D'abord, par niveau, le plus couvert par une opération qui s'y arrête ; puis, du plus profond au moins profond,
    // ce qui descend au moins jusque-là.
    const C = new Array(k + 1).fill(null);
    for (let n = k; n >= 1; n--) {
      const cn = n === k ? new Uint8Array(NX * NY).fill(255) : C[n + 1].slice();
      if (n === k) for (let j = 0; j < ny; j++) cn.fill(0, (j + 1) * NX + 1, (j + 1) * NX + 1 + nx);
      for (const x of creusages)
        if (indice(x.bas) === n)
          for (let j = 0; j < ny; j++)
            for (let i = 0, o = j * nx, q = (j + 1) * NX + 1; i < nx; i++) {
              const a = x.a[o + i];
              if (a > cn[q + i]) cn[q + i] = a;
            }
      C[n] = cn;
    }
    return { l, w, t, px, py, nx, ny, NX, NY, niveaux, k, C };
  }

  // LES SOMMETS, SERRÉS (16/10/2026) : 16 octets chacun — la position (trois flottants), puis la normale d'une paroi (x et
  // z sur un octet chacun) et la SORTE de la face ; la couleur se fait dans le nuanceur. À 36 octets (position, normale
  // et couleur en flottants), le jeu de go pesait 64 Mo.
  const SORTE = { fond: 0, paroi: 1, bord: 2, dessous: 3, trait: 4 };
  function tamponSommets() {
    let tampon = new ArrayBuffer(16 * 65536), F = new Float32Array(tampon), U = new Uint8Array(tampon), n = 0;
    return {
      ajouter(x, h, z, nx, nz, sorte) {
        if (16 * (n + 1) > tampon.byteLength) {
          const plus = new ArrayBuffer(tampon.byteLength * 2);
          new Uint8Array(plus).set(U);
          tampon = plus;
          F = new Float32Array(tampon);
          U = new Uint8Array(tampon);
        }
        F[4 * n] = x;
        F[4 * n + 1] = h;
        F[4 * n + 2] = z;
        U[16 * n + 12] = Math.round(nx * 127 + 128);
        U[16 * n + 13] = Math.round(nz * 127 + 128);
        U[16 * n + 14] = sorte;
        n++;
      },
      fin: () => ({ donnees: new Uint8Array(tampon, 0, 16 * n), n }),
    };
  }

  // LE MAILLAGE, SANS ESCALIER (16/10/2026, Christophe sur le jeu de go : « ça fonctionne mais c'est beaucoup moins
  // beau » — chaque bord suivait les cases, et chaque marche s'éclairait autrement). Les nœuds sont les centres des cases ;
  // chaque carré de quatre nœuds se coupe en deux triangles, où chaque couverture varie linéairement. Un bord de niveau
  // passe là où sa couverture vaut ½ (128) : entre les cases, sur le vrai trait. Dans un triangle, le fond du niveau n
  // est le triangle rogné par « C[n] ≥ ½ » et « C[n+1] < ½ » — deux coupes par une droite, un polygone convexe ; la paroi
  // du niveau n suit « C[n] = ½ », de −L[n−1] à −L[n]. Fonds et parois se coupent par les mêmes droites : ils se
  // rejoignent sans jour. Un carré de nœuds tous au même niveau n'a pas de bord : il s'étend en tronçon de rangée.
  function maillage(cc) {
    const { px, py, nx, ny, NX, niveaux, k, C, t } = cc;
    const v = tamponSommets();
    const sommet = (x, h, z, sorte, nx = 0, nz = 0) => v.ajouter(x, h, z, nx, nz, sorte);
    // Le niveau d'un nœud : combien de couvertures y dépassent ½ (elles sont emboîtées).
    const niv = new Uint8Array(C[1].length);
    for (let q = 0; q < niv.length; q++) {
      let n = 0;
      while (n < k && C[n + 1][q] >= 128) n++;
      niv[q] = n;
    }
    const X = (i) => (i - 0.5) * px, Z = (j) => (j - 0.5) * py;   // nœud de garde 0 : un demi-pas avant la planche
    // Un polygone (barycentres dans le triangle a, b, c) rogné par f ≥ ½ (garder > 0) ou f < ½ (garder < 0).
    const rogner = (poly, f, garder) => {
      const sortie = [];
      const val = (b) => garder * (b[0] * f[0] + b[1] * f[1] + b[2] * f[2] - 127.5);
      for (let e = 0; e < poly.length; e++) {
        const P = poly[e], Q = poly[(e + 1) % poly.length], vp = val(P), vq = val(Q);
        if (vp >= 0) sortie.push(P);
        if ((vp >= 0) !== (vq >= 0)) {
          const s = vp / (vp - vq);
          sortie.push([P[0] + s * (Q[0] - P[0]), P[1] + s * (Q[1] - P[1]), P[2] + s * (Q[2] - P[2])]);
        }
      }
      return sortie;
    };
    const triangle = (A, B, Cn, bord) => {   // A, B, Cn : [i, j] des nœuds
      const qs = [A, B, Cn].map(([i, j]) => j * NX + i);
      const ns = qs.map((q) => niv[q]);
      const nmin = Math.min(...ns), nmax = Math.max(...ns);
      const pos = (b) => [b[0] * X(A[0]) + b[1] * X(B[0]) + b[2] * X(Cn[0]), b[0] * Z(A[1]) + b[1] * Z(B[1]) + b[2] * Z(Cn[1])];
      const F = (n) => qs.map((q) => C[n][q]);
      const tri = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      const remplir = (poly, h, sorte) => {
        const P = poly.map(pos);
        for (let e = 1; e + 1 < P.length; e++) {
          sommet(P[0][0], h, P[0][1], sorte);
          sommet(P[e][0], h, P[e][1], sorte);
          sommet(P[e + 1][0], h, P[e + 1][1], sorte);
        }
      };
      // Les fonds, du niveau le plus haut au plus bas que touche le triangle (la traversée n'en a pas).
      for (let n = nmin; n <= Math.min(nmax, k - 1); n++) {
        let poly = tri;
        if (n >= 1) poly = rogner(poly, F(n), 1);
        if (poly.length >= 3) poly = rogner(poly, F(n + 1), -1);
        if (poly.length >= 3) remplir(poly, -niveaux[n], SORTE.fond);
      }
      // Les parois : le long de C[n] = ½, de −L[n−1] à −L[n].
      for (let n = nmin + 1; n <= nmax; n++) {
        const f = F(n), pts = [];
        for (let e = 0; e < 3; e++) {
          const a = f[e] - 127.5, b = f[(e + 1) % 3] - 127.5;
          if ((a >= 0) !== (b >= 0)) {
            const s = a / (a - b), bc = [0, 0, 0];
            bc[e] = 1 - s;
            bc[(e + 1) % 3] = s;
            pts.push(pos(bc));
          }
        }
        if (pts.length < 2) continue;
        const [p, q] = pts, dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1;
        const nx2 = dz / L, nz2 = -dx / L, c = bord ? SORTE.bord : SORTE.paroi;
        const h1 = -niveaux[n - 1], h2 = -niveaux[n];
        sommet(p[0], h1, p[1], c, nx2, nz2); sommet(q[0], h1, q[1], c, nx2, nz2); sommet(q[0], h2, q[1], c, nx2, nz2);
        sommet(p[0], h1, p[1], c, nx2, nz2); sommet(q[0], h2, q[1], c, nx2, nz2); sommet(p[0], h2, p[1], c, nx2, nz2);
      }
    };
    // Le dessous d'un triangle au bord d'une traversée : rogné par C[k] < ½.
    const dessous = (A, B, Cn) => {
      const qs = [A, B, Cn].map(([i, j]) => j * NX + i);
      const poly = rogner([[1, 0, 0], [0, 1, 0], [0, 0, 1]], qs.map((q) => C[k][q]), -1);
      const P = poly.map((b) => [b[0] * X(A[0]) + b[1] * X(B[0]) + b[2] * X(Cn[0]), b[0] * Z(A[1]) + b[1] * Z(B[1]) + b[2] * Z(Cn[1])]);
      for (let e = 1; e + 1 < P.length; e++) {
        sommet(P[0][0], -t, P[0][1], SORTE.dessous);
        sommet(P[e][0], -t, P[e][1], SORTE.dessous);
        sommet(P[e + 1][0], -t, P[e + 1][1], SORTE.dessous);
      }
    };
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx;) {
        const q = j * NX + i, n = niv[q];
        const uni = (ii) => niv[j * NX + ii] === n && niv[j * NX + ii + 1] === n && niv[(j + 1) * NX + ii] === n && niv[(j + 1) * NX + ii + 1] === n;
        if (uni(i)) {
          let i1 = i + 1;
          while (i1 <= nx && uni(i1)) i1++;
          if (n < k) {
            const x0 = X(i), x1 = X(i1), z0 = Z(j), z1 = Z(j + 1), h = -niveaux[n], c = SORTE.fond;
            sommet(x0, h, z0, c); sommet(x1, h, z0, c); sommet(x1, h, z1, c);
            sommet(x0, h, z0, c); sommet(x1, h, z1, c); sommet(x0, h, z1, c);
          }
          i = i1;
          continue;
        }
        const bord = i === 0 || j === 0 || i === nx || j === ny;   // un carré contre la garde : le chant de la planche
        triangle([i, j], [i + 1, j], [i + 1, j + 1], bord);
        triangle([i, j], [i + 1, j + 1], [i, j + 1], bord);
        i++;
      }
    // Le dessous, à part : il ne change qu'au bord d'une traversée (C[k] = ½). Ailleurs, par tronçons de rangée.
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx;) {
        const plein = (ii) => [j * NX + ii, j * NX + ii + 1, (j + 1) * NX + ii, (j + 1) * NX + ii + 1].map((q) => niv[q] < k);
        const p = plein(i);
        if (p.every((x) => x)) {
          let i1 = i + 1;
          while (i1 <= nx && plein(i1).every((x) => x)) i1++;
          const x0 = X(i), x1 = X(i1), z0 = Z(j), z1 = Z(j + 1);
          const d = SORTE.dessous;
          sommet(x0, -t, z0, d); sommet(x1, -t, z0, d); sommet(x1, -t, z1, d);
          sommet(x0, -t, z0, d); sommet(x1, -t, z1, d); sommet(x0, -t, z1, d);
          i = i1;
          continue;
        }
        if (p.some((x) => x)) {
          dessous([i, j], [i + 1, j], [i + 1, j + 1]);
          dessous([i, j], [i + 1, j + 1], [i, j + 1]);
        }
        i++;
      }
    return v.fin();
  }

  // Le trait de chaque opération, à son plan de départ, en segments : pour s'y retrouver.
  function traits(resultat, hote) {
    const v = tamponSommets();
    for (const u of resultat.usinages || []) {
      if (!u.svg) continue;
      const h = -Math.max(u.depart || 0, 0) + 0.02;
      for (const b of boucles(u.svg, hote, 3)) {
        const n = b.pts.length, fin = b.ferme ? n : n - 1;
        for (let i = 0; i < fin; i++) {
          const a = b.pts[i], c = b.pts[(i + 1) % n];
          v.ajouter(a[0], h, a[1], 0, 0, SORTE.trait);
          v.ajouter(c[0], h, c[1], 0, 0, SORTE.trait);
        }
      }
    }
    return v.fin();
  }

  // Les couleurs de la charte du configurateur : le bois (232,201,160), l'orange des fonds (255,143,0) assombri avec la
  // profondeur, la paroi (230,81,0), le chant (196,160,116), le dessous (214,184,146), le trait (47,53,64).
  const SOMMETS = `attribute vec3 aP; attribute vec4 aA;
uniform mat4 uM; uniform vec3 uL; uniform float uT; varying vec3 vC;
void main() {
  gl_Position = uM * vec4(aP, 1.0);
  float sorte = floor(aA.z * 255.0 + 0.5);
  vec3 n = vec3((aA.x * 255.0 - 128.0) / 127.0, 0.0, (aA.y * 255.0 - 128.0) / 127.0);
  vec3 c = vec3(0.902, 0.318, 0.0);
  if (sorte < 0.5) {
    n = vec3(0.0, 1.0, 0.0);
    c = aP.y > -0.001 ? vec3(0.910, 0.788, 0.627) : vec3(1.0, 0.561, 0.0) * (1.0 - 0.35 * (-aP.y) / uT);
  } else if (sorte > 1.5 && sorte < 2.5) {
    c = vec3(0.769, 0.627, 0.455);
  } else if (sorte > 2.5 && sorte < 3.5) {
    n = vec3(0.0, -1.0, 0.0);
    c = vec3(0.839, 0.722, 0.573);
  } else if (sorte > 3.5) {
    vC = vec3(0.184, 0.208, 0.251);
    return;
  }
  vC = c * (0.42 + 0.58 * abs(dot(n, uL)));
}`;
  const PIXELS = `precision mediump float; varying vec3 vC;
void main() { gl_FragColor = vec4(vC, 1.0); }`;

  function programme(gl) {
    const etage = (type, texte) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, texte);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, etage(gl.VERTEX_SHADER, SOMMETS));
    gl.attachShader(p, etage(gl.FRAGMENT_SHADER, PIXELS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return {
      p, aP: gl.getAttribLocation(p, 'aP'), aA: gl.getAttribLocation(p, 'aA'),
      uM: gl.getUniformLocation(p, 'uM'), uL: gl.getUniformLocation(p, 'uL'), uT: gl.getUniformLocation(p, 'uT'),
    };
  }

  function creer(canevas) {
    let gl = null, prog = null;
    try {
      gl = canevas.getContext('webgl', { antialias: true }) || null;
      if (gl) prog = programme(gl);
    } catch (e) {
      gl = null;
    }
    const ctx = gl ? null : canevas.getContext('2d');
    const hote = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    hote.setAttribute('width', '0');
    hote.setAttribute('height', '0');
    hote.style.position = 'absolute';
    hote.style.left = '-10000px';
    document.body.appendChild(hote);

    let faces = [];                // { pts3: [[x,y,z]…] ou anneaux, couleur, alpha, trait, anneaux }
    let planche = { l: 100, w: 100, t: 18 };
    const vueDepart = { lacet: -0.6, tangage: 0.75, zoom: 1 };
    let vue = { ...vueDepart };

    // WEBGL : la carte des hauteurs maillée, et les traits ; rangés dans deux tampons.
    const tampons = gl ? { faces: gl.createBuffer(), traits: gl.createBuffer(), nFaces: 0, nTraits: 0 } : null;
    function construireGL(resultat) {
      const p = resultat && resultat.planche;
      tampons.nFaces = tampons.nTraits = 0;
      if (p && p.largeur > 0) {
        planche = { l: p.largeur, w: p.longueur, t: Math.max(p.epaisseur, 0.5) };
        const f = maillage(couvertures(resultat)), tr = traits(resultat, hote);
        gl.bindBuffer(gl.ARRAY_BUFFER, tampons.faces);
        gl.bufferData(gl.ARRAY_BUFFER, f.donnees, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, tampons.traits);
        gl.bufferData(gl.ARRAY_BUFFER, tr.donnees, gl.STATIC_DRAW);
        tampons.nFaces = f.n;
        tampons.nTraits = tr.n;
      }
      dessiner();
    }

    // La même projection que le peintre (projeter), en matrice : x, y à l'écran, et la profondeur pour le tampon.
    function dessinerGL() {
      const dpr = window.devicePixelRatio || 1;
      const W = canevas.clientWidth, H = canevas.clientHeight;
      if (!W || !H) return;
      if (canevas.width !== Math.round(W * dpr) || canevas.height !== Math.round(H * dpr)) {
        canevas.width = Math.round(W * dpr);
        canevas.height = Math.round(H * dpr);
      }
      gl.viewport(0, 0, canevas.width, canevas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!tampons.nFaces) return;
      const { l, w, t } = planche;
      const cl = Math.cos(vue.lacet), sl = Math.sin(vue.lacet), ct = Math.cos(vue.tangage), st = Math.sin(vue.tangage);
      const diag = Math.hypot(l, w, t) || 1;
      const s = (Math.min(W, H) * 0.92 / diag) * vue.zoom;
      const sx = (2 * s) / W, sy = (2 * s) / H, k = 1 / diag;
      const r0 = [sx * cl, 0, -sx * sl], r1 = [-sy * sl * st, sy * ct, -sy * cl * st], r2 = [-k * sl * ct, -k * st, -k * cl * ct];
      const c = [l / 2, -t / 2, w / 2];
      const tr = (r) => -(r[0] * c[0] + r[1] * c[1] + r[2] * c[2]);
      const M = new Float32Array([r0[0], r1[0], r2[0], 0, r0[1], r1[1], r2[1], 0, r0[2], r1[2], r2[2], 0, tr(r0), tr(r1), tr(r2), 1]);
      // La lumière vient de l'œil, un peu d'en haut à gauche : ce qu'on regarde est toujours éclairé.
      const oeil = [sl * ct, st, cl * ct], hautVue = [-sl * st, ct, -cl * st], droite = [cl, 0, -sl];
      const L = [0, 1, 2].map((i) => oeil[i] + 0.5 * hautVue[i] - 0.3 * droite[i]);
      const nL = Math.hypot(...L);
      gl.useProgram(prog.p);
      gl.uniformMatrix4fv(prog.uM, false, M);
      gl.uniform3f(prog.uL, L[0] / nL, L[1] / nL, L[2] / nL);
      gl.uniform1f(prog.uT, t);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      const lier = (tampon) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
        gl.enableVertexAttribArray(prog.aP);
        gl.enableVertexAttribArray(prog.aA);
        gl.vertexAttribPointer(prog.aP, 3, gl.FLOAT, false, 16, 0);
        gl.vertexAttribPointer(prog.aA, 4, gl.UNSIGNED_BYTE, true, 16, 12);
      };
      // Les faces un rien en retrait : les traits posés dessus passent devant.
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);
      lier(tampons.faces);
      gl.drawArrays(gl.TRIANGLES, 0, tampons.nFaces);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      if (tampons.nTraits) {
        lier(tampons.traits);
        gl.drawArrays(gl.LINES, 0, tampons.nTraits);
      }
    }

    function construire(resultat) {
      if (gl) construireGL(resultat);
      else construirePeintre(resultat);
    }
    function dessiner() {
      if (gl) dessinerGL();
      else dessinerPeintre();
    }

    // SANS WEBGL, LE PEINTRE : la planche (dessus, dessous, quatre côtés) et, pour chaque opération, ses parois et son
    // fond, triés du fond vers l'avant.
    function construirePeintre(resultat) {
      faces = [];
      const p = resultat && resultat.planche;
      if (!p || !(p.largeur > 0)) return;
      planche = { l: p.largeur, w: p.longueur, t: Math.max(p.epaisseur, 0.5) };
      const { l, w, t } = planche;
      const coin = (x, z, y) => [x, y, z];
      const boite = [
        [coin(0, 0, 0), coin(l, 0, 0), coin(l, w, 0), coin(0, w, 0)],          // dessus
        [coin(0, 0, -t), coin(0, w, -t), coin(l, w, -t), coin(l, 0, -t)],      // dessous
        [coin(0, 0, 0), coin(0, 0, -t), coin(l, 0, -t), coin(l, 0, 0)],
        [coin(l, 0, 0), coin(l, 0, -t), coin(l, w, -t), coin(l, w, 0)],
        [coin(l, w, 0), coin(l, w, -t), coin(0, w, -t), coin(0, w, 0)],
        [coin(0, w, 0), coin(0, w, -t), coin(0, 0, -t), coin(0, 0, 0)],
      ];
      boite.forEach((q, i) => faces.push({ anneaux: [q], couleur: i === 0 ? COULEURS.planche : COULEURS.plancheBord,
                                            alpha: i === 0 ? 0.45 : 0.25, trait: 0.35 }));
      for (const u of resultat.usinages || []) {
        if (!u.svg) continue;
        const haut = -Math.max(u.depart || 0, 0);
        const prof = u.profondeur > 0 ? u.profondeur : Math.min(t, 1);
        const bas = Math.max(haut - prof, -t - 2);
        const ls = boucles(u.svg, hote);
        // Les parois : un quadrilatère par pas du trait, du plan de départ au fond.
        for (const b of ls) {
          const n = b.pts.length, fin = b.ferme ? n : n - 1;
          for (let i = 0; i < fin; i++) {
            const a = b.pts[i], c = b.pts[(i + 1) % n];
            faces.push({ anneaux: [[[a[0], haut, a[1]], [c[0], haut, c[1]], [c[0], bas, c[1]], [a[0], bas, a[1]]]],
                         couleur: COULEURS.paroi, alpha: 0.55, trait: 0 });
          }
        }
        // Le fond d'une poche, d'un perçage : toutes ses boucles fermées ensemble (pair-impair : une île reste debout).
        if (FAMILLES_FOND.has(u.famille)) {
          const anneaux = ls.filter((b) => b.ferme).map((b) => b.pts.map((q) => [q[0], bas, q[1]]));
          if (anneaux.length) faces.push({ anneaux, couleur: COULEURS.fond, alpha: 0.85, trait: 0.6 });
        }
        // Le trait sur le dessus, pour s'y retrouver.
        for (const b of ls)
          faces.push({ anneaux: [b.pts.map((q) => [q[0], haut, q[1]])], ligne: true, ferme: b.ferme, couleur: COULEURS.trait, alpha: 0.9 });
      }
      dessiner();
    }

    function projeter(W, H) {
      const { l, w, t } = planche;
      const cx = l / 2, cz = w / 2, cy = -t / 2;
      const cl = Math.cos(vue.lacet), sl = Math.sin(vue.lacet), ct = Math.cos(vue.tangage), st = Math.sin(vue.tangage);
      const diag = Math.hypot(l, w, t) || 1;
      const s = (Math.min(W, H) * 0.92 / diag) * vue.zoom;
      return (q) => {
        const x = q[0] - cx, y = q[1] - cy, z = q[2] - cz;
        const x1 = x * cl - z * sl, z1 = x * sl + z * cl;
        const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
        return [W / 2 + s * x1, H / 2 - s * y2, z2];
      };
    }

    function dessinerPeintre() {
      const dpr = window.devicePixelRatio || 1;
      const W = canevas.clientWidth, H = canevas.clientHeight;
      if (!W || !H) return;
      if (canevas.width !== Math.round(W * dpr) || canevas.height !== Math.round(H * dpr)) {
        canevas.width = Math.round(W * dpr);
        canevas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const P = projeter(W, H);
      // Du plus loin au plus proche (profondeur moyenne du premier anneau) : le peintre.
      const liste = faces.map((f) => {
        const anneaux = f.anneaux.map((a) => a.map(P));
        const a0 = anneaux[0];
        const prof = a0.reduce((m, q) => m + q[2], 0) / (a0.length || 1);
        return { f, anneaux, prof };
      });
      liste.sort((a, b) => a.prof - b.prof);
      for (const { f, anneaux } of liste) {
        ctx.beginPath();
        for (const a of anneaux) {
          a.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
          if (!f.ligne || f.ferme) ctx.closePath();
        }
        if (f.ligne) {
          ctx.strokeStyle = `rgba(${f.couleur},${f.alpha})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          continue;
        }
        ctx.fillStyle = `rgba(${f.couleur},${f.alpha})`;
        ctx.fill('evenodd');
        if (f.trait) {
          ctx.strokeStyle = `rgba(${COULEURS.trait},${f.trait * 0.5})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // TOURNER, RAPPROCHER, REVENIR (16/10/2026, Christophe sur son téléphone : « un doigt fait monter ou descendre la
    // fenêtre, je n'arrive pas à bouger la pièce ; à deux pouces, ça ne marche pas très bien »). Le canevas garde TOUS les
    // gestes (touch-action: none) : un doigt — ou la souris — tourne dans les deux sens, deux doigts pincés rapprochent.
    // La page défile en touchant hors de la vue (sa hauteur lui en laisse la place). La molette rapproche, un double-clic
    // revient ; et les boutons de vue (vues()) évitent d'avoir à tourner.
    const doigts = new Map();      // pointerId → dernière position
    let pince = 0;                 // l'écart des deux doigts au geste précédent
    const ecart = () => {
      const [a, b] = [...doigts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    canevas.addEventListener('pointerdown', (e) => {
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canevas.setPointerCapture(e.pointerId);
      if (doigts.size === 2) pince = ecart();
    });
    canevas.addEventListener('pointermove', (e) => {
      const avant = doigts.get(e.pointerId);
      if (!avant) return;
      e.preventDefault();
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (doigts.size >= 2) {
        const d = ecart();
        if (pince > 0 && d > 0) vue.zoom = Math.min(8, Math.max(0.3, vue.zoom * (d / pince)));
        pince = d;
      } else {
        // LA PIÈCE SUIT LA MAIN (16/10/2026, Christophe : « quand je clique et glisse à gauche, cela tourne à droite ») :
        // l'avant de la pièce part du côté où l'on glisse, comme dans VerdierCAM (Camera3D::Tourner, −dx).
        vue.lacet -= (e.clientX - avant.x) * 0.01;
        // DE DESSOUS AUSSI (16/10/2026, Christophe : « je peux pas voir en dessous ») : l'inclinaison était bornée à
        // 0,05 rad, toujours au-dessus de la planche. Elle va maintenant d'aplomb dessus à d'aplomb dessous.
        vue.tangage = Math.min(1.55, Math.max(-1.55, vue.tangage + (e.clientY - avant.y) * 0.01));
      }
      dessiner();
    });
    const lacher = (e) => {
      doigts.delete(e.pointerId);
      pince = doigts.size === 2 ? ecart() : 0;
    };
    canevas.addEventListener('pointerup', lacher);
    canevas.addEventListener('pointercancel', lacher);
    canevas.addEventListener('wheel', (e) => {
      e.preventDefault();
      vue.zoom = Math.min(8, Math.max(0.3, vue.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      dessiner();
    }, { passive: false });
    canevas.addEventListener('dblclick', () => { vue = { ...vueDepart }; dessiner(); });
    window.addEventListener('resize', dessiner);

    // Les vues toutes faites : de dessus, de dessous, de face, trois quarts (celle de départ).
    function vues(nom) {
      if (nom === 'dessus') vue = { lacet: 0, tangage: 1.55, zoom: 1 };
      else if (nom === 'dessous') vue = { lacet: 0, tangage: -1.55, zoom: 1 };
      else if (nom === 'face') vue = { lacet: 0, tangage: 0.12, zoom: 1 };
      else vue = { ...vueDepart };
      dessiner();
    }

    return { montrer: construire, redessiner: dessiner, vue: vues };
  }

  window.Vue3D = { creer };
})();
