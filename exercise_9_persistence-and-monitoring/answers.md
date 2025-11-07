# PARTIE A - Théorie

## Question 1 - Services cloud temps réel

### a) Deux services managés

1. **Firebase Realtime Database** (Google)
2. **Pusher Channels**

### b) Comparaison

**Firebase Realtime Database:**

- Modèle de données: NoSQL JSON hiérarchique
- Persistance: Automatique, données stockées dans le cloud
- Mode d'écoute: Listeners sur chemins de données, synchronisation automatique
- Scalabilité: Automatique jusqu'à 200k connexions simultanées

**Pusher Channels:**

- Modèle de données: Messages événementiels, pas de stockage
- Persistance: Aucune par défaut (stateless)
- Mode d'écoute: Pub/Sub sur canaux nommés
- Scalabilité: Basée sur le plan (100 à millions de connexions)

### c) Cas d'usage préférés

- **Firebase**: Applications collaboratives nécessitant persistance (todo-lists, documents partagés)
- **Pusher**: Notifications temps réel, chat éphémère, live updates sans besoin de stockage

## Question 2 - Sécurité temps réel

### a) Trois risques et protections

1. **DDoS par saturation de connexions**
   - Protection: Rate limiting, limite de connexions par IP, timeouts agressifs

2. **Injection de données malveillantes**
   - Protection: Validation stricte côté serveur, sanitisation, schémas de validation

3. **Hijacking de session WebSocket**
   - Protection: Tokens JWT avec expiration, rotation de tokens, vérification d'origine

### b) Importance de la gestion des identités

La gestion d'identité en temps réel est cruciale pour:

- Tracer les actions de chaque utilisateur
- Implémenter des autorisations granulaires
- Prévenir l'usurpation d'identité
- Permettre la révocation immédiate d'accès

## Question 3 - WebSockets vs Webhooks

### a) Définitions

- **WebSockets**: Protocole bidirectionnel full-duplex maintenant une connexion TCP persistante
- **Webhooks**: Callbacks HTTP déclenchés par des événements, communication unidirectionnelle

### b) Avantages et limites

**WebSockets:**

- Avantages: Latence minimale, bidirectionnel
- Limites: Consomme des ressources serveur, complexité de gestion des connexions

**Webhooks:**

- Avantages: Stateless, simple à implémenter
- Limites: Latence plus élevée, nécessite endpoint public

### c) Cas préférable pour Webhook

Les webhooks sont préférables pour les intégrations entre services (GitHub → CI/CD, Stripe → facturation) car ils ne nécessitent pas de connexion permanente et sont plus résilients aux pannes réseau temporaires.

## Question 4 - CRDT & Collaboration

### a) Définition CRDT

Conflict-free Replicated Data Type: structure de données qui peut être répliquée sur plusieurs nœuds et modifiée en parallèle sans coordination centrale, garantissant la convergence.

### b) Exemple concret

Compteur distribué dans un système de "likes": chaque serveur incrémente son propre compteur local, la somme donne le total global sans risque de conflit.

### c) Évitement des conflits

Les CRDT évitent les conflits car leurs opérations sont commutatives et associatives. L'ordre d'application n'impacte pas le résultat final, garantissant la convergence sans coordination.

## Question 5 - Monitoring temps réel

### a) Trois métriques clés

1. **Nombre de connexions actives**: Charge serveur
2. **Latence message (p50, p95, p99)**: Performance perçue
3. **Taux de reconnexions**: Stabilité du système

### b) Prometheus/Grafana

- Prometheus collecte les métriques via scraping périodique
- Grafana visualise avec dashboards temps réel et alerting
- Ensemble: vision complète de la santé du système

### c) Différences logs/traces/métriques

- **Logs**: Événements discrets textuels (erreurs, actions)
- **Traces**: Parcours complet d'une requête dans le système
- **Métriques**: Valeurs numériques agrégées dans le temps

## Question 6 - Déploiement & Connexions persistantes

### a) Impact sur load balancing et scalabilité

- **Load balancing**: Nécessite sticky sessions ou state sharing entre serveurs
- **Scalabilité**: Limite le nombre de connexions par serveur, nécessite architecture pub/sub

### b) Kubernetes dans ce contexte

Kubernetes facilite:

- Le scaling horizontal automatique
- La gestion des sessions avec StatefulSets
- Le service mesh pour la communication inter-pods
- Les health checks adaptés aux connexions longues

## Question 7 - Stratégies de résilience client

### a) Trois mécanismes

1. **Reconnexion automatique**: Nouvelle tentative après déconnexion
2. **Queue locale**: Stockage des actions pendant offline
3. **État optimiste**: UI responsive avec reconciliation ultérieure

### b) Exponential backoff

Augmentation progressive du délai entre tentatives de reconnexion (1s, 2s, 4s, 8s...) pour éviter de surcharger le serveur lors de pannes.
