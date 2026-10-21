// verdiercam.js — ce que la page fait d'elle-même. Tout y est facultatif :
// sans script, la page est entière (l'oiseau dessiné, les blocs visibles,
// les vidéos avec leurs boutons, les quatre jalons tous en encre pleine).
(function () {
  'use strict';
  var doc = document.documentElement;
  var calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  doc.classList.add('js');

  // La barre prend un filet dès qu'on a quitté le haut de la page.
  var barre = document.querySelector('.barre');
  function filet() { if (barre) barre.classList.toggle('defile', window.scrollY > 8); }
  window.addEventListener('scroll', filet, { passive: true }); filet();

  // --- Le bouton « Menu », sous 1140 px -------------------------------------
  // Il déroule les sections sous la barre. Un lien choisi, un clic ailleurs ou
  // Échap le referment ; Échap rend aussi la main au bouton.
  var menuBouton = document.querySelector('.menu-bouton');
  if (barre && menuBouton) {
    var fin = null;
    var ouvrirMenu = function (oui) {
      if (oui === barre.classList.contains('menu-ouvert')) return;
      clearTimeout(fin);
      barre.classList.toggle('menu-ouvert', oui);
      barre.classList.toggle('menu-ferme', !oui);
      if (!oui) fin = setTimeout(function () { barre.classList.remove('menu-ferme'); }, 150);
      menuBouton.setAttribute('aria-expanded', oui ? 'true' : 'false');
    };
    menuBouton.addEventListener('click', function (e) {
      e.stopPropagation(); ouvrirMenu(!barre.classList.contains('menu-ouvert'));
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#menu-sections') || e.target.closest('a')) ouvrirMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && barre.classList.contains('menu-ouvert')) { ouvrirMenu(false); menuBouton.focus(); }
    });
  }

  // --- L'apparition des blocs ---------------------------------------------
  // Mesurée au défilement, et non par IntersectionObserver : un saut direct à
  // une ancre (ou un onglet en arrière-plan) laissait des blocs ENTIERS
  // invisibles — un texte qui peut rester caché ne se cache pas du tout.
  // Tout ce qui est au-dessus du bas de la fenêtre se montre, y compris ce
  // qu'on a sauté ; et passé deux secondes, tout se montre, quoi qu'il arrive.
  var blocs = [].slice.call(document.querySelectorAll('.apparait'));
  function montrer() {
    var bas = window.innerHeight * 0.96;
    blocs.forEach(function (b) {
      if (!b.classList.contains('vu') && b.getBoundingClientRect().top < bas) b.classList.add('vu');
    });
  }
  function toutMontrer() { blocs.forEach(function (b) { b.classList.add('vu'); }); }
  if (calme) toutMontrer();
  else {
    window.addEventListener('scroll', montrer, { passive: true });
    window.addEventListener('resize', montrer);
    window.addEventListener('load', montrer);
    window.addEventListener('hashchange', function () { setTimeout(montrer, 50); });
    window.addEventListener('pageshow', montrer);
    montrer();
    setTimeout(toutMontrer, 2000);
  }

  // --- Les vidéos jouent quand on les voit, s'arrêtent quand on les quitte --
  var videos = document.querySelectorAll('video[data-auto]');
  if ('IntersectionObserver' in window && !calme) {
    var lecteur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); }
        else e.target.pause();
      });
    }, { threshold: .35 });
    videos.forEach(function (v) { lecteur.observe(v); });
  }

  // --- Le tracé de l'accueil se joue quand on le voit ----------------------
  // (21/10/2026, Christophe : « lance l'animation quand le tracé devient visible sur mobile ».) Sur un téléphone il est
  // sous le texte : joué au chargement, il était fini avant qu'on y arrive. L'animation reste en CSS (site/trace_piece.py) ;
  // le script ne fait que la retenir, à zéro, tant que la carte est hors de la fenêtre, puis la relâche — mesuré au
  // défilement comme l'apparition des blocs. Sans script ou en mouvement réduit, rien ne change.
  var trace = document.querySelector('.trace-piece');
  if (trace && !calme && document.getAnimations) {
    var animations = function () {
      return document.getAnimations().filter(function (a) {
        var t = a.effect && a.effect.target;
        return t && t.closest && t.closest('.trace-piece') === trace;
      });
    };
    var enVue = function () {
      var r = trace.getBoundingClientRect();
      return r.top < window.innerHeight * 0.85 && r.bottom > 0;
    };
    if (!enVue()) {
      animations().forEach(function (a) { a.pause(); a.currentTime = 0; });
      var lancer = function () {
        if (!enVue()) return;
        animations().forEach(function (a) { a.play(); });
        ['scroll', 'resize', 'hashchange', 'pageshow'].forEach(function (e) { window.removeEventListener(e, lancer); });
      };
      ['scroll', 'resize', 'hashchange', 'pageshow'].forEach(function (e) { window.addEventListener(e, lancer, { passive: true }); });
    }
  }

  // --- Le parcours : le jalon qui correspond à la vue au milieu de l'écran --
  // Les jalons restent fixés à gauche pendant que les vues défilent ; celui
  // de la vue la plus proche du centre prend l'orange. Sans script, les
  // quatre sont en encre pleine (rien n'est atténué par la CSS seule).
  var jalons = [].slice.call(document.querySelectorAll('.jalons > li'));
  var vues = [].slice.call(document.querySelectorAll('.vues > .vue'));
  if (jalons.length && jalons.length === vues.length) {
    doc.classList.add('jalonne');
    var courant = -1;
    function jalonner() {
      var centre = window.innerHeight * 0.5, meilleur = 0, dist = Infinity;
      vues.forEach(function (v, i) {
        var r = v.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - centre);
        if (d < dist) { dist = d; meilleur = i; }
      });
      if (meilleur !== courant) {
        courant = meilleur;
        jalons.forEach(function (j, i) { j.classList.toggle('actif', i === meilleur); });
      }
    }
    window.addEventListener('scroll', jalonner, { passive: true });
    window.addEventListener('resize', jalonner);
    jalonner();
    // Un clic sur un jalon amène sa vue.
    jalons.forEach(function (j, i) {
      j.addEventListener('click', function () {
        vues[i].scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'center' });
      });
    });
  }

  // --- La présentation en vidéo : YouTube ne se charge qu'au clic ------------
  document.querySelectorAll('.video-yt[data-youtube]').forEach(function (bloc) {
    var lien = bloc.querySelector('.video-yt-lien');
    if (!lien) return;
    lien.addEventListener('click', function (e) {
      e.preventDefault();
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + bloc.getAttribute('data-youtube') + '?autoplay=1&rel=0';
      f.title = 'Présentation de VerdierCAM';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      bloc.replaceChild(f, lien);
    });
  });

  // --- La visionneuse : un clic sur une capture l'agrandit ------------------
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

  // --- L'oiseau se dessine comme un parcours d'usinage ----------------------
  // Chaque trait du logo est une passe, menée à vitesse constante (comme une
  // avance) par une fraise lumineuse ; entre deux passes, un rapide en
  // pointillés. Le plein vient en dernier, comme une poche.
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
