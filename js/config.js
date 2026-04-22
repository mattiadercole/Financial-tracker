// ═══════════════════════════════════════════════
//  SOSOLDI — Config & Constants
// ═══════════════════════════════════════════════

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
].join(' ');

const MONTHS = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
];

const CATEGORIES_EXP = [
  { name: '🏠 Casa & Affitto',        color: '#6366f1' },
  { name: '🍔 Alimentari',             color: '#f59e0b' },
  { name: '🚗 Trasporti',             color: '#3b82f6' },
  { name: '💡 Utenze',                color: '#f97316' },
  { name: '🎬 Svago & Intrattenimento',color: '#ec4899' },
  { name: '👕 Abbigliamento',          color: '#8b5cf6' },
  { name: '💊 Salute & Farmacia',      color: '#10b981' },
  { name: '📚 Istruzione',            color: '#06b6d4' },
  { name: '✈️ Viaggi',                color: '#f43f5e' },
  { name: '💻 Tecnologia',            color: '#7c3aed' },
  { name: '🐾 Animali',               color: '#84cc16' },
  { name: '🎁 Regali',                color: '#e879f9' },
  { name: '💰 Risparmi & Investimenti',color: '#34d399' },
  { name: '📋 Altro',                 color: '#64748b' },
];

const CATEGORIES_INC = [
  { name: '💼 Stipendio',             color: '#34d399' },
  { name: '💡 Freelance / Consulenze',color: '#fbbf24' },
  { name: '🏦 Rendite / Investimenti',color: '#60a5fa' },
  { name: '🎁 Bonus',                 color: '#a78bfa' },
  { name: '💸 Altri Entrati',         color: '#64748b' },
];

// Sheet structure
const SHEET_HEADER = ['Data','Importo','Descrizione','Categoria','Tipo','Note'];
// Column indices (0-based)
const COL = { DATE:0, AMOUNT:1, DESC:2, CAT:3, TYPE:4, NOTE:5 };

// LocalStorage keys
const LS = {
  CLIENT_ID:   'ss_client_id',
  SHEET_ID:    'ss_sheet_id',
  TOKEN:       'ss_token',
};

function getCategoryColor(catName) {
  const all = [...CATEGORIES_EXP, ...CATEGORIES_INC];
  const found = all.find(c => c.name === catName);
  return found ? found.color : '#64748b';
}

function getCategoryIcon(catName) {
  const emoji = catName.match(/^\p{Emoji}/u);
  return emoji ? emoji[0] : '💳';
}

function formatEuro(amount) {
  const n = parseFloat(amount) || 0;
  return new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2
  }).format(n);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// Sheet name for a given month/year
function sheetNameFor(month, year) {
  return `${String(month).padStart(2,'0')} ${MONTHS[month-1]} ${year}`;
}
