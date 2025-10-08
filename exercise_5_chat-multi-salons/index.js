const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir le fichier index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Écoute des connexions Socket.IO
io.on('connection', (socket) => {
  console.log('Un utilisateur est connecté');

  // Étape 1 : Gérer la connexion à un salon
  socket.on('join room', (data) => {
    socket.join(data.room); // Ajoute le socket au salon
    socket.data.username = data.username; // Stocke le pseudo
    socket.data.room = data.room; // Stocke le salon actuel

    // Notifie tous les membres du salon (y compris le nouveau)
    io.to(data.room).emit('room message', { 
      message: `${data.username} a rejoint le salon ${data.room}.` 
    });
    console.log(`${data.username} a rejoint le salon ${data.room}`);
  });

  // Étape 2 : Gérer l'envoi de messages dans un salon
  socket.on('chat message', (data) => {
    // Émet le message uniquement aux clients du salon spécifié
    io.to(data.room).emit('chat message', {
      username: data.username,
      room: data.room,
      message: data.message
    });
    console.log(`[${data.room}] ${data.username}: ${data.message}`);
  });

  // Étape 3 : Gérer les déconnexions
  socket.on('disconnect', () => {
    console.log('Un utilisateur est déconnecté');
    if (socket.data.username && socket.data.room) {
      // Notifie les autres membres du salon que l'utilisateur est parti
      socket.to(socket.data.room).emit('room message', {
        message: `${socket.data.username} a quitté le salon ${socket.data.room}.`
      });
      console.log(`${socket.data.username} a quitté le salon ${socket.data.room}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});