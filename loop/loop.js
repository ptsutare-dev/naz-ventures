/* Naz Loop study — shared logic.
 * 1) Paste your Google Apps Script web-app URL into ENDPOINT below (see DEPLOY.md).
 *    While ENDPOINT is empty the pages run in PREVIEW MODE: nothing is sent anywhere.
 */
var NAZ_LOOP = {
  ENDPOINT: 'https://script.google.com/macros/s/AKfycbz7cxdWzNEiPm-gdRXy2wFshDULBVk39528YmiMZ1-nhx6MY5sqMFRxXSKNdF2O1QR3/exec',
  VERSIONS: ['a1b1', 'a1b2', 'a2b1', 'a2b2'],
  STUDY_KEY: 'nazLoopStudy',
  DONE_KEY: 'nazLoopDone2'
};

NAZ_LOOP.uid = function () {
  var a = new Uint8Array(8);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return 'NL-' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').toUpperCase();
};

NAZ_LOOP.load = function () {
  try { return JSON.parse(sessionStorage.getItem(NAZ_LOOP.STUDY_KEY) || 'null'); } catch (e) { return null; }
};
NAZ_LOOP.save = function (obj) {
  try { sessionStorage.setItem(NAZ_LOOP.STUDY_KEY, JSON.stringify(obj)); } catch (e) {}
};
NAZ_LOOP.isDone = function () {
  try { return localStorage.getItem(NAZ_LOOP.DONE_KEY) === '1'; } catch (e) { return false; }
};
NAZ_LOOP.markDone = function () {
  try { localStorage.setItem(NAZ_LOOP.DONE_KEY, '1'); } catch (e) {}
};
NAZ_LOOP.isPreview = function () { return !NAZ_LOOP.ENDPOINT; };

/* Fallback only: a simple random pick, used if the Google Sheet cannot be reached. */
NAZ_LOOP.assign = function () {
  var a = new Uint32Array(1);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return NAZ_LOOP.VERSIONS[a[0] % 4];
};

/* Sends one record. Apps Script web apps accept a text/plain POST; with no-cors the browser
 * cannot read the reply, so a copy is also kept on the device as a fallback. */
NAZ_LOOP.send = function (payload) {
  try {
    var key = 'nazLoopBackup';
    var list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push(payload);
    localStorage.setItem(key, JSON.stringify(list.slice(-5)));
  } catch (e) {}
  if (NAZ_LOOP.isPreview()) {
    if (window.console) console.log('[Naz Loop preview — not sent]', payload);
    return Promise.resolve('preview');
  }
  return fetch(NAZ_LOOP.ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function () { return 'sent'; }).catch(function () { return 'failed'; });
};

/* Block randomization: ask the Google Sheet for the next version in its shuffled deck of four.
 * Falls back to a random pick if the sheet does not answer within 6 seconds. */
NAZ_LOOP.requestVersion = function (id) {
  if (NAZ_LOOP.isPreview()) return Promise.resolve(NAZ_LOOP.assign());
  var ctrl = window.AbortController ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
  return fetch(NAZ_LOOP.ENDPOINT + '?action=assign&id=' + encodeURIComponent(id), ctrl ? { signal: ctrl.signal } : {})
    .then(function (r) { return r.json(); })
    .then(function (d) { clearTimeout(timer); return NAZ_LOOP.VERSIONS.indexOf(d.version) >= 0 ? d.version : NAZ_LOOP.assign(); })
    .catch(function () { clearTimeout(timer); return NAZ_LOOP.assign(); });
};

/* Within-subjects design: every person sees all four offers, in a random order.
 * Fisher-Yates shuffle using the browser's secure random generator. */
NAZ_LOOP.shuffle = function (arr) {
  var a = arr.slice(), r = new Uint32Array(a.length);
  (window.crypto || window.msCrypto).getRandomValues(r);
  for (var i = a.length - 1; i > 0; i--) {
    var j = r[i] % (i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
};
NAZ_LOOP.requestOrder = function () {
  return Promise.resolve(NAZ_LOOP.shuffle(NAZ_LOOP.VERSIONS));
};

NAZ_LOOP.param = function (name) {
  var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
  return m ? decodeURIComponent(m[1]) : '';
};
