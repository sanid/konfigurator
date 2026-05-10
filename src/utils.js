export function coerceNumericParams(params) {
  const p = {};
  for (const [k, v] of Object.entries(params)) {
    const n = parseFloat(v);
    p[k] = isNaN(n) ? v : n;
  }
  return p;
}

export function tryWithToast(fn, errorMsg) {
  try {
    return fn();
  } catch (e) {
    console.error(errorMsg, e);
    import('./notifications.js').then(({ showNotification }) => {
      showNotification(errorMsg, 'error');
    });
  }
}

export function fmtCm(val) {
  return val.toLocaleString('sr-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function fmtEur(val) {
  return val.toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function fmtRsd(val) {
  return val.toLocaleString('sr-RS', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' RSD';
}
