/*
 * Slatepress blog toolbar (v69+)
 *
 * Self-injecting utility bar for blog posts. Inserts after the .article-head
 * section with: Share (copy link, X, LinkedIn, email), Font size (3 steps),
 * Print, and Save (localStorage bookmark with visual toggle).
 *
 * Add a single <script defer src="/assets/blog-toolbar.js"></script> to any
 * blog post — the toolbar handles its own DOM, styles, and behavior.
 */
(function () {
  "use strict";

  /* ── skip if not a post page ── */
  var path = location.pathname.replace(/\/+$/, "/");
  if (path === "/blog/" || path === "/blog/index.html") return;
  if (!/^\/blog\/[^\/]+\//.test(path)) return;

  /* ── inject styles ── */
  var css = document.createElement("style");
  css.textContent = [
    ".blog-toolbar{display:flex;align-items:center;gap:24px;padding:18px 0;border-bottom:1px solid var(--rule);font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);user-select:none}",
    ".blog-toolbar button,.blog-toolbar .bt-btn{background:none;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font:inherit;color:var(--muted);letter-spacing:inherit;text-transform:inherit;padding:4px 0;transition:color .25s;position:relative}",
    ".blog-toolbar button:hover,.blog-toolbar .bt-btn:hover{color:var(--ink)}",
    ".blog-toolbar svg{width:15px;height:15px;flex:none;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}",
    ".blog-toolbar .bt-saved{color:var(--ochre)}",
    ".blog-toolbar .bt-saved svg{fill:var(--ochre);stroke:var(--ochre)}",
    /* share dropdown */
    ".bt-share-wrap{position:relative}",
    ".bt-share-dd{position:absolute;top:calc(100% + 8px);left:0;background:var(--cream);border:1px solid var(--rule);border-radius:4px;padding:8px 0;min-width:180px;opacity:0;visibility:hidden;transform:translateY(-4px);transition:opacity .2s,transform .2s,visibility .2s;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,.08)}",
    ".bt-share-dd.open{opacity:1;visibility:visible;transform:translateY(0)}",
    "[data-theme='dark'] .bt-share-dd{box-shadow:0 4px 12px rgba(0,0,0,.3)}",
    ".bt-share-dd a,.bt-share-dd button{display:flex;width:100%;align-items:center;gap:10px;padding:8px 16px;font:inherit;color:var(--ink-soft);letter-spacing:.1em;text-transform:uppercase;font-size:10px;text-decoration:none;background:none;border:none;cursor:pointer;transition:background .15s,color .15s}",
    ".bt-share-dd a:hover,.bt-share-dd button:hover{background:var(--cream-2);color:var(--ink)}",
    /* font size indicator */
    ".bt-fontsize span{display:inline-block;transition:transform .15s}",
    ".bt-fontsize .bt-a-sm{font-size:9px}",
    ".bt-fontsize .bt-a-lg{font-size:13px;font-weight:500}",
    /* toast */
    ".bt-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--ink);color:var(--cream);font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;padding:10px 20px;border-radius:4px;opacity:0;transition:opacity .3s,transform .3s;z-index:9999;pointer-events:none}",
    ".bt-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}",
    /* mobile */
    "@media(max-width:860px){.blog-toolbar{gap:16px;flex-wrap:wrap;padding:14px 0}.blog-toolbar button,.blog-toolbar .bt-btn{font-size:9px}}"
  ].join("\n");
  document.head.appendChild(css);

  /* ── SVG icon paths ── */
  function icon(paths) {
    return '<svg viewBox="0 0 24 24">' + paths + "</svg>";
  }
  var ICONS = {
    share: icon('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>'),
    copy: icon('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    x: icon('<path d="M4 4l6.5 8L4 20h2l5.2-6.4L16 20h4l-6.8-8.3L19.5 4h-2l-4.8 5.9L8 4H4z"/>'),
    linkedin: icon('<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>'),
    email: icon('<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 4 12 13 2 4"/>'),
    font: icon('<path d="M4 20h3l2.5-7h5l2.5 7h3"/><path d="M7.5 13L12 3l4.5 10"/>'),
    print: icon('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    bookmark: icon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>')
  };

  /* ── toast helper ── */
  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "bt-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2000);
  }

  /* ── page metadata ── */
  var pageUrl = location.href.split("?")[0];
  var pageTitle = document.title.replace(/ — Slatepress$/, "");

  /* ── build toolbar DOM ── */
  var bar = document.createElement("div");
  bar.className = "blog-toolbar";

  /* — Share — */
  var shareWrap = document.createElement("div");
  shareWrap.className = "bt-share-wrap";

  var shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.setAttribute("aria-label", "Share this post");
  shareBtn.innerHTML = ICONS.share + " Share";

  var dd = document.createElement("div");
  dd.className = "bt-share-dd";
  dd.innerHTML = [
    '<button class="bt-dd-copy" type="button">' + ICONS.copy + " Copy link</button>",
    '<a href="https://x.com/intent/tweet?url=' + encodeURIComponent(pageUrl) + "&text=" + encodeURIComponent(pageTitle) + '" target="_blank" rel="noopener">' + ICONS.x + " Post on X</a>",
    '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener">' + ICONS.linkedin + " LinkedIn</a>",
    '<a href="mailto:?subject=' + encodeURIComponent(pageTitle) + "&body=" + encodeURIComponent(pageTitle + "\n\n" + pageUrl) + '">' + ICONS.email + " Email</a>"
  ].join("");

  shareWrap.appendChild(shareBtn);
  shareWrap.appendChild(dd);
  bar.appendChild(shareWrap);

  // Toggle dropdown
  shareBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    dd.classList.toggle("open");
  });
  document.addEventListener("click", function () {
    dd.classList.remove("open");
  });
  dd.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  // Copy link
  dd.querySelector(".bt-dd-copy").addEventListener("click", function () {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pageUrl).then(function () {
        toast("Link copied");
        dd.classList.remove("open");
      });
    }
  });

  /* — Font size — */
  var SIZES = [17, 18, 20]; // px values mapped to small / default / large
  var sizeIdx = 1; // start at default (18px matches .article p)
  var fontBtn = document.createElement("button");
  fontBtn.type = "button";
  fontBtn.className = "bt-fontsize";
  fontBtn.setAttribute("aria-label", "Toggle font size");
  fontBtn.innerHTML = ICONS.font + ' <span class="bt-a-sm">A</span><span class="bt-a-lg">A</span>';
  fontBtn.addEventListener("click", function () {
    sizeIdx = (sizeIdx + 1) % SIZES.length;
    var px = SIZES[sizeIdx];
    var article = document.querySelector(".article");
    if (article) {
      var ps = article.querySelectorAll("p:not(.lede), li");
      for (var i = 0; i < ps.length; i++) {
        ps[i].style.fontSize = px + "px";
      }
    }
    var labels = ["Small", "Default", "Large"];
    toast("Font: " + labels[sizeIdx]);
  });
  bar.appendChild(fontBtn);

  /* — Print — */
  var printBtn = document.createElement("button");
  printBtn.type = "button";
  printBtn.setAttribute("aria-label", "Print this post");
  printBtn.innerHTML = ICONS.print + " Print";
  printBtn.addEventListener("click", function () {
    window.print();
  });
  bar.appendChild(printBtn);

  /* — Save — */
  var SAVE_KEY = "sp_savedPosts";
  function getSaved() {
    try {
      var r = localStorage.getItem(SAVE_KEY);
      return r ? JSON.parse(r) : [];
    } catch (e) {
      return [];
    }
  }
  function setSaved(arr) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(arr.slice(-200)));
    } catch (e) {}
  }

  var slug = (path.match(/\/blog\/([^\/]+)\//) || [])[1] || "";
  var saved = getSaved();
  var isSaved = saved.indexOf(slug) !== -1;

  var saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.setAttribute("aria-label", "Save this post");
  saveBtn.innerHTML = ICONS.bookmark + " Save";
  if (isSaved) saveBtn.classList.add("bt-saved");

  saveBtn.addEventListener("click", function () {
    var arr = getSaved();
    var idx = arr.indexOf(slug);
    if (idx === -1) {
      arr.push(slug);
      setSaved(arr);
      saveBtn.classList.add("bt-saved");
      toast("Saved");
    } else {
      arr.splice(idx, 1);
      setSaved(arr);
      saveBtn.classList.remove("bt-saved");
      toast("Removed");
    }
  });
  bar.appendChild(saveBtn);

  /* ── inject into page ── */
  function inject() {
    var prose = document.querySelector(".article-head .prose");
    if (prose) {
      prose.appendChild(bar);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
