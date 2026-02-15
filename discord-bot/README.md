# Genotify Discord Bot

Bot Discord per sincronizzare automaticamente i canali del server con il database di Genotify e creare webhook.

## Cosa Fa

- ✅ Sincronizza tutti i canali Discord → database all'avvio
- ✅ Crea automaticamente webhook per ogni canale
- ✅ Ascolta eventi di creazione/modifica/eliminazione canali
- ✅ Classifica i canali per tipo (CLIENT, INTERNAL, VENDOR) basandosi sulla categoria
- ✅ Estrae automaticamente lo slug del cliente dal nome del canale

## Setup

1. **Installa le dipendenze:**
   ```bash
   cd discord-bot
   npm install
   ```

2. **Configura le variabili d'ambiente:**
   ```bash
   cp .env.example .env
   ```

3. **Modifica il file `.env`:**
   ```env
   DISCORD_BOT_TOKEN=il-tuo-nuovo-token-rigenerato
   DISCORD_GUILD_ID=il-tuo-server-id
   DATABASE_URL=postgresql://andreacamolese@localhost:5432/notification_hub
   ```

4. **Genera il Prisma Client** (usa quello del progetto principale):
   ```bash
   cd ..
   npx prisma generate
   cd discord-bot
   ```

## Avvio

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

## Naming Convention per Canali Clienti

Il bot riconosce automaticamente i canali clienti se seguono questi pattern:
- `cliente-<slug>` (es. `cliente-acme` → slug: `acme`)
- `progetto-<slug>` (es. `progetto-beta` → slug: `beta`)
- `client-<slug>` (es. `client-gamma` → slug: `gamma`)

## Categorie

- **Categorie "Clienti" o "Progetti"** → tipo `CLIENT`
- **Categorie "Fornitori" o "Vendor"** → tipo `VENDOR`
- **Altre categorie** → tipo `INTERNAL`
