#!/bin/bash

# Script di avvio Genotify
# Esegui questo script dal tuo terminale macOS

set -e

echo "🚀 Genotify - Avvio in corso..."
echo ""

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Funzione per verificare se una porta è in uso
check_port() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Funzione per killare processi su una porta
kill_port() {
    if check_port $1; then
        echo -e "${YELLOW}⚠️  Chiudo processo esistente sulla porta $1${NC}"
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# 1. Verifica PostgreSQL
echo "1️⃣  Verifico PostgreSQL..."
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL non è in esecuzione!${NC}"
    echo ""
    echo "Avvia PostgreSQL con uno di questi comandi:"
    echo "  • brew services start postgresql@14"
    echo "  • brew services start postgresql@15"
    echo "  • brew services start postgresql@16"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ PostgreSQL attivo${NC}"

# 2. Verifica database
echo ""
echo "2️⃣  Verifico database notification_hub..."
if ! psql -U andreacamolese -d notification_hub -c "SELECT 1" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Database non trovato, lo creo...${NC}"
    createdb -U andreacamolese notification_hub 2>/dev/null || true
fi
echo -e "${GREEN}✅ Database pronto${NC}"

# 3. Esegui migrations
echo ""
echo "3️⃣  Eseguo migrations Prisma..."
cd "$(dirname "$0")"
npx prisma migrate deploy >/dev/null 2>&1 || true
npx prisma generate >/dev/null 2>&1
echo -e "${GREEN}✅ Migrations completate${NC}"

# 4. Libera le porte
echo ""
echo "4️⃣  Verifico porte..."
kill_port 3060
kill_port 50179
echo -e "${GREEN}✅ Porte liberate${NC}"

# 5. Avvia backend
echo ""
echo "5️⃣  Avvio backend su porta 3060..."
npm run dev > /tmp/genotify-backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

# Verifica che il backend sia partito
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Errore avvio backend${NC}"
    echo "Log:"
    tail -20 /tmp/genotify-backend.log
    exit 1
fi
echo -e "${GREEN}✅ Backend avviato (PID: $BACKEND_PID)${NC}"

# 6. Avvia dashboard
echo ""
echo "6️⃣  Avvio dashboard su porta 50179..."
cd dashboard
npm run dev > /tmp/genotify-dashboard.log 2>&1 &
DASHBOARD_PID=$!
cd ..
sleep 3

# Verifica che la dashboard sia partita
if ! kill -0 $DASHBOARD_PID 2>/dev/null; then
    echo -e "${RED}❌ Errore avvio dashboard${NC}"
    echo "Log:"
    tail -20 /tmp/genotify-dashboard.log
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi
echo -e "${GREEN}✅ Dashboard avviata (PID: $DASHBOARD_PID)${NC}"

# 7. Test health check
echo ""
echo "7️⃣  Test health check..."
sleep 2
if curl -s http://localhost:3060/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend risponde correttamente${NC}"
else
    echo -e "${YELLOW}⚠️  Backend non risponde ancora, potrebbe servire più tempo${NC}"
fi

# Salva i PID
echo "$BACKEND_PID" > /tmp/genotify-backend.pid
echo "$DASHBOARD_PID" > /tmp/genotify-dashboard.pid

# Riepilogo finale
echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Genotify avviato con successo!${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📍 URLs:"
echo "   • Backend API: http://localhost:3060"
echo "   • Dashboard:   http://localhost:50179"
echo ""
echo "📊 Processi:"
echo "   • Backend PID:   $BACKEND_PID"
echo "   • Dashboard PID: $DASHBOARD_PID"
echo ""
echo "📝 Log:"
echo "   • Backend:   tail -f /tmp/genotify-backend.log"
echo "   • Dashboard: tail -f /tmp/genotify-dashboard.log"
echo ""
echo "🛑 Per fermare i servizi:"
echo "   ./stop.sh"
echo ""
echo "════════════════════════════════════════════════════════════"
