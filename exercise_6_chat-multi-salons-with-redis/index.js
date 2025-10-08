const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configuration Redis
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'your_redis_password';

// Créer deux clients Redis : un pour publier, un pour s'abonner
const redisPublisher = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT
  },
  password: REDIS_PASSWORD
});

const redisSubscriber = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT
  },
  password: REDIS_PASSWORD
});

// Gestion des erreurs Redis
redisPublisher.on('error', (err) => console.error('Redis Publisher Error:', err));
redisSubscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));

// Connexion à Redis
async function connectRedis() {
  try {
    await redisPublisher.connect();
    await redisSubscriber.connect();
    console.log('✓ Connecté à Redis avec succès');
    
    // S'abonner au canal de messages de chat
    await redisSubscriber.subscribe('chat:messages', (message) => {
      try {
        const data = JSON.parse(message);
        
        // Diffuser le message aux clients Socket.IO connectés à ce serveur
        // qui sont dans le salon approprié
        io.to(data.room).emit('chat message', {
          username: data.username,
          room: data.room,
          message: data.message,
          time: data.time
        });
        
        console.log(`[Redis → Clients] [${data.room}] ${data.username}: ${data.message}`);
      } catch (err) {
        console.error('Erreur lors du traitement du message Redis:', err);
      }
    });

    // S'abonner au canal des notifications de salon
    await redisSubscriber.subscribe('chat:room-notifications', (message) => {
      try {
        const data = JSON.parse(message);
        
        // Diffuser la notification aux clients du salon
        io.to(data.room).emit('room message', {
          message: data.message
        });
        
        console.log(`[Redis → Clients] Notification: ${data.message}`);
      } catch (err) {
        console.error('Erreur lors du traitement de la notification Redis:', err);
      }
    });

    console.log('✓ Abonné aux canaux Redis');
  } catch (err) {
    console.error('Erreur de connexion à Redis:', err);
    process.exit(1);
  }
}

// Servir le fichier index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Écoute des connexions Socket.IO
io.on('connection', (socket) => {
  console.log(`✓ Nouvelle connexion Socket.IO: ${socket.id}`);

  // Gérer la connexion à un salon
  socket.on('join room', async (data) => {
    try {
      socket.join(data.room);
      socket.data.username = data.username;
      socket.data.room = data.room;

      // Publier la notification de connexion sur Redis
      const notification = {
        room: data.room,
        message: `${data.username} a rejoint le salon ${data.room}.`
      };
      
      await redisPublisher.publish(
        'chat:room-notifications', 
        JSON.stringify(notification)
      );
      
      console.log(`[Local] ${data.username} a rejoint le salon ${data.room}`);
    } catch (err) {
      console.error('Erreur lors de la publication de la notification:', err);
    }
  });

  // Gérer l'envoi de messages
  socket.on('chat message', async (data) => {
    try {
      // Publier le message sur Redis au lieu de l'émettre directement
      const messageData = {
        username: data.username,
        room: data.room,
        message: data.message,
        time: data.time || new Date().toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };
      
      await redisPublisher.publish(
        'chat:messages', 
        JSON.stringify(messageData)
      );
      
      console.log(`[Local → Redis] [${data.room}] ${data.username}: ${data.message}`);
    } catch (err) {
      console.error('Erreur lors de la publication du message:', err);
    }
  });

  // Gérer les déconnexions
  socket.on('disconnect', async () => {
    console.log(`✗ Déconnexion: ${socket.id}`);
    
    if (socket.data.username && socket.data.room) {
      try {
        // Publier la notification de déconnexion sur Redis
        const notification = {
          room: socket.data.room,
          message: `${socket.data.username} a quitté le salon ${socket.data.room}.`
        };
        
        await redisPublisher.publish(
          'chat:room-notifications', 
          JSON.stringify(notification)
        );
        
        console.log(`[Local] ${socket.data.username} a quitté le salon ${socket.data.room}`);
      } catch (err) {
        console.error('Erreur lors de la publication de la notification de départ:', err);
      }
    }
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectRedis();
  
  server.listen(PORT, () => {
    console.log(`🚀 Serveur en écoute sur le port ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
  });
}

// Gestion de l'arrêt propre
process.on('SIGINT', async () => {
  console.log('\n⏹ Arrêt du serveur...');
  await redisPublisher.quit();
  await redisSubscriber.quit();
  server.close(() => {
    console.log('✓ Serveur arrêté proprement');
    process.exit(0);
  });
});

startServer().catch(err => {
  console.error('Erreur au démarrage:', err);
  process.exit(1);
});