/* Slatepress — contact modal (Formspree)
 * Intercepts any link with href="mailto:hello@slatepress.co" OR any element
 * with [data-contact-modal] and opens a modal form.
 *
 * v18: removes public Calendly CTA from success state. Funnel is now fully
 * async — the form is the qualifier, Anthony decides per-lead whether to send
 * a Calendly link in his email reply. Matches "autonomous business" thesis:
 * no public call booking, no Google Workspace required, one unambiguous
 * terminal state ("We'll reply within one business day").
 * v19: fixes Stage/Timeline row overflowing modal width — grid tracks were
 * using intrinsic min-width and long option text ("Pre-seed (no outside
 * capital yet)") pushed each column wider than 1fr. Switched to minmax(0, 1fr)
 * so columns can shrink below content width. Select options still render at
 * native width when the dropdown opens.
 * v20: minmax fix in v19 shrank the grid TRACKS but native <select> elements
 * still rendered at intrinsic content width, overflowing their columns and
 * making Stage/Timeline visibly uneven. Forced width: 100%, box-sizing:
 * border-box, min-width: 0 on all form controls so they actually fill the
 * grid cell. Only the collapsed select is constrained — the options dropdown
 * pops out at native width when opened.
 * v26: envelope animation on the success state. The "Confirmation email sent"
 * badge is now a sage pill that pulses once at arrival; an envelope icon
 * flies a swirling path across the row leaving a fading ink-dot trail, then
 * explodes into a burst of small stars at the finish. All classes and
 * keyframes are cm-prefixed so nothing collides with host-page styles. The
 * animation respects prefers-reduced-motion — in reduced-motion mode, only
 * the static pill renders.
 *
 * Submissions POST to Formspree (Professional plan — supports file uploads).
 */
(function () {
  'use strict';

  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/xjgjwobq';

  var modalHTML = [
    '<div class="cm-root" id="cmRoot" hidden aria-hidden="true">',
    '  <div class="cm-backdrop" data-cm-close></div>',
    '  <div class="cm-card" role="dialog" aria-modal="true" aria-labelledby="cmTitle">',
    '    <button class="cm-close" type="button" data-cm-close aria-label="Close">&times;</button>',
    '    <div class="cm-eyebrow">Start a project</div>',
    '    <h2 class="cm-title" id="cmTitle">Let\'s talk about your deck.</h2>',
    '    <p class="cm-intro">A few quick questions so the first reply is useful — we respond within one business day.</p>',
    '    <form class="cm-form" id="cmForm" novalidate enctype="multipart/form-data">',
    '      <label class="cm-field">',
    '        <span class="cm-label">Name</span>',
    '        <input type="text" name="name" required autocomplete="name" />',
    '      </label>',
    '      <label class="cm-field">',
    '        <span class="cm-label">Email</span>',
    '        <input type="email" name="email" required autocomplete="email" />',
    '      </label>',
    '      <label class="cm-field">',
    '        <span class="cm-label">Company <span class="cm-optional">(optional)</span></span>',
    '        <input type="text" name="company" autocomplete="organization" />',
    '      </label>',
    '      <div class="cm-row">',
    '        <label class="cm-field">',
    '          <span class="cm-label">Stage</span>',
    '          <select name="stage" required>',
    '            <option value="">Select…</option>',
    '            <option>Pre-seed (no outside capital yet)</option>',
    '            <option>Seed (angel / F&amp;F raised)</option>',
    '            <option>Series A or later</option>',
    '            <option>Not raising — other project</option>',
    '          </select>',
    '        </label>',
    '        <label class="cm-field">',
    '          <span class="cm-label">Timeline</span>',
    '          <select name="timeline" required>',
    '            <option value="">Select…</option>',
    '            <option>Pitching in the next 30 days</option>',
    '            <option>Pitching in the next 90 days</option>',
    '            <option>6+ months out — exploring</option>',
    '            <option>Not raising</option>',
    '          </select>',
    '        </label>',
    '      </div>',
    '      <label class="cm-field">',
    '        <span class="cm-label">Rough budget <span class="cm-optional">(optional)</span></span>',
    '        <select name="budget">',
    '          <option value="">No preference yet</option>',
    '          <option>Under $2k</option>',
    '          <option>$2k – $5k</option>',
    '          <option>$5k – $10k</option>',
    '          <option>$10k+</option>',
    '          <option>Not sure yet</option>',
    '        </select>',
    '      </label>',
    '      <label class="cm-field">',
    '        <span class="cm-label">Message</span>',
    '        <textarea name="message" rows="4" required placeholder="A couple sentences on what you\'re raising, who you\'re pitching, and what isn\'t landing on the current deck."></textarea>',
    '      </label>',
    '      <label class="cm-field cm-file">',
    '        <span class="cm-label">Attach your current deck <span class="cm-optional">(optional · PDF, PPTX, KEY · 25MB max)</span></span>',
    '        <input type="file" name="attachment" accept=".pdf,.pptx,.ppt,.key,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" />',
    '      </label>',
    '      <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;" aria-hidden="true" />',
    '      <input type="hidden" name="source_page" value="" />',
    '      <input type="hidden" name="utm_params" value="" />',
    '      <button type="submit" class="cm-submit">Send message</button>',
    '      <div class="cm-status" role="status" aria-live="polite"></div>',
    '    </form>',
    '  </div>',
    '</div>'
  ].join('\n');

  var modalCSS = [
    '.cm-root { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.22s ease; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }',
    '.cm-root[hidden] { display: none; }',
    '.cm-root.is-open { opacity: 1; pointer-events: auto; }',
    '.cm-backdrop { position: absolute; inset: 0; background: rgba(20, 24, 31, 0.88); }',
    '.cm-card { position: relative; background: #F5F1E8; color: #2A2F39; max-width: 580px; width: calc(100% - 32px); max-height: calc(100vh - 32px); overflow-y: auto; padding: 44px 44px 36px; border: 1px solid #C9C2B1; box-shadow: 0 30px 80px rgba(20, 24, 31, 0.35); transform: translateY(12px); transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1); }',
    '.cm-root.is-open .cm-card { transform: translateY(0); }',
    '.cm-close { position: absolute; top: 14px; right: 16px; width: 32px; height: 32px; background: transparent; border: 0; cursor: pointer; font-size: 26px; line-height: 1; color: #6E6B66; transition: color 0.15s ease; }',
    '.cm-close:hover { color: #C2720D; }',
    '.cm-eyebrow { font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; font-weight: 600; color: #C2720D; margin-bottom: 14px; }',
    '.cm-title { font-family: Georgia, "Times New Roman", serif; font-weight: 400; font-size: 30px; line-height: 1.1; letter-spacing: -0.01em; color: #14181F; margin: 0 0 12px; }',
    '.cm-intro { font-size: 14px; line-height: 1.55; color: #2A2F39; margin: 0 0 24px; }',
    '.cm-form { display: flex; flex-direction: column; gap: 14px; }',
    '.cm-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }',
    '.cm-field { display: flex; flex-direction: column; gap: 6px; }',
    '.cm-label { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600; color: #6E6B66; }',
    '.cm-optional { font-weight: 400; text-transform: none; letter-spacing: 0; color: #9A9690; margin-left: 4px; }',
    '.cm-field input[type="text"], .cm-field input[type="email"], .cm-field textarea, .cm-field select { font-family: inherit; font-size: 15px; color: #14181F; background: #FFFFFF; border: 1px solid #C9C2B1; padding: 11px 13px; outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease; resize: vertical; -webkit-appearance: none; border-radius: 0; width: 100%; box-sizing: border-box; min-width: 0; }',
    '.cm-field select { appearance: none; -webkit-appearance: none; background-image: url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8"><path fill="none" stroke="%236E6B66" stroke-width="1.5" d="M1 1.5l5 5 5-5"/></svg>\'); background-repeat: no-repeat; background-position: right 14px center; padding-right: 34px; }',
    '.cm-field input:focus, .cm-field textarea:focus, .cm-field select:focus { border-color: #C2720D; box-shadow: 0 0 0 3px rgba(194, 114, 13, 0.12); }',
    '.cm-file input[type="file"] { font-family: inherit; font-size: 13px; color: #2A2F39; background: #FFFFFF; border: 1px dashed #C9C2B1; padding: 12px 14px; cursor: pointer; border-radius: 0; }',
    '.cm-file input[type="file"]::file-selector-button { font-family: inherit; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600; color: #14181F; background: transparent; border: 1px solid #C9C2B1; padding: 6px 10px; margin-right: 12px; cursor: pointer; }',
    '.cm-file input[type="file"]::file-selector-button:hover { border-color: #C2720D; color: #C2720D; }',
    '.cm-submit { font-family: inherit; font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; font-weight: 600; color: #FFFFFF; background: #14181F; border: 0; padding: 16px 20px; cursor: pointer; transition: background 0.18s ease, transform 0.1s ease; margin-top: 6px; }',
    '.cm-submit:hover:not(:disabled) { background: #C2720D; }',
    '.cm-submit:active:not(:disabled) { transform: translateY(1px); }',
    '.cm-submit:disabled { opacity: 0.6; cursor: wait; }',
    '.cm-status { font-size: 13px; color: #B24242; min-height: 18px; }',
    '.cm-status.is-success { color: #2C5F2D; }',
    '.cm-success { text-align: left; padding: 0; }',
    '.cm-success h3 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; font-size: 26px; color: #14181F; margin: 0 0 10px; letter-spacing: -0.005em; }',
    '.cm-success p { font-size: 15px; color: #2A2F39; margin: 0 0 24px; line-height: 1.55; }',
    /* v26 — envelope confirmation row */
    '.cm-confirm-row { display: flex; align-items: center; gap: 0; height: 44px; position: relative; }',
    '.cm-pill { display: inline-flex; align-items: center; gap: 10px; padding: 10px 18px 10px 14px; background: rgba(44, 95, 45, 0.1); color: #2C5F2D; font-family: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, monospace; font-size: 11.5px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; border: 1px solid rgba(44, 95, 45, 0.2); white-space: nowrap; position: relative; z-index: 2; animation: cm-pulse 900ms ease-out 1; }',
    '.cm-pill .cm-check { width: 14px; height: 14px; display: inline-block; position: relative; }',
    '.cm-pill .cm-check::after { content: ""; position: absolute; left: 2px; top: 1px; width: 5px; height: 9px; border-right: 2px solid #2C5F2D; border-bottom: 2px solid #2C5F2D; transform: rotate(45deg); }',
    '.cm-stage { position: relative; flex: 1; height: 44px; margin-left: 14px; overflow: visible; }',
    '.cm-envelope { position: absolute; left: 0; top: 50%; width: 26px; height: 18px; transform-origin: 50% 50%; will-change: transform; animation: cm-fly 3.2s cubic-bezier(.65,.05,.35,1) 1 forwards; z-index: 2; }',
    '.cm-envelope .cm-flap { transform-origin: 50% 30%; animation: cm-flap 3.2s ease-in-out 1 forwards; }',
    '.cm-trail-dot { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #14181F; transform: translate(-50%, -50%); animation: cm-fade 1100ms ease-out forwards; pointer-events: none; will-change: opacity, transform; }',
    '.cm-star { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%) scale(0.3) rotate(0deg); opacity: 0; pointer-events: none; will-change: transform, opacity; color: #14181F; }',
    '.cm-star svg { display: block; overflow: visible; }',
    '@keyframes cm-pulse { 0% { box-shadow: 0 0 0 0 rgba(44, 95, 45, 0.28); } 60% { box-shadow: 0 0 0 10px rgba(44, 95, 45, 0.0); } 100% { box-shadow: 0 0 0 0 rgba(44, 95, 45, 0.0); } }',
    '@keyframes cm-fly { 0% { transform: translate(0, -50%) rotate(0deg) scale(1); opacity: 0; } 6% { transform: translate(0, -50%) rotate(0deg) scale(1); opacity: 1; } 18% { transform: translate(calc(var(--cm-end-x) * 0.08), calc(-50% - 18px)) rotate(-22deg) scale(1.02); opacity: 1; } 32% { transform: translate(calc(var(--cm-end-x) * 0.22), calc(-50% - 34px)) rotate(-180deg) scale(.95); opacity: 1; } 46% { transform: translate(calc(var(--cm-end-x) * 0.44), calc(-50% - 22px)) rotate(-320deg) scale(1); opacity: 1; } 60% { transform: translate(calc(var(--cm-end-x) * 0.66), calc(-50% + 6px)) rotate(-380deg) scale(1.02); opacity: 1; } 75% { transform: translate(calc(var(--cm-end-x) * 0.86), calc(-50% - 10px)) rotate(-360deg) scale(1); opacity: 1; } 100% { transform: translate(var(--cm-end-x), -50%) rotate(-360deg) scale(1); opacity: 1; } }',
    '@keyframes cm-flap { 0%, 8% { transform: rotateX(0deg); } 20% { transform: rotateX(-35deg); } 50% { transform: rotateX(-10deg); } 80% { transform: rotateX(-25deg); } 100% { transform: rotateX(0deg); } }',
    '@keyframes cm-fade { 0% { opacity: 0.85; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); } }',
    '@keyframes cm-star-burst { 0% { opacity: 0; transform: translate(-50%, -50%) translate(0, 0) scale(0.2) rotate(0deg); } 20% { opacity: 1; transform: translate(-50%, -50%) translate(calc(var(--cm-dx) * 0.35), calc(var(--cm-dy) * 0.35)) scale(1) rotate(calc(var(--cm-spin) * 0.3)); } 100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--cm-dx), var(--cm-dy)) scale(0.5) rotate(var(--cm-spin)); } }',
    '@media (prefers-reduced-motion: reduce) { .cm-envelope { display: none !important; } .cm-pill { animation: none !important; } .cm-trail-dot, .cm-star { display: none !important; } }',
    '@media (max-width: 560px) {',
    '  .cm-card { padding: 38px 22px 28px; }',
    '  .cm-title { font-size: 24px; }',
    '  .cm-row { grid-template-columns: 1fr; gap: 14px; }',
    '}'
  ].join('\n');

  // v26 — envelope SVG inserted into the success state
  var envelopeSVG = [
    '<svg class="cm-envelope" viewBox="0 0 26 18" aria-hidden="true">',
    '  <rect x="0.5" y="3.5" width="25" height="14" rx="1.5" fill="#ffffff" stroke="#14181F" stroke-width="1"/>',
    '  <path d="M 1 4 L 13 12 L 25 4" fill="none" stroke="#14181F" stroke-width="1"/>',
    '  <g class="cm-flap">',
    '    <path d="M 0.5 3.5 L 13 12 L 25.5 3.5" fill="none" stroke="#14181F" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>',
    '  </g>',
    '</svg>'
  ].join('');

  // v26 — spin up the flying envelope after success HTML is injected
  function runEnvelopeAnimation(scope) {
    var stage = scope.querySelector('.cm-stage');
    var envelope = scope.querySelector('.cm-envelope');
    if (!stage || !envelope) return;

    // Respect reduced-motion — CSS already hides the envelope, but skip the
    // rAF + star-burst work entirely so we're not churning frames.
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    function syncEndX() {
      var stageW = stage.getBoundingClientRect().width;
      var envW = envelope.getBoundingClientRect().width || 26;
      var endX = Math.max(0, stageW - envW - 8);
      envelope.style.setProperty('--cm-end-x', endX + 'px');
    }
    syncEndX();
    var onResize = function () { syncEndX(); };
    window.addEventListener('resize', onResize);

    var lastX = -9999, lastY = -9999;
    var trailRAF = null;
    var MIN_GAP = 7;

    function sampleTrail() {
      var sb = stage.getBoundingClientRect();
      var eb = envelope.getBoundingClientRect();
      var x = (eb.left + eb.width / 2) - sb.left;
      var y = (eb.top + eb.height / 2) - sb.top;
      var visible = parseFloat(getComputedStyle(envelope).opacity) > 0.1;
      var dx = x - lastX, dy = y - lastY;
      if (visible && (dx * dx + dy * dy) >= MIN_GAP * MIN_GAP) {
        var d = document.createElement('span');
        d.className = 'cm-trail-dot';
        d.style.left = x + 'px';
        d.style.top = y + 'px';
        stage.appendChild(d);
        d.addEventListener('animationend', function () { d.remove(); }, { once: true });
        lastX = x; lastY = y;
      }
      trailRAF = requestAnimationFrame(sampleTrail);
    }

    function puffAt(x, y) {
      var N = 12;
      var starSVG =
        '<svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true">' +
          '<path d="M0,-5 L1.2,-1.2 L5,0 L1.2,1.2 L0,5 L-1.2,1.2 L-5,0 L-1.2,-1.2 Z" fill="currentColor"/>' +
        '</svg>';
      for (var i = 0; i < N; i++) {
        var angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        var dist = 22 + Math.random() * 18;
        var dur = 800 + Math.random() * 500;
        var delay = Math.random() * 90;
        var spin = (Math.random() * 540 - 270).toFixed(0) + 'deg';
        var size = 0.55 + Math.random() * 0.65;
        var s = document.createElement('span');
        s.className = 'cm-star';
        s.style.left = x + 'px';
        s.style.top = y + 'px';
        s.style.setProperty('--cm-dx', (Math.cos(angle) * dist).toFixed(2) + 'px');
        s.style.setProperty('--cm-dy', (Math.sin(angle) * dist).toFixed(2) + 'px');
        s.style.setProperty('--cm-spin', spin);
        s.innerHTML = starSVG;
        var svg = s.firstElementChild;
        svg.setAttribute('width', (12 * size).toFixed(1));
        svg.setAttribute('height', (12 * size).toFixed(1));
        s.style.animation = 'cm-star-burst ' + dur + 'ms cubic-bezier(.2,.7,.3,1) ' + delay + 'ms forwards';
        stage.appendChild(s);
        (function (node) {
          node.addEventListener('animationend', function () { node.remove(); }, { once: true });
        })(s);
      }
    }

    trailRAF = requestAnimationFrame(sampleTrail);

    var onEnd = function (e) {
      if (e.animationName !== 'cm-fly') return;
      envelope.removeEventListener('animationend', onEnd);
      window.removeEventListener('resize', onResize);
      if (trailRAF) cancelAnimationFrame(trailRAF);
      var sb = stage.getBoundingClientRect();
      var eb = envelope.getBoundingClientRect();
      var x = (eb.left + eb.width / 2) - sb.left;
      var y = (eb.top + eb.height / 2) - sb.top;
      envelope.style.visibility = 'hidden';
      puffAt(x, y);
    };
    envelope.addEventListener('animationend', onEnd);
  }

  function init() {
    var styleEl = document.createElement('style');
    styleEl.setAttribute('data-cm-style', '');
    styleEl.appendChild(document.createTextNode(modalCSS));
    document.head.appendChild(styleEl);

    var wrapper = document.createElement('div');
    wrapper.innerHTML = modalHTML;
    document.body.appendChild(wrapper.firstElementChild);

    var root = document.getElementById('cmRoot');
    var form = document.getElementById('cmForm');
    var card = root.querySelector('.cm-card');
    var status = root.querySelector('.cm-status');
    var submitBtn = root.querySelector('.cm-submit');
    var firstInput = root.querySelector('input[name="name"]');
    var lastFocused = null;

    // Capture page + UTM context on modal open so every submission is attributed
    function captureContext() {
      var srcEl = form.querySelector('input[name="source_page"]');
      var utmEl = form.querySelector('input[name="utm_params"]');
      if (srcEl) srcEl.value = (document.title || '') + ' :: ' + window.location.pathname + window.location.search;
      if (utmEl) {
        var qs = window.location.search || '';
        var utm = [];
        qs.replace(/^\?/, '').split('&').forEach(function (pair) {
          if (pair.toLowerCase().indexOf('utm_') === 0) utm.push(pair);
        });
        utmEl.value = utm.join('&') || '(none)';
      }
    }

    function open() {
      captureContext();
      lastFocused = document.activeElement;
      root.hidden = false;
      root.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
      requestAnimationFrame(function () { root.classList.add('is-open'); });
      setTimeout(function () { if (firstInput) firstInput.focus(); }, 120);
    }

    function close() {
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      setTimeout(function () {
        root.hidden = true;
        document.documentElement.style.overflow = '';
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
      }, 220);
    }

    // Wire openers: every mailto link AND every [data-contact-modal] trigger
    function wireOpeners() {
      var mailLinks = document.querySelectorAll('a[href^="mailto:hello@slatepress.co"]');
      Array.prototype.forEach.call(mailLinks, function (link) {
        if (link.__cmWired) return;
        link.__cmWired = true;
        link.addEventListener('click', function (e) { e.preventDefault(); open(); });
      });
      var triggers = document.querySelectorAll('[data-contact-modal]');
      Array.prototype.forEach.call(triggers, function (el) {
        if (el.__cmWired) return;
        el.__cmWired = true;
        el.addEventListener('click', function (e) { e.preventDefault(); open(); });
      });
    }
    wireOpeners();
    if (window.MutationObserver) {
      new MutationObserver(wireOpeners).observe(document.body, { childList: true, subtree: true });
    }

    // Close actions
    root.addEventListener('click', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-cm-close')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !root.hidden) close();
    });

    // Trap focus inside card when modal open
    card.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || root.hidden) return;
      var focusables = card.querySelectorAll('button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitBtn.disabled) return;

      // Honeypot check
      var honeypot = form.querySelector('input[name="_gotcha"]');
      if (honeypot && honeypot.value) return;

      submitBtn.disabled = true;
      var originalLabel = submitBtn.textContent;
      submitBtn.textContent = 'Sending…';
      status.textContent = '';
      status.className = 'cm-status';

      var data = new FormData(form);

      // Fire-and-forget: also persist to our D1-backed /lead-intake endpoint.
      // This runs in parallel with Formspree and does NOT block the UX or
      // the success state. If /lead-intake fails, Formspree email is still
      // the source of truth and Anthony will see the lead via email.
      try {
        var leadJson = {};
        data.forEach(function (v, k) {
          if (k === 'attachment') return; // D1 doesn't store files
          leadJson[k] = typeof v === 'string' ? v : '';
        });
        fetch('/lead-intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(leadJson)
        }).catch(function () { /* silent — Formspree is authoritative */ });
      } catch (_) { /* never let intake errors break the Formspree path */ }

      fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: data
      }).then(function (res) {
        if (res.ok) {
          form.innerHTML = [
            '<div class="cm-success">',
            '  <h3>Got it — thanks.</h3>',
            '  <p>We\'ll reply within one business day at the email you provided. If it\'s urgent, reach us directly at hello@slatepress.co.</p>',
            '  <div class="cm-confirm-row">',
            '    <div class="cm-pill"><span class="cm-check" aria-hidden="true"></span>Confirmation email sent</div>',
            '    <div class="cm-stage">',
            '      ' + envelopeSVG,
            '    </div>',
            '  </div>',
            '</div>'
          ].join('');
          runEnvelopeAnimation(form);
        } else {
          return res.json().then(function (payload) {
            var msg = (payload && payload.errors && payload.errors[0] && payload.errors[0].message) || 'Something went wrong. Please email hello@slatepress.co directly.';
            status.textContent = msg;
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
          });
        }
      }).catch(function () {
        status.textContent = 'Network error. Please email hello@slatepress.co directly.';
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
