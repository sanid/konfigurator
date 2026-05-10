const DEBUG =
  typeof window !== 'undefined' &&
  (new URLSearchParams(window.location.search).has('debug') || localStorage.getItem('mecoDebug') === '1');

export const log = DEBUG ? console.log.bind(console) : () => {};
export const warn = DEBUG ? console.warn.bind(console) : () => {};
export const error = console.error.bind(console);
