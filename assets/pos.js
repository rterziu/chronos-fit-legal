/* Chronos POS's page: its own navigation, the screens, and pausing its motion off screen. The shared behaviour is in ui.js. */
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
})();
