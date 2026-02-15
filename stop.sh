#!/bin/bash

# Script per fermare Genotify

echo "🛑 Arresto Genotify..."

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Leggi i PID salvati
if [ -f /tmp/genotify-backend.pid ]; then
    BACKEND_PID=$(cat /tmp/genotify-backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        echo -e "${GREEN}✅ Backend fermato (PID: $BACKEND_PID)${NC}"
    fi
    rm /tmp/genotify-backend.pid
fi

if [ -f /tmp/genotify-dashboard.pid ]; then
    DASHBOARD_PID=$(cat /tmp/genotify-dashboard.pid)
    if kill -0 $DASHBOARD_PID 2>/dev/null; then
        kill $DASHBOARD_PID
        echo -e "${GREEN}✅ Dashboard fermata (PID: $DASHBOARD_PID)${NC}"
    fi
    rm /tmp/genotify-dashboard.pid
fi

# Cleanup eventuali processi rimasti sulle porte
lsof -ti:3050 | xargs kill -9 2>/dev/null || true
lsof -ti:50179 | xargs kill -9 2>/dev/null || true

echo -e "${GREEN}✅ Tutti i servizi sono stati fermati${NC}"
