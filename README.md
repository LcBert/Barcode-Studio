# GS1-128 Barcode Generator Studio

Applicazione Full-Stack per la generazione, validazione, rendering e archiviazione di codici a barre standard **GS1-128** (EAN-128).

- **Backend**: Python 3.13, Django 6, Django REST Framework, gestito con `uv`.
- **Frontend**: Angular 22 (Standalone components, reactive signals, icone vettoriali SVG pure).
- **Container**: Docker Compose (servizi per PostgreSQL, Django API con `uv`, Nginx + Angular).
- **Dev Runner**: `justfile` con comandi rapidi per l'intero ciclo di vita del progetto.

---

## Struttura del Progetto

```
.
├── docker-compose.yml       # Definizione container (db, backend, frontend)
├── justfile                 # Comandi di automazione per lo sviluppo
├── backend/                 # Backend Django gestito con uv
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── manage.py
│   ├── barcode_project/     # Configurazione Django, settings, urls
│   └── barcodes/            # App GS1: parser, validatore, generatore, modelli, test
└── frontend/                # Frontend Angular 22 standalone
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
        └── app/             # Componenti, servizi, modelli e icone SVG
```

---

## Comandi Rapidi (`justfile`)

Per visualizzare la lista completa dei comandi disponibili:
```bash
just
```

### Docker
- `just up` : Avvia tutti i container (`db`, `backend`, `frontend`) in background ricostruendo le immagini.
- `just down` : Ferma e rimuove i container.
- `just down-clean` : Ferma i container, rimuove i volumi (`-v`) e le reti per ripartire da zero.
- `just logs [service]` : Visualizza i log in streaming di tutti i servizi o di un singolo container (es. `just logs backend`).
- `just build` : Compila le immagini Docker dei servizi.

### Sviluppo Locale (senza Docker)
- `just install` : Installa le dipendenze del backend con `uv` e del frontend con `npm`.
- `just run-backend` : Avvia il server Django di sviluppo su `http://localhost:8000`.
- `just run-frontend` : Avvia il server di sviluppo Angular su `http://localhost:4200` con proxy integrato verso il backend.
- `just migrate` : Applica le migrazioni del database Django localmente.
- `just makemigrations [app]` : Genera nuove migrazioni per l'app specificata.
- `just test` : Esegue la suite di test unitari automatizzati del backend.

---

## Caratteristiche Implementate

1. **Specifiche GS1-128 / EAN-128 Complete**:
   - Gestione dei codici identificativi di applicazione (AI): GTIN (01), Lotto (10), Data Scadenza (17), Data Produzione (11), Data Consumo preferibile (15), Seriale (21), Quantità (30, 37), SSCC (00), Peso netto (310x), CAP (420/421), Ordine acquisto (400) e dati interni (90-99).
   - Inserimento automatico del separatore **FNC1** (`\xf1`) secondo le specifiche GS1 per campi a lunghezza variabile non terminali.
   - Formattazione del testo per lettura umana (HRI) tra parentesi, es: `(01)08412345678905(17)271231(10)BATCH-2026-X1(30)150`.
2. **Interfaccia ad Alta Risoluzione per Scansione**:
   - Schermata con canvas ad alto contrasto e dimensioni calibrate per consentire la scansione fisica immediata tramite scanner laser/ottico o fotocamera smartphone direttamente dal monitor.
   - Slider interattivi per regolare la larghezza del modulo (risoluzione barre) e l'altezza del codice.
3. **Download Immagine**:
   - Esportazione vettoriale **SVG** nitida per tipografia e stampe industriali.
   - Esportazione raster **PNG** ad alta risoluzione.
4. **Salvataggio e Riuso Configurazioni**:
   - Salvataggio con nome univoco e note nel database PostgreSQL / SQLite.
   - Ricarica istantanea con un clic nel generatore per modifiche o ristampe.
5. **Nessuna Emoji**:
   - Tutte le icone della UI sono implementate in grafica vettoriale SVG inline (`app-svg-icon`).
