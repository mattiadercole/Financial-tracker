// ═══════════════════════════════════════════════
//  SOSOLDI — Google Sheets API layer
// ═══════════════════════════════════════════════

const Sheets = (() => {

  let _accessToken = null;
  let _sheetId     = null;
  let _clientId    = null;
  let _tokenClient = null;
  let _gapiReady   = false;
  let _gsiReady    = false;

  // ── Init ────────────────────────────────────
  async function init(clientId, sheetId) {
    _clientId = clientId;
    _sheetId  = sheetId || null;
    _accessToken = localStorage.getItem(LS.TOKEN);

    await Promise.all([loadGapi(), loadGsi()]);
  }

  function loadGapi() {
    return new Promise(resolve => {
      if (typeof gapi !== 'undefined' && _gapiReady) return resolve();
      const check = setInterval(() => {
        if (typeof gapi !== 'undefined') {
          clearInterval(check);
          gapi.load('client', async () => {
            await gapi.client.init({});
            _gapiReady = true;
            resolve();
          });
        }
      }, 100);
    });
  }

  function loadGsi() {
    return new Promise(resolve => {
      if (typeof google !== 'undefined' && _gsiReady) return resolve();
      const check = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) {
          clearInterval(check);
          _tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: _clientId,
            scope: SCOPES,
            callback: (resp) => {
              if (resp.access_token) {
                _accessToken = resp.access_token;
                localStorage.setItem(LS.TOKEN, _accessToken);
              }
            }
          });
          _gsiReady = true;
          resolve();
        }
      }, 100);
    });
  }

  // ── Auth ────────────────────────────────────
  async function authorize() {
    return new Promise((resolve, reject) => {
      if (!_tokenClient) return reject(new Error('GSI not initialized'));
      const origCallback = _tokenClient.callback;
      _tokenClient.callback = (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        _accessToken = resp.access_token;
        localStorage.setItem(LS.TOKEN, _accessToken);
        origCallback(resp);
        resolve(resp.access_token);
      };
      _tokenClient.requestAccessToken({ prompt: _accessToken ? '' : 'consent' });
    });
  }

  function isAuthorized() { return !!_accessToken; }

  function logout() {
    if (_accessToken && typeof google !== 'undefined') {
      google.accounts.oauth2.revoke(_accessToken);
    }
    _accessToken = null;
    _sheetId = null;
    localStorage.removeItem(LS.TOKEN);
    localStorage.removeItem(LS.SHEET_ID);
  }

  // ── API helper ──────────────────────────────
  async function apiRequest(method, url, body) {
    if (!_accessToken) throw new Error('Not authorized');

    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${_accessToken}`,
        'Content-Type':  'application/json',
      }
    };
    if (body) opts.body = JSON.stringify(body);

    let res = await fetch(url, opts);

    // Token expired → refresh and retry once
    if (res.status === 401) {
      try {
        await authorize();
        opts.headers['Authorization'] = `Bearer ${_accessToken}`;
        if (body) opts.body = JSON.stringify(body);
        res = await fetch(url, opts);
      } catch(e) {
        throw new Error('Sessione scaduta. Riconnettiti.');
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── Spreadsheet bootstrap ───────────────────
  async function createSpreadsheet() {
    const data = await apiRequest('POST',
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        properties: { title: 'Sosoldi — Finanze Personali' },
        sheets: [{ properties: { title: 'Info' } }]
      }
    );
    _sheetId = data.spreadsheetId;
    localStorage.setItem(LS.SHEET_ID, _sheetId);

    // Write info tab
    await apiRequest('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/Info!A1?valueInputOption=RAW`,
      { values: [['Sosoldi'], ['Creato il'], [new Date().toLocaleDateString('it-IT')]] }
    );

    return _sheetId;
  }

  async function ensureSheet(sheetName) {
    // Check if sheet exists
    const meta = await apiRequest('GET',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}?fields=sheets.properties.title`
    );
    const exists = meta.sheets.some(s => s.properties.title === sheetName);
    if (!exists) await addSheet(sheetName);
  }

  async function addSheet(title) {
    await apiRequest('POST',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}:batchUpdate`,
      { requests: [{ addSheet: { properties: { title } } }] }
    );
    // Write header row
    await writeRow(title, 1, SHEET_HEADER);
  }

  async function writeRow(sheetName, rowNum, values) {
    const range = `${encodeSheet(sheetName)}!A${rowNum}`;
    await apiRequest('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${range}?valueInputOption=RAW`,
      { values: [values] }
    );
  }

  function encodeSheet(name) {
    return encodeURIComponent(`'${name}'`);
  }

  // ── Transactions ────────────────────────────
  async function getTransactions(month, year) {
    const sheetName = sheetNameFor(month, year);
    await ensureSheet(sheetName);

    const range = `${encodeSheet(sheetName)}!A1:F500`;
    const res = await apiRequest('GET',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${range}`
    );

    const rows = (res.values || []).slice(1); // skip header
    return rows.map((r, i) => ({
      rowIndex: i + 2, // 1-based, +1 for header
      date:     r[COL.DATE]   || '',
      amount:   parseFloat(r[COL.AMOUNT]) || 0,
      desc:     r[COL.DESC]   || '',
      category: r[COL.CAT]    || '',
      type:     r[COL.TYPE]   || 'Uscita',
      note:     r[COL.NOTE]   || '',
    }));
  }

  async function addTransaction(month, year, tx) {
    const sheetName = sheetNameFor(month, year);
    await ensureSheet(sheetName);

    // Append row
    const range = `${encodeSheet(sheetName)}!A:F`;
    await apiRequest('POST',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: [[tx.date, tx.amount, tx.desc, tx.category, tx.type, tx.note]] }
    );
  }

  async function deleteTransaction(month, year, rowIndex) {
    // Get sheet ID (numeric)
    const meta = await apiRequest('GET',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}?fields=sheets.properties`
    );
    const sheetName = sheetNameFor(month, year);
    const sheetMeta = meta.sheets.find(s => s.properties.title === sheetName);
    if (!sheetMeta) return;
    const sheetId = sheetMeta.properties.sheetId;

    await apiRequest('POST',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}:batchUpdate`,
      {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-based
              endIndex:   rowIndex,
            }
          }
        }]
      }
    );
  }

  // ── Annual summary ──────────────────────────
  async function getAnnualSummary(year) {
    const result = [];
    for (let m = 1; m <= 12; m++) {
      try {
        const txs = await getTransactions(m, year);
        const entrate = txs.filter(t => t.type === 'Entrata').reduce((s,t) => s + t.amount, 0);
        const uscite  = txs.filter(t => t.type === 'Uscita') .reduce((s,t) => s + t.amount, 0);
        result.push({ month: m, entrate, uscite, saldo: entrate - uscite });
      } catch(e) {
        result.push({ month: m, entrate: 0, uscite: 0, saldo: 0 });
      }
    }
    return result;
  }

  function getSheetId()  { return _sheetId; }
  function setSheetId(id){ _sheetId = id; localStorage.setItem(LS.SHEET_ID, id); }

  return {
    init, authorize, isAuthorized, logout,
    createSpreadsheet, getTransactions, addTransaction,
    deleteTransaction, getAnnualSummary,
    getSheetId, setSheetId,
  };
})();
