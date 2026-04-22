/*
 * Slatepress blog read-tracker (v55+)
 *
 * Replaces :visited styling, which Chrome 132+ partitions per-origin-frame so
 * URL-bar / search / external arrivals never register. This script works for
 * every arrival path.
 *
 * On a post page (pathname matches /blog/<slug>/): store <slug> into the read set.
 * On the blog index (pathname === /blog/ or /blog/index.html): read the set and
 * add `.read` to any <a class="post-card"> whose href resolves to a stored slug.
 * CSS rule `.post-card.read h2 { text-decoration: line-through 2px var(--ink) }`
 * paints the strikethrough.
 *
 * Storage key: sp_readPosts (JSON array of slugs, deduped). Safe to clear; user
 * can reset read state via browser devtools without affecting anything else.
 */
(function () {
  var KEY = "sp_readPosts";
  var path = location.pathname.replace(/\/+$/, "/"); // normalize trailing slash
  // Strip query + hash handled by pathname already.

  function readSet() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeSet(arr) {
    try {
      // Cap to last 200 entries — plenty of headroom, keeps the blob tiny
      if (arr.length > 200) arr = arr.slice(-200);
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (e) {
      // localStorage disabled / full / private mode — silent fail, feature degrades
    }
  }

  function slugFromPath(p) {
    // Match /blog/<slug>/ or /blog/<slug>/index.html
    var m = p.match(/^\/blog\/([^\/]+)\/(?:index\.html)?$/);
    return m ? m[1] : null;
  }

  var selfSlug = slugFromPath(path);
  var isIndex = path === "/blog/" || path === "/blog/index.html";

  if (selfSlug) {
    // Post page: record this slug
    var set = readSet();
    if (set.indexOf(selfSlug) === -1) {
      set.push(selfSlug);
      writeSet(set);
    }
  }

  if (isIndex) {
    // Blog index: mark cards
    var storedArr = readSet();
    if (!storedArr.length) return;
    var stored = Object.create(null);
    for (var i = 0; i < storedArr.length; i++) stored[storedArr[i]] = true;

    function markCards() {
      var cards = document.querySelectorAll("a.post-card");
      for (var j = 0; j < cards.length; j++) {
        var href = cards[j].getAttribute("href") || "";
        // Href is relative like "<slug>/" — strip trailing slash + index.html
        var slug = href.replace(/\/?(index\.html)?$/, "").replace(/\/$/, "");
        if (stored[slug]) cards[j].classList.add("read");
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", markCards);
    } else {
      markCards();
    }
  }
})();
