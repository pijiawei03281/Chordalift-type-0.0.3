// public/js/apply.js
export function bindApply({ keySel, scaleSel, applyBtn, toast }) {
  const $key = document.querySelector(keySel);
  const $scale = document.querySelector(scaleSel);
  const $btn = document.querySelector(applyBtn);
  const $toast = document.querySelector(toast);

  function showToast(msg, ok=true) {
    $toast.textContent = msg;
    $toast.style.background = ok ? '#1f6f43' : '#7a2b2b';
    $toast.style.display = 'inline-block';
    setTimeout(() => ($toast.style.display='none'), 1800);
  }

  function setKeyScale(key, scale) {
    window.currentMapping = { key, scale };
  }

  $btn.addEventListener('click', async () => {
    try {
      setKeyScale($key.value, $scale.value);
      window.chordalift?.log?.info?.(`Apply Key/Scale: ${$key.value}/${$scale.value}`);
      showToast('已套用：Key/Scale 設定生效', true);
    } catch (e) {
      window.chordalift?.log?.error?.(`Apply failed: ${e?.message || e}`);
      showToast('套用失敗：請檢查裝置與設定', false);
    }
  });
}
