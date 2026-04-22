# 🚀 Guida Completa — Deploy di Sosoldi

Questa guida ti porta da zero all'app installata su iPhone e desktop in ~20 minuti.
Segui i passaggi nell'ordine indicato.

---

## PARTE 1 — Pubblicare l'app su GitHub Pages

### 1.1 — Crea il repository su GitHub

1. Vai su **[github.com](https://github.com)** e accedi
2. Clicca il pulsante **"+"** in alto a destra → **"New repository"**
3. Impostazioni:
   - **Repository name:** `sosoldi` (oppure qualsiasi nome tu voglia)
   - **Visibility:** Public *(necessario per GitHub Pages gratuito)*
   - Lascia tutto il resto invariato
4. Clicca **"Create repository"**

---

### 1.2 — Carica i file

Hai due opzioni:

#### Opzione A — Via browser (più semplice)
1. Nella pagina del repository appena creato, clicca **"uploading an existing file"**
2. Trascina TUTTA la cartella `sosoldi/` nell'area di upload (o seleziona tutti i file)
3. Scrivi un messaggio di commit, es. *"Prima versione Sosoldi"*
4. Clicca **"Commit changes"**

> ⚠️ Assicurati che la struttura dei file sia:
> ```
> (root del repo)
> ├── index.html
> ├── manifest.json
> ├── sw.js
> ├── css/
> │   └── app.css
> ├── js/
> │   ├── config.js
> │   ├── sheets.js
> │   ├── charts.js
> │   └── app.js
> └── icons/
>     ├── icon-192.png
>     └── icon-512.png
> ```

#### Opzione B — Via Git (per chi sa usarlo)
```bash
cd sosoldi/
git init
git remote add origin https://github.com/TUO_USERNAME/sosoldi.git
git add .
git commit -m "Prima versione Sosoldi"
git push -u origin main
```

---

### 1.3 — Attiva GitHub Pages

1. Nel repository, clicca **"Settings"** (tab in alto)
2. Nella barra laterale sinistra, clicca **"Pages"**
3. Sotto **"Source"**, seleziona:
   - Branch: **main**
   - Folder: **/ (root)**
4. Clicca **"Save"**
5. Aspetta ~2 minuti. Apparirà un banner verde con l'URL:  
   `https://TUO_USERNAME.github.io/sosoldi/`

🎉 L'app è ora online! Annotati questo URL, ti servirà nel passo successivo.

---

## PARTE 2 — Configurare Google Cloud

### 2.1 — Crea un progetto Google Cloud

1. Vai su **[console.cloud.google.com](https://console.cloud.google.com)**
2. In alto a sinistra, clicca sul menu progetti → **"Nuovo progetto"**
3. Nome: `Sosoldi` → **"Crea"**
4. Assicurati di avere il progetto "Sosoldi" selezionato in alto

---

### 2.2 — Abilita le API necessarie

1. Nel menu laterale: **"API e Servizi" → "Libreria"**
2. Cerca **"Google Sheets API"** → clicca → **"Abilita"**
3. Torna alla libreria, cerca **"Google Drive API"** → clicca → **"Abilita"**

---

### 2.3 — Configura la schermata di consenso OAuth

1. Nel menu laterale: **"API e Servizi" → "Schermata consenso OAuth"**
2. Seleziona **"Esterno"** → **"Crea"**
3. Compila i campi obbligatori:
   - **Nome app:** `Sosoldi`
   - **Email assistenza utente:** la tua email
   - **Email sviluppatore:** la tua email
4. Clicca **"Salva e continua"**
5. Nella sezione **"Ambiti"** clicca "Salva e continua" (non serve aggiungere nulla)
6. Nella sezione **"Utenti di test"**, clicca **"Add users"** e aggiungi la tua email Google
7. Clicca **"Salva e continua"** fino alla fine

---

### 2.4 — Crea le credenziali OAuth

1. Nel menu laterale: **"API e Servizi" → "Credenziali"**
2. Clicca **"+ Crea credenziali" → "ID client OAuth 2.0"**
3. Tipo di applicazione: **"Applicazione web"**
4. Nome: `Sosoldi Web`
5. Sotto **"Origini JavaScript autorizzate"** clicca **"+ Aggiungi URI"** e inserisci:
   ```
   https://TUO_USERNAME.github.io
   ```
   *(sostituisci TUO_USERNAME con il tuo username GitHub)*
   
   Se vuoi testare in locale, aggiungi anche:
   ```
   http://localhost:3000
   ```
6. Clicca **"Crea"**
7. Si aprirà un popup con il tuo **Client ID** — è una stringa tipo:  
   `123456789-abcdefghijk.apps.googleusercontent.com`  
   **Copialo e conservalo!**

---

## PARTE 3 — Prima configurazione dell'app

1. Apri l'app su **`https://TUO_USERNAME.github.io/sosoldi/`**
2. Nella schermata di setup:
   - **Client ID:** incolla quello copiato al passo 2.4
   - **Spreadsheet ID:** lascia vuoto (l'app creerà automaticamente un nuovo Google Sheet)
3. Clicca **"Connetti con Google"**
4. Comparirà la finestra di login Google → accedi con il tuo account
5. Concedi i permessi richiesti (Sheets + Drive)
6. ✅ Sei dentro! L'app ha creato automaticamente un Google Sheet chiamato *"Sosoldi — Finanze Personali"* nel tuo Drive

> 💡 **Vuoi usare un Sheet esistente?**  
> Apri il tuo Google Sheet, guarda l'URL:  
> `docs.google.com/spreadsheets/d/`**`QUESTO_È_LO_SPREADSHEET_ID`**`/edit`  
> Copia quella parte e incollala nel campo "Spreadsheet ID"

---

## PARTE 4 — Installare come app su iPhone

1. Apri **Safari** (obbligatorio, non Chrome) su iPhone
2. Vai su `https://TUO_USERNAME.github.io/sosoldi/`
3. Tocca il pulsante **Condividi** (l'icona con la freccia in su ↑)
4. Scorri verso il basso e tocca **"Aggiungi a schermata Home"**
5. Modifica il nome se vuoi → **"Aggiungi"**
6. L'icona di Sosoldi apparirà sulla tua schermata Home come una vera app!

---

## PARTE 5 — Installare come app su desktop (Chrome/Edge)

1. Apri Chrome o Edge sul tuo computer
2. Vai su `https://TUO_USERNAME.github.io/sosoldi/`
3. Nella barra degli indirizzi, a destra, apparirà un'icona **"Installa app"** (un monitor con una freccia)
4. Clicca → **"Installa"**
5. Sosoldi si aprirà come finestra separata, senza barra del browser!

---

## ❓ Domande frequenti

**L'app non si apre dopo il login Google?**  
Verifica che l'URL della tua GitHub Pages corrisponda esattamente a quello inserito nelle "Origini JavaScript autorizzate" in Google Cloud. Occhio a http vs https e al trailing slash.

**Vedo "Errore 403"?**  
Le API Google Sheets o Drive non sono abilitate. Torna al Passo 2.2 e abilitale entrambe.

**Il popup di login non si apre?**  
I popup bloccati dal browser possono causare problemi. Assicurati di consentirli per il dominio GitHub Pages.

**I dati sono privati?**  
Sì. Il tuo Google Sheet è nel tuo Drive personale, accessibile solo da te. Sosoldi non ha nessun server proprio: tutto va direttamente da browser a Google.

**Posso usare Sosoldi su più dispositivi contemporaneamente?**  
Sì! Ogni dispositivo legge e scrive sullo stesso Google Sheet. Se due dispositivi salvano nello stesso momento potrebbe esserci un piccolo ritardo, ma non perdi dati.

**Come aggiorno l'app quando esce una nuova versione?**  
Basta aggiornare i file sul repository GitHub. La prossima volta che apri l'app, il service worker scaricherà automaticamente la versione aggiornata.

---

## 📞 Struttura del Google Sheet

L'app crea automaticamente un foglio per ogni mese in cui inserisci transazioni, con il formato:  
`01 Gennaio 2024`, `02 Febbraio 2024`, ecc.

Ogni foglio ha le colonne: **Data | Importo | Descrizione | Categoria | Tipo | Note**

Puoi anche aprire il Sheet direttamente su Google Drive per vedere, modificare o esportare i dati in qualsiasi momento.
