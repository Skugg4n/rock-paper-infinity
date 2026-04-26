import { PHASE1_CONSTANTS, PHASE2_CONSTANTS, PHASE_KEY } from './constants.js';

const EXPORT_SCHEMA_VERSION = 1;

/**
 * Serializes all save-related localStorage keys into a single base64 string.
 * The exported string is self-describing (includes a schema version and
 * timestamp) so future migrations are possible.
 *
 * @returns {string} Base64-encoded export blob
 */
export function exportSave() {
    const phase1 = localStorage.getItem(PHASE1_CONSTANTS.SAVE_KEY) || '';
    const phase2 = localStorage.getItem(PHASE2_CONSTANTS.SAVE_KEY) || '';
    const stars  = localStorage.getItem(PHASE2_CONSTANTS.STARS_TRANSFER_KEY) || '';
    const phase  = localStorage.getItem(PHASE_KEY) || '';
    const blob = JSON.stringify({
        schemaVersion: EXPORT_SCHEMA_VERSION,
        phase1,
        phase2,
        stars,
        phase,
        timestamp: Date.now(),
    });
    return btoa(blob);
}

/**
 * Parses and validates an export string produced by exportSave(), then
 * writes the contained saves back to localStorage. Callers should reload
 * the page after a successful import.
 *
 * @param {string} encoded - Base64 export string from exportSave()
 * @returns {{ ok: boolean, error?: string }}
 */
export function importSave(encoded) {
    if (!encoded || typeof encoded !== 'string') {
        return { ok: false, error: 'Empty or invalid export string' };
    }
    let blob;
    try {
        blob = JSON.parse(atob(encoded.trim()));
    } catch {
        return { ok: false, error: 'Invalid save string — could not decode' };
    }
    if (!blob || typeof blob !== 'object') {
        return { ok: false, error: 'Invalid save format' };
    }
    if (typeof blob.schemaVersion !== 'number' || blob.schemaVersion > EXPORT_SCHEMA_VERSION) {
        return { ok: false, error: `Unrecognised save format (version ${blob.schemaVersion})` };
    }

    // Apply each field — only write keys that were present (non-empty) in the export.
    if (blob.phase1) {
        localStorage.setItem(PHASE1_CONSTANTS.SAVE_KEY, blob.phase1);
    } else {
        localStorage.removeItem(PHASE1_CONSTANTS.SAVE_KEY);
    }
    if (blob.phase2) {
        localStorage.setItem(PHASE2_CONSTANTS.SAVE_KEY, blob.phase2);
    } else {
        localStorage.removeItem(PHASE2_CONSTANTS.SAVE_KEY);
    }
    if (blob.stars) {
        localStorage.setItem(PHASE2_CONSTANTS.STARS_TRANSFER_KEY, blob.stars);
    } else {
        localStorage.removeItem(PHASE2_CONSTANTS.STARS_TRANSFER_KEY);
    }
    if (blob.phase) {
        localStorage.setItem(PHASE_KEY, blob.phase);
    } else {
        localStorage.removeItem(PHASE_KEY);
    }

    return { ok: true };
}

/**
 * Wires export/import buttons into a debug menu element.
 *
 * Creates two buttons:
 *  - Export: encodes the save and copies to clipboard (falls back to textarea).
 *  - Import: prompts for a paste or shows a textarea, then reloads on success.
 *
 * @param {HTMLElement} menuEl - The debug menu container element
 */
export function mountSaveButtons(menuEl) {
    if (!menuEl) return;
    if (menuEl.querySelector('.save-export-btn')) return; // already mounted

    const group = document.createElement('div');
    group.className = 'save-io-group';
    group.style.cssText = 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'save-export-btn';
    exportBtn.textContent = 'Export save';
    exportBtn.style.cssText = 'font-size:11px;padding:3px 8px;cursor:pointer;';

    const importBtn = document.createElement('button');
    importBtn.className = 'save-import-btn';
    importBtn.textContent = 'Import save';
    importBtn.style.cssText = 'font-size:11px;padding:3px 8px;cursor:pointer;';

    const feedback = document.createElement('span');
    feedback.style.cssText = 'font-size:11px;color:#64748b;align-self:center;';

    exportBtn.addEventListener('click', async () => {
        const encoded = exportSave();
        feedback.textContent = '';
        try {
            await navigator.clipboard.writeText(encoded);
            feedback.textContent = 'Copied!';
        } catch {
            // Clipboard not available — show a textarea for manual copy
            showCopyTextarea(group, encoded, feedback);
            return;
        }
        setTimeout(() => { feedback.textContent = ''; }, 2000);
    });

    importBtn.addEventListener('click', () => {
        showImportTextarea(group, feedback);
    });

    group.appendChild(exportBtn);
    group.appendChild(importBtn);
    group.appendChild(feedback);
    menuEl.appendChild(group);
}

function showCopyTextarea(container, text, feedbackEl) {
    let ta = container.querySelector('.save-io-textarea');
    if (!ta) {
        ta = document.createElement('textarea');
        ta.className = 'save-io-textarea';
        ta.rows = 3;
        ta.style.cssText = 'width:100%;font-size:10px;margin-top:6px;resize:vertical;';
        ta.readOnly = true;
        container.appendChild(ta);
    }
    ta.value = text;
    ta.style.display = 'block';
    ta.select();
    feedbackEl.textContent = 'Copy the text above';
}

function showImportTextarea(container, feedbackEl) {
    let ta = container.querySelector('.save-import-textarea');
    if (!ta) {
        ta = document.createElement('textarea');
        ta.className = 'save-import-textarea';
        ta.placeholder = 'Paste export string here…';
        ta.rows = 3;
        ta.style.cssText = 'width:100%;font-size:10px;margin-top:6px;resize:vertical;';

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Load & reload';
        confirmBtn.style.cssText = 'font-size:11px;padding:3px 8px;cursor:pointer;margin-top:4px;';
        confirmBtn.addEventListener('click', () => {
            const result = importSave(ta.value);
            if (result.ok) {
                feedbackEl.textContent = 'Loaded — reloading…';
                setTimeout(() => location.reload(), 300);
            } else {
                feedbackEl.textContent = result.error || 'Import failed';
            }
        });

        container.appendChild(ta);
        container.appendChild(confirmBtn);
    }
    ta.style.display = 'block';
    ta.nextSibling.style.display = 'block';
    ta.focus();
}
