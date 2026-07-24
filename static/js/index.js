document.addEventListener("DOMContentLoaded", function () {
  // ================= BibTeX copy =================
  var copyButton = document.querySelector("[data-copy-target]");
  if (copyButton) {
    copyButton.addEventListener("click", function () {
      var target = document.querySelector(copyButton.getAttribute("data-copy-target"));
      if (!target) return;
      var original = copyButton.textContent;
      navigator.clipboard.writeText(target.textContent.trim()).then(function () {
        copyButton.textContent = "Copied"; copyButton.classList.add("is-success");
      }).catch(function () { copyButton.textContent = "Copy failed"; });
      window.setTimeout(function () { copyButton.textContent = original; copyButton.classList.remove("is-success"); }, 1800);
    });
  }

  // ================= lightbox =================
  var zoom = document.getElementById("zoom");
  var zoomBody = zoom ? zoom.querySelector(".zoom-body") : null;
  function openZoom(elm) {
    if (!zoomBody) return;
    zoomBody.innerHTML = "";
    var node;
    if (elm.tagName === "VIDEO") {
      node = document.createElement("video");
      node.src = elm.currentSrc || elm.src;
      node.controls = true; node.autoplay = true; node.loop = true; node.muted = true; node.playsInline = true;
    } else { node = document.createElement("img"); node.src = elm.currentSrc || elm.src; }
    zoomBody.appendChild(node); zoom.classList.add("open");
  }
  if (zoom) {
    document.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest(".gzoom") : null;
      if (t) { e.stopPropagation(); openZoom(t); }
    });
    zoom.addEventListener("click", function () { zoom.classList.remove("open"); zoomBody.innerHTML = ""; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { zoom.classList.remove("open"); zoomBody.innerHTML = ""; } });
  }

  // ================= mobile nav toggle =================
  var navToggle = document.querySelector(".nav-toggle");
  var siteNav = document.getElementById("site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    siteNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        siteNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ================= data-driven video gallery =================
  var G = null;
  var el = function (id) { return document.getElementById(id); };
  function observeOnce(sel, cb) {
    var node = document.querySelector(sel);
    if (!node) return;
    if (!("IntersectionObserver" in window)) { cb(); return; } // old browsers: render now
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) { if (entries[i].isIntersecting) { io.disconnect(); cb(); return; } }
    }, { rootMargin: "300px 0px" }); // start loading a bit before it scrolls into view
    io.observe(node);
  }
  function isVideo(src) { return /\.mp4($|\?|#)/i.test(src || ""); }

  function mediaTag(src, cls, opts) {
    opts = opts || {};
    if (isVideo(src)) {
      var a = 'muted loop playsinline preload="' + (opts.preload || "metadata") + '"';
      if (opts.autoplay) a += " autoplay";
      return '<video class="' + (cls || "") + '" src="' + src + '#t=0.1" ' + a + "></video>";
    }
    return '<img class="' + (cls || "") + '" loading="lazy" src="' + src + '" alt="' + (opts.alt || "") + '">';
  }

  // returns {src, missing}; missing=true when the method has no media for this kind
  function methodMedia(view, method, kind) {
    var m = view.methods[method];
    if (m && m[kind]) return { src: m[kind], missing: false };
    return { src: null, missing: true };
  }
  function primaryView(scene) { return scene.views[0]; }

  function methodTile(view, method, kind, autoplay) {
    var label = (G.methodLabels[method] || method);
    var mm = methodMedia(view, method, kind);
    if (mm.missing) {
      return '<figure class="cmp unavailable"><div class="na-tile" aria-hidden="true"></div><figcaption>' + label + ' <span class="ph">(None)</span></figcaption></figure>';
    }
    var cls = "cmp" + (method === "psdf" ? " ours" : "");
    return '<figure class="' + cls + '">' + mediaTag(mm.src, "gzoom", { autoplay: autoplay, alt: label }) + "<figcaption>" + label + "</figcaption></figure>";
  }

  function bindHoverPlay(scope) {
    scope.querySelectorAll(".gcase").forEach(function (gc) {
      var vids = gc.querySelectorAll("video");
      if (!vids.length) return;
      gc.addEventListener("mouseenter", function () { vids.forEach(function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }); });
      gc.addEventListener("mouseleave", function () { vids.forEach(function (v) { v.pause(); }); });
    });
  }

  // ---- interactive comparison ----
  function fillSelect(sel, items, selected) {
    sel.innerHTML = items.map(function (i) {
      var dis = i.disabled ? " disabled" : "";
      return '<option value="' + i.v + '"' + (i.v === selected ? " selected" : "") + dis + ">" + i.t + "</option>";
    }).join("");
  }
  function methodItems(view, kind) {
    return G.methodOrder.map(function (m) {
      var mm = methodMedia(view, m, kind);
      var label = G.methodLabels[m] || m;
      return { v: m, t: mm.missing ? label + " (None)" : label, disabled: mm.missing };
    });
  }
  function refreshMethodSelects() {
    var ctx = cmpContext(); if (!ctx) return;
    var kind = el("cmp-kind").value;
    var items = methodItems(ctx.view, kind);
    function isNa(v) { for (var k = 0; k < items.length; k++) { if (items[k].v === v) return items[k].disabled; } return true; }
    var avail = items.filter(function (x) { return !x.disabled; });
    var fb = avail.length ? avail[0].v : items[0].v;
    var curA = el("cmp-a").value, curB = el("cmp-b").value;
    var a = (curA && !isNa(curA)) ? curA : (!isNa("dgmesh") ? "dgmesh" : fb);
    var b = (curB && !isNa(curB)) ? curB : (!isNa("psdf") ? "psdf" : fb);
    fillSelect(el("cmp-a"), items, a);
    fillSelect(el("cmp-b"), items, b);
  }
  function dsById(id) { return G.datasets.find(function (d) { return d.id === id; }); }
  function sceneById(ds, id) { return ds.scenes.find(function (s) { return s.id === id; }); }
  function cmpContext() {
    var ds = dsById(el("cmp-dataset").value); if (!ds) return null;
    var sc = sceneById(ds, el("cmp-scene").value) || ds.scenes[0]; if (!sc) return null;
    var view = sc.views[0];
    return { ds: ds, sc: sc, view: view };
  }

  function renderGrid() {
    var host = el("cmp-grid"); var ctx = cmpContext(); if (!host || !ctx) return;
    var kind = el("cmp-kind").value;
    var html = '<div class="gcase"><div class="result-row">';
    G.methodOrder.forEach(function (method) { html += methodTile(ctx.view, method, kind, false); });
    html += "</div></div>";
    host.innerHTML = html;
    bindHoverPlay(host);
  }

  function initSlider(scope) {
    scope.querySelectorAll("[data-cmpslider]").forEach(function (slider) {
      var top = slider.querySelector(".cmp-top");
      var topMedia = top ? top.querySelector("img,video") : null;
      var handle = slider.querySelector(".cmp-handle");
      var range = slider.querySelector(".cmp-range");
      var base = slider.querySelector(".cmp-base");
      if (!top || !topMedia || !range) return;
      function syncW() { topMedia.style.width = slider.clientWidth + "px"; }
      function setPos(p) { top.style.width = p + "%"; if (handle) handle.style.left = p + "%"; }
      if (base) {
        if (base.tagName === "IMG" && !base.complete) base.addEventListener("load", syncW);
        if (base.tagName === "VIDEO") base.addEventListener("loadedmetadata", syncW);
      }
      if (topMedia.tagName === "VIDEO") topMedia.addEventListener("loadedmetadata", syncW);
      syncW(); setPos(range.value || 50);
      range.addEventListener("input", function () { setPos(range.value); });
      window.addEventListener("resize", syncW);

      // hover-to-play, kept time-aligned even when the two clips buffer unevenly
      var vids = [];
      if (base && base.tagName === "VIDEO") vids.push(base);
      if (topMedia.tagName === "VIDEO") vids.push(topMedia);
      if (!vids.length) return;
      var master = vids[0];
      var wantPlay = false;
      function pauseAll() { vids.forEach(function (v) { v.pause(); }); }
      function resync() { for (var i = 1; i < vids.length; i++) { if (Math.abs(vids[i].currentTime - master.currentTime) > 0.08) vids[i].currentTime = master.currentTime; } }
      function playTogether() {
        if (!wantPlay) return;
        resync();
        vids.forEach(function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); });
      }
      if (vids.length > 1) {
        master.addEventListener("timeupdate", function () {
          if (!wantPlay) return;
          for (var i = 1; i < vids.length; i++) {
            if (Math.abs(vids[i].currentTime - master.currentTime) > 0.12) vids[i].currentTime = master.currentTime;
          }
        });
      }
      vids.forEach(function (v) {
        v.addEventListener("waiting", function () { if (wantPlay) pauseAll(); }); // one stalled -> hold both
        v.addEventListener("canplay", playTogether);                             // ready again -> resume together
      });
      slider.addEventListener("mouseenter", function () { wantPlay = true; playTogether(); });
      slider.addEventListener("mouseleave", function () { wantPlay = false; pauseAll(); });
    });
  }

  function renderSlider() {
    var host = el("cmp-slider-host"); var ctx = cmpContext(); if (!host || !ctx) return;
    var kind = el("cmp-kind").value;
    var a = el("cmp-a").value, b = el("cmp-b").value;
    var ma = methodMedia(ctx.view, a, kind), mb = methodMedia(ctx.view, b, kind);
    if (ma.missing || mb.missing) { host.innerHTML = '<p class="gfallback">Selected methods are not both available for this scene / type.</p>'; return; }
    var la = (G.methodLabels[a] || a);
    var lb = (G.methodLabels[b] || b);
    host.innerHTML =
      '<div class="cmpslider" data-cmpslider>' +
        mediaTag(mb.src, "cmp-base", { autoplay: false, alt: lb }) +
        '<div class="cmp-top">' + mediaTag(ma.src, "", { autoplay: false, alt: la }) + "</div>" +
        '<div class="cmp-handle"></div>' +
        '<input class="cmp-range" type="range" min="0" max="100" value="50" aria-label="Drag to compare">' +
        '<span class="cmp-tag l">' + la + "</span><span class=\"cmp-tag r\">" + lb + "</span>" +
      "</div>";
    initSlider(host);
  }

  function onCmpScene() {
    refreshMethodSelects();
    renderGrid();
    renderSlider();
  }
  function onCmpDataset() {
    var ds = dsById(el("cmp-dataset").value);
    fillSelect(el("cmp-scene"), ds.scenes.map(function (s) { return { v: s.id, t: s.name }; }), ds.scenes[0].id);
    onCmpScene();
  }

  // ---- PBR decomposition ----
  var PBR_TILES = [
    { kind: "image", label: "RGB" },
    { kind: "normal", label: "Normal" },
    { kind: "pbr_kd", label: "Albedo" },
    { kind: "pbr_roughness", label: "Roughness" },
    { kind: "pbr_metallic", label: "Metallic" },
    { kind: "pbr_occ", label: "Occlusion" }
  ];
  function renderPbr() {
    var host = el("pbr-grid"); if (!host) return;
    var ds = dsById(el("pbr-dataset").value); var sc = sceneById(ds, el("pbr-scene").value) || ds.scenes[0];
    var view = primaryView(sc); var m = view.methods["psdf"] || {};
    var html = '<div class="gcase"><div class="result-row">';
    PBR_TILES.forEach(function (t) {
      if (!m[t.kind]) return;
      html += '<figure class="cmp">' + mediaTag(m[t.kind], "gzoom", { autoplay: false, alt: t.label }) + "<figcaption>" + t.label + "</figcaption></figure>";
    });
    html += "</div></div>";
    host.innerHTML = html;
    bindHoverPlay(host);
  }
  function onPbrDataset() {
    var ds = dsById(el("pbr-dataset").value);
    fillSelect(el("pbr-scene"), ds.scenes.map(function (s) { return { v: s.id, t: s.name }; }), ds.scenes[0].id);
    renderPbr();
  }

  function bindControls() {
    el("cmp-dataset").addEventListener("change", onCmpDataset);
    el("cmp-scene").addEventListener("change", onCmpScene);
    el("cmp-kind").addEventListener("change", function () { refreshMethodSelects(); renderGrid(); renderSlider(); });
    el("cmp-a").addEventListener("change", renderSlider);
    el("cmp-b").addEventListener("change", renderSlider);
    el("pbr-dataset").addEventListener("change", onPbrDataset);
    el("pbr-scene").addEventListener("change", renderPbr);
  }

  fetch("static/gallery.json")
    .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
    .then(function (data) {
      G = data;
      var dsItems = G.datasets.map(function (d) { return { v: d.id, t: d.name }; });
      fillSelect(el("cmp-dataset"), dsItems, G.datasets[0].id);
      fillSelect(el("pbr-dataset"), dsItems, G.datasets[0].id);
      bindControls();
      // populate dependent selects immediately (cheap), but DEFER loading the ~14 gallery
      // videos until each below-the-fold section is about to enter the viewport
      var dsC = dsById(el("cmp-dataset").value);
      fillSelect(el("cmp-scene"), dsC.scenes.map(function (s) { return { v: s.id, t: s.name }; }), dsC.scenes[0].id);
      refreshMethodSelects();
      var dsP = dsById(el("pbr-dataset").value);
      fillSelect(el("pbr-scene"), dsP.scenes.map(function (s) { return { v: s.id, t: s.name }; }), dsP.scenes[0].id);
      observeOnce("#gallery", function () { renderGrid(); renderSlider(); });
      observeOnce("#decomposition", function () { renderPbr(); });
    })
    .catch(function (err) { console.error("gallery load error:", err); var fb = el("gallery-fallback"); if (fb) fb.hidden = false; });
});
