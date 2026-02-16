# Deploy Dashboard GeNotify su Vercel

Questa guida spiega come deployare il dashboard GeNotify su Vercel.

## Prerequisiti

1. Account Vercel (gratuito)
2. Backend GeNotify deployato su Render
3. Google OAuth credentials configurati

## Passaggi per il Deploy

### 1. Prepara Google OAuth

Aggiungi il dominio Vercel come Authorized Redirect URI:

1. Vai su [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Seleziona le tue OAuth 2.0 credentials
3. Aggiungi agli "Authorized redirect URIs":
   ```
   https://genotify-dashboard.vercel.app/api/auth/callback/google
   ```
   *(sostituisci con il tuo dominio Vercel)*

### 2. Deploy su Vercel

#### Opzione A: Deploy via Dashboard (Consigliato)

1. Vai su [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Importa il repository GeNotify
4. Configura:
   - **Framework Preset**: Next.js
   - **Root Directory**: `dashboard`
   - **Build Command**: `prisma generate && next build`
   - **Output Directory**: `.next` (default)

5. Click "Deploy"

#### Opzione B: Deploy via CLI

```bash
cd /Users/andreacamolese/Genotify/dashboard

# Installa Vercel CLI (se necessario)
npm install -g vercel

# Login
vercel login

# Deploy
vercel
```

### 3. Configura le Variabili d'Ambiente

Nella dashboard Vercel, vai su Settings → Environment Variables e aggiungi:

#### Production Environment:

```
DATABASE_URL=postgresql://user:pass@host.render.com:5432/genotify
NEXTAUTH_URL=https://genotify-dashboard.vercel.app
NEXTAUTH_SECRET=n/T3uqJ/FJXRUW3UezdSXfFI73Fmv8smU01znSspZmY=
GOOGLE_CLIENT_ID=[tuo Google Client ID]
GOOGLE_CLIENT_SECRET=[tuo Google Client Secret]
```

**⚠️ IMPORTANTE:**
- `DATABASE_URL` deve puntare al database PostgreSQL su Render (stesso del backend)
- `NEXTAUTH_URL` deve essere l'URL completo del tuo deployment Vercel
- `NEXTAUTH_SECRET` è stato generato per production: `n/T3uqJ/FJXRUW3UezdSXfFI73Fmv8smU01znSspZmY=`

### 4. Configura il Custom Domain (Opzionale)

1. Vai su Settings → Domains
2. Aggiungi il tuo dominio personalizzato
3. Configura i DNS records come indicato da Vercel

### 5. Verifica il Deploy

Visita `https://genotify-dashboard.vercel.app` (o il tuo dominio)

- Dovresti vedere la pagina di login
- Il login con Google dovrebbe funzionare
- Dopo il login, dovresti vedere il dashboard con le notifiche

## Struttura Finale

```
GeNotify (Repository Git)
├── Backend API → Render.com
│   ├── Web Service: genotify-api
│   ├── Worker: genotify-discord-bot
│   └── Database: PostgreSQL
│
└── Frontend Dashboard → Vercel
    ├── Next.js App
    ├── NextAuth (Google OAuth)
    └── Connesso allo stesso DB Render
```

## Auto-Deploy

Vercel si integra automaticamente con Git:
- Push su `main` → Deploy production
- Pull Request → Deploy preview automatico

## Monitoraggio

- **Analytics**: Tab Analytics nella dashboard Vercel
- **Logs**: Tab Deployments → Click su deployment → View Function Logs
- **Performance**: Speed Insights automatici

## Costi

- **Vercel Hobby Plan**: GRATUITO
  - 100 GB bandwidth/mese
  - 100 ore serverless function/mese
  - Unlimited deployments
  - HTTPS automatico

Per team più grandi, considera Pro Plan ($20/mese per team).

## Note di Sicurezza

1. **NEXTAUTH_SECRET** deve essere diverso tra development e production ✅
2. **Google OAuth** redirect URIs devono includere il dominio Vercel ✅
3. **DATABASE_URL** deve usare SSL in production
4. Non committare mai `.env` nel repository

## Troubleshooting

**"Error: Invalid redirect URI":**
- Verifica che l'URI sia stato aggiunto correttamente in Google Console
- L'URI deve essere esattamente: `https://tuo-dominio.vercel.app/api/auth/callback/google`

**"Database connection error":**
- Verifica che `DATABASE_URL` sia corretto
- Assicurati che il database Render permetta connessioni esterne
- Controlla che Prisma sia stato generato correttamente

**"Session expired" continuo:**
- Verifica che `NEXTAUTH_URL` corrisponda esattamente al dominio
- Controlla che `NEXTAUTH_SECRET` sia configurato correttamente

## Aggiornamenti

Per deployare aggiornamenti al dashboard:

```bash
cd dashboard
git add .
git commit -m "Update dashboard"
git push origin main
```

Vercel rileva automaticamente il push e redeploya.

## Link Utili

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [NextAuth.js Vercel Guide](https://next-auth.js.org/deployment)
