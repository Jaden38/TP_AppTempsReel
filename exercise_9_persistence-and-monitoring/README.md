# Realtime Sync Application

## Choix Technologiques

- **WebSockets**: Communication bidirectionnelle temps réel
- **SQLite**: Persistance locale légère et sans configuration
- **JWT**: Authentification stateless
- **bcrypt**: Hachage sécurisé des mots de passe

## Plan de Sécurité

### Règles Implémentées

1. **Rate Limiting**: Max 100 requêtes/minute par IP
2. **Validation Serveur**: Sanitisation de toutes les entrées
3. **Autorisation**: Seuls les propriétaires peuvent modifier/supprimer leurs items
4. **Authentication JWT**: Tokens avec expiration 24h
5. **Hachage bcrypt**: Mots de passe jamais stockés en clair

## Gestion des Erreurs

- Reconnexion automatique avec exponential backoff
- Queue locale des actions pendant déconnexion
- Validation de tous les messages WebSocket
- Gestion gracieuse des erreurs d'authentification

## Monitoring

- Compteur de connexions actives
- Mesure de latence en temps réel
- Logs de synchronisation avec historique
- Statistiques de performance (p95 latency)

## Installation et Lancement

```bash
npm install
npm start
```

Ouvrir <http://localhost:3000> dans plusieurs onglets

## Limites et Améliorations

### Limites Actuelles

- SQLite mono-thread limite la concurrence
- Pas de résolution de conflits (last-write-wins)
- Monitoring basique sans persistance

### Améliorations Possibles

- Migration vers PostgreSQL pour meilleure concurrence
- Implémentation CRDT pour résolution de conflits
- Ajout de Prometheus/Grafana pour monitoring avancé
- Cache Redis pour améliorer les performances
- Compression des messages WebSocket
