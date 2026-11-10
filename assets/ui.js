/* The site's shared behaviour: the intro, the reading line, counters, the light on cards, and motion that waits when off screen. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('ui-js');
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var canObserve = 'IntersectionObserver' in window;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  /* The intro. The inline script in the page's head decides whether it plays (once a session, never under reduced motion);
     this file runs it, lets any tap or key skip it, and lands the logo on the header's. */
  var introDone = [];
  var whenIntroDone = function (fn) { if (root.classList.contains('intro-play')) introDone.push(fn); else fn(); };
  var intro = document.querySelector('.intro');
  var finishIntro = function () {
    root.classList.remove('intro-play');
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    intro = null;
    var waiting = introDone; introDone = [];
    waiting.forEach(function (fn) { fn(); });
    try { document.dispatchEvent(new CustomEvent('chronos:intro-end')); } catch (e) {}
  };
  if (intro && root.classList.contains('intro-play')) {
    // Keeps the intro on screen after the page's class goes, which lets the hero come in while the logo is still flying.
    intro.classList.add('is-on');
    var leaving = false;
    var leave = function () {
      if (leaving || !intro) return;
      leaving = true;
      var logo = intro.querySelector('.intro-logo');
      var target = document.querySelector('.nav .brand img');
      intro.classList.add('is-leaving');
      if (logo && target) {
        var from = logo.getBoundingClientRect();
        var to = target.getBoundingClientRect();
        if (from.width && to.width) {
          var scale = to.width / from.width;
          logo.style.transform = 'translate(' + (to.left - from.left) + 'px, ' + (to.top - from.top) + 'px) scale(' + scale + ')';
          logo.style.opacity = '0';
        }
      }
      // The hero starts coming in while the logo is still on its way.
      window.setTimeout(function () { root.classList.remove('intro-play'); }, 260);
      window.setTimeout(finishIntro, 900);
    };
    var skip = function () { leave(); };
    intro.addEventListener('click', skip);
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('wheel', skip, { once: true, passive: true });
    window.addEventListener('touchstart', skip, { once: true, passive: true });
    var shine = intro.querySelector('.il-shine');
    if (shine) shine.addEventListener('animationend', function () { window.setTimeout(leave, 80); });
    // If the drawing never reports back, the intro still ends.
    window.setTimeout(leave, 2100);
  } else if (intro) {
    intro.parentNode.removeChild(intro);
    intro = null;
  }

  /* How far down the page: a gold line under the header. */
  var nav = document.querySelector('.nav');
  if (nav) {
    var queued = false;
    var measure = function () {
      queued = false;
      var max = root.scrollHeight - window.innerHeight;
      nav.style.setProperty('--progress', max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)).toFixed(4) : '0');
    };
    var queue = function () {
      if (!queued) { queued = true; window.requestAnimationFrame(measure); }
    };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    measure();
  }

  /* The phone menu closes when focus leaves it, so focus never lands behind the open panel. */
  var menu = document.querySelector('.menu');
  if (menu) {
    menu.addEventListener('focusout', function (event) {
      if (menu.open && event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false;
    });
  }

  /* Numbers count up once, when they come into view. The final figure is in the page for readers and search. */
  var format = function (value, decimals) {
    var parts = value.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };
  var decimalsOf = function (el) { return parseInt(el.getAttribute('data-decimals') || '0', 10); };
  var counters = document.querySelectorAll('[data-count]');
  var settle = function (el) { el.textContent = format(parseFloat(el.getAttribute('data-count')), decimalsOf(el)); };
  var count = function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = decimalsOf(el);
    var wait = parseInt(el.getAttribute('data-delay') || '0', 10);
    var done = false;
    var finish = function () { done = true; settle(el); };
    window.setTimeout(function () {
      var start = null;
      var tick = function (now) {
        if (done) return;
        if (start === null) start = now;
        var k = Math.min(1, (now - start) / 1600);
        if (k >= 1) { finish(); return; }
        el.textContent = format(target * (1 - Math.pow(1 - k, 4)), decimals);
        window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    }, wait);
    // Where frames are not drawn (a background tab, some renderers) the figure still arrives.
    window.setTimeout(finish, wait + 2200);
  };
  if (counters.length && canObserve && !reduce) {
    var counter = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        counter.unobserve(entry.target);
        var el = entry.target;
        whenIntroDone(function () { count(el); });
      });
    }, { threshold: 0.5 });
    each(counters, function (el) {
      el.textContent = format(0, decimalsOf(el));
      counter.observe(el);
    });
  }

  /* Floating previews rest while they are off screen. */
  if (canObserve) {
    each(document.querySelectorAll('[data-pause]'), function (el) {
      new IntersectionObserver(function (entries) { el.classList.toggle('is-paused', !entries[0].isIntersecting); }).observe(el);
    });
  }

  /* On paper: every picture loaded and every figure final. */
  window.addEventListener('beforeprint', function () {
    each(document.querySelectorAll('img[loading="lazy"]'), function (img) { img.loading = 'eager'; });
    each(counters, settle);
  });

  /* A soft light that follows the pointer across cards, where there is a pointer. */
  if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    each(document.querySelectorAll('[data-spot]'), function (el) {
      el.addEventListener('pointermove', function (event) {
        var box = el.getBoundingClientRect();
        el.style.setProperty('--mx', Math.round(event.clientX - box.left) + 'px');
        el.style.setProperty('--my', Math.round(event.clientY - box.top) + 'px');
      });
    });
  }
})();
