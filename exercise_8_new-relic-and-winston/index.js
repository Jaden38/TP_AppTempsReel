// IMPORTANT: New Relic doit être importé en premier !
require('newrelic');

const express = require('express');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

// Créer le dossier logs s'il n'existe pas
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour logger toutes les requêtes
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log de la requête entrante
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Intercepter la fin de la requête pour logger la réponse
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    };

    // Choisir le niveau de log selon le status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else {
      logger.info('Request completed successfully', logData);
    }
  });

  next();
});

// Middleware pour parser le JSON
app.use(express.json());

// Routes de base

// Route de santé
app.get('/ping', (req, res) => {
  logger.info('Ping endpoint called', { route: '/ping' });
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

// Route lente (simule une latence)
app.get('/slow', async (req, res) => {
  logger.warn('Slow endpoint triggered', { 
    route: '/slow',
    expectedDelay: '2000ms'
  });
  
  // Simuler une opération lente
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  logger.info('Slow endpoint completed', { route: '/slow' });
  res.json({ 
    status: 'ok',
    message: 'This endpoint is intentionally slow',
    delay: '2000ms'
  });
});

// Route qui génère une erreur
app.get('/error', (req, res, next) => {
  logger.error('Error endpoint triggered - About to throw error', {
    route: '/error'
  });
  
  // Simuler une erreur
  throw new Error('Boom! This is an intentional error for testing');
});

// Route avec différents niveaux de logs
app.get('/test-logs', (req, res) => {
  // Différents niveaux de logs
  logger.debug('This is a debug message', { level: 'debug', extra: 'data' });
  logger.info('This is an info message', { level: 'info' });
  logger.warn('This is a warning message', { level: 'warn', caution: true });
  logger.error('This is an error message (not a real error)', { level: 'error' });
  
  res.json({
    message: 'Different log levels have been generated',
    checkLogs: {
      console: 'Check your console output',
      files: [
        'logs/app.log (all logs)',
        'logs/error.log (errors only)'
      ]
    }
  });
});

// Route pour simuler du trafic variable
app.post('/data', (req, res) => {
  const { type, payload } = req.body;
  
  logger.info('Data endpoint called', {
    route: '/data',
    dataType: type,
    payloadSize: JSON.stringify(payload).length
  });

  // Simuler différents temps de traitement selon le type
  const processingTime = type === 'heavy' ? 1000 : 100;
  
  setTimeout(() => {
    res.json({
      received: true,
      type,
      processedAt: new Date().toISOString(),
      processingTime: `${processingTime}ms`
    });
  }, processingTime);
});

// Route pour obtenir les statistiques
app.get('/stats', (req, res) => {
  logger.info('Stats endpoint called', { route: '/stats' });
  
  // Lire le fichier de logs pour des stats basiques
  const logFile = path.join(__dirname, 'logs', 'app.log');
  
  if (fs.existsSync(logFile)) {
    const stats = fs.statSync(logFile);
    const logs = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
    
    res.json({
      logFileSize: `${(stats.size / 1024).toFixed(2)} KB`,
      totalLogs: logs.length,
      lastModified: stats.mtime,
      recentLogs: logs.slice(-5).map(log => {
        try {
          return JSON.parse(log);
        } catch {
          return log;
        }
      })
    });
  } else {
    res.json({
      message: 'No log file found yet'
    });
  }
});

// Middleware de gestion d'erreurs global
app.use((err, req, res, next) => {
  logger.error('Unhandled error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Route 404
app.use((req, res) => {
  logger.warn('404 - Route not found', {
    url: req.url,
    method: req.method
  });
  
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.url} not found`,
    availableRoutes: [
      'GET /ping',
      'GET /slow',
      'GET /error',
      'GET /test-logs',
      'POST /data',
      'GET /stats'
    ]
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  logger.info('🚀 Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    newRelic: process.env.NEW_RELIC_LICENSE_KEY ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString()
  });
  
  console.log(`
╔═══════════════════════════════════════════╗
║   TP New Relic & Winston - Server Ready   ║
╠═══════════════════════════════════════════╣
║   Server running on port ${PORT}            ║
║   Visit http://localhost:${PORT}            ║
║                                           ║
║   Available endpoints:                    ║
║   - GET  /ping       (health check)       ║
║   - GET  /slow       (simulated latency)  ║
║   - GET  /error      (trigger error)      ║
║   - GET  /test-logs  (test log levels)    ║
║   - POST /data       (process data)       ║
║   - GET  /stats      (view statistics)    ║
╚═══════════════════════════════════════════╝
  `);
});

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});