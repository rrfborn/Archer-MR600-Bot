document.addEventListener('DOMContentLoaded', () => {
  // Laad huidige waarden
  chrome.storage.local.get(['targets', 'sender', 'replyNum', 'replyMsg', 'autoClean'], (res) => {
    if (res.targets) document.getElementById('targets').value = res.targets;
    if (res.sender) document.getElementById('sender').value = res.sender;
    if (res.replyNum) document.getElementById('replyNum').value = res.replyNum;
    if (res.replyMsg) document.getElementById('replyMsg').value = res.replyMsg;
    document.getElementById('autoClean').checked = res.autoClean !== false;
  });

  // Opslaan
  document.getElementById('save').addEventListener('click', () => {
    chrome.storage.local.set({
      targets: document.getElementById('targets').value,
      sender: document.getElementById('sender').value,
      replyNum: document.getElementById('replyNum').value,
      replyMsg: document.getElementById('replyMsg').value,
      autoClean: document.getElementById('autoClean').checked
    }, () => {
      alert("Instellingen opgeslagen! Ververs de router-pagina.");
      window.close();
    });
  });
});
