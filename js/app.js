// ═══════════════════════════════════════════════
//  SOSOLDI — App Controller
// ═══════════════════════════════════════════════

const App = (() => {

  // ── State ────────────────────────────────────
  let state = {
    month:        new Date().getMonth() + 1,
    year:         new Date().getFullYear(),
    transactions: [],
    annualData:   [],
    filter:       'all',
    txType:       'Uscita',
    loading:      false,
  };

  // ── DOM refs ─────────────────────────────────
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  // ── Boot ─────────────────────────────────────
  async function init() {
    setupSetupScreen();
    setupMonthYearPickers();
    setupNavigation();
    setupTransactionForm();
    setupFilters();

    const savedClientId = localStorage.getItem(LS.CLIENT_ID);
    const savedSheetId  = localStorage.getItem(LS.SHEET_ID);

    if (savedClientId) {
      $('client-id-input').value = savedClientId;
      if (savedSheetId) $('sheet-id-input').value = savedSheetId;

      try {
        await Sheets.init(savedClientId, savedSheetId);
        if (Sheets.isAuthorized()) {
          await enterApp();
          return;
        }
      } catch(e) { /* fall through to setup */ }
    }

    showScreen('setup');
  }

  // ── Setup screen ─────────────────────────────
  function setupSetupScreen() {
    $('connect-btn').addEventListener('click', handleConnect);
    $('help-link').addEventListener('click', e => {
      e.preventDefault();
      $('help-overlay').classList.add('open');
    });
    $('help-close').addEventListener('click', () => $('help-overlay').classList.remove('open'));
    $('help-close-btn').addEventListener('click', () => $('help-overlay').classList.remove('open'));
  }

  async function handleConnect() {
    const clientId = $('client-id-input').value.trim();
    const sheetId  = $('sheet-id-input').value.trim();

    if (!clientId) return showToast('Inserisci il Client ID', 'error');

    localStorage.setItem(LS.CLIENT_ID, clientId);
    if (sheetId) localStorage.setItem(LS.SHEET_ID, sheetId);

    setLoading(true, 'Connessione a Google...');
    try {
      await Sheets.init(clientId, sheetId || null);
      await Sheets.authorize();

      if (!Sheets.getSheetId()) {
        setLoading(true, 'Creazione foglio di calcolo...');
        await Sheets.createSpreadsheet();
      }

      await enterApp();
    } catch(e) {
      setLoading(false);
      showToast(e.message || 'Errore di connessione', 'error');
    }
  }

  async function enterApp() {
    showScreen('app');
    await loadData();
  }

  // ── Data loading ─────────────────────────────
  async function loadData(silent = false) {
    if (!silent) setLoading(true, 'Caricamento dati...');
    try {
      const [txs, annual] = await Promise.all([
        Sheets.getTransactions(state.month, state.year),
        Sheets.getAnnualSummary(state.year),
      ]);
      state.transactions = txs;
      state.annualData   = annual;
      renderAll();
    } catch(e) {
      showToast(e.message || 'Errore di rete', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────
  function renderAll() {
    renderKPIs();
    renderRecentList();
    renderFullList();
    renderCatBreakdown();
    renderAnnualTable();
    Charts.renderPie(state.transactions);
    Charts.renderBar(state.annualData);

    const ml = $('chart-month-label');
    if (ml) ml.textContent = `${MONTHS[state.month-1]} ${state.year}`;
    const ay = $('annual-year');
    if (ay) ay.textContent = state.year;
  }

  function renderKPIs() {
    const txs = state.transactions;
    const entrate = txs.filter(t=>t.type==='Entrata').reduce((s,t)=>s+t.amount,0);
    const uscite  = txs.filter(t=>t.type==='Uscita') .reduce((s,t)=>s+t.amount,0);
    const saldo   = entrate - uscite;
    const rispPct = entrate > 0 ? ((entrate-uscite)/entrate*100).toFixed(1) : null;
    const max     = Math.max(entrate, uscite, 1);

    $('kpi-entrate').textContent = formatEuro(entrate);
    $('kpi-uscite') .textContent = formatEuro(uscite);
    $('kpi-saldo')  .textContent = formatEuro(saldo);
    $('kpi-saldo').style.color   = saldo >= 0 ? 'var(--green)' : 'var(--red)';

    $('bar-entrate').style.width = `${entrate/max*100}%`;
    $('bar-uscite') .style.width = `${uscite/max*100}%`;

    $('kpi-risparmio').textContent = rispPct !== null
      ? `Tasso di risparmio: ${rispPct}%`
      : 'Nessuna entrata registrata';
  }

  function buildTxItem(tx) {
    const div = document.createElement('div');
    div.className = 'tx-item';
    div.innerHTML = `
      <div class="tx-icon">${getCategoryIcon(tx.category)}</div>
      <div class="tx-info">
        <div class="tx-desc">${escHtml(tx.desc || tx.category)}</div>
        <div class="tx-meta">${formatDate(tx.date)}${tx.note ? ' · '+escHtml(tx.note) : ''}</div>
      </div>
      <div class="tx-amount ${tx.type.toLowerCase()}">${tx.type==='Uscita'?'-':'+'}${formatEuro(tx.amount)}</div>
      <button class="tx-delete" title="Elimina">✕</button>
    `;
    div.querySelector('.tx-delete').addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(`Eliminare "${tx.desc}"?`)) return;
      setLoading(true, 'Eliminazione...');
      try {
        await Sheets.deleteTransaction(state.month, state.year, tx.rowIndex);
        await loadData(true);
        showToast('Transazione eliminata');
      } catch(err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    });
    return div;
  }

  function renderRecentList() {
    const el = $('recent-list');
    const sorted = [...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
    const recent = sorted.slice(0,5);
    el.innerHTML = '';
    if (recent.length === 0) {
      el.innerHTML = '<p style="color:var(--muted);font-size:14px;text-align:center;padding:16px">Nessuna transazione</p>';
      return;
    }
    recent.forEach(t => el.appendChild(buildTxItem(t)));
  }

  function renderFullList() {
    const el   = $('tx-list-full');
    const empty = $('tx-empty');
    let txs = [...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
    if (state.filter !== 'all') txs = txs.filter(t=>t.type===state.filter);
    el.innerHTML = '';
    if (txs.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    txs.forEach(t => el.appendChild(buildTxItem(t)));
  }

  function renderCatBreakdown() {
    const el = $('cat-breakdown');
    const uscite = state.transactions.filter(t=>t.type==='Uscita');
    const total  = uscite.reduce((s,t)=>s+t.amount,0);
    const totals = {};
    uscite.forEach(t => { totals[t.category] = (totals[t.category]||0) + t.amount; });
    const sorted = Object.entries(totals).sort((a,b)=>b[1]-a[1]);

    el.innerHTML = '';
    if (sorted.length === 0) {
      el.innerHTML = '<p style="color:var(--muted);font-size:14px;text-align:center;padding:16px">Nessuna spesa</p>';
      return;
    }

    sorted.forEach(([name,val]) => {
      const pct = total > 0 ? (val/total*100).toFixed(1) : 0;
      const color = getCategoryColor(name);
      const div = document.createElement('div');
      div.className = 'cat-item';
      div.innerHTML = `
        <div class="cat-header">
          <span class="cat-name">${name}</span>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="cat-pct">${pct}%</span>
            <span class="cat-amount">${formatEuro(val)}</span>
          </div>
        </div>
        <div class="cat-bar">
          <div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      `;
      el.appendChild(div);
    });
  }

  function renderAnnualTable() {
    const tbody = $('annual-tbody');
    tbody.innerHTML = '';
    state.annualData.forEach(d => {
      const isCurrentMonth = d.month === state.month;
      const tr = document.createElement('tr');
      if (isCurrentMonth) tr.className = 'current-month';
      const sign = d.saldo >= 0 ? 'pos' : 'neg';
      tr.innerHTML = `
        <td>${MONTHS[d.month-1]}</td>
        <td class="pos">${d.entrate > 0 ? formatEuro(d.entrate) : '—'}</td>
        <td class="neg">${d.uscite  > 0 ? formatEuro(d.uscite)  : '—'}</td>
        <td class="${sign}">${(d.entrate+d.uscite) > 0 ? formatEuro(d.saldo) : '—'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── Month/Year pickers ───────────────────────
  function setupMonthYearPickers() {
    const mSel = $('month-select');
    const ySel = $('year-select');

    MONTHS.forEach((m,i) => {
      const opt = document.createElement('option');
      opt.value = i+1;
      opt.textContent = m;
      if (i+1 === state.month) opt.selected = true;
      mSel.appendChild(opt);
    });

    const currentYear = new Date().getFullYear();
    for (let y = currentYear-2; y <= currentYear+1; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === state.year) opt.selected = true;
      ySel.appendChild(opt);
    }

    mSel.addEventListener('change', async () => {
      state.month = parseInt(mSel.value);
      await loadData();
    });
    ySel.addEventListener('change', async () => {
      state.year = parseInt(ySel.value);
      await loadData();
    });
  }

  // ── Navigation ───────────────────────────────
  function setupNavigation() {
    $$('.nav-btn[data-tab]').forEach(btn => {
      if (btn.id === 'nav-settings-btn') return;
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        $$('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.tab-content').forEach(t => t.classList.remove('active'));
        $(`tab-${tab}`)?.classList.add('active');
        if (tab === 'transazioni') renderFullList();
        if (tab === 'riepilogo')   { renderCatBreakdown(); renderAnnualTable(); }
      });
    });

    $('view-all-btn').addEventListener('click', () => {
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-tab="transazioni"]').classList.add('active');
      $$('.tab-content').forEach(t => t.classList.remove('active'));
      $('tab-transazioni').classList.add('active');
    });

    $('sync-btn').addEventListener('click', async () => {
      $('sync-btn').classList.add('spinning');
      await loadData(false);
      $('sync-btn').classList.remove('spinning');
      showToast('Sincronizzato ✓', 'success');
    });

    $('logout-btn').addEventListener('click', () => {
      if (!confirm('Disconnettersi da Google?')) return;
      Sheets.logout();
      showScreen('setup');
    });
  }

  // ── Transaction form ─────────────────────────
  function setupTransactionForm() {
    // Set default date
    $('form-date').value = todayISO();

    // Type toggle
    $$('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.txType = btn.dataset.type;
        populateCategories();
      });
    });

    populateCategories();

    $('save-tx-btn').addEventListener('click', handleSave);
  }

  function populateCategories() {
    const sel = $('form-category');
    sel.innerHTML = '';
    const cats = state.txType === 'Uscita' ? CATEGORIES_EXP : CATEGORIES_INC;
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
  }

  async function handleSave() {
    const amount = parseFloat($('form-amount').value);
    const desc   = $('form-desc').value.trim();
    const cat    = $('form-category').value;
    const date   = $('form-date').value;
    const note   = $('form-notes').value.trim();

    if (!amount || amount <= 0) return showToast('Inserisci un importo valido', 'error');
    if (!desc)   return showToast('Inserisci una descrizione', 'error');
    if (!date)   return showToast('Seleziona una data', 'error');

    // Determine target month/year from date
    const d = new Date(date);
    const txMonth = d.getMonth() + 1;
    const txYear  = d.getFullYear();

    setLoading(true, 'Salvataggio...');
    try {
      await Sheets.addTransaction(txMonth, txYear, {
        date, amount, desc, category: cat, type: state.txType, note
      });

      // Reset form
      $('form-amount').value = '';
      $('form-desc').value   = '';
      $('form-notes').value  = '';
      $('form-date').value   = todayISO();

      // Reload if same month
      if (txMonth === state.month && txYear === state.year) {
        await loadData(true);
      }

      showToast('Transazione salvata! ✓', 'success');

      // Go to dashboard
      $$('.nav-btn').forEach(b=>b.classList.remove('active'));
      document.querySelector('[data-tab="dashboard"]').classList.add('active');
      $$('.tab-content').forEach(t=>t.classList.remove('active'));
      $('tab-dashboard').classList.add('active');

    } catch(e) {
      showToast(e.message || 'Errore salvataggio', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Filters ──────────────────────────────────
  function setupFilters() {
    $$('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.filter-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        state.filter = btn.dataset.filter;
        renderFullList();
      });
    });
  }

  // ── Helpers ──────────────────────────────────
  function showScreen(name) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $(name === 'app' ? 'app-screen' : 'setup-screen').classList.add('active');
  }

  function setLoading(on, text='') {
    state.loading = on;
    const el = $('loading-overlay');
    if (on) {
      $('loading-text').textContent = text;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  let _toastTimer = null;
  function showToast(msg, type='') {
    const el = $('toast');
    el.textContent = msg;
    el.className = `toast${type ? ' '+type : ''}`;
    el.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { init };
})();

// ── Service Worker registration ──────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ── Start ────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => App.init());
