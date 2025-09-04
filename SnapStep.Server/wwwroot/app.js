(function () {
    const blocksEl = document.getElementById('blocks');
    const btnMd = document.getElementById('btnExportMd');   // Export Markdown (ZIP)
    const btnPrint = document.getElementById('btnPrint');
    const sessionLabel = document.getElementById('sessionLabel');

    // ---- Session id parsing (supports /session/<id> and ?id=<id>) ----
    const sessionId = (function parseSessionId() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf('session');
        if (idx >= 0 && parts.length > idx + 1) return parts[idx + 1];
        const url = new URL(window.location.href);
        return url.searchParams.get('id') || 'dev';
    })();

    sessionLabel.textContent = `Session: ${sessionId}`;

    // ---- State ----
    let state = { images: [], notes: {} };

    // ---- Load session from server ----
    async function loadSession() {
        const res = await fetch(`/api/session/${sessionId}`);
        if (!res.ok) {
            blocksEl.innerHTML = `<li>Session not found.</li>`;
            return;
        }
        const data = await res.json();
        state.images = data.images || [];
        try {
            if (data.doc) {
                const parsed = JSON.parse(data.doc);
                state.notes = parsed.notes || {};
                // Respect saved order if present (and only keep known images)
                if (Array.isArray(parsed.order) && parsed.order.length) {
                    const set = new Set(state.images);
                    state.images = parsed.order.filter(p => set.has(p));
                }
            }
        } catch { /* ignore malformed doc */ }
        render();
    }

    // ---- Render blocks ----
    function render() {
        blocksEl.innerHTML = '';
        state.images.forEach((src, i) => {
            const li = document.createElement('li');
            li.className = 'block';
            li.dataset.image = src;

            const note = document.createElement('div');
            note.className = 'note';
            note.contentEditable = 'true';
            note.placeholder = 'Write notes here…';
            note.textContent = state.notes[src] || '';
            note.addEventListener('input', () => {
                state.notes[src] = note.textContent;
                queueSave();
            });

            const img = new Image();
            img.src = src;
            img.alt = `Capture ${i + 1}`;

            li.appendChild(note);
            li.appendChild(img);
            blocksEl.appendChild(li);
        });

        new Sortable(blocksEl, {
            animation: 150,
            ghostClass: 'drag-ghost',
            chosenClass: 'drag-chosen',
            onSort: () => {
                state.images = Array.from(blocksEl.querySelectorAll('.block')).map(
                    li => li.dataset.image
                );
                queueSave();
            }
        });
    }

    // ---- Save doc (notes + order) with debounce ----
    let saveTimer = null;
    function queueSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveDoc, 400);
    }

    async function saveDoc() {
        const doc = { notes: state.notes, order: state.images };
        await fetch(`/api/session/${sessionId}/doc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doc)
        });
    }

    // ---------- Export: Markdown + images in a ZIP (portable anywhere) ----------
    async function exportZipMarkdown() {
        if (typeof JSZip === 'undefined' || typeof saveAs === 'undefined') {
            alert('ZIP export libraries not loaded. Include JSZip and FileSaver in index.html.');
            return;
        }

        const zip = new JSZip();

        const md = [];
        md.push(`# SnapStep — ${sessionId}`);
        md.push('');
        md.push(`_Exported: ${new Date().toLocaleString()}_`);
        md.push('');

        // use the rendered order
        const blocks = Array.from(document.querySelectorAll('.block'));
        let index = 1;
        for (const block of blocks) {
            const src = block.dataset.image;
            const note = (state.notes[src] || '').trim();
            const imgEl = block.querySelector('img');
            if (!imgEl) continue;

            // fetch the actual file from our local server
            const resp = await fetch(imgEl.src, { cache: 'no-store' });
            if (!resp.ok) continue;
            const blob = await resp.blob();

            const ext = (blob.type && blob.type.split('/')[1]) || 'png';
            const fname = `images/${String(index).padStart(4, '0')}.${ext}`;
            zip.file(fname, blob);

            if (note) {
                md.push(note);
                md.push('');
            }
            md.push(`![capture ${index}](${fname})`);
            md.push('');
            index++;
        }

        // Use README.md; change to 'index.md' if your importer prefers it
        zip.file('README.md', md.join('\n'));

        const out = await zip.generateAsync({ type: 'blob' });
        saveAs(out, `snapstep_${sessionId}.zip`);
    }

    btnMd.addEventListener('click', () => {
        exportZipMarkdown().catch(err => {
            console.error('Export failed:', err);
            alert('Export failed. See console for details.');
        });
    });

    // ---------- Print (smart gentle shrink, single-column, no logo) ----------
    btnPrint.addEventListener('click', () => {
        // A4 with 10mm margins ≈ 277mm printable height = ~1048 CSS px at 96dpi
        const PAGE_HEIGHT = 1048; // px
        const GAP = 96 * 0.1;     // ~10mm spacing

        const blocks = Array.from(document.querySelectorAll('.block'));
        blocks.forEach(b => (b.style.transform = ''));

        let y = 0;
        for (const b of blocks) {
            const rect = b.getBoundingClientRect();
            const h = rect.height;

            const usedOnPage = y % PAGE_HEIGHT;
            const remaining = PAGE_HEIGHT - usedOnPage;

            if (h + GAP > remaining) {
                // If it nearly fits (>= 85% of remaining), scale it down to fit.
                const scale = (remaining - GAP) / h;
                if (scale > 0.85 && scale < 1.0) {
                    b.style.transform = `scale(${scale})`;
                    y += h * scale + GAP;
                    continue;
                }
                // Otherwise, push to next page
                y += remaining + h + GAP;
                continue;
            }

            // Fits as-is
            y += h + GAP;
        }

        window.print();

        // Clean up transforms after the print dialog closes
        setTimeout(() => blocks.forEach(b => (b.style.transform = '')), 500);
    });

    // ---- go! ----
    loadSession();
})();
