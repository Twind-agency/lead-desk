# LeadDesk

Dashboard statica per gestire i lead che arrivano da Meta su Google Sheets.

## Come provarla

Apri `index.html` nel browser. Troverai i lead in schede espandibili: clicchi una scheda, cambi stato, aggiungi note e apri WhatsApp con un messaggio precompilato.

Quando l'endpoint Apps Script e' configurato, la dashboard rilegge automaticamente il Google Sheet ogni 15 secondi.

## Collegamento a Google Sheets

1. Apri il Google Sheet dove arrivano i lead Meta.
2. Vai su `Estensioni > Apps Script`.
3. Incolla il contenuto di `google-apps-script.gs`.
4. Verifica che il foglio si chiami `Leads`, oppure modifica `SHEET_NAME`.
5. Distribuisci come `Web app`.
6. Imposta accesso a chi deve usare la dashboard.
7. Copia l'URL del Web App e incollalo nella pagina `Configurazione`.

## Riepilogo pipeline nel Google Sheet

Lo script crea e aggiorna un foglio `Pipeline` con:

- riepilogo per stato
- conteggio messaggi WhatsApp inviati
- ultimo lead ricevuto per stato
- riepilogo per campagna

Puoi lanciare una volta la funzione `setupLeadDesk()` da Apps Script per creare subito la struttura. In seguito il riepilogo viene aggiornato quando la dashboard legge o aggiorna i lead.

## Colonne consigliate

La dashboard riconosce automaticamente vari nomi di colonne Meta. La struttura consigliata e':

`id`, `createdAt`, `name`, `phone`, `email`, `campaign`, `source`, `city`, `interest`, `status`, `notes`, `updatedAt`, `whatsappCount`

Le colonne `status`, `notes`, `updatedAt` e `whatsappCount` vengono create dallo script se mancano.

## WhatsApp

Il pulsante apre `wa.me` usando il numero del lead. Quando clicchi su `Scrivi su WhatsApp`, il lead viene segnato come `Contattato` o come lo stato equivalente configurato.

La dashboard supporta due messaggi predefiniti:

- primo messaggio
- follow-up per i contatti successivi

I testi possono essere modificati nella sezione `Google Sheet`, insieme ai nomi degli stati lead. Nei messaggi puoi usare queste variabili:

- `{{nome}}`
- `{{campagna}}`
- `{{interesse}}`
