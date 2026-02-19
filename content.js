// --- 🤖 MR600-Bot v1.0 (Universal SMS Automation) ---

// 1. Kernconfiguratie (Neutrale defaults)
let CONFIG = {
    targets: ["80%", "100%"],
    replyNum: "1266",
    replyMsg: "NL2000 AAN",
    autoClean: true,
    checkInterval: 60000
};

let laatsteBerichtID = ""; 
let smsVerstuurdTeller = 0; 
const CLEANUP_THRESHOLD = 10;

function log(msg) {
    console.log(`[MR600-BOT] ${new Date().toLocaleTimeString()}: ${msg}`);
}

// 2. Instellingen laden
function loadSettings() {
    const saved = localStorage.getItem('mr600_config');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            CONFIG = {...CONFIG, ...parsed};
        } catch(e) { log("Fout bij laden config: " + e); }
    }
}

// 3. De Universele Hover UI injecteren
function injectInterface() {
    if (document.getElementById('mr600-ui-box')) return;
    loadSettings();

    const ui = document.createElement('div');
    ui.id = 'mr600-ui-box';
    ui.innerHTML = `
        <div style="position:fixed; top:70px; right:20px; z-index:9999; background:white; border:2px solid #00a1e1; padding:15px; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.3); width:220px; font-family:Arial; color:#333;">
            <h4 style="margin:0 0 10px 0; color:#00a1e1; display:flex; align-items:center; gap:8px;">
                <span style="font-size:20px;">🤖</span> MR600-Bot v1.0
            </h4>
            
            <label style="font-size:11px; font-weight:bold;">Trigger tekst (comma sep.):</label>
            <input type="text" id="ui-targets" value="${Array.isArray(CONFIG.targets) ? CONFIG.targets.join(', ') : CONFIG.targets}" style="width:100%; margin:5px 0 10px 0; padding:4px; border:1px solid #ccc; border-radius:4px;">
            
            <label style="font-size:11px; font-weight:bold;">Antwoord naar & bericht:</label>
            <input type="text" id="ui-num" value="${CONFIG.replyNum}" style="width:100%; margin:5px 0 5px 0; padding:4px; border:1px solid #ccc; border-radius:4px;">
            <input type="text" id="ui-msg" value="${CONFIG.replyMsg}" style="width:100%; margin:0 0 10px 0; padding:4px; border:1px solid #ccc; border-radius:4px;">
            
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                <input type="checkbox" id="ui-clean" ${CONFIG.autoClean ? 'checked' : ''} style="cursor:pointer;">
                <label for="ui-clean" style="font-size:11px; cursor:pointer;">Auto-wipe Inbox/Outbox</label>
            </div>
            
            <button id="ui-save" style="width:100%; background:#00a1e1; color:white; border:none; padding:10px; border-radius:4px; cursor:pointer; font-weight:bold;">Save & Restart</button>
            <p id="ui-status" style="font-size:10px; color:green; margin-top:8px; display:none; text-align:center;">✅ Settings updated!</p>
        </div>
    `;
    document.body.appendChild(ui);

    document.getElementById('ui-save').onclick = function() {
        const newConfig = {
            targets: document.getElementById('ui-targets').value.split(',').map(t => t.trim()),
            replyNum: document.getElementById('ui-num').value,
            replyMsg: document.getElementById('ui-msg').value,
            autoClean: document.getElementById('ui-clean').checked
        };
        
        localStorage.setItem('mr600_config', JSON.stringify(newConfig));
        this.style.background = "#28a745";
        document.getElementById('ui-status').style.display = 'block';
        setTimeout(() => location.reload(), 1200); 
    };
}

// --- ⚙️ Kernfunctionaliteit ---

function klikMenuText(txt) {
    const spans = Array.from(document.querySelectorAll('span.text.T'));
    const target = spans.find(s => s.innerText.trim() === txt);
    if (target) {
        target.click();
        return true;
    }
    return false;
}

function startRobot() {
    loadSettings();
    log(`Monitoring Archer UI...`);

    const advancedTab = document.querySelector('#advanced');
    if (advancedTab && !advancedTab.classList.contains('selected')) {
        advancedTab.click();
        setTimeout(startRobot, 3000);
        return;
    }

    const inboxTabelBody = document.querySelector('#tableSmsInboxBody');
    if (!inboxTabelBody) {
        const smsMenu = document.querySelector('#sms');
        if (smsMenu && !smsMenu.classList.contains('selected')) {
            smsMenu.click();
            setTimeout(() => klikMenuText("Inbox"), 2000);
        } else {
            klikMenuText("Inbox");
        }
        setTimeout(verversLijst, 5000);
        return;
    }
    verversLijst();
}

function verversLijst() {
    const refreshBtn = document.querySelector('#staticRefresh') || 
                       Array.from(document.querySelectorAll('label.table-icon-text')).find(el => el.innerText.trim() === "Refresh");
    if (refreshBtn) {
        refreshBtn.click();
        setTimeout(verwerkBerichten, 10000); 
    } else {
        verwerkBerichten();
    }
}

function verwerkBerichten() {
    const tbody = document.querySelector('#tableSmsInboxBody');
    const rijen = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
    if (rijen.length === 0) return;

    const eersteRij = rijen[0];
    const cellen = eersteRij.querySelectorAll('td.table-content');
    if (cellen.length < 4) return;

    const inhoud = cellen[3]?.innerText || "";
    const tijdstip = cellen[4]?.innerText || "ID-" + inhoud.length;

    const isMatch = CONFIG.targets.some(t => inhoud.includes(t));

    if (isMatch && laatsteBerichtID !== tijdstip) {
        log(`Trigger found: "${inhoud}". Executing response...`);
        if (!klikMenuText("New Message")) {
            if (window.$ && $.tp && $.tp.loadPage) $.tp.loadPage("lteSmsNewMsg.htm");
        }
        setTimeout(() => verstuurSms(tijdstip), 7000);
    }
}

function verstuurSms(berichtID) {
    const toField = document.querySelector('#toNumber');
    const contentField = document.querySelector('#inputContent');
    const sendBtn = document.querySelector('#send') || 
                    Array.from(document.querySelectorAll('.button-text')).find(s => s.innerText.trim() === "Send");

    if (toField && contentField && sendBtn) {
        toField.value = CONFIG.replyNum;
        contentField.value = CONFIG.replyMsg;

        ['input', 'change', 'blur', 'keyup'].forEach(t => {
            toField.dispatchEvent(new Event(t, { bubbles: true }));
            contentField.dispatchEvent(new Event(t, { bubbles: true }));
        });

        setTimeout(() => { 
            log(`🚀 Response sent to ${CONFIG.replyNum}`);
            sendBtn.click(); 
            laatsteBerichtID = berichtID;
            smsVerstuurdTeller++; 

            if (CONFIG.autoClean && smsVerstuurdTeller >= CLEANUP_THRESHOLD) {
                setTimeout(startGroteSchoonmaak, 10000);
            } else {
                setTimeout(() => klikMenuText("Inbox"), 5000);
            }
        }, 2000);
    }
}

async function startGroteSchoonmaak() {
    log("🗑️ Starting full storage wipe...");
    smsVerstuurdTeller = 0; 
    await leegMap("Inbox");
    setTimeout(async () => {
        await leegMap("Outbox");
        log("✅ Storage is now clean.");
        setTimeout(() => klikMenuText("Inbox"), 3000);
    }, 12000); 
}

function leegMap(mapNaam) {
    return new Promise((resolve) => {
        log(`Cleaning: ${mapNaam}...`);
        klikMenuText(mapNaam);
        setTimeout(() => {
            const allCheckbox = document.querySelector('th .tp-checkbox-wrapper') || 
                               document.querySelector('th rect.checkboxColor')?.closest('span');
            const deleteBtn = document.querySelector('#staticDelete') || 
                              Array.from(document.querySelectorAll('label.table-icon-text')).find(el => el.innerText.trim() === "Delete");

            if (allCheckbox && deleteBtn) {
                allCheckbox.click();
                setTimeout(() => {
                    deleteBtn.click();
                    setTimeout(() => {
                        const okBtn = document.querySelector('.tp-msgbox-ok') || 
                                     Array.from(document.querySelectorAll('span')).find(s => s.innerText.trim() === "OK");
                        if (okBtn) okBtn.click();
                        resolve();
                    }, 2500);
                }, 1500);
            } else {
                resolve();
            }
        }, 6000);
    });
}

// 🚀 Start Sequence
setTimeout(() => {
    loadSettings();
    injectInterface();
    startRobot();
}, 4000);

setInterval(startRobot, CONFIG.checkInterval);
