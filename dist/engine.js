/* VaultConvert client engine \u2014 100% in-browser conversion. No uploads. */
(function () {
  var cfg = window.__VC__ || {};
  var drop = document.getElementById('vc-drop');
  var input = document.getElementById('vc-input');
  var pick = document.getElementById('vc-pick');
  var list = document.getElementById('vc-list');
  var allBtn = document.getElementById('vc-all');
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

  async function decodeToCanvas(file) {
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
      var heic2any = await loadHeic();
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

  function addRow(file) {
    var row = document.createElement('div');
    row.className = 'vc-row';
    row.innerHTML = '<span class="vc-name"></span><span class="vc-status">working\u2026</span>';
    row.querySelector('.vc-name').textContent = file.name;
    list.appendChild(row);
    return row;
  }

  async function handleFile(file) {
    var row = addRow(file);
    var status = row.querySelector('.vc-status');
    try {
      var canvas = await decodeToCanvas(file);
      var blob = await canvasToBlob(canvas);
      if (!blob) throw new Error('Encoding failed.');
      var outName = baseName(file.name) + '.' + cfg.outExt;
      var url = URL.createObjectURL(blob);
      results.push({ name: outName, url: url });
      status.innerHTML = '';
      var a = document.createElement('a');
      a.href = url;
      a.download = outName;
      a.className = 'vc-dl';
      a.textContent = 'Download ' + cfg.outExt.toUpperCase() + ' (' + fmtBytes(blob.size) + ')';
      status.appendChild(a);
      if (results.length > 1 && allBtn) allBtn.hidden = false;
    } catch (e) {
      status.className = 'vc-status vc-err';
      status.textContent = (e && e.message) ? e.message : 'Conversion failed.';
    }
  }

  function handleFiles(files) {
    var arr = Array.prototype.slice.call(files);
    arr.forEach(function (f) { handleFile(f); });
  }

  if (pick) pick.addEventListener('click', function (e) { e.preventDefault(); input.click(); });
  drop.addEventListener('click', function (e) { if (e.target === drop || e.target.classList.contains('vc-hint')) input.click(); });
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
})();
