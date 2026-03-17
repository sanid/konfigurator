// notifications.js
export function showNotification(msg, type) {
  if (!type) type = 'info';
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  const bg = type==='success'?'var(--green)':type==='warning'?'var(--amber)':type==='error'?'var(--red)':'var(--accent)';
  const col = type==='warning'?'#000':'#fff';
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:'+bg+';color:'+col+';padding:10px 22px;border-radius:99px;font-size:12px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.4);z-index:9999;animation:fadeIn 0.2s ease;';
  document.body.appendChild(toast);
  setTimeout(function(){ toast.remove(); }, 2800);
}
