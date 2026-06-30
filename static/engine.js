/* VaultConvert client engine \u2014 100% in-browser conversion. No uploads. */
(function () {
  var cfg = window.__VC__ || {};
  var drop = document.getElementById('vc-drop');
  var input = document.getElementById('vc-input');
  var pick = document.getElementById('vc-pick');
  var list = document.getElementById('vc-list');
  var controls = document.getElementById('vc-controls');
  var allBtn = document.getElementById('vc-all');
  var clearBtn = document.getElementById('vc-clear');
  if (!drop || !input) return;

  var results = [];
  var heicReady = null;

  function loadHeic() {
    if (heicReady) return heicReady;
    heicReady = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      s.onload = function () { res(window.heic2any); };
      s.onerror = function () { rej(new Error('Could not load the HEIC decoder. Check your connection and retry.')); };
      document.head.appendChild(s);
    });
    return heicReady;
  }

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  function baseName(name) {
    var i = name.lastIndexOf('.');
    return i > 0 ? name.slice(0, i) : name;
  }

  function savings(orig, out) {
    if (!orig) return '';
    var pct = Math.round((1 - out / orig) * 100);
    if (pct > 0) return ' <b class="vc-down">\u2212' + pct + '%</b>';
    if (pct < 0) return ' <b class="vc-up">+' + (-pct) + '%</b>';
    return ' <b>same size</b>';
  }

  async function decodeToCanvas(file, onNote) {
    var canvas = document.createElement('canvas');
    var ctx;
    if (cfg.decoder === 'svg') {
      var url = URL.createObjectURL(file);
      var img = await new Promise(function (res, rej) {
        var im = new Image();
        im.onload = function () { res(im); };
        im.onerror = function () { rej(new Error('Invalid SVG file.')); };
        im.src = url;
      });
      var scale = cfg.scale || 1;
      canvas.width = Math.max(1, Math.round((img.naturalWidth || 512) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || 512) * scale));
      ctx = canvas.getContext('2d');
      if (cfg.flatten) { ctx.fillStyle = cfg.flatten; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      return canvas;
    }

    var sourceBlob = file;
    if (cfg.decoder === 'heic') {
      if (onNote) onNote('Loading HEIC decoder (first time only)\u2026');
      var heic2any = await loadHeic();
      if (onNote) onNote('Converting\u2026');
      var converted = await heic2any({
        blob: file,
        toType: cfg.outMime === 'image/png' ? 'image/png' : 'image/jpeg',
        quality: cfg.quality || 0.92
      });
      sourceBlob = Array.isArray(converted) ? converted[0] : converted;
    }
    var bmp = await createImageBitmap(sourceBlob);
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    ctx = canvas.getContext('2d');
    if (cfg.flatten) { ctx.fillStyle = cfg.flatten; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(bmp, 0, 0);
    if (bmp.close) bmp.close();
    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (res) {
      canvas.toBlob(function (b) { res(b); }, cfg.outMime, cfg.quality || 0.92);
    });
  }

  function makeRow(file) {
    var row = document.createElement('div');
    row.className = 'vc-row';
    row.innerHTML =
      '<img class="vc-thumb" alt="" hidden>' +
      '<div class="vc-info">' +
        '<span class="vc-name"></span>' +
        '<span class="vc-meta">Queued\u2026</span>' +
        '<div class="vc-bar"><i></i></div>' +
      '</div>' +
      '<div class="vc-action"></div>';
    row.querySelector('.vc-name').textContent = file.name;
    list.appendChild(row);
    return row;
  }

  function showControls() {
    if (controls && results.length >= 1) controls.hidden = false;
  }

  async function handleFile(file) {
    var row = makeRow(file);
    var meta = row.querySelector('.vc-meta');
    var bar = row.querySelector('.vc-bar');
    var action = row.querySelector('.vc-action');
    var thumb = row.querySelector('.vc-thumb');
    try {
      meta.textContent = 'Converting\u2026';
      var canvas = await decodeToCanvas(file, function (note) { meta.textContent = note; });
      var blob = await canvasToBlob(canvas);
      if (!blob) throw new Error('Encoding failed.');
      var outName = baseName(file.name) + '.' + cfg.outExt;
      var url = URL.createObjectURL(blob);
      results.push({ name: outName, url: url });
      bar.style.display = 'none';
      thumb.src = url; thumb.hidden = false;
      meta.innerHTML = fmtBytes(file.size) + ' \u2192 ' + fmtBytes(blob.size) + savings(file.size, blob.size) +
        ' \u00b7 ' + canvas.width + '\u00d7' + canvas.height + ' px';
      var a = document.createElement('a');
      a.href = url; a.download = outName; a.className = 'vc-dl';
      a.textContent = 'Download ' + cfg.outExt.toUpperCase();
      action.appendChild(a);
      showControls();
    } catch (e) {
      bar.style.display = 'none';
      meta.className = 'vc-meta vc-err';
      meta.textContent = (e && e.message) ? e.message : 'Conversion failed.';
    }
  }

  function handleFiles(files) {
    Array.prototype.slice.call(files).forEach(function (f) { handleFile(f); });
  }

  if (pick) pick.addEventListener('click', function (e) { e.preventDefault(); input.click(); });
  drop.addEventListener('click', function (e) {
    if (e.target === drop || e.target.classList.contains('vc-hint') || e.target.classList.contains('vc-priv')) input.click();
  });
  input.addEventListener('change', function () { handleFiles(input.files); });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('vc-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('vc-over'); });
  });
  drop.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  });

  if (allBtn) allBtn.addEventListener('click', function () {
    results.forEach(function (r, i) {
      setTimeout(function () {
        var a = document.createElement('a');
        a.href = r.url; a.download = r.name;
        document.body.appendChild(a); a.click(); a.remove();
      }, i * 250);
    });
  });

  if (clearBtn) clearBtn.addEventListener('click', function () {
    results.forEach(function (r) { URL.revokeObjectURL(r.url); });
    results = [];
    list.innerHTML = '';
    if (controls) controls.hidden = true;
    input.value = '';
  });
})();
