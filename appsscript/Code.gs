// ═══════════════════════════════════════════════
//  FINANCIAL TRACKER — Google Apps Script Webhook
//  Riceve transazioni da iOS Shortcuts e le scrive
//  nel Google Sheet
// ═══════════════════════════════════════════════

const SECRET_TOKEN = 'FT_SECRET_CHANGE_ME'; // ← CAMBIA QUESTO!

// ── Parser notifiche bancarie ─────────────────
const BANK_PARSERS = [
  { name: 'Satispay',
    patterns: [/(?:hai pagato|pagamento di)\s*[€£$]?\s*([\d.,]+)/i, /[€£$]\s*([\d.,]+)\s*(?:pagat|a )/i],
    merchantPatterns: [/(?:hai pagato [€£$]?[\d.,]+ a )\s*(.+)/i, /(?:pagamento a )\s*(.+)/i] },
  { name: 'N26',
    patterns: [/hai speso\s*[€£$]?\s*([\d.,]+)/i, /pagamento:\s*[€£$]?\s*([\d.,]+)/i],
    merchantPatterns: [/hai speso [€£$]?[\d.,]+ da (.+)/i, /pagamento: [€£$]?[\d.,]+ [·•] (.+)/i] },
  { name: 'Revolut',
    patterns: [/pagato\s*[€£$]?\s*([\d.,]+)/i, /card payment\s*[€£$]?\s*([\d.,]+)/i],
    merchantPatterns: [/pagato [€£$]?[\d.,]+ a (.+)/i, /card payment [€£$]?[\d.,]+ at (.+)/i] },
  { name: 'Fineco',
    patterns: [/pagamento pos\s*[€£$]?\s*([\d.,]+)/i, /addebito\s*[€£$]?\s*([\d.,]+)/i, /[€£$]\s*([\d.,]+)/i],
    merchantPatterns: [/pagamento pos [€£$]?[\d.,]+ [-–] (.+)/i] },
  { name: 'Intesa / Isybank',
    patterns: [/pagamento con carta\s*[€£$]?\s*([\d.,]+)/i, /addebito\s*[€£$]?\s*([\d.,]+)/i, /[€£$]\s*([\d.,]+)/i],
    merchantPatterns: [/pagamento con carta [€£$]?[\d.,]+ (.+)/i, /addebito [€£$]?[\d.,]+ del \d+\/\d+ (.+)/i] },
  { name: 'UniCredit',
    patterns: [/pagamento pos di\s*[€£$]?\s*([\d.,]+)/i, /[€£$]\s*([\d.,]+)/i],
    merchantPatterns: [/presso (.+)/i] },
  { name: 'Hype',
    patterns: [/hai speso\s*[€£$]?\s*([\d.,]+)/i, /[€£$]\s*([\d.,]+)/i],
    merchantPatterns: [/hai speso [€£$]?[\d.,]+ su (.+)/i] },
  { name: 'Mediolanum',
    patterns: [/pagamento\s*[€£$]?\s*([\d.,]+)/i, /[€£$]\s*([\d.,]+)/i],
    merchantPatterns: [/pagamento [€£$]?[\d.,]+ [-–] (.+)/i] },
  { name: 'ING',
    patterns: [/pagamento di\s*[€£$]?\s*([\d.,]+)/i, /[€£$]\s*([\d.,]+)/i],
    merchantPatterns: [/pagamento di [€£$]?[\d.,]+ da (.+)/i] },
  { name: 'Trade Republic',
    patterns: [/zahlung\s*[€£$]?\s*([\d.,]+)/i, /payment\s*[€£$]?\s*([\d.,]+)/i, /[€£$]\s*([\d.,]+)/i],
    merchantPatterns: [/bei (.+)/i, /at (.+)/i] },
  { name: 'Generico',
    patterns: [/[€£$]\s*([\d]+[.,][\d]{2})/, /[€£$]\s*([\d]+[.,][\d]{1})/, /[€£$]\s*([\d]+)/, /([\d]+[.,][\d]{2})\s*[€£$]/, /([\d]+[.,][\d]{2})\s*euro/i],
    merchantPatterns: [] }
];

function parseAmount(str) {
  const s = String(str).replace(/[^0-9.,]/g,'');
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  if (lastDot > -1 && lastComma > -1) {
    return lastComma > lastDot ? parseFloat(s.replace(/\./g,'').replace(',','.')) : parseFloat(s.replace(/,/g,''));
  }
  if (lastComma > -1) return parseFloat(s.replace(',','.'));
  return parseFloat(s) || 0;
}

function parseNotification(text) {
  if (!text) return { amount: 0, merchant: '', bank: 'Sconosciuta' };
  for (const parser of BANK_PARSERS) {
    for (const pattern of parser.patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const amount = parseAmount(match[1]);
        if (amount <= 0) continue;
        let merchant = '';
        for (const mp of parser.merchantPatterns) {
          const mm = text.match(mp);
          if (mm && mm[1]) { merchant = mm[1].trim().replace(/\s+/g,' ').replace(/[.,!?]+$/,'').substring(0,50); break; }
        }
        return { amount, merchant, bank: parser.name };
      }
    }
  }
  return { amount: 0, merchant: '', bank: 'Sconosciuta' };
}

function guessCategory(merchant, description) {
  const text = (merchant + ' ' + description).toLowerCase();
  const rules = [
    { cat: '🍔 Alimentari', kw: ['esselunga','coop','lidl','conad','carrefour','pam','iper','penny','aldi','eurospin','supermercato','spar','despar','iperal','bennet','alimentar','grocery'] },
    { cat: '🏠 Casa & Affitto', kw: ['affitto','rent','ikea','leroy','bricofer','castorama','obi','brico','condominio','enel','eni','a2a','italgas'] },
    { cat: '🚗 Trasporti', kw: ['trenitalia','italo','atm','atac','gtt','taxi','uber','free now','parking','autostrada','telepass','q8','esso','agip','shell','benzina','carburante'] },
    { cat: '💡 Utenze', kw: ['wind','vodafone','tim','fastweb','iliad','ho.','very mobile','internet','telefonia','bolletta'] },
    { cat: '🎬 Svago & Intrattenimento', kw: ['netflix','spotify','amazon prime','disney','hbo','dazn','sky','cinema','teatro','ticketmaster','playstation','steam','nintendo','xbox'] },
    { cat: '💊 Salute & Farmacia', kw: ['farmacia','parafarmacia','medico','dentista','clinica','ospedale','lloyds'] },
    { cat: '👕 Abbigliamento', kw: ['zara','h&m','primark','mango','bershka','pull&bear','uniqlo','nike','adidas','foot locker','decathlon'] },
    { cat: '🍕 Ristoranti', kw: ['ristorante','pizzeria','mcdonald','burger','kfc','subway','just eat','deliveroo','glovo','uber eats','trattoria','sushi','bar '] },
    { cat: '✈️ Viaggi', kw: ['ryanair','easyjet','airbnb','booking','hotels','expedia','hotel','aeroporto','volo'] },
    { cat: '💻 Tecnologia', kw: ['apple','amazon','mediaworld','unieuro','euronics','samsung','xiaomi','fnac'] },
    { cat: '🎁 Regali', kw: ['regalo','gift','fiori','gioielleria','sephora','douglas'] },
  ];
  for (const r of rules) { for (const k of r.kw) { if (text.includes(k)) return r.cat; } }
  return '📋 Altro';
}

function getMonthName(m) {
  return ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'][m-1]||'';
}

function writeTransaction(month, year, tx) {
  const sid  = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sid) throw new Error('Sheet ID non configurato. Esegui la funzione setup().');
  const ss   = SpreadsheetApp.openById(sid);
  const name = `${String(month).padStart(2,'0')} ${getMonthName(month)} ${year}`;
  let sheet  = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(['Data','Importo','Descrizione','Categoria','Tipo','Note']);
  }
  sheet.appendRow([tx.date, tx.amount, tx.description, tx.category, tx.type||'Uscita', tx.note||'']);
}

function doPost(e) {
  try {
    const body  = JSON.parse(e.postData.contents);
    const token = body.token || e.parameter.token || '';
    if (token !== SECRET_TOKEN) return _json({ ok:false, error:'Token non valido' });

    const now   = new Date();
    const month = body.month || (now.getMonth()+1);
    const year  = body.year  || now.getFullYear();
    const date  = body.date  || Utilities.formatDate(now,'Europe/Rome','yyyy-MM-dd');

    let amount=0, description=body.description||'', category=body.category||'', note=body.note||'';

    if (body.amount && parseFloat(String(body.amount).replace(',','.')>0)) {
      amount = parseFloat(String(body.amount).replace(',','.'));
    } else if (body.notification) {
      const p = parseNotification(body.notification);
      amount  = p.amount;
      if (!description) description = p.merchant || 'Pagamento';
      note = `Banca: ${p.bank}`;
    }

    if (amount <= 0) return _json({ ok:false, error:'Importo non rilevato', raw:body.notification||'' });
    if (!description) description = 'Pagamento Apple Pay';
    if (!category)    category    = guessCategory(description, note);

    writeTransaction(month, year, { date, amount, description, category, type:'Uscita', note });
    return _json({ ok:true, saved:{ date, amount, description, category } });

  } catch(err) {
    return _json({ ok:false, error:err.toString() });
  }
}

function doGet(e) {
  const token = (e.parameter||{}).token||'';
  if (token !== SECRET_TOKEN) return _json({ ok:false, error:'Token non valido' });
  return _json({ ok:true, status:'Webhook attivo ✅' });
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function setup() {
  const ui = SpreadsheetApp.getUi();
  const r  = ui.prompt('Financial Tracker — Setup','Incolla il tuo Spreadsheet ID:',ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton()===ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('SHEET_ID', r.getResponseText().trim());
    ui.alert('✅ Configurazione completata! Il webhook è pronto.');
  }
}
