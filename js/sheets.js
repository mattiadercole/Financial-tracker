// ═══════════════════════════════════════════════
//  SOSOLDI — Google Sheets API layer v3
// ═══════════════════════════════════════════════

const Sheets = (() => {
  let _token = null, _sheetId = null, _clientId = null;
  let _tokenClient = null, _gapiReady = false, _gsiReady = false;

  // ── Init & Auth ──────────────────────────────
  async function init(clientId, sheetId) {
    _clientId = clientId; _sheetId = sheetId || null;
    _token = localStorage.getItem(LS.TOKEN);
    await Promise.all([_loadGapi(), _loadGsi()]);
  }

  function _loadGapi() {
    return new Promise(resolve => {
      if (_gapiReady) return resolve();
      const t = setInterval(() => {
        if (typeof gapi !== 'undefined') {
          clearInterval(t);
          gapi.load('client', async () => { await gapi.client.init({}); _gapiReady = true; resolve(); });
        }
      }, 100);
    });
  }
  function _loadGsi() {
    return new Promise(resolve => {
      if (_gsiReady) return resolve();
      const t = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) {
          clearInterval(t);
          _tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: _clientId, scope: SCOPES,
            callback: r => { if (r.access_token) { _token = r.access_token; localStorage.setItem(LS.TOKEN, _token); } }
          });
          _gsiReady = true; resolve();
        }
      }, 100);
    });
  }

  async function authorize() {
    return new Promise((resolve, reject) => {
      if (!_tokenClient) return reject(new Error('GSI not ready'));
      const orig = _tokenClient.callback;
      _tokenClient.callback = r => {
        if (r.error) return reject(new Error(r.error));
        _token = r.access_token; localStorage.setItem(LS.TOKEN, _token);
        orig(r); resolve(_token);
      };
      _tokenClient.requestAccessToken({ prompt: _token ? '' : 'consent' });
    });
  }

  function isAuthorized() { return !!_token; }
  function logout() {
    if (_token && typeof google !== 'undefined') google.accounts.oauth2.revoke(_token);
    _token = null; _sheetId = null;
    localStorage.removeItem(LS.TOKEN); localStorage.removeItem(LS.SHEET_ID);
  }

  // ── API request ──────────────────────────────
  async function api(method, url, body) {
    if (!_token) throw new Error('Not authorized');
    const opts = { method, headers: { 'Authorization': `Bearer ${_token}`, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    let res = await fetch(url, opts);
    if (res.status === 401) {
      await authorize();
      opts.headers['Authorization'] = `Bearer ${_token}`;
      if (body) opts.body = JSON.stringify(body);
      res = await fetch(url, opts);
    }
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
    return res.json();
  }

  function enc(name) { return encodeURIComponent(`'${name}'`); }

  // ── Spreadsheet bootstrap ────────────────────
  async function createSpreadsheet() {
    const d = await api('POST','https://sheets.googleapis.com/v4/spreadsheets',{
      properties: { title: 'Financial Tracker — Finanze Personali' },
      sheets: [{ properties: { title: 'Info' } }]
    });
    _sheetId = d.spreadsheetId;
    localStorage.setItem(LS.SHEET_ID, _sheetId);
    return _sheetId;
  }

  async function _sheetExists(name) {
    const m = await api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}?fields=sheets.properties.title`);
    return m.sheets.some(s => s.properties.title === name);
  }

  async function _ensureSheet(name, header) {
    if (await _sheetExists(name)) return;
    await api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}:batchUpdate`,
      { requests: [{ addSheet: { properties: { title: name } } }] });
    await _writeRow(name, 1, header);
  }

  async function _writeRow(sheet, row, values) {
    await api('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(sheet)}!A${row}?valueInputOption=RAW`,
      { values: [values] });
  }

  async function _getRows(sheet, header, maxRow = 500) {
    const res = await api('GET',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(sheet)}!A1:${String.fromCharCode(65+header.length-1)}${maxRow}`);
    return (res.values || []).slice(1);
  }

  async function _getSheetNumericId(name) {
    const m = await api('GET', `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}?fields=sheets.properties`);
    const s = m.sheets.find(s => s.properties.title === name);
    return s ? s.properties.sheetId : null;
  }

  async function _deleteRow(sheetName, rowIndex) {
    const sid = await _getSheetNumericId(sheetName);
    if (sid === null) return;
    await api('POST', `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}:batchUpdate`, {
      requests: [{ deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: rowIndex-1, endIndex: rowIndex } } }]
    });
  }

  // ── Transactions ─────────────────────────────
  async function getTransactions(month, year) {
    const sname = sheetNameFor(month, year);
    const ckey  = `tx_${month}_${year}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;

    await _ensureSheet(sname, SHEET_HEADER);
    const rows = await _getRows(sname, SHEET_HEADER);
    const data = rows.map((r,i) => ({
      rowIndex: i+2,
      date:     r[COL.DATE]||'',
      amount:   parseAmount(r[COL.AMOUNT]||0),
      desc:     r[COL.DESC]||'',
      category: r[COL.CAT]||'',
      type:     r[COL.TYPE]||'Uscita',
      note:     r[COL.NOTE]||'',
    }));
    cacheSet(ckey, data);
    return data;
  }

  async function addTransaction(month, year, tx) {
    const sname = sheetNameFor(month, year);
    await _ensureSheet(sname, SHEET_HEADER);
    await api('POST',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(sname)}!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: [[tx.date, tx.amount, tx.desc, tx.category, tx.type, tx.note]] });
    cacheClear(`tx_${month}_${year}`);
  }

  async function editTransaction(month, year, rowIndex, tx) {
    const sname = sheetNameFor(month, year);
    await api('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(sname)}!A${rowIndex}:F${rowIndex}?valueInputOption=RAW`,
      { values: [[tx.date, tx.amount, tx.desc, tx.category, tx.type, tx.note]] });
    cacheClear(`tx_${month}_${year}`);
  }

  async function deleteTransaction(month, year, rowIndex) {
    await _deleteRow(sheetNameFor(month, year), rowIndex);
    cacheClear(`tx_${month}_${year}`);
  }

  // ── Annual summary (optimized: lazy) ─────────
  async function getAnnualSummary(year) {
    const ckey = `annual_${year}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;

    const result = [];
    // Sequential to avoid hammering the API
    for (let m = 1; m <= 12; m++) {
      try {
        const txs = await getTransactions(m, year);
        const entrate = txs.filter(t=>t.type==='Entrata').reduce((s,t)=>s+t.amount,0);
        const uscite  = txs.filter(t=>t.type==='Uscita') .reduce((s,t)=>s+t.amount,0);
        result.push({ month: m, entrate, uscite, saldo: entrate-uscite });
      } catch { result.push({ month: m, entrate:0, uscite:0, saldo:0 }); }
    }
    cacheSet(ckey, result);
    return result;
  }

  // ── Fixed expenses ────────────────────────────
  async function getFixedExpenses() {
    await _ensureSheet(FIXED_SHEET, FIXED_HEADER);
    const rows = await _getRows(FIXED_SHEET, FIXED_HEADER);
    return rows.map((r,i) => ({
      rowIndex: i+2,
      name:     r[FCOL.NAME]||'',
      amount:   parseAmount(r[FCOL.AMOUNT]||0),
      category: r[FCOL.CAT]||'',
      day:      parseInt(r[FCOL.DAY])||1,
      active:   r[FCOL.ACTIVE]!=='false',
      note:     r[FCOL.NOTE]||'',
    }));
  }

  async function addFixedExpense(fe) {
    await _ensureSheet(FIXED_SHEET, FIXED_HEADER);
    await api('POST',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(FIXED_SHEET)}!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: [[fe.name, fe.amount, fe.category, fe.day, String(fe.active), fe.note||'']] });
  }

  async function editFixedExpense(rowIndex, fe) {
    await api('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(FIXED_SHEET)}!A${rowIndex}:F${rowIndex}?valueInputOption=RAW`,
      { values: [[fe.name, fe.amount, fe.category, fe.day, String(fe.active), fe.note||'']] });
  }

  async function deleteFixedExpense(rowIndex) {
    await _deleteRow(FIXED_SHEET, rowIndex);
  }

  // ── Installments ──────────────────────────────
  async function getInstallments() {
    await _ensureSheet(INSTALL_SHEET, INSTALL_HEADER);
    const rows = await _getRows(INSTALL_SHEET, INSTALL_HEADER);
    return rows.map((r,i) => ({
      rowIndex:  i+2,
      name:      r[ICOL.NAME]||'',
      total:     parseAmount(r[ICOL.TOTAL]||0),
      nRates:    parseInt(r[ICOL.N_RATES])||0,
      paid:      parseInt(r[ICOL.PAID])||0,
      amount:    parseAmount(r[ICOL.AMOUNT]||0),
      category:  r[ICOL.CAT]||'',
      start:     r[ICOL.START]||'',
      note:      r[ICOL.NOTE]||'',
    }));
  }

  async function addInstallment(inst) {
    await _ensureSheet(INSTALL_SHEET, INSTALL_HEADER);
    await api('POST',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(INSTALL_SHEET)}!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: [[inst.name, inst.total, inst.nRates, inst.paid||0, inst.amount, inst.category, inst.start, inst.note||'']] });
  }

  async function updateInstallmentPaid(rowIndex, paid) {
    // Only update the "paid" column (D = col 4)
    await api('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(INSTALL_SHEET)}!D${rowIndex}?valueInputOption=RAW`,
      { values: [[paid]] });
  }

  async function deleteInstallment(rowIndex) {
    await _deleteRow(INSTALL_SHEET, rowIndex);
  }

  // ── Investment plans ──────────────────────────
  async function getInvestments() {
    await _ensureSheet(INVEST_SHEET, INVEST_HEADER);
    const rows = await _getRows(INVEST_SHEET, INVEST_HEADER, 200);
    return rows.map((r,i) => ({
      rowIndex:  i+2,
      id:        r[INV.ID]||String(i),
      name:      r[INV.NAME]||'',
      platform:  r[INV.PLATFORM]||'',
      ticker:    r[INV.TICKER]||'',
      type:      r[INV.TYPE]||'',
      invested:  parseAmount(r[INV.INVESTED]||0),
      current:   parseAmount(r[INV.CURRENT]||0),
      start:     r[INV.START]||'',
      freq:      r[INV.FREQ]||'Manuale',
      periodic:  parseAmount(r[INV.PERIODIC]||0),
      active:    r[INV.ACTIVE]!=='false',
      note:      r[INV.NOTE]||'',
    }));
  }

  async function addInvestment(inv) {
    await _ensureSheet(INVEST_SHEET, INVEST_HEADER);
    const id = 'inv_' + Date.now();
    await api('POST',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(INVEST_SHEET)}!A:L:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: [[id, inv.name, inv.platform, inv.ticker||'', inv.type, inv.invested||0, inv.current||0, inv.start, inv.freq, inv.periodic||0, String(inv.active!==false), inv.note||'']] });
    return id;
  }

  async function updateInvestmentValue(rowIndex, currentValue, totalInvested) {
    await api('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(INVEST_SHEET)}!F${rowIndex}:G${rowIndex}?valueInputOption=RAW`,
      { values: [[totalInvested, currentValue]] });
    cacheClear('investments');
  }

  async function editInvestment(rowIndex, inv) {
    await api('PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(INVEST_SHEET)}!A${rowIndex}:L${rowIndex}?valueInputOption=RAW`,
      { values: [[inv.id, inv.name, inv.platform, inv.ticker||'', inv.type, inv.invested||0, inv.current||0, inv.start, inv.freq, inv.periodic||0, String(inv.active!==false), inv.note||'']] });
    cacheClear('investments');
  }

  async function deleteInvestment(rowIndex) {
    await _deleteRow(INVEST_SHEET, rowIndex);
    cacheClear('investments');
  }

  // ── Investment deposits ───────────────────────
  async function getDeposits(planId) {
    await _ensureSheet(DEPOSIT_SHEET, DEPOSIT_HEADER);
    const rows = await _getRows(DEPOSIT_SHEET, DEPOSIT_HEADER, 1000);
    const all = rows.map((r,i) => ({
      rowIndex:  i+2,
      date:      r[DCOL.DATE]||'',
      planId:    r[DCOL.PLAN_ID]||'',
      planName:  r[DCOL.PLAN_NAME]||'',
      amount:    parseAmount(r[DCOL.AMOUNT]||0),
      type:      r[DCOL.TYPE]||'Versamento',
      note:      r[DCOL.NOTE]||'',
    }));
    return planId ? all.filter(d => d.planId === planId) : all;
  }

  async function addDeposit(dep) {
    await _ensureSheet(DEPOSIT_SHEET, DEPOSIT_HEADER);
    await api('POST',
      `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}/values/${enc(DEPOSIT_SHEET)}!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: [[dep.date, dep.planId, dep.planName, dep.amount, dep.type||'Versamento', dep.note||'']] });
    // Update invested total on the plan
    cacheClear('investments');
  }

  async function deleteDeposit(rowIndex) {
    await _deleteRow(DEPOSIT_SHEET, rowIndex);
    cacheClear('investments');
  }

  function getSheetId()   { return _sheetId; }
  function setSheetId(id) { _sheetId = id; localStorage.setItem(LS.SHEET_ID, id); }

  return {
    init, authorize, isAuthorized, logout,
    createSpreadsheet,
    getTransactions, addTransaction, editTransaction, deleteTransaction,
    getAnnualSummary,
    getFixedExpenses, addFixedExpense, editFixedExpense, deleteFixedExpense,
    getInstallments, addInstallment, updateInstallmentPaid, deleteInstallment,
    getInvestments, addInvestment, editInvestment, deleteInvestment, updateInvestmentValue,
    getDeposits, addDeposit, deleteDeposit,
    getSheetId, setSheetId,
  };
})();
