# Deploy LeadDesk

LeadDesk e' una dashboard statica: i file HTML, CSS e JS possono essere pubblicati su qualsiasi hosting statico. Il backend leggero e' Google Apps Script, collegato al Google Sheet dove arrivano i lead Meta.

## File da pubblicare online

Carica questi file nello stesso progetto/cartella dell'hosting:

- `index.html`
- `settings.html`
- `styles.css`
- `app.js`
- `settings.js`

Non pubblicare obbligatoriamente questi file, ma tienili come documentazione/setup:

- `google-apps-script.gs`
- `README.md`
- `DEPLOY.md`

## Setup Google Sheet

1. Apri il Google Sheet dove Meta invia i lead.
2. Controlla che il foglio principale dei lead si chiami `Leads`.
3. Se ha un altro nome, modifica `SHEET_NAME` in `google-apps-script.gs`.
4. Vai su `Estensioni > Apps Script`.
5. Incolla tutto il contenuto di `google-apps-script.gs`.
6. Salva il progetto.
7. Dal menu funzioni seleziona `setupLeadDesk` e premi `Esegui`.
8. Autorizza lo script quando Google lo richiede.

Lo script crea o aggiorna il foglio `Pipeline`, che contiene il riepilogo per stato e campagna. La funzione `setupLeadDesk()` formatta anche il foglio `Leads` con intestazioni scure, filtro, righe alternate, colonne dimensionate e colori automatici sugli stati.

## Pubblicare Apps Script come Web App

1. In Apps Script clicca `Distribuisci > Nuova distribuzione`.
2. Scegli tipo `App web`.
3. Imposta `Esegui come`: `Me`.
4. Imposta `Chi ha accesso`: scegli l'opzione adatta al tuo account Google Workspace.
5. Clicca `Distribuisci`.
6. Copia l'URL della Web App.

## Configurare la dashboard

1. Apri online `settings.html`.
2. Incolla l'URL della Web App Apps Script.
3. Imposta i messaggi WhatsApp predefiniti.
4. Imposta gli stati lead, uno per riga.
5. Salva.
6. Torna su `index.html`.

La dashboard salva automaticamente stato e note sul Google Sheet. Inoltre rilegge i lead dal Google Sheet ogni 15 secondi, sospendendo il refresh mentre stai modificando un lead.

## Campi dinamici

Prima del lancio della campagna puoi configurare i campi extra del form Meta dalla pagina `settings.html`.

Formato consigliato:

`nome_colonna | Etichetta visibile`

Dopo che arriva almeno un lead puoi usare `Rileva campi dal foglio` per proporre automaticamente le colonne extra.

## Deploy su Netlify

1. Vai su Netlify.
2. Crea un nuovo sito con drag and drop.
3. Carica la cartella che contiene i file della dashboard, oppure carica lo zip `leaddesk-online.zip`.
4. Apri l'URL generato da Netlify.
5. Vai su `/settings.html` e configura l'endpoint Apps Script.

## Deploy su Vercel

1. Crea un progetto Vercel.
2. Carica i file statici oppure collega una repo Git.
3. Non serve build command.
4. Output directory: lascia vuoto o usa la cartella dove sono i file.
5. Dopo il deploy apri `/settings.html` e configura l'endpoint Apps Script.

## Deploy su GitHub Pages

1. Crea una repo GitHub.
2. Carica i file della dashboard nella root della repo.
3. Vai su `Settings > Pages`.
4. Source: `Deploy from a branch`.
5. Branch: `main`, folder `/root`.
6. Salva e apri l'URL generato.
7. Configura `/settings.html`.

## Note importanti

- Se Google blocca richieste da dominio esterno, ridistribuisci Apps Script come nuova versione della Web App.
- Se cambi colonne nel Google Sheet, mantieni almeno un identificativo lead riconoscibile: `id`, `ID`, `lead_id` o `Lead ID`.
- Le impostazioni della dashboard vengono salvate nel browser con `localStorage`.
- Per usare le stesse impostazioni su piu' computer, apri `settings.html` su ogni computer e incolla lo stesso endpoint Apps Script.
