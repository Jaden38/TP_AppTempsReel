# TP WebSockets & Communication Temps Réel

## 📚 Description

Repository contenant les travaux pratiques sur les technologies de communication temps réel avec WebSockets et Socket.IO. Chaque dossier correspond à un exercice indépendant avec son propre serveur et client.

## 🚀 Démarrage Rapide

### Prérequis
- Node.js (v14+)
- npm ou yarn
- Navigateur web moderne

### Installation Globale
```bash
# Cloner le repository
git clone [url-du-repo]
cd TP_AppTempsReel

# Se déplacer dans un exercice
cd [nom-du-dossier-exercice]

# Installer les dépendances
npm install

# Démarrer le serveur
node server.js   # ou node index.js selon l'exercice

```

## Structure

```
AppTempsReel
├─ exercise_1_sse_stock_app
│  ├─ gunicorn.conf.py
│  ├─ README.md
│  ├─ requirements.txt
│  ├─ screenshots
│  │  └─ image.png
│  ├─ server.py
│  ├─ static
│  │  ├─ css
│  │  │  └─ styles.css
│  │  └─ js
│  │     └─ dashboard.js
│  └─ templates
│     └─ index.html
├─ exercise_2_tp-long-polling
│  ├─ app.py
│  ├─ README.md
│  └─ test_script.py
├─ exercise_3_tp-websocket-chat
│  ├─ client
│  │  ├─ css
│  │  │  └─ styles.css
│  │  ├─ index.html
│  │  └─ js
│  │     └─ chat.js
│  ├─ package.json
│  ├─ README.md
│  ├─ render.yml
│  ├─ screenshots
│  │  ├─ image-1.png
│  │  ├─ image-2.png
│  │  └─ image-3.png
│  └─ server.js
├─ exercise_4_websocket_capitalizer
│  ├─ client.js
│  ├─ index.html
│  ├─ package.json
│  ├─ README.md
│  └─ server.js
├─ exercise_5_chat-multi-salons
│  ├─ index.html
│  ├─ index.js
│  ├─ package.json
│  └─ README.md
├─ exercise_6_chat-multi-salons-with-redis
│  ├─ docker-compose.yml
│  ├─ index.html
│  ├─ index.js
│  ├─ package.json
│  └─ README.md
└─ README.md

```
```
AppTempsReel
├─ exercise_1_sse_stock_app
│  ├─ gunicorn.conf.py
│  ├─ README.md
│  ├─ requirements.txt
│  ├─ screenshots
│  │  └─ image.png
│  ├─ server.py
│  ├─ static
│  │  ├─ css
│  │  │  └─ styles.css
│  │  └─ js
│  │     └─ dashboard.js
│  └─ templates
│     └─ index.html
├─ exercise_2_tp-long-polling
│  ├─ app.py
│  ├─ README.md
│  └─ test_script.py
├─ exercise_3_tp-websocket-chat
│  ├─ client
│  │  ├─ css
│  │  │  └─ styles.css
│  │  ├─ index.html
│  │  └─ js
│  │     └─ chat.js
│  ├─ package.json
│  ├─ README.md
│  ├─ render.yml
│  ├─ screenshots
│  │  ├─ image-1.png
│  │  ├─ image-2.png
│  │  └─ image-3.png
│  └─ server.js
├─ exercise_4_websocket_capitalizer
│  ├─ client.js
│  ├─ index.html
│  ├─ package.json
│  ├─ README.md
│  └─ server.js
├─ exercise_5_chat-multi-salons
│  ├─ index.html
│  ├─ index.js
│  ├─ package.json
│  └─ README.md
├─ exercise_6_chat-multi-salons-with-redis
│  ├─ docker-compose.yml
│  ├─ index.html
│  ├─ index.js
│  ├─ package.json
│  └─ README.md
├─ exercise_7_secure-collaborative-board
│  ├─ package.json
│  ├─ public
│  │  ├─ app.js
│  │  └─ index.html
│  ├─ README.md
│  └─ server.js
└─ README.md

```