// ═══════════════════════════════════════════════
//  SOSOLDI — Config & Constants v3
// ═══════════════════════════════════════════════

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
].join(' ');

const MONTHS = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
];

// ── Categories ───────────────────────────────
const DEFAULT_CATEGORIES_EXP = [
  { name: '🏠 Casa & Affitto',         color: '#6366f1' },
  { name: '🍔 Alimentari',              color: '#f59e0b' },
  { name: '🚗 Trasporti',              color: '#3b82f6' },
  { name: '💡 Utenze',                 color: '#f97316' },
  { name: '🎬 Svago & Intrattenimento',color: '#ec4899' },
  { name: '👕 Abbigliamento',           color: '#8b5cf6' },
  { name: '💊 Salute & Farmacia',       color: '#10b981' },
  { name: '📚 Istruzione',             color: '#06b6d4' },
  { name: '✈️ Viaggi',                 color: '#f43f5e' },
  { name: '💻 Tecnologia',             color: '#7c3aed' },
  { name: '🐾 Animali',                color: '#84cc16' },
  { name: '🎁 Regali',                 color: '#e879f9' },
  { name: '💰 Risparmi & Investimenti',color: '#34d399' },
  { name: '📋 Altro',                  color: '#64748b' },
];
const DEFAULT_CATEGORIES_INC = [
  { name: '💼 Stipendio',              color: '#34d399' },
  { name: '💡 Freelance / Consulenze', color: '#fbbf24' },
  { name: '🏦 Rendite / Investimenti', color: '#60a5fa' },
  { name: '🎁 Bonus',                  color: '#a78bfa' },
  { name: '💸 Altri Entrati',          color: '#64748b' },
];

const LS_CAT_EXP = 'ss_categories_exp';
const LS_CAT_INC = 'ss_categories_inc';

function getCategories(type) {
  const key = type === 'Uscita' ? LS_CAT_EXP : LS_CAT_INC;
  const def = type === 'Uscita' ? DEFAULT_CATEGORIES_EXP : DEFAULT_CATEGORIES_INC;
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : JSON.parse(JSON.stringify(def));
  } catch { return JSON.parse(JSON.stringify(def)); }
}
function saveCategories(type, cats) {
  localStorage.setItem(type === 'Uscita' ? LS_CAT_EXP : LS_CAT_INC, JSON.stringify(cats));
}

// ── Sheet structure (transactions) ───────────
const SHEET_HEADER = ['Data','Importo','Descrizione','Categoria','Tipo','Note'];
const COL = { DATE:0, AMOUNT:1, DESC:2, CAT:3, TYPE:4, NOTE:5 };

// ── Fixed expenses sheet ──────────────────────
const FIXED_SHEET   = 'Spese Fisse';
const FIXED_HEADER  = ['Nome','Importo','Categoria','Giorno','Attiva','Note'];
const FCOL = { NAME:0, AMOUNT:1, CAT:2, DAY:3, ACTIVE:4, NOTE:5 };

// ── Installment expenses sheet ────────────────
const INSTALL_SHEET  = 'Rate';
const INSTALL_HEADER = ['Nome','Importo Totale','Rate Totali','Rate Pagate','Importo Rata','Categoria','Data Inizio','Note'];
const ICOL = { NAME:0, TOTAL:1, N_RATES:2, PAID:3, AMOUNT:4, CAT:5, START:6, NOTE:7 };

// ── Investment plans sheet ────────────────────
const INVEST_SHEET  = 'Investimenti';
const INVEST_HEADER = ['ID','Nome Piano','Piattaforma','Ticker/ISIN','Tipo','Capitale Investito','Valore Attuale','Data Inizio','Frequenza','Importo Periodico','Attivo','Note'];
const INV = { ID:0, NAME:1, PLATFORM:2, TICKER:3, TYPE:4, INVESTED:5, CURRENT:6, START:7, FREQ:8, PERIODIC:9, ACTIVE:10, NOTE:11 };

// ── Investment deposits sheet ─────────────────
const DEPOSIT_SHEET  = 'Depositi';
const DEPOSIT_HEADER = ['Data','Piano ID','Piano Nome','Importo','Tipo','Note'];
const DCOL = { DATE:0, PLAN_ID:1, PLAN_NAME:2, AMOUNT:3, TYPE:4, NOTE:5 };

// ── Known investment platforms ────────────────
const KNOWN_PLATFORMS = [
  'Directa SIM','Fineco','Moneyfarm','Scalable Capital',
  'Trade Republic','Degiro','Saxo Bank','Revolut','N26',
  'Banca Mediolanum','Poste Italiane','Altro'
];

const INVEST_TYPES = ['ETF','Azione','Obbligazione','Fondo','Criptovaluta','PAC','Liquidità','Altro'];
const INVEST_FREQS = ['Mensile','Bimestrale','Trimestrale','Semestrale','Annuale','Manuale'];

// ── LocalStorage ──────────────────────────────
const LS = {
  CLIENT_ID:    'ss_client_id',
  SHEET_ID:     'ss_sheet_id',
  TOKEN:        'ss_token',
  CACHE_PREFIX: 'ss_cache_',
  CACHE_TS:     'ss_cache_ts_',
};

const CACHE_TTL = 5 * 60 * 1000; // 5 min

function cacheSet(key, data) {
  try {
    localStorage.setItem(LS.CACHE_PREFIX + key, JSON.stringify(data));
    localStorage.setItem(LS.CACHE_TS + key, Date.now());
  } catch(e) {}
}
function cacheGet(key) {
  try {
    const ts = parseInt(localStorage.getItem(LS.CACHE_TS + key) || '0');
    if (Date.now() - ts > CACHE_TTL) return null;
    const d = localStorage.getItem(LS.CACHE_PREFIX + key);
    return d ? JSON.parse(d) : null;
  } catch { return null; }
}
function cacheClear(key) {
  localStorage.removeItem(LS.CACHE_PREFIX + key);
  localStorage.removeItem(LS.CACHE_TS + key);
}

// ── Color palette ─────────────────────────────
const COLOR_PALETTE = [
  '#6366f1','#8b5cf6','#a78bfa','#ec4899','#f43f5e',
  '#f97316','#f59e0b','#fbbf24','#84cc16','#10b981',
  '#34d399','#06b6d4','#3b82f6','#60a5fa','#64748b',
];

// ── Helpers ───────────────────────────────────
function getCategoryColor(catName) {
  const all = [...getCategories('Uscita'), ...getCategories('Entrata')];
  const f = all.find(c => c.name === catName);
  return f ? f.color : '#64748b';
}
function getCategoryIcon(catName) {
  const e = catName ? catName.match(/^\p{Emoji}/u) : null;
  return e ? e[0] : '💳';
}
function formatEuro(amount) {
  return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(parseFloat(amount)||0);
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'});
}
function todayISO() { return new Date().toISOString().split('T')[0]; }
function sheetNameFor(month, year) {
  return `${String(month).padStart(2,'0')} ${MONTHS[month-1]} ${year}`;
}
function pct(val, total) {
  if (!total) return 0;
  return ((val / total) * 100).toFixed(1);
}
