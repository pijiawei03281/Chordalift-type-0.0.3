// public/js/eula-gate.js
export async function eulaGate({ modalSel, chkSel, openSel, okSel }) {
  const cfg = await window.chordalift.config.get();
  const $modal = document.querySelector(modalSel);
  const $chk = document.querySelector(chkSel);
  const $open = document.querySelector(openSel);
  const $ok = document.querySelector(okSel);

  if (cfg.eulaAccepted) { $modal.style.display='none'; return; }

  fetch('EULA.txt',{cache:'no-store'}).then(r=>r.text()).then(txt=>{
    const pre = $modal.querySelector('pre');
    if (pre) pre.textContent = txt.slice(0, 2000);
  });

  $open.addEventListener('click', ()=> window.open('EULA.txt','_blank'));
  $ok.addEventListener('click', async ()=>{
    if (!$chk.checked) return alert('請先勾選我同意 EULA');
    await window.chordalift.config.set({ eulaAccepted: true });
    $modal.style.display = 'none';
  });

  $modal.style.display = 'block';
}
