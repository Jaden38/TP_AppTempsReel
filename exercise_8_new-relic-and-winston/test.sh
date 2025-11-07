#!/bin/bash

echo "🧪 Test de l'application New Relic & Winston"
echo "==========================================="

# URL de base
BASE_URL="http://localhost:3000"

echo -e "\n1️⃣ Test du endpoint /ping"
curl -s $BASE_URL/ping | json_pp

echo -e "\n2️⃣ Test du endpoint /slow (2 secondes de latence)"
time curl -s $BASE_URL/slow | json_pp

echo -e "\n3️⃣ Test des différents niveaux de logs"
curl -s $BASE_URL/test-logs | json_pp

echo -e "\n4️⃣ Test du endpoint /data avec payload léger"
curl -s -X POST $BASE_URL/data \
  -H "Content-Type: application/json" \
  -d '{"type":"light","payload":{"test":"data"}}' | json_pp

echo -e "\n5️⃣ Test du endpoint /data avec payload lourd"
curl -s -X POST $BASE_URL/data \
  -H "Content-Type: application/json" \
  -d '{"type":"heavy","payload":{"test":"heavy data processing"}}' | json_pp

echo -e "\n6️⃣ Test du endpoint /error (génère une erreur)"
curl -s $BASE_URL/error | json_pp

echo -e "\n7️⃣ Test d'une route inexistante (404)"
curl -s $BASE_URL/inexistent | json_pp

echo -e "\n8️⃣ Récupération des statistiques"
curl -s $BASE_URL/stats | json_pp

echo -e "\n✅ Tests terminés! Vérifiez:"
echo "   - La console pour les logs Winston"
echo "   - Le fichier logs/app.log pour l'historique complet"
echo "   - Le fichier logs/error.log pour les erreurs uniquement"
echo "   - Le dashboard New Relic (si configuré) pour les métriques APM"