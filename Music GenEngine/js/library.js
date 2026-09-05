/* ============================================================
   GENENGINE — library.js
   Sound library: built-in instrument presets (audition & add)
   plus the user sample library — drag & drop your GarageBand /
   Apple Loops audio, stored persistently in IndexedDB.
   ============================================================ */
'use strict';
(function (G) {

  const V = G.views = G.views || {};
  const L = G.library = {};

  let root, sampleListEl, catFilter = 'All';
  let db = null;
  const decoded = new Map();     // name -> AudioBuffer
  let names = [];                // sample names in library
  let previewSrc = null;

  // ---------------- IndexedDB ----------------
  const openDB = () => new Promise((res) => {
    try {
      const req = indexedDB.open('genengine', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('samples', { keyPath: 'name' }); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    } catch (e) { res(null); }
  });

  const idbPut = (rec) => new Promise((res) => {
    if (!db) return res(false);
    const tx = db.transaction('samples', 'readwrite');
    tx.objectStore('samples').put(rec);
    tx.oncomplete = () => res(true); tx.onerror = () => res(false);
  });
  const idbDel = (name) => new Promise((res) => {
    if (!db) return res(false);
    const tx = db.transaction('samples', 'readwrite');
    tx.objectStore('samples').delete(name);
    tx.oncomplete = () => res(true); tx.onerror = () => res(false);
  });
  const idbGet = (name) => new Promise((res) => {
    if (!db) return res(null);
    const tx = db.transaction('samples', 'readonly');
    const rq = tx.objectStore('samples').get(name);
    rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null);
  });
  const idbKeys = () => new Promise((res) => {
    if (!db) return res([]);
    const tx = db.transaction('samples', 'readonly');
    const rq = tx.objectStore('samples').getAllKeys();
    rq.onsuccess = () => res(rq.result || []); rq.onerror = () => res([]);
  });

  L.init = async () => {
    db = await openDB();
    names = (await idbKeys()).sort();
  };

  L.bufferByName = (name) => decoded.get(name) || null;

  L.linkAsync = async (chan) => {
    if (!chan.sample || chan.sample.buffer || !chan.sample.name) return;
    const buf = await L.decode(chan.sample.name);
    if (buf) { chan.sample.buffer = buf; G.emit('channels'); }
  };

  L.decode = async (name) => {
    if (decoded.has(name)) return decoded.get(name);
    const rec = await idbGet(name);
    if (!rec) return null;
    try {
      await G.audio.init();
      const buf = await G.audio.ctx.decodeAudioData(rec.data.slice(0));
      decoded.set(name, buf);
      return buf;
    } catch (e) {
      console.warn('decode failed', name, e);
      return null;
    }
  };

  const AUDIO_EXT = /\.(wav|mp3|m4a|aac|ogg|oga|flac|aif|aiff|caf)$/i;

  L.addFiles = async (files) => {
    await G.audio.init();
    let ok = 0, fail = 0, failNames = [];
    for (const f of files) {
      if (!AUDIO_EXT.test(f.name)) continue;
      try {
        const data = await f.arrayBuffer();
        let buf = null;
        try { buf = await G.audio.ctx.decodeAudioData(data.slice(0)); }
        catch (e) { fail++; failNames.push(f.name); continue; }
        decoded.set(f.name, buf);
        await idbPut({ name: f.name, data, added: Date.now() });
        if (!names.includes(f.name)) names.push(f.name);
        ok++;
      } catch (e) { fail++; failNames.push(f.name); }
    }
    names.sort();
    renderSamples();
    if (ok) G.toast(`🎵 Imported ${ok} sample${ok > 1 ? 's' : ''} into your library`);
    if (fail) G.toast(`⚠ ${fail} file(s) couldn't be decoded by this browser (${failNames.slice(0, 2).join(', ')}${fail > 2 ? '…' : ''}). Safari decodes .caf/.aif natively — or convert with tools/convert_apple_loops.sh`, 'err');
  };

  // ---------------- UI ----------------
  const render = () => {
    if (!root) return;
    root.innerHTML = '';

    // ===== instruments =====
    const instCol = G.el('div', 'lib-col', root);
    G.el('div', 'lib-title', instCol, '🎛 INSTRUMENT LIBRARY');
    G.el('div', 'dim small', instCol, 'Click a card to hear it · ＋ adds it to your channel rack');

    const cats = G.el('div', 'lib-cats', instCol);
    ['All', ...G.presets.categories].forEach(cat => {
      const b = G.el('button', 'lib-cat' + (catFilter === cat ? ' active' : ''), cats, cat);
      b.addEventListener('click', () => { catFilter = cat; render(); });
    });

    const grid = G.el('div', 'lib-grid', instCol);
    G.presets.instruments
      .filter(p => catFilter === 'All' || p.cat === catFilter)
      .forEach(p => {
        const card = G.el('div', 'lib-card', grid);
        G.el('div', 'lib-card-icon', card, p.icon);
        G.el('div', 'lib-card-name', card, p.name);
        G.el('div', 'lib-card-cat', card, p.cat);
        const addB = G.el('button', 'lib-card-add', card, '＋');
        addB.title = 'Add to channel rack';
        card.addEventListener('click', async () => {
          await G.audio.init();
          const tmp = G.presets.makeChannel(p);
          G.audio.previewPreset(tmp, p.pitch, p.cat === 'Pad' || p.cat === 'FX' ? 1.4 : 0.5);
        });
        addB.addEventListener('click', async (e) => {
          e.stopPropagation();
          await G.audio.init();
          const c = G.presets.makeChannel(p);
          G.undoPush('Add channel');
          c.hue = G.hueFor(G.proj.channels.length);
          G.proj.channels.push(c);
          G.sel.channelId = c.id;
          G.emit('channels');
          G.toast('＋ ' + p.name + ' added to rack');
        });
      });

    // ===== samples =====
    const sampCol = G.el('div', 'lib-col', root);
    G.el('div', 'lib-title', sampCol, '📦 YOUR SAMPLE LIBRARY');
    G.el('div', 'dim small', sampCol, 'GarageBand sounds, Apple Loops, WAV / MP3 / M4A / AIFF — stored in your browser');

    const drop = G.el('div', 'drop-zone', sampCol);
    G.el('div', 'drop-big', drop, '⬇ Drag audio files or folders here');
    const btnRow = G.el('div', 'drop-btns', drop);
    const fileBtn = G.el('button', 'btn subtle', btnRow, 'Choose files…');
    const dirBtn = G.el('button', 'btn subtle', btnRow, 'Import folder…');
    const fileInp = G.el('input', '', drop); fileInp.type = 'file'; fileInp.multiple = true; fileInp.accept = 'audio/*,.wav,.mp3,.m4a,.aif,.aiff,.caf,.ogg,.flac'; fileInp.style.display = 'none';
    const dirInp = G.el('input', '', drop); dirInp.type = 'file'; dirInp.multiple = true; dirInp.webkitdirectory = true; dirInp.style.display = 'none';
    fileBtn.addEventListener('click', () => fileInp.click());
    dirBtn.addEventListener('click', () => dirInp.click());
    fileInp.addEventListener('change', () => L.addFiles([...fileInp.files]));
    dirInp.addEventListener('change', () => L.addFiles([...dirInp.files]));
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', async (e) => {
      e.preventDefault(); drop.classList.remove('over');
      const files = [];
      const walk = async (entry, depth) => {
        if (depth > 6) return;
        if (entry.isFile) {
          await new Promise(res => entry.file(f => { files.push(f); res(); }, res));
        } else if (entry.isDirectory) {
          const rd = entry.createReader();
          await new Promise(res => {
            const readAll = () => rd.readEntries(async (es) => {
              if (!es.length) return res();
              for (const en of es) await walk(en, depth + 1);
              readAll();
            }, res);
            readAll();
          });
        }
      };
      if (e.dataTransfer.items && e.dataTransfer.items[0] && e.dataTransfer.items[0].webkitGetAsEntry) {
        for (const item of [...e.dataTransfer.items]) {
          const en = item.webkitGetAsEntry();
          if (en) await walk(en, 0);
        }
      } else {
        files.push(...e.dataTransfer.files);
      }
      L.addFiles(files);
    });

    const gbHelp = G.el('details', 'gb-help', sampCol);
    G.el('summary', '', gbHelp, '🍎 Where are my GarageBand sounds?');
    const gbBody = G.el('div', '', gbHelp);
    gbBody.innerHTML = `
      <p>GarageBand scatters its sounds across several places on your Mac — including inside the app itself.
      Open Finder, press <b>⌘⇧G</b> and paste any of:</p>
      <ul>
        <li><code>/Applications/GarageBand.app/Contents</code> — inside the app bundle (right-click GarageBand → Show Package Contents)</li>
        <li><code>/Library/Audio/Apple Loops/Apple</code> — the big Apple Loops collection</li>
        <li><code>/Library/Application Support/GarageBand</code> — the Instrument Library (sampler one-shots, drum kits)</li>
        <li><code>/Library/Application Support/Logic</code> — shared sound content</li>
        <li><code>~/Library/Audio/Apple Loops/User Loops</code> — loops you saved yourself</li>
      </ul>
      <p>Drag files or whole folders into the drop zone above. <b>Safari decodes .caf and .aif natively.</b></p>
      <p>Easiest of all: <b>double-click “Harvest GarageBand Sounds.command”</b> (next to this app — first time:
      right-click it → Open → Open). It scans <b>all</b> of those locations automatically, converts everything
      to WAV, and opens the result — <code>~/Desktop/Music GenEngine/GarageBand Sounds</code> — in Finder.
      Then use “Import folder…” above and pick that folder.</p>`;

    sampleListEl = G.el('div', 'sample-list', sampCol);
    renderSamples();
  };

  const renderSamples = async () => {
    if (!sampleListEl) return;
    sampleListEl.innerHTML = '';
    if (!names.length) {
      G.el('div', 'fx-empty', sampleListEl, 'No samples yet — drop some in!');
      return;
    }
    names.forEach(name => {
      const row = G.el('div', 'sample-row', sampleListEl);
      const play = G.el('button', 'mini-btn play', row, '▶');
      const nm = G.el('span', 'sample-name', row, name);
      const buf = decoded.get(name);
      if (buf) G.el('span', 'sample-dur', row, buf.duration.toFixed(2) + 's');
      const add = G.el('button', 'mini-btn', row, '＋ rack');
      const del = G.el('button', 'mini-btn danger', row, '✕');
      play.addEventListener('click', async () => {
        await G.audio.init();
        if (previewSrc) { try { previewSrc.stop(); } catch (e) {} previewSrc = null; }
        const b = await L.decode(name);
        if (b) previewSrc = G.audio.previewBuffer(b);
        else G.toast('Could not decode ' + name, 'err');
      });
      add.addEventListener('click', async () => {
        await G.audio.init();
        const b = await L.decode(name);
        if (!b) { G.toast('Could not decode ' + name, 'err'); return; }
        G.undoPush('Add sampler');
        const c = G.newChannel({ kind: 'sampler', name: name.replace(/\.[^.]+$/, '').slice(0, 22) });
        c.sample = { name, buffer: b };
        c.hue = G.hueFor(G.proj.channels.length);
        G.proj.channels.push(c);
        G.sel.channelId = c.id;
        G.emit('channels');
        G.toast('＋ Sampler channel: ' + c.name);
      });
      del.addEventListener('click', async () => {
        await idbDel(name);
        decoded.delete(name);
        names = names.filter(n => n !== name);
        renderSamples();
      });
    });
  };

  V.library = {
    mount(el) { root = el; render(); },
    refresh: render,
    tick() {},
  };

})(window.G);
