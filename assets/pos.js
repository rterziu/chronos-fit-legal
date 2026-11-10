/* Chronos POS's page: the page's own navigation, the screens, the counters, and pausing motion that is off screen. */
(function () {
  'use strict';

  var root = document.documentElement;
  // The tabs, the stacked screens and the header's download button are only hidden once this file has run,
  // so if it never arrives every screen and panel is still on the page.
  root.classList.add('pos-js');

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var canObserve = 'IntersectionObserver' in window;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var inOrder = function (a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; };

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

  /* The page's own navigation: the part on screen, and the download button once the hero's has gone. */
  var subnav = document.querySelector('.subnav');
  if (subnav && !canObserve) subnav.classList.add('show-cta');
  if (subnav && canObserve) {
    var row = subnav.querySelector('.subnav-links');
    var links = row ? Array.prototype.slice.call(row.querySelectorAll('a[href^="#"]')) : [];
    var linkTo = function (id) {
      for (var i = 0; i < links.length; i++) if (links[i].getAttribute('href') === '#' + id) return links[i];
      return null;
    };
    // Each section that has a link, plus the two without one, which belong to the part before them.
    var parts = links.map(function (a) { return { el: document.getElementById(a.getAttribute('href').slice(1)), link: a }; });
    var needs = document.getElementById('needs');
    var closing = document.querySelector('.closing');
    if (needs && linkTo('prices')) parts.push({ el: needs, link: linkTo('prices') });
    if (closing && linkTo('questions')) parts.push({ el: closing, link: linkTo('questions') });
    parts = parts.filter(function (p) { return p.el; }).sort(function (a, b) { return inOrder(a.el, b.el); });

    var showing = [];
    var current = null;
    var mark = function () {
      var next = null;
      for (var i = 0; i < parts.length; i++) {
        if (showing.indexOf(parts[i].el) !== -1) { next = parts[i].link; break; }
      }
      if (next === current) return;
      current = next;
      links.forEach(function (a) {
        var on = a === next;
        a.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      if (next && row.scrollWidth > row.clientWidth + 1) {
        var left = next.offsetLeft - (row.clientWidth - next.offsetWidth) / 2;
        if (row.scrollTo) row.scrollTo({ left: left, behavior: reduce ? 'auto' : 'smooth' });
        else row.scrollLeft = left;
      }
    };
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var at = showing.indexOf(entry.target);
        if (entry.isIntersecting && at === -1) showing.push(entry.target);
        if (!entry.isIntersecting && at !== -1) showing.splice(at, 1);
      });
      mark();
    }, { rootMargin: '-35% 0px -60% 0px' });
    parts.forEach(function (p) { spy.observe(p.el); });

    var heroActions = document.querySelector('.pos-hero .actions');
    if (heroActions) {
      // The button shows once the hero's buttons have gone up under the header, and hides when they come back.
      new IntersectionObserver(function (entries) {
        var entry = entries[entries.length - 1];
        var edge = entry.rootBounds ? entry.rootBounds.top : 0;
        subnav.classList.toggle('show-cta', !entry.isIntersecting && entry.boundingClientRect.bottom <= edge + 1);
      }, { rootMargin: '-116px 0px 0px 0px' }).observe(heroActions);
    } else {
      subnav.classList.add('show-cta');
    }
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
  if (counters.length && canObserve && !reduce) {
    var counter = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        counter.unobserve(entry.target);
        var el = entry.target;
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
      });
    }, { threshold: 0.5 });
    each(counters, function (el) {
      el.textContent = format(0, decimalsOf(el));
      counter.observe(el);
    });
  }

  /* Motion that is off screen waits. */
  var flow = document.querySelector('[data-flow]');
  if (flow) {
    if (canObserve) new IntersectionObserver(function (entries) { flow.classList.toggle('is-live', entries[0].isIntersecting); }).observe(flow);
    else flow.classList.add('is-live');
  }
  var visual = document.querySelector('.hero-visual');
  if (visual && canObserve) {
    new IntersectionObserver(function (entries) { visual.classList.toggle('is-paused', !entries[0].isIntersecting); }).observe(visual);
  }

  /* The screens: three parts of the program, and the screens within each. */
  var showcase = document.querySelector('[data-showcase]');
  if (showcase) {
    var tablist = showcase.querySelector('[role="tablist"]');
    var tabs = Array.prototype.slice.call(showcase.querySelectorAll('[role="tab"]'));
    var thumb = showcase.querySelector('.tab-thumb');

    // Without this script the panels are plain sections; with it they become the tabs' panels.
    each(showcase.querySelectorAll('.showcase-panel[data-tab]'), function (panel) {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', panel.getAttribute('data-tab'));
      panel.tabIndex = 0;
    });

    var place = function () {
      var tab = tablist && tablist.querySelector('[aria-selected="true"]');
      if (!thumb || !tab || !tab.offsetWidth) return;
      thumb.style.width = tab.offsetWidth + 'px';
      thumb.style.height = tab.offsetHeight + 'px';
      thumb.style.bottom = 'auto';
      thumb.style.transform = 'translate(' + tab.offsetLeft + 'px, ' + (tab.offsetTop - thumb.offsetTop) + 'px)';
      if (!tablist.classList.contains('has-thumb')) {
        tablist.classList.add('has-thumb');
        window.requestAnimationFrame(function () { thumb.classList.add('ready'); });
      }
    };
    var select = function (tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (!panel) return;
        var was = panel.classList.contains('is-active');
        panel.classList.toggle('is-active', on);
        if (on && !was) {
          panel.classList.remove('is-entering');
          void panel.offsetWidth;
          panel.classList.add('is-entering');
        }
      });
      place();
      if (focus) tab.focus();
    };
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (event) {
        var next = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (event.key === 'Home') next = tabs[0];
        else if (event.key === 'End') next = tabs[tabs.length - 1];
        if (next) { event.preventDefault(); select(next, true); }
      });
    });
    if (tablist) {
      place();
      if ('ResizeObserver' in window) new ResizeObserver(place).observe(tablist);
      else window.addEventListener('resize', place);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    }

    each(showcase.querySelectorAll('.screen-picker'), function (picker) {
      var buttons = picker.querySelectorAll('button');
      var shots = picker.parentNode.querySelectorAll('.screens > .shot');
      each(buttons, function (button, i) {
        button.addEventListener('click', function () {
          each(buttons, function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
          each(shots, function (s, j) { s.classList.toggle('is-active', j === i); });
        });
      });
    });

    // Screens in the closed tabs load once the showcase is near, so a tab opens on a picture, not an empty frame.
    var loadAll = function () { each(showcase.querySelectorAll('img[loading="lazy"]'), function (img) { img.loading = 'eager'; }); };
    if (canObserve) {
      var near = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { near.disconnect(); loadAll(); }
      }, { rootMargin: '600px 0px' });
      near.observe(showcase);
    } else {
      loadAll();
    }
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
