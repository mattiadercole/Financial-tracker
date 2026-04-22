// ═══════════════════════════════════════════════
//  SOSOLDI — App Controller v3
// ═══════════════════════════════════════════════

const App = (() => {
  let state = {
    month: new Date().getMonth()+1, year: new Date().getFullYear(),
    transactions: [], annualData: [],
    fixedExpenses: [], installments: [],
    investments: [], deposits: [],
    filter: 'all', txType: 'Uscita',
    editingTx: null, editingFixed: null, editingInstall: null, editingInvest: null,
    annualLoaded: false,
  };

  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // ── Boot ──────────────────────────────────────
  async function init() {
    _setupSetup(); _setupPickers(); _setupNav();
    _setupTxForm(); _setupFilters(); _setupCatManager();
    _setupFixedModal(); _setupInstallModal(); _setupInvestModal();
    _setupDepositModal(); _setupEditTxModal();

    const cid = localStorage.getItem(LS.CLIENT_ID);
    const sid = localStorage.getItem(LS.SHEET_ID);
    if (cid) {
      $('client-id-input').value = cid;
      if (sid) $('sheet-id-input').value = sid;
      try {
        await Sheets.init(cid, sid);
        if (Sheets.isAuthorized()) { await _enterApp(); return; }
      } catch(e) {}
    }
    _showScreen('setup');
  }

  // ── Setup screen ──────────────────────────────
  function _setupSetup() {
    $('connect-btn').addEventListener('click', async () => {
      const cid = $('client-id-input').value.trim();
      const sid = $('sheet-id-input').value.trim();
      if (!cid) return _toast('Inserisci il Client ID','error');
      localStorage.setItem(LS.CLIENT_ID, cid);
      if (sid) localStorage.setItem(LS.SHEET_ID, sid);
      _load(true,'Connessione a Google...');
      try {
        await Sheets.init(cid, sid||null);
        await Sheets.authorize();
        if (!Sheets.getSheetId()) { _load(true,'Creazione foglio...'); await Sheets.createSpreadsheet(); }
        await _enterApp();
      } catch(e) { _load(false); _toast(e.message||'Errore','error'); }
    });
    $('help-link').addEventListener('click', e=>{ e.preventDefault(); $('help-overlay').classList.add('open'); });
    $('help-close').addEventListener('click', ()=>$('help-overlay').classList.remove('open'));
    $('help-close-btn').addEventListener('click', ()=>$('help-overlay').classList.remove('open'));
  }

  async function _enterApp() { _showScreen('app'); await _loadCore(); }

  // ── Core data (fast: only current month) ──────
  async function _loadCore(silent=false) {
    if (!silent) _load(true,'Caricamento...');
    try {
      state.transactions = await Sheets.getTransactions(state.month, state.year);
      state.annualLoaded = false;
      _renderDashboard();
      _renderTxList();
    } catch(e) { _toast(e.message||'Errore rete','error'); }
    finally { _load(false); }
  }

  // ── Lazy annual load ──────────────────────────
  async function _loadAnnual() {
    if (state.annualLoaded) return;
    _load(true,'Caricamento riepilogo annuale...');
    try {
      state.annualData = await Sheets.getAnnualSummary(state.year);
      state.annualLoaded = true;
      _renderRiepilogo();
      Charts.renderBar(state.annualData);
    } catch(e) { _toast(e.message,'error'); }
    finally { _load(false); }
  }

  async function _loadFixedAndInstall() {
    try {
      [state.fixedExpenses, state.installments] = await Promise.all([
        Sheets.getFixedExpenses(), Sheets.getInstallments()
      ]);
      _renderFixed(); _renderInstallments();
    } catch(e) { _toast(e.message,'error'); }
  }

  async function _loadInvestments() {
    _load(true,'Caricamento investimenti...');
    try {
      state.investments = await Sheets.getInvestments();
      state.deposits    = await Sheets.getDeposits();
      _renderInvestments();
    } catch(e) { _toast(e.message,'error'); }
    finally { _load(false); }
  }

  // ── Dashboard render ──────────────────────────
  function _renderDashboard() {
    const txs = state.transactions;
    const entrate = txs.filter(t=>t.type==='Entrata').reduce((s,t)=>s+t.amount,0);
    const uscite  = txs.filter(t=>t.type==='Uscita') .reduce((s,t)=>s+t.amount,0);
    const saldo   = entrate - uscite;
    const max     = Math.max(entrate,uscite,1);
    const rsp     = entrate>0 ? pct(entrate-uscite,entrate) : null;

    $('kpi-entrate').textContent = formatEuro(entrate);
    $('kpi-uscite') .textContent = formatEuro(uscite);
    $('kpi-saldo')  .textContent = formatEuro(saldo);
    $('kpi-saldo').style.color   = saldo>=0?'var(--green)':'var(--red)';
    $('bar-entrate').style.width = `${entrate/max*100}%`;
    $('bar-uscite') .style.width = `${uscite/max*100}%`;
    $('kpi-risparmio').textContent = rsp!==null ? `Tasso di risparmio: ${rsp}%` : 'Nessuna entrata';

    const ml = $('chart-month-label');
    if (ml) ml.textContent = `${MONTHS[state.month-1]} ${state.year}`;

    Charts.renderPie(txs);

    // Recent list
    const el = $('recent-list');
    const sorted = [...txs].sort((a,b)=>b.date.localeCompare(a.date));
    el.innerHTML = '';
    if (!sorted.length) { el.innerHTML='<p class="empty-msg">Nessuna transazione</p>'; return; }
    sorted.slice(0,5).forEach(t=>el.appendChild(_buildTxItem(t)));
  }

  // ── TX list ───────────────────────────────────
  function _renderTxList() {
    const el = $('tx-list-full'), empty = $('tx-empty');
    let txs = [...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));
    if (state.filter!=='all') txs = txs.filter(t=>t.type===state.filter);
    el.innerHTML = '';
    if (!txs.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    txs.forEach(t=>el.appendChild(_buildTxItem(t)));
  }

  function _buildTxItem(tx) {
    const div = document.createElement('div'); div.className='tx-item';
    div.innerHTML=`
      <div class="tx-icon">${getCategoryIcon(tx.category)}</div>
      <div class="tx-info">
        <div class="tx-desc">${esc(tx.desc||tx.category)}</div>
        <div class="tx-meta">${formatDate(tx.date)}${tx.note?' · '+esc(tx.note):''}</div>
      </div>
      <div class="tx-amount ${tx.type.toLowerCase()}">${tx.type==='Uscita'?'-':'+'}${formatEuro(tx.amount)}</div>
      <div class="tx-actions">
        <button class="tx-btn tx-edit" title="Modifica">✏️</button>
        <button class="tx-btn tx-delete" title="Elimina">✕</button>
      </div>`;
    div.querySelector('.tx-edit').onclick = e=>{ e.stopPropagation(); _openEditTxModal(tx); };
    div.querySelector('.tx-delete').onclick = async e=>{
      e.stopPropagation();
      if (!confirm(`Eliminare "${tx.desc}"?`)) return;
      _load(true,'Eliminazione...');
      try { await Sheets.deleteTransaction(state.month,state.year,tx.rowIndex); await _loadCore(true); _toast('Eliminata'); }
      catch(err){ _toast(err.message,'error'); } finally { _load(false); }
    };
    return div;
  }

  // ── Riepilogo render ──────────────────────────
  function _renderRiepilogo() {
    // Category breakdown
    const el = $('cat-breakdown');
    const uscite = state.transactions.filter(t=>t.type==='Uscita');
    const total  = uscite.reduce((s,t)=>s+t.amount,0);
    const tots = {}; uscite.forEach(t=>{ tots[t.category]=(tots[t.category]||0)+t.amount; });
    const sorted = Object.entries(tots).sort((a,b)=>b[1]-a[1]);
    el.innerHTML = '';
    if (!sorted.length) { el.innerHTML='<p class="empty-msg">Nessuna spesa</p>'; return; }
    sorted.forEach(([name,val])=>{
      const p = total>0?(val/total*100).toFixed(1):0;
      const color = getCategoryColor(name);
      const d = document.createElement('div'); d.className='cat-item';
      d.innerHTML=`
        <div class="cat-header">
          <span class="cat-name">${name}</span>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="cat-pct">${p}%</span>
            <span class="cat-amount">${formatEuro(val)}</span>
          </div>
        </div>
        <div class="cat-bar"><div class="cat-bar-fill" style="width:${p}%;background:${color}"></div></div>`;
      el.appendChild(d);
    });

    // Annual table
    const tbody = $('annual-tbody');
    if (!tbody) return;
    tbody.innerHTML='';
    if (!state.annualData.length) return;
    state.annualData.forEach(d=>{
      const tr=document.createElement('tr');
      if (d.month===state.month) tr.className='current-month';
      const sign=d.saldo>=0?'pos':'neg';
      tr.innerHTML=`<td>${MONTHS[d.month-1]}</td><td class="pos">${d.entrate>0?formatEuro(d.entrate):'—'}</td><td class="neg">${d.uscite>0?formatEuro(d.uscite):'—'}</td><td class="${sign}">${(d.entrate+d.uscite)>0?formatEuro(d.saldo):'—'}</td>`;
      tbody.appendChild(tr);
    });
    const ay=$('annual-year'); if(ay) ay.textContent=state.year;
  }

  // ════════════════════════════════════════════
  //  FIXED EXPENSES
  // ════════════════════════════════════════════
  function _renderFixed() {
    const el = $('fixed-list');
    el.innerHTML = '';
    if (!state.fixedExpenses.length) { el.innerHTML='<p class="empty-msg">Nessuna spesa fissa</p>'; return; }
    state.fixedExpenses.forEach(fe=>{
      const d=document.createElement('div'); d.className=`fixed-item${fe.active?'':' inactive'}`;
      d.innerHTML=`
        <div class="fixed-icon">${getCategoryIcon(fe.category)}</div>
        <div class="tx-info">
          <div class="tx-desc">${esc(fe.name)}</div>
          <div class="tx-meta">Giorno ${fe.day} · ${esc(fe.category)}</div>
        </div>
        <div class="fixed-amount">${formatEuro(fe.amount)}/mese</div>
        <div class="tx-actions">
          <button class="tx-btn tx-edit">✏️</button>
          <button class="tx-btn tx-delete">✕</button>
        </div>`;
      d.querySelector('.tx-edit').onclick=()=>_openFixedModal(fe);
      d.querySelector('.tx-delete').onclick=async()=>{
        if(!confirm(`Eliminare "${fe.name}"?`)) return;
        _load(true); try{ await Sheets.deleteFixedExpense(fe.rowIndex); await _loadFixedAndInstall(); _toast('Eliminata'); }
        catch(e){_toast(e.message,'error');} finally{_load(false);}
      };
      el.appendChild(d);
    });
    // Total
    const tot = state.fixedExpenses.filter(f=>f.active).reduce((s,f)=>s+f.amount,0);
    $('fixed-total').textContent = `Totale mensile: ${formatEuro(tot)}`;
  }

  function _setupFixedModal() {
    $('add-fixed-btn').onclick=()=>_openFixedModal(null);
    $('fixed-modal-close').onclick=()=>_closeModal('fixed-modal');
    $('fixed-modal-overlay').onclick=()=>_closeModal('fixed-modal');
    $('fixed-cancel-btn').onclick=()=>_closeModal('fixed-modal');
    $('fixed-save-btn').onclick=_saveFixed;
  }

  function _openFixedModal(fe) {
    state.editingFixed = fe;
    $('fixed-modal-title').textContent = fe ? 'Modifica Spesa Fissa' : 'Nuova Spesa Fissa';
    $('fixed-name').value     = fe?.name||'';
    $('fixed-amount').value   = fe?.amount||'';
    $('fixed-day').value      = fe?.day||1;
    $('fixed-note').value     = fe?.note||'';
    $('fixed-active').checked = fe ? fe.active : true;
    _populateCatSelect('fixed-category', 'Uscita', fe?.category);
    _openModal('fixed-modal');
  }

  async function _saveFixed() {
    const fe = {
      name: $('fixed-name').value.trim(), amount: parseFloat($('fixed-amount').value),
      category: $('fixed-category').value, day: parseInt($('fixed-day').value)||1,
      active: $('fixed-active').checked, note: $('fixed-note').value.trim(),
    };
    if (!fe.name||!fe.amount) return _toast('Compila nome e importo','error');
    _load(true,'Salvataggio...');
    try {
      if (state.editingFixed) await Sheets.editFixedExpense(state.editingFixed.rowIndex, fe);
      else await Sheets.addFixedExpense(fe);
      _closeModal('fixed-modal'); await _loadFixedAndInstall(); _toast('Salvata ✓','success');
    } catch(e){_toast(e.message,'error');} finally{_load(false);}
  }

  // ════════════════════════════════════════════
  //  INSTALLMENTS
  // ════════════════════════════════════════════
  function _renderInstallments() {
    const el = $('install-list');
    el.innerHTML = '';
    if (!state.installments.length) { el.innerHTML='<p class="empty-msg">Nessuna spesa rateizzata</p>'; return; }
    state.installments.forEach(inst=>{
      const remaining = inst.nRates - inst.paid;
      const progress  = inst.nRates>0 ? (inst.paid/inst.nRates*100) : 0;
      const d=document.createElement('div'); d.className='install-item';
      d.innerHTML=`
        <div class="install-header">
          <div>
            <div class="tx-desc">${esc(inst.name)}</div>
            <div class="tx-meta">${esc(inst.category)} · Iniziato ${formatDate(inst.start)}</div>
          </div>
          <div class="install-amounts">
            <div class="install-rate">${formatEuro(inst.amount)}/rata</div>
            <div class="install-remaining">${remaining > 0 ? remaining+' rimaste' : '✅ Completato'}</div>
          </div>
        </div>
        <div class="install-progress-bar"><div class="install-progress-fill" style="width:${progress}%"></div></div>
        <div class="install-footer">
          <span class="install-pct">${inst.paid}/${inst.nRates} rate · ${formatEuro(inst.paid*inst.amount)} pagato</span>
          <div class="tx-actions" style="display:flex">
            ${remaining>0?`<button class="tx-btn tx-pay" title="Segna prossima rata">✓</button>`:''}
            <button class="tx-btn tx-delete" title="Elimina">✕</button>
          </div>
        </div>`;
      d.querySelector('.tx-delete')?.addEventListener('click', async()=>{
        if(!confirm(`Eliminare "${inst.name}"?`)) return;
        _load(true); try{ await Sheets.deleteInstallment(inst.rowIndex); await _loadFixedAndInstall(); _toast('Eliminata'); }
        catch(e){_toast(e.message,'error');} finally{_load(false);}
      });
      d.querySelector('.tx-pay')?.addEventListener('click', async()=>{
        _load(true,'Aggiornamento...');
        try{ await Sheets.updateInstallmentPaid(inst.rowIndex, inst.paid+1); await _loadFixedAndInstall(); _toast('Rata segnata ✓','success'); }
        catch(e){_toast(e.message,'error');} finally{_load(false);}
      });
      el.appendChild(d);
    });
  }

  function _setupInstallModal() {
    $('add-install-btn').onclick=()=>_openInstallModal();
    $('install-modal-close').onclick=()=>_closeModal('install-modal');
    $('install-modal-overlay').onclick=()=>_closeModal('install-modal');
    $('install-cancel-btn').onclick=()=>_closeModal('install-modal');
    $('install-save-btn').onclick=_saveInstall;

    // Auto-calculate rate amount when total or nRates changes
    const calc=()=>{
      const tot=parseFloat($('install-total').value)||0;
      const n  =parseInt($('install-nrates').value)||0;
      if(tot&&n) $('install-amount').value=(tot/n).toFixed(2);
    };
    $('install-total').oninput=calc;
    $('install-nrates').oninput=calc;
  }

  function _openInstallModal() {
    $('install-name').value=''; $('install-total').value='';
    $('install-nrates').value=''; $('install-amount').value='';
    $('install-start').value=todayISO(); $('install-note').value='';
    _populateCatSelect('install-category','Uscita');
    _openModal('install-modal');
  }

  async function _saveInstall() {
    const inst = {
      name: $('install-name').value.trim(), total: parseFloat($('install-total').value),
      nRates: parseInt($('install-nrates').value), paid: 0,
      amount: parseFloat($('install-amount').value), category: $('install-category').value,
      start: $('install-start').value, note: $('install-note').value.trim(),
    };
    if (!inst.name||!inst.total||!inst.nRates) return _toast('Compila tutti i campi','error');
    _load(true,'Salvataggio...');
    try{ await Sheets.addInstallment(inst); _closeModal('install-modal'); await _loadFixedAndInstall(); _toast('Rateizzazione aggiunta ✓','success'); }
    catch(e){_toast(e.message,'error');} finally{_load(false);}
  }

  // ════════════════════════════════════════════
  //  INVESTMENTS
  // ════════════════════════════════════════════
  function _renderInvestments() {
    const investments = state.investments;
    const deposits    = state.deposits;

    // KPIs
    const totalInvested = investments.reduce((s,i)=>s+i.invested,0);
    const totalCurrent  = investments.reduce((s,i)=>s+i.current,0);
    const totalGain     = totalCurrent - totalInvested;
    const gainPct       = totalInvested>0 ? ((totalGain/totalInvested)*100).toFixed(2) : 0;

    $('inv-kpi-invested').textContent = formatEuro(totalInvested);
    $('inv-kpi-current').textContent  = formatEuro(totalCurrent);
    $('inv-kpi-gain').textContent     = (totalGain>=0?'+':'')+formatEuro(totalGain);
    $('inv-kpi-gain').style.color     = totalGain>=0?'var(--green)':'var(--red)';
    $('inv-kpi-pct').textContent      = (gainPct>=0?'+':'')+gainPct+'%';
    $('inv-kpi-pct').style.color      = gainPct>=0?'var(--green)':'var(--red)';

    // Plans list
    const el = $('invest-list');
    el.innerHTML='';
    if (!investments.length) { el.innerHTML='<p class="empty-msg">Nessun piano di investimento</p>'; return; }

    // Group by platform
    const byPlatform = {};
    investments.forEach(i=>{ (byPlatform[i.platform]||(byPlatform[i.platform]=[])).push(i); });

    Object.entries(byPlatform).forEach(([platform, plans])=>{
      const platDiv = document.createElement('div'); platDiv.className='invest-platform-group';
      const platTotal = plans.reduce((s,p)=>s+p.current,0);
      platDiv.innerHTML=`<div class="invest-platform-header"><span class="invest-platform-name">🏦 ${esc(platform)}</span><span class="invest-platform-total">${formatEuro(platTotal)}</span></div>`;

      plans.forEach(inv=>{
        const gain = inv.current - inv.invested;
        const gp   = inv.invested>0?((gain/inv.invested)*100).toFixed(2):0;
        const planDeposits = deposits.filter(d=>d.planId===inv.id);
        const card = document.createElement('div'); card.className='invest-card';
        card.innerHTML=`
          <div class="invest-card-top">
            <div>
              <div class="invest-name">${esc(inv.name)}</div>
              <div class="invest-meta">${esc(inv.type)}${inv.ticker?' · '+esc(inv.ticker):''}${inv.freq!=='Manuale'?' · '+inv.freq:''}</div>
            </div>
            <div class="invest-card-actions">
              <button class="tx-btn tx-edit inv-edit-btn">✏️</button>
              <button class="tx-btn tx-delete inv-del-btn">✕</button>
            </div>
          </div>
          <div class="invest-amounts">
            <div><div class="invest-amt-label">Investito</div><div class="invest-amt-val">${formatEuro(inv.invested)}</div></div>
            <div><div class="invest-amt-label">Valore attuale</div><div class="invest-amt-val" style="color:var(--accent2)">${formatEuro(inv.current)}</div></div>
            <div><div class="invest-amt-label">Rendimento</div><div class="invest-amt-val" style="color:${gain>=0?'var(--green)':'var(--red)'}">${gain>=0?'+':''}${formatEuro(gain)} (${gp}%)</div></div>
          </div>
          <div class="invest-card-footer">
            <span class="invest-deposits-count">${planDeposits.length} versamenti</span>
            <div style="display:flex;gap:6px">
              <button class="btn-small btn-deposit inv-deposit-btn">+ Versamento</button>
              <button class="btn-small btn-update-val inv-update-btn">Aggiorna valore</button>
            </div>
          </div>`;

        card.querySelector('.inv-edit-btn').onclick=()=>_openInvestModal(inv);
        card.querySelector('.inv-del-btn').onclick=async()=>{
          if(!confirm(`Eliminare "${inv.name}"?`)) return;
          _load(true); try{ await Sheets.deleteInvestment(inv.rowIndex); await _loadInvestments(); _toast('Piano eliminato'); }
          catch(e){_toast(e.message,'error');} finally{_load(false);}
        };
        card.querySelector('.inv-deposit-btn').onclick=()=>_openDepositModal(inv);
        card.querySelector('.inv-update-btn').onclick=()=>_openUpdateValueModal(inv);

        platDiv.appendChild(card);
      });
      el.appendChild(platDiv);
    });

    // Allocation pie
    Charts.renderInvestmentPie(investments);

    // Allocation legend
    const legEl = $('invest-pie-legend');
    if (legEl) {
      const COLORS=['#6366f1','#34d399','#f59e0b','#f43f5e','#06b6d4','#a78bfa','#84cc16','#ec4899'];
      const active = investments.filter(i=>i.active&&i.current>0);
      const tot    = active.reduce((s,i)=>s+i.current,0);
      legEl.innerHTML = active.map((inv,idx)=>`
        <div class="legend-item">
          <div class="legend-dot" style="background:${COLORS[idx%COLORS.length]}"></div>
          <span>${esc(inv.name)} ${pct(inv.current,tot)}%</span>
        </div>`).join('');
    }
  }

  // ── Investment modal ──────────────────────────
  function _setupInvestModal() {
    $('add-invest-btn').onclick=()=>_openInvestModal(null);
    $('invest-modal-close').onclick=()=>_closeModal('invest-modal');
    $('invest-modal-overlay').onclick=()=>_closeModal('invest-modal');
    $('invest-cancel-btn').onclick=()=>_closeModal('invest-modal');
    $('invest-save-btn').onclick=_saveInvest;

    // Populate platform & type selects
    const ps=$('invest-platform');
    KNOWN_PLATFORMS.forEach(p=>{ const o=document.createElement('option'); o.value=p; o.textContent=p; ps.appendChild(o); });
    const ts=$('invest-type');
    INVEST_TYPES.forEach(t=>{ const o=document.createElement('option'); o.value=t; o.textContent=t; ts.appendChild(o); });
    const fs=$('invest-freq');
    INVEST_FREQS.forEach(f=>{ const o=document.createElement('option'); o.value=f; o.textContent=f; fs.appendChild(o); });
  }

  function _openInvestModal(inv) {
    state.editingInvest = inv;
    $('invest-modal-title').textContent = inv ? 'Modifica Piano' : 'Nuovo Piano di Investimento';
    $('invest-name').value    = inv?.name||'';
    $('invest-platform').value= inv?.platform||KNOWN_PLATFORMS[0];
    $('invest-ticker').value  = inv?.ticker||'';
    $('invest-type').value    = inv?.type||INVEST_TYPES[0];
    $('invest-start').value   = inv?.start||todayISO();
    $('invest-freq').value    = inv?.freq||'Manuale';
    $('invest-periodic').value= inv?.periodic||'';
    $('invest-note').value    = inv?.note||'';
    _openModal('invest-modal');
  }

  async function _saveInvest() {
    const inv = {
      id: state.editingInvest?.id||'',
      name: $('invest-name').value.trim(),
      platform: $('invest-platform').value,
      ticker: $('invest-ticker').value.trim(),
      type: $('invest-type').value,
      invested: state.editingInvest?.invested||0,
      current: state.editingInvest?.current||0,
      start: $('invest-start').value,
      freq: $('invest-freq').value,
      periodic: parseFloat($('invest-periodic').value)||0,
      active: true,
      note: $('invest-note').value.trim(),
    };
    if (!inv.name) return _toast('Inserisci un nome','error');
    _load(true,'Salvataggio...');
    try {
      if (state.editingInvest) await Sheets.editInvestment(state.editingInvest.rowIndex, inv);
      else await Sheets.addInvestment(inv);
      _closeModal('invest-modal'); await _loadInvestments(); _toast('Piano salvato ✓','success');
    } catch(e){_toast(e.message,'error');} finally{_load(false);}
  }

  // ── Deposit modal ─────────────────────────────
  function _setupDepositModal() {
    $('deposit-modal-close').onclick=()=>_closeModal('deposit-modal');
    $('deposit-modal-overlay').onclick=()=>_closeModal('deposit-modal');
    $('deposit-cancel-btn').onclick=()=>_closeModal('deposit-modal');
    $('deposit-save-btn').onclick=_saveDeposit;
  }

  function _openDepositModal(inv) {
    $('deposit-plan-name').textContent = inv.name;
    $('deposit-amount').value='';
    $('deposit-date').value=todayISO();
    $('deposit-note').value='';
    $('deposit-save-btn').dataset.planId   = inv.id;
    $('deposit-save-btn').dataset.planName = inv.name;
    $('deposit-save-btn').dataset.rowIndex = inv.rowIndex;
    $('deposit-save-btn').dataset.invested = inv.invested;
    _openModal('deposit-modal');
  }

  async function _saveDeposit() {
    const btn     = $('deposit-save-btn');
    const amount  = parseFloat($('deposit-amount').value);
    const date    = $('deposit-date').value;
    const note    = $('deposit-note').value.trim();
    const planId  = btn.dataset.planId;
    const planName= btn.dataset.planName;
    const rowIndex= parseInt(btn.dataset.rowIndex);
    const oldInv  = parseInt(btn.dataset.invested)||0;
    if (!amount||amount<=0) return _toast('Inserisci un importo','error');
    _load(true,'Salvataggio versamento...');
    try {
      await Sheets.addDeposit({ date, planId, planName, amount, type:'Versamento', note });
      // Update invested total on plan
      const newInvested = oldInv + amount;
      const inv = state.investments.find(i=>i.id===planId);
      const newCurrent  = inv ? Math.max(inv.current, newInvested) : newInvested;
      await Sheets.updateInvestmentValue(rowIndex, newCurrent, newInvested);
      _closeModal('deposit-modal'); await _loadInvestments(); _toast('Versamento registrato ✓','success');
    } catch(e){_toast(e.message,'error');} finally{_load(false);}
  }

  // ── Update value modal ────────────────────────
  function _openUpdateValueModal(inv) {
    const val = prompt(`Valore attuale di "${inv.name}" (€):`, inv.current||'');
    if (val===null) return;
    const newVal = parseFloat(val);
    if (isNaN(newVal)||newVal<0) return _toast('Valore non valido','error');
    _load(true,'Aggiornamento...');
    Sheets.updateInvestmentValue(inv.rowIndex, newVal, inv.invested)
      .then(()=>{ _loadInvestments(); _toast('Valore aggiornato ✓','success'); })
      .catch(e=>_toast(e.message,'error'))
      .finally(()=>_load(false));
  }

  // ════════════════════════════════════════════
  //  EDIT TX MODAL
  // ════════════════════════════════════════════
  function _setupEditTxModal() {
    $('edit-modal-close').onclick=()=>_closeModal('edit-modal');
    $('edit-modal-overlay').onclick=()=>_closeModal('edit-modal');
    $('edit-cancel-btn').onclick=()=>_closeModal('edit-modal');
    $('edit-save-btn').onclick=_saveEditTx;
  }

  function _openEditTxModal(tx) {
    state.editingTx = tx;
    $('edit-type-label').textContent = tx.type==='Uscita'?'↑ Uscita':'↓ Entrata';
    $('edit-type-label').style.color  = tx.type==='Uscita'?'var(--red)':'var(--green)';
    $('edit-amount').value  = tx.amount;
    $('edit-desc').value    = tx.desc;
    $('edit-date').value    = tx.date;
    $('edit-notes').value   = tx.note||'';
    _populateCatSelect('edit-category', tx.type, tx.category);
    _openModal('edit-modal');
  }

  async function _saveEditTx() {
    const tx = state.editingTx;
    const upd = { date:$('edit-date').value, amount:parseFloat($('edit-amount').value),
      desc:$('edit-desc').value.trim(), category:$('edit-category').value, type:tx.type, note:$('edit-notes').value.trim() };
    if (!upd.amount||!upd.desc) return _toast('Compila tutti i campi','error');
    _load(true,'Salvataggio...');
    try{ await Sheets.editTransaction(state.month,state.year,tx.rowIndex,upd); _closeModal('edit-modal'); await _loadCore(true); _toast('Modificata ✓','success'); }
    catch(e){_toast(e.message,'error');} finally{_load(false);}
  }

  // ════════════════════════════════════════════
  //  CATEGORY MANAGER
  // ════════════════════════════════════════════
  function _setupCatManager() {
    $$('.cat-tab-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{ $$('.cat-tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); _renderCatList(btn.dataset.cattype); });
    });
    $('cat-modal-close').onclick=()=>{ _closeModal('cat-modal'); _setupTxForm(); };
    $('cat-modal-overlay').onclick=()=>{ _closeModal('cat-modal'); _setupTxForm(); };
    $('add-category-btn').onclick=_addCategory;
    $('open-cat-manager-btn').onclick=()=>{ _renderCatList('Uscita'); _openModal('cat-modal'); };
  }

  function _renderCatList(type) {
    const cats = getCategories(type);
    const el   = $('cat-list-editable'); el.innerHTML='';
    cats.forEach((cat,idx)=>{
      const d=document.createElement('div'); d.className='cat-edit-item';
      d.innerHTML=`<div class="cat-edit-swatch" style="background:${cat.color}"></div><span class="cat-edit-name">${cat.name}</span><div class="cat-edit-actions"><button class="cat-action-btn" data-a="edit" data-i="${idx}" data-t="${type}">✏️</button><button class="cat-action-btn cat-action-del" data-a="del" data-i="${idx}" data-t="${type}">✕</button></div>`;
      d.querySelector('[data-a="del"]').onclick=()=>{
        if(cats.length<=1) return _toast('Almeno una categoria','error');
        if(!confirm(`Eliminare "${cats[idx].name}"?`)) return;
        cats.splice(idx,1); saveCategories(type,cats); _renderCatList(type); _toast('Eliminata');
      };
      d.querySelector('[data-a="edit"]').onclick=()=>{
        d.innerHTML=`<input class="cat-inline-input" id="ie-name" type="text" value="${esc(cat.name)}"/><input class="cat-inline-color" id="ie-color" type="color" value="${cat.color}"/><div class="cat-edit-actions"><button class="cat-action-btn cat-action-save" id="ie-save">✓</button><button class="cat-action-btn" id="ie-cancel">✕</button></div>`;
        d.querySelector('#ie-save').onclick=()=>{
          const n=d.querySelector('#ie-name').value.trim(); const c=d.querySelector('#ie-color').value;
          if(!n) return _toast('Inserisci un nome','error');
          cats[idx]={name:n,color:c}; saveCategories(type,cats); _renderCatList(type); _toast('Aggiornata ✓','success');
        };
        d.querySelector('#ie-cancel').onclick=()=>_renderCatList(type);
      };
      el.appendChild(d);
    });
    $('new-cat-type').value=type;
  }

  function _addCategory() {
    const name=$('new-cat-name').value.trim(), color=$('new-cat-color').value, type=$('new-cat-type').value;
    if(!name) return _toast('Inserisci un nome','error');
    const cats=getCategories(type);
    if(cats.find(c=>c.name===name)) return _toast('Categoria già esistente','error');
    cats.push({name,color}); saveCategories(type,cats);
    $('new-cat-name').value=''; _renderCatList(type); _toast('Aggiunta ✓','success');
  }

  // ── Pickers ───────────────────────────────────
  function _setupPickers() {
    const ms=$('month-select'), ys=$('year-select');
    MONTHS.forEach((m,i)=>{ const o=document.createElement('option'); o.value=i+1; o.textContent=m; if(i+1===state.month)o.selected=true; ms.appendChild(o); });
    const cy=new Date().getFullYear();
    for(let y=cy-2;y<=cy+1;y++){ const o=document.createElement('option'); o.value=y; o.textContent=y; if(y===state.year)o.selected=true; ys.appendChild(o); }
    ms.onchange=async()=>{ state.month=parseInt(ms.value); state.annualLoaded=false; await _loadCore(); };
    ys.onchange=async()=>{ state.year=parseInt(ys.value); state.annualLoaded=false; await _loadCore(); };
  }

  // ── Navigation ────────────────────────────────
  function _setupNav() {
    $$('.nav-btn[data-tab]').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const tab=btn.dataset.tab;
        $$('.nav-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
        $$('.tab-content').forEach(t=>t.classList.remove('active'));
        $(`tab-${tab}`)?.classList.add('active');
        if(tab==='transazioni') _renderTxList();
        if(tab==='riepilogo')   { _renderRiepilogo(); if(!state.annualLoaded) await _loadAnnual(); }
        if(tab==='spese')       await _loadFixedAndInstall();
        if(tab==='investimenti') await _loadInvestments();
        if(tab==='impostazioni') _renderSettingsPreview();
      });
    });
    $('view-all-btn').onclick=()=>{ $$('.nav-btn').forEach(b=>b.classList.remove('active')); document.querySelector('[data-tab="transazioni"]').classList.add('active'); $$('.tab-content').forEach(t=>t.classList.remove('active')); $('tab-transazioni').classList.add('active'); };
    $('sync-btn').onclick=async()=>{ $('sync-btn').classList.add('spinning'); Object.keys(localStorage).filter(k=>k.startsWith(LS.CACHE_PREFIX)).forEach(k=>localStorage.removeItem(k)); await _loadCore(); $('sync-btn').classList.remove('spinning'); _toast('Sincronizzato ✓','success'); };
    $('logout-btn').onclick=()=>{ if(!confirm('Disconnettersi?')) return; Sheets.logout(); _showScreen('setup'); };
    $('logout-btn-settings')?.addEventListener('click',()=>{ if(!confirm('Disconnettersi?')) return; Sheets.logout(); _showScreen('setup'); });
  }

  // ── TX Form ───────────────────────────────────
  function _setupTxForm() {
    $('form-date').value=todayISO();
    $$('.type-btn').forEach(btn=>{ btn.onclick=()=>{ $$('.type-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.txType=btn.dataset.type; _populateCatSelect('form-category',state.txType); }; });
    _populateCatSelect('form-category',state.txType);
    $('save-tx-btn').onclick=async()=>{
      const amount=parseFloat($('form-amount').value), desc=$('form-desc').value.trim(), cat=$('form-category').value, date=$('form-date').value, note=$('form-notes').value.trim();
      if(!amount||amount<=0) return _toast('Importo non valido','error');
      if(!desc) return _toast('Inserisci una descrizione','error');
      const d=new Date(date); const m=d.getMonth()+1, y=d.getFullYear();
      _load(true,'Salvataggio...'); try{
        await Sheets.addTransaction(m,y,{date,amount,desc,category:cat,type:state.txType,note});
        $('form-amount').value=''; $('form-desc').value=''; $('form-notes').value=''; $('form-date').value=todayISO();
        if(m===state.month&&y===state.year) await _loadCore(true);
        _toast('Salvata ✓','success');
        $$('.nav-btn').forEach(b=>b.classList.remove('active')); document.querySelector('[data-tab="dashboard"]').classList.add('active');
        $$('.tab-content').forEach(t=>t.classList.remove('active')); $('tab-dashboard').classList.add('active');
      } catch(e){_toast(e.message,'error');} finally{_load(false);}
    };
  }

  function _setupFilters() {
    $$('.filter-btn').forEach(btn=>{ btn.onclick=()=>{ $$('.filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.filter=btn.dataset.filter; _renderTxList(); }; });
  }

  function _renderSettingsPreview() {
    [['Uscita','settings-cats-exp','count-exp'],['Entrata','settings-cats-inc','count-inc']].forEach(([type,chipId,cntId])=>{
      const el=$(chipId); if(!el) return;
      const cats=getCategories(type);
      el.innerHTML=cats.map(c=>`<span class="settings-cat-chip" style="border-color:${c.color};color:${c.color}">${c.name}</span>`).join('');
      const ce=$(cntId); if(ce) ce.textContent=`${cats.length} categorie`;
    });
  }

  // ── Helpers ───────────────────────────────────
  function _populateCatSelect(selId, type, selected) {
    const sel=$(selId); if(!sel) return; sel.innerHTML='';
    getCategories(type).forEach(c=>{ const o=document.createElement('option'); o.value=c.name; o.textContent=c.name; if(c.name===selected)o.selected=true; sel.appendChild(o); });
  }

  function _openModal(id)  { $(id).classList.add('open'); $(id+'-overlay')?.classList.add('open'); }
  function _closeModal(id) { $(id).classList.remove('open'); $(id+'-overlay')?.classList.remove('open'); }
  function _showScreen(n)  { $$('.screen').forEach(s=>s.classList.remove('active')); $(n==='app'?'app-screen':'setup-screen').classList.add('active'); }

  function _load(on, text='') {
    const el=$('loading-overlay');
    if(on){ $('loading-text').textContent=text; el.classList.remove('hidden'); }
    else  { el.classList.add('hidden'); }
  }

  let _toastT=null;
  function _toast(msg,type='') {
    const el=$('toast'); el.textContent=msg; el.className=`toast${type?' '+type:''}`;
    el.classList.remove('hidden'); clearTimeout(_toastT);
    _toastT=setTimeout(()=>el.classList.add('hidden'),3000);
  }

  return { init };
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
window.addEventListener('DOMContentLoaded', ()=>App.init());
