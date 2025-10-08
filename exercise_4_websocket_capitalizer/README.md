# WebSocket Capitalizer - Application Client-Serveur

## 📋 Description

Application de démonstration d'une communication bidirectionnelle en temps réel utilisant les WebSockets natifs. Le client envoie du texte au serveur qui le retourne en MAJUSCULES.

## 🚀 Installation et Démarrage

### Prérequis
- Node.js (version 14 ou supérieure)
- npm (gestionnaire de paquets Node.js)
- Un navigateur web moderne

### Démarrage

1. **Lancer le serveur WebSocket**
```bash
node server.js
```
Le serveur démarre sur le port 8080 et affiche :
```
🚀 Serveur WebSocket démarré sur le port 8080
En attente de connexions...
```

2. **Ouvrir le client**
- Ouvrez le fichier `index.html` dans votre navigateur
- Ou utilisez un serveur HTTP local (ex: Live Server dans VS Code)

## 💻 Utilisation

1. **Connexion automatique** : Le client se connecte automatiquement au serveur au chargement
2. **Envoi de messages** : 
   - Tapez votre texte dans le champ de saisie
   - Cliquez sur "Envoyer" ou appuyez sur Entrée
3. **Réception** : Le texte capitalisé s'affiche immédiatement dans l'historique
4. **Reconnexion** : En cas de déconnexion, le client tente automatiquement de se reconnecter

## 🏗️ Architecture

### Serveur (`server.js`)
- **Port** : 8080
- **Bibliothèque** : `ws` (WebSocket pour Node.js)
- **Fonctionnalités** :
  - Gestion multi-clients avec identification unique
  - Capitalisation des messages reçus
  - Messages structurés en JSON
  - Heartbeat pour maintenir les connexions actives
  - Gestion propre de l'arrêt du serveur (Ctrl+C)

### Client (`index.html` + `client.js`)
- **API** : WebSocket native du navigateur
- **Interface** : Design moderne avec animations et feedback visuel
- **Fonctionnalités** :
  - Indicateur de statut de connexion en temps réel
  - Historique des messages avec horodatage
  - Reconnexion automatique en cas de perte de connexion
  - Gestion des erreurs avec messages explicites
  - Interface responsive pour mobile

## 📦 Structure des Messages

### Messages du Client → Serveur
```javascript
"Bonjour monde"  // Texte brut simple
```

### Messages du Serveur → Client

**Message de bienvenue**
```json
{
  "type": "welcome",
  "message": "Bienvenue ! Vous êtes le client #1",
  "clientId": 1,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Réponse capitalisée**
```json
{
  "type": "response",
  "original": "bonjour",
  "capitalized": "BONJOUR",
  "processedAt": "2024-01-15T10:30:01.000Z",
  "clientId": 1
}
```

**Message d'erreur**
```json
{
  "type": "error",
  "message": "Description de l'erreur",
  "timestamp": "2024-01-15T10:30:02.000Z"
}
```

## 🛠️ Fonctionnalités Techniques

### Gestion des Événements
- ✅ **connection** : Nouveau client connecté
- ✅ **message** : Réception et traitement des messages
- ✅ **close** : Déconnexion propre des clients
- ✅ **error** : Gestion des erreurs réseau
- ✅ **ping/pong** : Heartbeat pour maintenir la connexion

### Sécurité et Robustesse
- Échappement HTML pour éviter les injections XSS
- Validation des messages vides
- Gestion des erreurs de parsing JSON
- Reconnexion automatique avec délai
- Nettoyage des connexions inactives

## 🎨 Points d'Amélioration Possibles

- **Persistance** : Sauvegarder l'historique des messages dans une base de données
- **Authentification** : Ajouter un système de login
- **Salons** : Créer des canaux de discussion séparés
- **Notifications** : Alertes sonores ou visuelles pour les nouveaux messages
- **Statistiques** : Compteur de messages, temps de réponse moyen
- **Emojis** : Support des émojis et formatage de texte

## 🤖 Utilisation de l'IA dans ce Projet

L'IA a été utilisée comme assistant pour :
- **Architecture** : Conseils sur la structure optimale du code WebSocket
- **Gestion d'erreurs** : Implémentation robuste avec reconnexion automatique
- **Interface utilisateur** : Design moderne avec animations CSS fluides
- **Documentation** : Génération de commentaires JSDoc clairs et complets
- **Debug** : Fonction `debugWebSocket()` pour faciliter le diagnostic

L'IA a permis d'accélérer le développement tout en maintenant une haute qualité de code et en explorant des patterns avancés comme le heartbeat et la reconnexion automatique.

## 📝 Notes de Développement

### Commandes Utiles
- `node server.js` : Démarrer le serveur
- `Ctrl+C` : Arrêter proprement le serveur
- `F12` → Console : Voir les logs dans le navigateur
- `debugWebSocket()` : Afficher l'état de la connexion dans la console

### Ports et URLs
- Serveur WebSocket : `ws://localhost:8080`
- Client : Ouvrir `index.html` localement

## 📚 Ressources

- [Documentation WebSocket MDN](https://developer.mozilla.org/fr/docs/Web/API/WebSocket)
- [Bibliothèque ws sur npm](https://www.npmjs.com/package/ws)
- [Guide des WebSockets](https://javascript.info/websocket)

---

**Auteur** : Étudiant TP WebSocket  
**Date** : 2024  
**Licence** : MIT