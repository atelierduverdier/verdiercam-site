// verdiercam.js — ce que la page fait d'elle-même. Tout y est facultatif :
// sans script, la page est entière (l'oiseau dessiné, les blocs visibles,
// les vidéos avec leurs boutons).
(function () {
  'use strict';
  var doc = document.documentElement;
  var calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  doc.classList.add('js');

  // La barre prend un filet dès qu'on a quitté le haut de la page.
  var barre = document.querySelector('.barre');
  function filet() { if (barre) barre.classList.toggle('defile', window.scrollY > 8); }
  window.addEventListener('scroll', filet, { passive: true }); filet();

  // Les blocs apparaissent quand ils entrent dans la fenêtre ; les vidéos
  // jouent quand on les voit, et s'arrêtent quand on les quitte.
  var blocs = document.querySelectorAll('.apparait');
  var videos = document.querySelectorAll('video[data-auto]');
  // Mesuré au défilement, et non par IntersectionObserver : un saut direct à
  // une ancre (ou un onglet en arrière-plan) laissait des blocs ENTIERS
  // invisibles — un texte qui peut rester caché ne se cache pas du tout.
  // Tout ce qui est au-dessus du bas de la fenêtre se montre, y compris ce
  // qu'on a sauté.
  function montrer() {
    var bas = window.innerHeight * 0.94;
    blocs.forEach(function (b) {
      if (!b.classList.contains('vu') && b.getBoundingClientRect().top < bas) b.classList.add('vu');
    });
  }
  window.addEventListener('scroll', montrer, { passive: true });
  window.addEventListener('resize', montrer);
  window.addEventListener('load', montrer);
  montrer();
  if ('IntersectionObserver' in window) {
    if (!calme) {
      var lecteur = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); }
          else e.target.pause();
        });
      }, { threshold: .35 });
      videos.forEach(function (v) { lecteur.observe(v); });
    }
  }

  // La visionneuse : un clic sur une capture l'agrandit.
  var vis = document.querySelector('.visionneuse');
  if (vis) {
    var grande = vis.querySelector('img');
    document.addEventListener('click', function (e) {
      var img = e.target.closest && e.target.closest('.fenetre img');
      if (!img) return;
      grande.src = img.currentSrc || img.src; grande.alt = img.alt;
      vis.hidden = false;
    });
    vis.addEventListener('click', function () { vis.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') vis.hidden = true; });
  }

  // L'oiseau se dessine comme un parcours d'usinage : chaque trait du logo
  // est une passe, menée à vitesse constante (comme une avance) par une
  // fraise lumineuse ; entre deux passes, un rapide en pointillés. Le plein
  // vient en dernier, comme une poche.
  var oiseau = document.querySelector('.oiseau');
  if (!oiseau || calme) return;
  var passes = [].slice.call(oiseau.querySelectorAll('.passe'));
  var plein = oiseau.querySelector('.plein'), fraise = oiseau.querySelector('.fraise'),
      rapide = oiseau.querySelector('.rapide');
  if (!passes.length || !fraise || !passes[0].getTotalLength) return;
  var AVANCE = 900, RAPIDE = 2600;   // unités du dessin par seconde
  var etapes = [], t = 0, avant = null;
  passes.forEach(function (p) {
    var L = p.getTotalLength(), debut = p.getPointAtLength(0);
    p.style.strokeDasharray = L + ' ' + L; p.style.strokeDashoffset = L;
    if (avant) {
      var dx = debut.x - avant.x, dy = debut.y - avant.y, d = Math.sqrt(dx * dx + dy * dy);
      etapes.push({ rapide: true, de: avant, a: debut, t0: t, t1: t + d / RAPIDE }); t += d / RAPIDE;
    }
    etapes.push({ p: p, L: L, t0: t, t1: t + L / AVANCE }); t += L / AVANCE;
    avant = p.getPointAtLength(L);
  });
  if (plein) { plein.style.opacity = 0; plein.style.transition = 'opacity .5s'; }
  var total = t, depart = null;
  function poser(x, y) { fraise.setAttribute('cx', x); fraise.setAttribute('cy', y); }
  function image(ms) {
    if (depart === null) depart = ms;
    var s = (ms - depart) / 1000 - 0.35;   // un temps d'arrêt : la broche se lance
    fraise.style.opacity = s < 0 ? 0 : 1;
    etapes.forEach(function (e) {
      var k = Math.max(0, Math.min(1, (s - e.t0) / (e.t1 - e.t0)));
      if (e.rapide) {
        if (s >= e.t0 && s < e.t1) {
          var x = e.de.x + (e.a.x - e.de.x) * k, y = e.de.y + (e.a.y - e.de.y) * k;
          poser(x, y); rapide.setAttribute('d', 'M' + e.de.x + ' ' + e.de.y + 'L' + x + ' ' + y);
          rapide.style.opacity = .9;
        } else if (s >= e.t1) rapide.style.opacity = 0;
      } else {
        e.p.style.strokeDashoffset = e.L * (1 - k);
        if (s >= e.t0 && s < e.t1) { var q = e.p.getPointAtLength(e.L * k); poser(q.x, q.y); }
      }
    });
    if (s < total) requestAnimationFrame(image);
    else {
      fraise.style.transition = 'opacity .6s'; fraise.style.opacity = 0;
      if (plein) plein.style.opacity = 1;
    }
  }
  requestAnimationFrame(image);
})();
