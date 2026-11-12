/* Open Golf arcade shell: HTML menus, HUD and results over the upstream engine.
   The engine reports state through the statoz_golf_* bridge (see
   scripts/open-golf/statoz-ui-bridge.c); course rules and saves stay in C. */
(() => {
  'use strict';
  const host = window.__STATOZ_HOST__ || { emit() {} };
  const boot = window.__STATOZ_BOOT__ || {};
  const launch = boot.launch && typeof boot.launch === 'object' ? boot.launch : {};
  // Captured before the host adapter wraps rAF, so menus keep animating while the engine is paused.
  const frame = window.requestAnimationFrame.bind(window);
  const $ = id => document.getElementById(id);
  const root = $('og-ui');
  if (!root) return;

  const GOLF = { title: 0, menu: 1, loading: 2, game: 3 };
  const PLAY = { intro: 1, ready: 2, aiming: 3, rolling: 4, celebrate: 5, finished: 6, paused: 7 };
  const HINTS = ['Drag back inside the circle to aim and set power', 'Release to hit the ball', 'Drag outside the circle to turn the camera'];
  const screens = { splash: $('og-splash'), select: $('og-select'), play: $('og-hud'), loading: $('og-loading'), pause: $('og-pause'), finish: $('og-finish'), error: $('og-error') };

  let engine = null, failed = false, view = 'splash', holes = 20;
  let autostart = Number.isInteger(launch.hole) && launch.hole >= 0 ? launch.hole : -1;
  let booting = true, transition = '';
  const hole = { level: -1, bestBefore: -1, strokes: 0, game: -1, cheered: false, summarised: false, lastOob: -1 };
  let bannerTimer = 0, toastTimer = 0, cheerTimer = 0, lastInput = 'pointer';
  window.addEventListener('pointerdown', () => { lastInput = 'pointer'; }, true);

  const call = (name, ...args) => {
    const fn = engine && engine['_statoz_golf_' + name];
    if (typeof fn !== 'function') return -1;
    try { return fn(...args); } catch { return -1; }
  };
  const pad = value => String(value).padStart(2, '0');
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 'S'}`;
  const announce = text => { $('og-live').textContent = text; };
  const bests = () => Array.from({ length: holes }, (_, index) => call('best', index));
  const unlocked = (list, index) => index >= 0 && index < holes && list.slice(0, index).every(best => best > 0);
  const nextHole = list => list.findIndex(best => best <= 0);

  /* ---------- View switching ---------- */
  function show(next) {
    if (view === next) return;
    const previous = view;
    view = next;
    root.dataset.view = next;
    for (const [name, element] of Object.entries(screens)) {
      if (!element || name === 'splash') continue;
      if (name === next) { element.classList.remove('is-leaving'); element.hidden = false; continue; }
      if (element.hidden) continue;
      // A screen already fading out finishes its fade before it is removed.
      if (element.classList.contains('is-leaving')) setTimeout(() => { if (view !== name) { element.hidden = true; element.classList.remove('is-leaving'); } }, 520);
      else element.hidden = true;
    }
    if (next !== 'splash' && !screens.splash.hidden) {
      screens.splash.classList.add('is-leaving');
      setTimeout(() => { screens.splash.hidden = true; }, 450);
    }
    if (next !== 'play') { $('og-banner').hidden = true; $('og-power').hidden = true; $('og-hint').hidden = true; $('og-cheer').hidden = true; }
    if (next === 'select') renderSelect(previous);
    // Dialogs always take focus; the hole grid only after keyboard use, so touch
    // players do not see a focus ring on first arrival.
    const focusTarget = { select: lastInput === 'keyboard' ? $('og-continue') : null, pause: screens.pause.querySelector('[data-action="resume"]'), finish: $('og-finish-next').hidden ? $('og-finish-menu') : $('og-finish-next'), error: screens.error.querySelector('[data-action]') }[next];
    if (focusTarget) focusTarget.focus({ preventScroll: true });
    else if (root.contains(document.activeElement)) document.activeElement.blur();
  }

  function leave(element) { element?.classList.add('is-leaving'); }

  /* ---------- Hole select ---------- */
  function renderSelect(previous) {
    const list = bests(), cleared = list.filter(best => best > 0);
    const next = nextHole(list), aces = list.filter(best => best === 1).length;
    $('og-stat-cleared').textContent = cleared.length;
    $('og-stat-holes').textContent = holes;
    $('og-stat-total').textContent = cleared.length ? cleared.reduce((sum, best) => sum + best, 0) : '–';
    $('og-stat-aces').textContent = aces;
    $('og-progress').style.setProperty('--og-progress', `${(cleared.length / holes) * 100}%`);
    $('og-progress').setAttribute('aria-label', `${cleared.length} of ${holes} holes cleared`);
    const target = next >= 0 ? next : 0;
    $('og-continue').dataset.hole = String(target);
    $('og-continue-label').textContent = next < 0 ? 'REPLAY HOLE 1' : next === 0 && !cleared.length ? 'TEE OFF' : `PLAY HOLE ${next + 1}`;
    const grid = $('og-grid');
    grid.replaceChildren(...list.map((best, index) => {
      const button = document.createElement('button');
      const state = best > 0 ? 'cleared' : unlocked(list, index) ? 'next' : 'locked';
      button.type = 'button';
      button.className = 'og-tile';
      button.dataset.state = state;
      button.dataset.hole = String(index);
      button.style.setProperty('--i', String(index));
      const number = document.createElement('span');
      number.className = 'og-tile__number';
      number.textContent = pad(index + 1);
      const meta = document.createElement('span');
      meta.className = 'og-tile__meta';
      if (state === 'locked') {
        meta.innerHTML = '<svg aria-hidden="true"><use href="#og-i-lock"/></svg>';
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('aria-label', `Hole ${index + 1}, locked. Clear hole ${index} to unlock`);
      } else if (state === 'next') {
        meta.textContent = 'PLAY';
        button.setAttribute('aria-label', `Hole ${index + 1}, not yet cleared. Play`);
      } else {
        meta.textContent = `BEST ${best}`;
        button.setAttribute('aria-label', `Hole ${index + 1}, best ${plural(best, 'stroke').toLowerCase()}${best === 1 ? ', hole in one' : ''}`);
      }
      button.append(number, meta);
      if (best === 1) {
        const ace = document.createElement('i');
        ace.className = 'og-tile__ace';
        ace.innerHTML = '<svg aria-hidden="true"><use href="#og-i-star"/></svg>';
        button.append(ace);
      }
      return button;
    }));
    if (previous !== 'splash') announce(`Hole select. ${cleared.length} of ${holes} holes cleared.`);
  }

  function play(index, source) {
    const list = bests();
    if (!unlocked(list, index) || call('play', index) !== 1) return false;
    if (source) source.classList.add('is-chosen');
    transition = `TEEING UP HOLE ${index + 1}`;
    leave(screens.select);
    return true;
  }

  /* ---------- Hole start, HUD and results ---------- */
  function startHole(level) {
    hole.level = level;
    hole.bestBefore = call('best', level);
    hole.strokes = 0;
    hole.cheered = false;
    hole.summarised = false;
    hole.lastOob = -1;
    $('og-hud-hole').textContent = level + 1;
    $('og-hud-of').textContent = `/${holes}`;
    $('og-hud-strokes').textContent = '0';
    $('og-hud-best').textContent = hole.bestBefore > 0 ? hole.bestBefore : '–';
    $('og-hud-strokes').closest('.og-chip').classList.remove('is-over');
    $('og-banner-number').textContent = pad(level + 1);
    $('og-banner-meta').textContent = hole.bestBefore > 0 ? `OF ${holes} · BEST ${hole.bestBefore}` : `OF ${holes} · NEW GREEN`;
    const banner = $('og-banner');
    banner.hidden = true;
    void banner.offsetWidth;
    banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { banner.hidden = true; }, 2300);
    announce(`Hole ${level + 1} of ${holes}.${hole.bestBefore > 0 ? ` Best ${plural(hole.bestBefore, 'stroke').toLowerCase()}.` : ''}`);
  }

  function updateHud(s) {
    if (s.strokes !== hole.strokes) {
      hole.strokes = s.strokes;
      const chip = $('og-hud-strokes').closest('.og-chip');
      $('og-hud-strokes').textContent = s.strokes;
      chip.classList.remove('is-bump');
      void chip.offsetWidth;
      chip.classList.add('is-bump');
      chip.classList.toggle('is-over', hole.bestBefore > 0 && s.strokes > hole.bestBefore);
    }
    const canPause = !s.busy && (s.game === PLAY.ready || s.game === PLAY.rolling);
    $('og-pause-button').setAttribute('aria-disabled', String(!canPause));
    const power = $('og-power');
    const aiming = s.game === PLAY.aiming && s.power > .01;
    power.hidden = !aiming;
    if (aiming) {
      const percent = Math.round(s.power * 100);
      power.style.setProperty('--og-power', `${percent}%`);
      $('og-power-value').textContent = `${percent}%`;
      power.classList.toggle('is-max', percent >= 90);
    }
    const hint = $('og-hint');
    hint.hidden = s.tutorial < 0 || s.tutorial > 2;
    if (!hint.hidden && hint.dataset.step !== String(s.tutorial)) {
      hint.dataset.step = String(s.tutorial);
      $('og-hint-text').textContent = HINTS[s.tutorial];
      announce(HINTS[s.tutorial]);
    }
    if (s.oob >= 0 && (hole.lastOob < 0 || s.oob < hole.lastOob)) showToast();
    hole.lastOob = s.oob;
  }

  function showToast() {
    const toast = $('og-toast');
    toast.hidden = true;
    void toast.offsetWidth;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 1500);
  }

  function cheer(strokes) {
    if (hole.cheered) return;
    hole.cheered = true;
    $('og-cheer-text').textContent = strokes === 1 ? 'HOLE IN ONE!' : 'IN THE CUP!';
    $('og-cheer').hidden = false;
    clearTimeout(cheerTimer);
    cheerTimer = setTimeout(() => { $('og-cheer').hidden = true; }, 1400);
  }

  function summarise(s) {
    if (hole.summarised) return;
    hole.summarised = true;
    const list = bests(), level = hole.level, strokes = s.strokes;
    const first = hole.bestBefore <= 0, improved = !first && strokes < hole.bestBefore, matched = !first && strokes === hole.bestBefore;
    const last = level + 1 >= holes, complete = list.every(best => best > 0);
    const card = screens.finish.querySelector('.og-card--finish');
    card.classList.toggle('is-ace', strokes === 1);
    $('og-finish-hole').textContent = `HOLE ${level + 1} OF ${holes}`;
    $('og-finish-title').textContent = strokes === 1 ? 'HOLE IN ONE!' : last && complete ? 'COURSE COMPLETE!' : 'HOLE COMPLETE';
    $('og-finish-strokes').textContent = strokes;
    $('og-finish-unit').textContent = strokes === 1 ? 'STROKE' : 'STROKES';
    $('og-finish-best').textContent = list[level] > 0 ? list[level] : strokes;
    const badge = $('og-finish-badge');
    badge.hidden = !(first || improved || matched);
    badge.textContent = first ? 'FIRST CLEAR!' : improved ? 'NEW BEST!' : 'MATCHED BEST';
    badge.dataset.tone = matched ? 'plain' : 'gold';
    const note = $('og-finish-note');
    const total = list.filter(best => best > 0).reduce((sum, best) => sum + best, 0);
    note.hidden = !(first && !last) && !(last && complete);
    note.textContent = last && complete ? `COURSE TOTAL ${total}` : `HOLE ${level + 2} UNLOCKED`;
    $('og-finish-dots').replaceChildren(...list.map((best, index) => {
      const dot = document.createElement('li');
      dot.dataset.state = index === level ? 'current' : best > 0 ? 'cleared' : 'open';
      dot.setAttribute('aria-label', `Hole ${index + 1}${best > 0 ? `, best ${best}` : ''}`);
      return dot;
    }));
    const next = $('og-finish-next'), menu = $('og-finish-menu');
    next.hidden = last;
    menu.classList.toggle('og-btn--sun', last);
    menu.classList.toggle('og-btn--cream', !last);
    menu.closest('.og-btn-row').classList.toggle('is-last', last);
    confetti(strokes === 1 || improved || first);
    announce(`${$('og-finish-title').textContent} ${plural(strokes, 'stroke').toLowerCase()}.${badge.hidden ? '' : ` ${badge.textContent}`}`);
  }

  function confetti(on) {
    const layer = $('og-confetti');
    layer.replaceChildren();
    if (!on || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ffd23f', '#9be15d', '#ff4d5a', '#7fd6ff', '#fff6df', '#ff9b2f'];
    for (let index = 0; index < 34; index++) {
      const piece = document.createElement('i');
      piece.style.cssText = `--x:${Math.random() * 100}%;--w:${6 + Math.random() * 7}px;--c:${colors[index % colors.length]};--d:${1.6 + Math.random() * 1.4}s;--delay:${Math.random() * .5}s;--drift:${(Math.random() - .5) * 26}vw;--spin:${(Math.random() - .5) * 1080}deg`;
      layer.append(piece);
    }
  }

  /* ---------- Frame loop ---------- */
  function snapshot() {
    return {
      golf: call('state'), game: call('game_state'), level: call('level'), strokes: call('strokes'),
      busy: call('busy') === 1, tutorial: call('tutorial'), power: call('power'), oob: call('since_out_of_bounds'),
    };
  }

  function update(s) {
    if (s.golf < 0 || s.golf === GOLF.title) return;
    if (booting) { const count = call('levels'); if (count > 0) holes = count; }
    if (s.golf === GOLF.menu) {
      if (autostart >= 0) {
        const target = autostart;
        autostart = -1;
        if (play(target)) { $('og-splash-status').textContent = `TEEING UP HOLE ${target + 1}`; return; }
      }
      if (s.busy) {
        if (!booting) show('loading');
        $('og-loading-text').textContent = transition || 'TEEING UP';
        return;
      }
      booting = false;
      show('select');
      return;
    }
    if (s.golf === GOLF.loading) {
      if (!booting) { $('og-loading-text').textContent = transition || 'TEEING UP'; show('loading'); }
      return;
    }
    // In a hole.
    booting = false;
    if (s.game === PLAY.intro && (hole.game !== PLAY.intro || hole.level !== s.level)) startHole(s.level);
    else if (hole.level !== s.level) startHole(s.level);
    hole.game = s.game;
    if (s.busy) {
      if (view === 'pause' || view === 'finish') leave(screens[view]);
      $('og-loading-text').textContent = transition || 'TEEING UP';
      show('loading');
      return;
    }
    transition = '';
    if (s.game === PLAY.paused) {
      $('og-pause-meta').textContent = `HOLE ${s.level + 1} · ${plural(s.strokes, 'STROKE')}`;
      show('pause');
      return;
    }
    if (s.game === PLAY.finished) { summarise(s); show('finish'); return; }
    show('play');
    if (s.game === PLAY.celebrate) cheer(s.strokes);
    updateHud(s);
  }

  function tick() {
    if (!failed && engine) update(snapshot());
    frame(tick);
  }

  /* ---------- Input ---------- */
  function act(action, target) {
    if (action !== 'lobby') call('click');
    switch (action) {
      case 'lobby': host.emit('exit'); break;
      case 'continue': play(Number(target.dataset.hole), $(`og-grid`).querySelector(`[data-hole="${target.dataset.hole}"]`)); break;
      case 'hole': if (target.getAttribute('aria-disabled') !== 'true') play(Number(target.dataset.hole), target); break;
      case 'pause': if (target.getAttribute('aria-disabled') !== 'true') call('pause'); break;
      case 'resume': call('resume'); break;
      case 'retry': if (call('retry') === 1) transition = `TEEING UP HOLE ${hole.level + 1}`; break;
      case 'menu': if (call('menu') === 1) transition = 'HOLE SELECT'; break;
      case 'next': if (call('play', hole.level + 1) === 1) transition = `TEEING UP HOLE ${hole.level + 2}`; break;
    }
  }

  root.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-action], .og-tile') : null;
    if (!target || !root.contains(target)) return;
    act(target.classList.contains('og-tile') ? 'hole' : target.dataset.action, target);
  });

  // Sokol listens for keys on window and cancels Space, which would block button
  // activation. Keys aimed at the shell's controls stay with the shell. These
  // listeners are registered before the engine starts, so they run first.
  const ownsKey = event => event.target instanceof Element && event.target !== document.body && root.contains(event.target);
  function onKey(event) {
    lastInput = 'keyboard';
    if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') {
      if (view === 'play' && call('pause') === 1) { call('click'); event.preventDefault(); }
      else if (view === 'pause' && call('resume') === 1) { call('click'); event.preventDefault(); }
    } else {
      const tile = event.target instanceof Element ? event.target.closest('.og-tile') : null;
      if (tile && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        const tiles = [...$('og-grid').children], index = tiles.indexOf(tile);
        const columns = getComputedStyle($('og-grid')).gridTemplateColumns.split(' ').length;
        const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tiles.length - 1 : index + move;
        if (tiles[next]) { tiles[next].focus(); event.preventDefault(); }
      }
    }
    if (ownsKey(event)) event.stopImmediatePropagation();
  }
  window.addEventListener('keydown', onKey, true);
  for (const type of ['keyup', 'keypress']) window.addEventListener(type, event => { if (ownsKey(event)) event.stopImmediatePropagation(); }, true);

  /* ---------- Host adapter hooks ---------- */
  window.OpenGolfShell = {
    ready(module) {
      if (typeof module?._statoz_golf_state !== 'function') { this.fail(); return; }
      engine = module;
      holes = Math.max(1, call('levels') > 0 ? call('levels') : holes);
    },
    fail() {
      failed = true;
      for (const [name, element] of Object.entries(screens)) if (name !== 'error' && element) element.hidden = true;
      screens.error.hidden = false;
      screens.error.querySelector('[data-action]')?.focus({ preventScroll: true });
    },
    hostPause(paused) {
      $('og-hostpause').hidden = !paused;
      if (paused) $('resume').focus({ preventScroll: true });
    },
  };
  frame(tick);
})();
