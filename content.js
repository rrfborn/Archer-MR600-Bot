// --- 🤖 MR600-Bot v1.2 (Session Keep-Alive & Robust Clean) ---

// 1. Core Configuration
let CONFIG = {
    targets: ["80%", "100%"],
    replyNum: "1266",
    replyMsg: "NL2000 AAN",
    autoClean: true,
    paused: false,
    // Agressiever interval van 15 seconden om inactiviteit te voorkomen
    checkInterval: 45000 
};

let laatsteBerichtID = ""; 
let smsVerstuurdTeller = 0; 
let isCleaning = false;
let isBusy = false; // general-purpose lock to prevent overlapping actions
let monitorIntervalId = null;
let errorCount = 0; // number of error entries logged to the Error monitor
// Selector map and cached nodes
const SELECTORS = {
    inboxBody: '#tableSmsInboxBody',
    outboxBody: '#tableSmsOutboxBody',
    refreshBtn: '#staticRefresh',
    deleteBtn: '#staticDelete',
    allCheckbox: 'th .tp-checkbox-wrapper',
    menuSpans: 'span.text.T, span.text',
    sendBtn: '#send',
    newMessageText: 'New Message'
};

const _cache = {};
function getNode(key) {
    const sel = SELECTORS[key];
    if (!sel) return null;
    const el = document.querySelector(sel);
    _cache[key] = el;
    return el;
}

// Simple async task queue to prevent overlap
const taskQueue = [];
let queueRunning = false;
function enqueueTask(fn) {
    return new Promise((resolve) => {
        // wrap the provided function so the queue can call it and we resolve when done
        taskQueue.push(async () => {
            try { await fn(); } catch (e) { log('Queue task error: ' + e); }
            resolve();
        });
        if (!queueRunning) runQueue();
    });
}
async function runQueue() {
    queueRunning = true;
    while (taskQueue.length) {
        const task = taskQueue.shift();
        try { await task(); } catch (e) { log('Queue task error: ' + e); }
    }
    queueRunning = false;
}

// UI log helper (small panel in injected UI)
function logToUI(msg) {
    try {
        const type = (arguments.length>1 && arguments[1]) ? arguments[1] : 'am';
        const amEl = document.getElementById('mr600-ui-am-log');
        const errEl = document.getElementById('mr600-ui-error-log');
        const target = (type === 'error' ? errEl : amEl) || document.getElementById('mr600-ui-log');
        if (!target) return;
        const now = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.textContent = `${now} ${msg}`;
        target.appendChild(line);
        while (target.children.length > 200) target.removeChild(target.firstChild);
        // track error count in-memory for quick checks
        try { if (type === 'error') errorCount = (errorCount||0) + 1; } catch(e){}
    } catch(e) {}
}

// Small transient popup near the toggle button
function showTempPopup(text, timeout = 1800) {
    try {
        let existing = document.getElementById('mr600-temp-popup');
        if (existing) existing.remove();
        const btn = document.getElementById('mr600-ui-toggle') || document.body;
        const popup = document.createElement('div');
        popup.id = 'mr600-temp-popup';
        popup.textContent = text;
        popup.style.position = 'fixed';
        popup.style.zIndex = 10002;
        popup.style.background = '#00a1e1';
        popup.style.color = '#fff';
        popup.style.padding = '8px 10px';
        popup.style.borderRadius = '6px';
        popup.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
        // position relative to toggle button (centered)
        if (btn && btn.getBoundingClientRect) {
            const rect = btn.getBoundingClientRect();
            popup.style.left = (rect.left + rect.width/2) + 'px';
            popup.style.top = (rect.bottom + 8) + 'px';
            popup.style.transform = 'translateX(-50%)';
        } else {
            popup.style.right = '20px';
            popup.style.top = '80px';
        }
        document.body.appendChild(popup);
        setTimeout(() => { try { popup.remove(); } catch(e){} }, timeout);
    } catch(e){}
}

// Scan page/modals for textual error messages to include in error log
function findPageErrors() {
    try {
        const modalSelectors = ['.msg-container-wrapper', '.tp-msgbox', '.tp-msgbox-wrapper', '.msgbox', '.ui-dialog', '.modal', '.modal-dialog', '.tp-dialog', '.layer', '.grid-warning-msg', '.grid-popup-msg'];
        const found = [];
        for (const sel of modalSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                const txt = (el.innerText||el.textContent||'').trim();
                if (txt) found.push(txt);
            }
            const list = Array.from(document.querySelectorAll(sel));
            for (const li of list) {
                const t = (li.innerText||li.textContent||'').trim(); if (t) found.push(t);
            }
        }
        // also scan for any .grid-warning-msg elements
        const warnings = Array.from(document.querySelectorAll('.grid-warning-msg, .grid-popup-msg, .msg-container, .alert-container-complex-msg'));
        for (const w of warnings) { const t=(w.innerText||w.textContent||'').trim(); if (t) found.push(t); }
        // dedupe
        return Array.from(new Set(found)).slice(0,10);
    } catch(e) { return []; }
}
// Verhoog de threshold voor opschonen iets, zodat we de UI minder vaak storen.
const CLEANUP_THRESHOLD = 10; 

function log(msg) {
    console.log(`[MR600-BOT] ${new Date().toLocaleTimeString()}: ${msg}`);
}

// Helper functie voor asynchrone waits
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 2. Instellingen laden
function loadSettings() {
    const saved = localStorage.getItem('mr600_config');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            CONFIG = {...CONFIG, ...parsed};
        } catch(e) { log("Error loading config: " + e); }
    }
    // If UI injected, update its controls to reflect loaded settings
    try { if (document.getElementById('mr600-ui-box')) updateInjectedUI(); } catch(e) {}
}

// Sync injected UI controls with `CONFIG`
function updateInjectedUI() {
    const p = document.getElementById('ui-pause');
    const c = document.getElementById('ui-clean');
    if (p) {
        p.checked = !!CONFIG.paused;
        // also toggle a visual class on parent to help pages that style checkboxes via labels
        try { if (p.parentElement) p.parentElement.classList.toggle('mr600-checked', !!CONFIG.paused); } catch(e) {}
        try {
            const lbl = document.querySelector('label[for="ui-pause"]');
            if (lbl) { lbl.style.color = CONFIG.paused ? '#00a1e1' : '#333'; lbl.style.fontWeight = CONFIG.paused ? '700' : '400'; }
        } catch(e) {}
    }
    if (c) {
        c.checked = !!CONFIG.autoClean;
        try { if (c.parentElement) c.parentElement.classList.toggle('mr600-checked', !!CONFIG.autoClean); } catch(e) {}
        try {
            const lbl2 = document.querySelector('label[for="ui-clean"]');
            if (lbl2) { lbl2.style.color = CONFIG.autoClean ? '#00a1e1' : '#333'; lbl2.style.fontWeight = CONFIG.autoClean ? '700' : '400'; }
        } catch(e) {}
    }
}

// 3. De Universele Hover UI injecteren
function injectInterface() {
    if (document.getElementById('mr600-ui-box')) return;
    loadSettings();

    const ui = document.createElement('div');
    ui.id = 'mr600-ui-box';
    ui.innerHTML = `
        <div id="mr600-ui-main" style="position:fixed; top:70px; right:80px; z-index:9999; background:white; border:2px solid #00a1e1; padding:0; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.3); width:220px; font-family:Arial; color:#333; overflow:hidden; touch-action:none;">
            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:#fff; border-bottom:1px solid #e6f5ff;">
                <div style="display:flex; gap:8px; align-items:center;">
                    <span style="font-size:18px;">🤖</span>
                    <strong style="color:#00a1e1; font-size:13px;">MR600-Bot v1.2</strong>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button id="ui-run-clean" style="background:#ffc107; border:none; padding:4px 6px; border-radius:4px; cursor:pointer; font-size:12px;">Clean</button>
                        <button id="ui-open-error" title="Show Errors" style="background:transparent; border:none; font-size:14px; padding:2px 6px; cursor:pointer; color:#c11c66;">!</button>
                </div>
            </div>
            <div id="mr600-ui-content" style="padding:12px;">
                <label style="font-size:11px; font-weight:bold;">Trigger tekst (comma sep.):</label>
                <input type="text" id="ui-targets" value="${Array.isArray(CONFIG.targets) ? CONFIG.targets.join(', ') : CONFIG.targets}" style="width:100%; margin:5px 0 10px 0; padding:4px; border:1px solid #ccc; border-radius:4px;">

                <label style="font-size:11px; font-weight:bold;">Antwoord naar & bericht:</label>
                <input type="text" id="ui-num" value="${CONFIG.replyNum}" style="width:100%; margin:5px 0 5px 0; padding:4px; border:1px solid #ccc; border-radius:4px;">
                <input type="text" id="ui-msg" value="${CONFIG.replyMsg}" style="width:100%; margin:0 0 10px 0; padding:4px; border:1px solid #ccc; border-radius:4px;">

                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <input type="checkbox" id="ui-clean" ${CONFIG.autoClean ? 'checked' : ''} style="cursor:pointer;">
                    <label for="ui-clean" style="font-size:11px; cursor:pointer;">Auto-wipe Inbox/Outbox</label>
                </div>

                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                    <input type="checkbox" id="ui-pause" ${CONFIG.paused ? 'checked' : ''} style="cursor:pointer;">
                    <label for="ui-pause" style="font-size:11px; cursor:pointer;">Pause Bot</label>
                </div>

                <button id="ui-save" style="width:100%; background:#00a1e1; color:white; border:none; padding:10px; border-radius:4px; cursor:pointer; font-weight:bold;">Save</button>
                <p id="ui-status" style="font-size:10px; color:green; margin-top:8px; display:none; text-align:center;">✅ Settings updated</p>
                <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
                    <button id="ui-check-counts" style="background:#eee; border:1px solid #ccc; padding:6px 8px; border-radius:4px; cursor:pointer; font-size:12px;">🔎</button>
                    <div id="ui-counts" style="font-size:11px; min-width:120px; text-align:right;">Inbox: -  Outbox: -</div>
                </div>

                <!-- AM Monitor (can be hidden) -->
                <div id="mr600-am-wrap" style="margin-top:8px; border-top:1px dashed #eee; padding-top:6px;">
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <strong style="font-size:12px;">AM Monitor</strong>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button id="ui-am-toggle" title="Hide/Show AM Monitor" style="background:transparent;border:0;cursor:pointer;font-size:12px;">▾</button>
                        </div>
                    </div>
                    <div id="mr600-ui-am-log" style="max-height:120px; overflow:auto; font-size:11px; margin-top:6px; color:#444"></div>
                </div>

                <!-- Error Monitor (can be hidden) -->
                <div id="mr600-error-wrap" style="margin-top:8px; border-top:1px dashed #fee; padding-top:6px; display:none; background:#fff8f8;">
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <strong style="font-size:12px; color:#c11c66;">Errors</strong>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button id="ui-error-toggle" title="Hide/Show Error Monitor" style="background:transparent;border:0;cursor:pointer;font-size:12px;">▾</button>
                        </div>
                    </div>
                    <div id="mr600-ui-error-log" style="max-height:120px; overflow:auto; font-size:11px; margin-top:6px; color:#c11c66"></div>
                </div>
            </div>
        </div>
        <button id="mr600-ui-toggle" title="MR600-Bot" style="position:fixed; top:80px; right:20px; z-index:10001; width:40px; height:40px; border-radius:50%; border:2px solid #00a1e1; background:#fff; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.2);">🤖</button>
    `;
    document.body.appendChild(ui);

    // Make the UI draggable by its header area
    (function makeDraggable(){
        const main = document.getElementById('mr600-ui-main');
        const header = main && main.querySelector('div');
        if (!main || !header) return;
        let dragging = false, startX=0, startY=0, origX=0, origY=0;
        header.style.cursor = 'move';
        header.addEventListener('pointerdown', (ev) => {
            dragging = true; startX = ev.clientX; startY = ev.clientY;
            const rect = main.getBoundingClientRect(); origX = rect.right; origY = rect.top; // use right for easier pin
            main.setPointerCapture && main.setPointerCapture(ev.pointerId);
        });
        document.addEventListener('pointermove', (ev) => {
            if (!dragging) return;
            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
            // adjust right/top to move
            main.style.right = (window.innerWidth - (origX + dx)) + 'px';
            main.style.top = (origY + dy) + 'px';
        });
        document.addEventListener('pointerup', (ev) => { dragging = false; });
    })();

    // Toggle button behaviour: hide/show the main UI
    const toggleBtn = document.getElementById('mr600-ui-toggle');
    const mainBox = document.getElementById('mr600-ui-main');
    toggleBtn.onclick = function(){
        if (!mainBox) return;
        if (mainBox.style.display === 'none') { mainBox.style.display = 'block'; this.style.opacity = '1'; }
        else { mainBox.style.display = 'none'; this.style.opacity = '0.9'; }
    };

    // AM monitor toggle wiring
    const amToggle = document.getElementById('ui-am-toggle');
    const amWrap = document.getElementById('mr600-am-wrap');
    const amLog = document.getElementById('mr600-ui-am-log');
    if (amToggle && amWrap) amToggle.onclick = function() {
        if (amLog.style.display === 'none' || amLog.style.display === '') { amLog.style.display = 'block'; this.innerText='▾'; }
        else { amLog.style.display = 'none'; this.innerText='▸'; }
    };

    // Error monitor toggle wiring
    const errToggle = document.getElementById('ui-error-toggle');
    const errWrap = document.getElementById('mr600-error-wrap');
    const errLog = document.getElementById('mr600-ui-error-log');
    if (errToggle && errWrap) errToggle.onclick = function() {
        if (errWrap.style.display === 'none' || errWrap.style.display === '') { errWrap.style.display = 'block'; this.innerText='▾'; }
        else { errWrap.style.display = 'none'; this.innerText='▸'; }
    };

    // Small UX: clicking the toggle button should show the AM monitor by default
    try { if (amLog) { amLog.style.display = 'block'; } } catch(e) {}

    // Capture console.error and window errors into the error monitor
    try {
        const origConsoleError = console.error.bind(console);
        console.error = function() {
            try { logToUI('[console] '+ Array.from(arguments).join(' '), 'console'); } catch(e){}
            origConsoleError.apply(console, arguments);
        };
        window.addEventListener('error', function(ev) {
            try { logToUI((ev && ev.message) ? ev.message : String(ev), 'error'); } catch(e){}
        });
        window.addEventListener('unhandledrejection', function(ev) {
            try { logToUI('UnhandledRejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)), 'error'); } catch(e){}
        });
    } catch(e) {}

    // Quick open Errors button (small header button)
    const openErrBtn = document.getElementById('ui-open-error');
    if (openErrBtn) {
        try {
            // Ensure visible and clickable even if overlays exist
            openErrBtn.style.zIndex = '10005';
            openErrBtn.style.position = openErrBtn.style.position || 'relative';
            openErrBtn.style.pointerEvents = 'auto';
        } catch(e){}

        const openErrHandler = function(ev) {
            try {
                const errWrap = document.getElementById('mr600-error-wrap');
                const errLog = document.getElementById('mr600-ui-error-log');
                if (errWrap) {
                    errWrap.style.display = 'block';
                    // also bring the main UI into view
                    const mainBox = document.getElementById('mr600-ui-main'); if (mainBox) mainBox.style.display = 'block';
                }
                if (errLog) {
                    // compute if there are meaningful error entries (ignore our markers)
                    const meaningful = Array.from(errLog.children).filter(ch => {
                        const t = (ch.innerText||'').trim();
                        if (!t) return false;
                        if (/Opened Errors|Everything looking good!/i.test(t)) return false;
                        return true;
                    });
                    if ((!errorCount || errorCount === 0) && meaningful.length === 0) {
                        showTempPopup('Everything looking good!');
                        return;
                    }
                    // mark with a quick highlight
                    const hl = document.createElement('div'); hl.textContent = new Date().toLocaleTimeString() + ' Opened Errors'; hl.style.fontWeight='700'; errLog.insertBefore(hl, errLog.firstChild);
                }
            } catch(e) { log('Open error panel failed: '+e); }
        };

        // attach both click and pointerdown for robustness
        openErrBtn.addEventListener('click', openErrHandler);
        openErrBtn.addEventListener('pointerdown', openErrHandler);

        // document-level fallback: if a click occurs at the button position but the button didn't receive it
        document.addEventListener('click', function docFallback(ev){
            try {
                const target = ev.target;
                if (!target) return;
                const hit = target.closest && target.closest('#ui-open-error');
                if (hit) return; // button already handled
                // check if event occurred inside the button bounding rect
                const rect = openErrBtn.getBoundingClientRect();
                if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
                    // synthesize handler
                    openErrHandler.call(openErrBtn, ev);
                }
            } catch(e){}
        });
    }

    // Run clean now button (robust attach: click + pointerdown + fallback observer)
    const runCleanBtn = document.getElementById('ui-run-clean');
    const _attachRunClean = (btn) => {
        if (!btn) return;
        const runCleanHandler = function() {
            if (isBusy || isCleaning) {
                log('Busy: another operation is running. Skipping manual clean.');
                logToUI('Manual clean skipped - busy');
                return;
            }
            log('Manual clean triggered from UI.');
            logToUI('Manual clean triggered');
            enqueueTask(startGroteSchoonmaak);
        };
        try { btn.style.pointerEvents = btn.style.pointerEvents || 'auto'; } catch(e){}
        btn.removeEventListener('click', runCleanHandler);
        btn.removeEventListener('pointerdown', runCleanHandler);
        btn.addEventListener('click', runCleanHandler);
        btn.addEventListener('pointerdown', runCleanHandler);
    };

    if (runCleanBtn) {
        _attachRunClean(runCleanBtn);
    } else {
        // If the UI was injected before the element existed, observe and attach when it appears
        const attachObs = new MutationObserver((mutations, obs) => {
            const btn = document.getElementById('ui-run-clean');
            if (btn) { _attachRunClean(btn); obs.disconnect(); }
        });
        try { attachObs.observe(document.body, { childList: true, subtree: true }); } catch(e) { /* ignore */ }
    }

    const saveBtn = document.getElementById('ui-save');
    if (saveBtn) saveBtn.onclick = function() {
        const newConfig = {
            targets: document.getElementById('ui-targets').value.split(',').map(t => t.trim()),
            replyNum: document.getElementById('ui-num').value,
            replyMsg: document.getElementById('ui-msg').value,
            autoClean: document.getElementById('ui-clean').checked,
            paused: document.getElementById('ui-pause').checked,
            checkInterval: CONFIG.checkInterval
        };
        // apply immediately without reloading
        CONFIG = {...CONFIG, ...newConfig};
        saveSettings();
        updateInjectedUI();
        this.style.background = "#28a745";
        const statusEl = document.getElementById('ui-status'); if (statusEl) { statusEl.style.display = 'block'; setTimeout(()=>statusEl.style.display='none',2500); }
        log("Configuratie bijgewerkt (no reload). Restarting monitor loop...");
        // restart scheduler with new value
        try { scheduleNextRun(); } catch(e){}
    };

    // Check counts button wiring
    const runCheckBtn = document.getElementById('ui-check-counts');
    const countsEl = document.getElementById('ui-counts');
    if (runCheckBtn && countsEl) runCheckBtn.onclick = async function() {
        countsEl.innerText = 'Checking...';
        try {
            const counts = await verifyClean();
            countsEl.innerText = `Inbox: ${counts.inbox}  Outbox: ${counts.outbox}`;
            logToUI(`Counts checked: Inbox ${counts.inbox}, Outbox ${counts.outbox}`);
        } catch(e) { countsEl.innerText = 'Error'; logToUI('Counts check error'); }
    };

    // Immediate handlers so toggles take effect without Save & Restart
    const pauseCheckbox = document.getElementById('ui-pause');
    const cleanCheckbox = document.getElementById('ui-clean');
    if (pauseCheckbox) pauseCheckbox.addEventListener('change', () => {
        CONFIG.paused = !!pauseCheckbox.checked;
        saveSettings();
        updateInjectedUI();
        log(`Pause toggled -> ${CONFIG.paused}`);
    });
    if (cleanCheckbox) cleanCheckbox.addEventListener('change', () => {
        CONFIG.autoClean = !!cleanCheckbox.checked;
        saveSettings();
        updateInjectedUI();
        log(`Auto-clean toggled -> ${CONFIG.autoClean}`);
    });

    // MutationObserver: watch inbox table for new messages and trigger processing
    try {
        const inboxBody = document.querySelector(SELECTORS.inboxBody);
        if (inboxBody) {
            const obs = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.addedNodes && m.addedNodes.length) {
                        logToUI('Inbox changed (mutation)');
                        enqueueTask(async () => { verwerkBerichten(); });
                        break;
                    }
                }
            });
            obs.observe(inboxBody, { childList: true, subtree: false });
        }
    } catch(e) {}
}

// --- ⚙️ Kernfunctionaliteit ---

function klikMenuText(txt) {
    if (!txt) return false;
    const wanted = txt.trim().toLowerCase();
    // try common menu span selectors
    const spanCandidates = Array.from(document.querySelectorAll('span.text.T, span.text'));
    let target = spanCandidates.find(s => (s.innerText || '').trim().toLowerCase() === wanted);
    if (!target) target = spanCandidates.find(s => (s.innerText || '').trim().toLowerCase().includes(wanted));

    // fallback to anchors with span.text inside
    if (!target) {
        const anchors = Array.from(document.querySelectorAll('#menu a, a'));
        for (const a of anchors) {
            const span = a.querySelector('span.text');
            if (span && ((span.innerText||'').trim().toLowerCase() === wanted || (span.innerText||'').trim().toLowerCase().includes(wanted))) {
                target = span; break;
            }
        }
    }

    if (target) { try { target.click(); } catch(e) { target.dispatchEvent(new MouseEvent('click', { bubbles:true })); } return true; }
    return false;
}

function saveSettings(cfg) {
    try { localStorage.setItem('mr600_config', JSON.stringify(cfg || CONFIG)); } catch(e) { log('saveSettings failed: '+e); }
}

// Robust confirmation click helper: searches modals and tries multiple attributes/text
function clickConfirmPopup(timeoutMs = 8000) {
    return new Promise(async (resolve) => {
        const modalSelectors = ['.msg-container-wrapper', '.tp-msgbox', '.tp-msgbox-wrapper', '.msgbox', '.ui-dialog', '.modal', '.modal-dialog', '.tp-dialog', '.layer'];
        const end = Date.now() + timeoutMs;
        const textMatcher = el => {
            if (!el) return false;
            const parts = [el.innerText, el.textContent, el.value, el.title, el.getAttribute && el.getAttribute('aria-label')];
            const txt = (parts.filter(Boolean).join(' ')||'').trim().toUpperCase();
            if (!txt) return false;
            return /\b(OK|YES|CONFIRM|BEVESTIGEN|ACEPTAR|CONFIRMAR)\b/.test(txt) || txt.includes('OK');
        };

        while (Date.now() < end) {
            // try modal-contained buttons first
            let modal = null;
            for (const sel of modalSelectors) { modal = document.querySelector(sel); if (modal) break; }

            let candidates = [];
            if (modal) {
                candidates = Array.from(modal.querySelectorAll('button, a, input[type=button], input[type=submit], .btn, .button'))
                    .concat(Array.from(modal.querySelectorAll('span,div')).filter(textMatcher));
            } else {
                candidates = Array.from(document.querySelectorAll('button, a, input, span, div'));
            }

            const match = candidates.find(c => textMatcher(c));
            const fallback = candidates.find(c => (c.className||'').toLowerCase().includes('ok') || (c.className||'').toLowerCase().includes('confirm'));
            const candidate = match || fallback;

            if (candidate) {
                const btn = candidate.closest && (candidate.closest('button') || candidate.closest('a')) || candidate;
                const visible = btn && (btn.offsetParent !== null || (btn.getBoundingClientRect && (btn.getBoundingClientRect().width > 0 || btn.getBoundingClientRect().height > 0)));
                const enabled = btn && !btn.disabled && !(btn.getAttribute && btn.getAttribute('aria-disabled') === 'true');
                if (visible && enabled) {
                    try { btn.click(); } catch(e) { try { btn.dispatchEvent(new MouseEvent('click', {bubbles:true})); } catch(e2){} }
                    await wait(600);
                    // if modal gone, success
                    const stillOpen = modalSelectors.some(s => document.querySelector(s) !== null);
                    if (!stillOpen) return resolve(true);
                }
            }

            await wait(500);
        }
        resolve(false);
    });
}

// Count messages in a given folder (Inbox/Outbox). Navigates there, waits, and returns row count.
async function countMessagesIn(mapNaam) {
    if (!mapNaam) return 0;
    klikMenuText(mapNaam);
    await wait(2500);

    const mappings = {
        inbox: '#tableSmsInboxBody',
        outbox: '#tableSmsOutboxBody',
        sent: '#tableSmsSentBody',
        draft: '#tableSmsDraftBody'
    };

    let selector = null;
    const key = Object.keys(mappings).find(k => mapNaam.toLowerCase().includes(k));
    if (key) selector = mappings[key];

    let tbody = selector ? document.querySelector(selector) : null;
    if (!tbody) {
        // fallback: find any sms table body present
        tbody = document.querySelector('[id^="tableSms"][id$="Body"]');
    }

    if (!tbody) {
        // try searching for tables within the main content
        const possible = Array.from(document.querySelectorAll('table, tbody'));
        for (const p of possible) {
            if ((p.id || '').toLowerCase().includes('sms') || (p.closest && p.closest('#tableSmsInboxBody'))) { tbody = p; break; }
        }
    }

    if (!tbody) return 0;

    const rows = tbody.querySelectorAll('tr');
    if (!rows || rows.length === 0) return 0;

    // Only count visible rows that contain meaningful cells (ignore templates/hidden rows and placeholder dashes)
    const visibleRows = Array.from(rows).filter(r => {
        try {
            if (r.offsetParent === null) return false; // hidden
            if (r.classList && r.classList.contains('nd')) return false; // css-hidden template
            const cells = Array.from(r.querySelectorAll('td, th'));
            if (!cells.length) return false;
            // consider a row valid when any cell has non-empty, non-placeholder text or contains interactive elements
            return cells.some(td => {
                const txt = (td.innerText||'').trim();
                if (txt === '') return !!td.querySelector('input, label, a, span');
                // ignore rows that only show dashes/placeholder like '--' or '---'
                if (/^[-\s]+$/.test(txt)) return false;
                // consider numeric/alpha or other text as valid
                return txt.length > 0;
            });
        } catch (e) { return false; }
    });

    return visibleRows.length;
}

// Verify both Inbox and Outbox counts and log them
async function verifyClean() {
    const inboxCount = await countMessagesIn('Inbox');
    await wait(800);
    const outboxCount = await countMessagesIn('Outbox');
    log(`VerifyClean -> Inbox: ${inboxCount}, Outbox: ${outboxCount}`);
    return { inbox: inboxCount, outbox: outboxCount };
}

function startRobot() {
    // single-run check loop (non-overlapping). Called by scheduler.
    loadSettings();
    log(`Monitoring Archer UI run (Interval: ${CONFIG.checkInterval/1000}s)...`);
    logToUI('Monitor run');

    if (CONFIG.paused) {
        log("⏸️ Bot is paused. Skipping this cycle.");
        logToUI('Paused');
        scheduleNextRun();
        return;
    }

    if (isBusy || isCleaning) {
        log('Skipping cycle because another operation is busy.');
        scheduleNextRun();
        return;
    }

    const advancedTab = document.querySelector('#advanced');
    if (advancedTab && !advancedTab.classList.contains('selected')) {
        advancedTab.click();
        setTimeout(() => { scheduleNextRun(); }, 3000);
        return;
    }

    const inboxTabelBody = document.querySelector(SELECTORS.inboxBody) || document.querySelector('[id^="tableSms"][id$="Body"]');
    if (!inboxTabelBody) {
        const smsMenu = document.querySelector('#sms');
        if (smsMenu && !smsMenu.classList.contains('selected')) {
            smsMenu.click();
            setTimeout(() => klikMenuText('Inbox'), 2000);
        } else {
            klikMenuText('Inbox');
        }
        setTimeout(() => { verversLijst(); scheduleNextRun(); }, 5000);
        return;
    }

    // perform normal refresh/processing
    verversLijst();
    scheduleNextRun();
}

function scheduleNextRun() {
    try { if (monitorIntervalId) clearTimeout(monitorIntervalId); } catch(e) {}
    monitorIntervalId = setTimeout(startRobot, CONFIG.checkInterval);
}

function verversLijst() {
    if (isBusy || isCleaning) {
        log('Refresh skipped because another operation is busy. Retrying shortly.');
        setTimeout(verversLijst, 3000);
        return;
    }

    const refreshBtn = document.querySelector(SELECTORS.refreshBtn) || 
                       Array.from(document.querySelectorAll('label.table-icon-text')).find(el => (el.innerText||'').trim() === 'Refresh');
    if (refreshBtn) {
        // enqueue the refresh click to keep single-task ordering
        enqueueTask(async () => {
            try { isBusy = true; try { refreshBtn.click(); } catch(e) { refreshBtn.dispatchEvent(new MouseEvent('click',{bubbles:true})); } log('Refresh clicked'); logToUI('Refresh clicked'); }
            finally { await wait(8000); isBusy = false; enqueueTask(async () => { verwerkBerichten(); }); }
        });
    } else {
        enqueueTask(async () => { verwerkBerichten(); });
    }
}

function verwerkBerichten() {
    const tbody = document.querySelector('#tableSmsInboxBody');
    const rijen = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
    if (rijen.length === 0) return;

    const eersteRij = rijen[0]; // Vaste selectie van de bovenste rij [0]
    const cellen = eersteRij.querySelectorAll('td.table-content');
    // we expect at least 5 columns (index 0..4) to safely read inhoud and tijdstip
    if (cellen.length < 5) return;

    const inhoud = cellen[3]?.innerText || "";
    const tijdstip = cellen[4]?.innerText || "ID-" + inhoud.length;

    const isMatch = CONFIG.targets.some(t => inhoud.includes(t));

    if (isMatch && laatsteBerichtID !== tijdstip) {
        log(`Trigger found: "${inhoud}". Executing response...`);
        if (!klikMenuText(SELECTORS.newMessageText)) {
            if (window.$ && $.tp && $.tp.loadPage) $.tp.loadPage("lteSmsNewMsg.htm");
        }
        // enqueue send action
        enqueueTask(async () => {
            await wait(7000);
            await verstuurSms(tijdstip);
        });
    }
}

async function verstuurSms(berichtID) {
    const toField = document.querySelector('#toNumber');
    const contentField = document.querySelector('#inputContent');
    const sendBtn = document.querySelector('#send') || 
                    Array.from(document.querySelectorAll('.button-text')).find(s => (s.innerText||'').trim() === "Send");

    if (toField && contentField && sendBtn) {
        if (isBusy || isCleaning) {
            log('Send skipped because another operation is busy.');
            logToUI('Send skipped - busy', 'error');
            return;
        }
        isBusy = true;

        // record Outbox before sending to verify delivery
        let outBefore = 0;
        try { outBefore = await countMessagesIn('Outbox'); } catch(e) { outBefore = 0; }

        toField.value = CONFIG.replyNum;
        contentField.value = CONFIG.replyMsg;
        ['input', 'change', 'blur', 'keyup'].forEach(t => {
            toField.dispatchEvent(new Event(t, { bubbles: true }));
            contentField.dispatchEvent(new Event(t, { bubbles: true }));
        });

        await wait(800);
        try { sendBtn.click(); } catch(e) { try { sendBtn.dispatchEvent(new MouseEvent('click',{bubbles:true})); } catch(_){} }
        log(`Attempted send to ${CONFIG.replyNum}`);

        // wait for router UI to update and check Outbox
        await wait(6000);
        let outAfter = 0;
        try { outAfter = await countMessagesIn('Outbox'); } catch(e) { outAfter = outBefore; }

        if (outAfter > outBefore) {
            smsVerstuurdTeller++;
            laatsteBerichtID = berichtID;
            log(`✅ Message enqueued to Outbox (${outAfter} total).`);
            logToUI(`Response sent to ${CONFIG.replyNum}`, 'am');
        } else {
            // attempt to capture on-page error text
            const errors = findPageErrors();
            const reason = (errors && errors.length) ? errors.join(' | ') : 'Outbox count did not increase after send';
            log(`❌ Send might have failed: ${reason}`);
            logToUI(`Send failed: ${reason}`, 'error');
        }

        // give the UI some time then return to Inbox and release busy
        await wait(3000);
        try { klikMenuText('Inbox'); } catch(e){}
        isBusy = false;

        if (CONFIG.autoClean && smsVerstuurdTeller >= CLEANUP_THRESHOLD) {
            setTimeout(() => { if (!isBusy && !isCleaning) startGroteSchoonmaak(); else log('Auto-clean postponed; busy.'); }, 10000);
        }
    } else {
        log('Send fields/buttons not found.');
        logToUI('Send failed - UI elements missing', 'error');
    }
}

// **HERZIENE Schoonmaak Functie**
async function startGroteSchoonmaak() {
    if (isCleaning) {
        log('Cleaning already running; skipping new request.');
        return;
    }
    if (isBusy) {
        log('Another operation is busy; postponing clean.');
        return;
    }
    // Acquire locks
    isCleaning = true;
    isBusy = true;
    try {
        log("🗑️ Starting robust storage wipe (Inbox & Outbox)...");
        smsVerstuurdTeller = 0; 
        
        // enqueue each map cleaning to keep UI operations ordered and avoid races
        await enqueueTask(async () => { await leegMap("Inbox"); });
        await wait(1000);
        await enqueueTask(async () => { await leegMap("Outbox"); });
        await wait(1000);

        // Verify counts after attempting to clear both folders
        const counts = await verifyClean();
        if ((counts.inbox || 0) > 0 || (counts.outbox || 0) > 0) {
            log(`⚠️ Cleanup incomplete - remaining Inbox: ${counts.inbox}, Outbox: ${counts.outbox}`);
        } else {
            log("✅ Storage is now clean. Returning to Inbox.");
        }
        klikMenuText("Inbox");
    } finally {
        // Release locks
        isCleaning = false;
        isBusy = false;
    }
}

function leegMap(mapNaam) {
    return new Promise(async (resolve) => {
        log(`Wiping: ${mapNaam}...`);
        
        // Gebruik de betrouwbare klikMenuText om te navigeren
        klikMenuText(mapNaam);
        await wait(6000); // Wacht tot de UI geladen is

        const allCheckbox = document.querySelector('th .tp-checkbox-wrapper') || 
                            document.querySelector('th rect.checkboxColor')?.closest('span') ||
                            document.querySelector('th.checkbox-click'); // Nieuwe selector

        const deleteBtn = document.querySelector('#staticDelete') ||
                          document.getElementById('staticDel') || // Van PDF
                          Array.from(document.querySelectorAll('label.table-icon-text')).find(el => el.innerText.includes("Delete"));

        if (allCheckbox && deleteBtn) {
            allCheckbox.click();
            await wait(1500);
            deleteBtn.click();
            log("Waiting for confirmation popup...");
            await wait(2500);

            // Use the centralized helper to click confirmation popups
            const ok = await clickConfirmPopup(10000);
            if (ok) {
                log(`${mapNaam} is now empty.`);
                resolve(true);
            } else {
                log(`Delete confirmation OK/Yes button not found or popup did not close for ${mapNaam}.`);
                resolve(false);
            }
        } else {
            log(`No items to delete in ${mapNaam} or buttons not found.`);
            resolve(false);
        }
    });
}

// 🚀 Start Sequence
setTimeout(() => {
    loadSettings();
    injectInterface();
    // Ensure we navigate to the SMS section and Inbox immediately on startup
    try {
        // click the main SMS menu then Inbox to force the UI into the right view
        klikMenuText('SMS');
        setTimeout(() => { klikMenuText('Inbox'); }, 1200);
    } catch(e){}

    startRobot();
}, 4000);
