const { createLogger, format, transports } = require('winston');
const path = require('path');

// Format personnalisé pour les logs
const customFormat = format.combine(
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

// Format pour la console (plus lisible)
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({
    format: 'HH:mm:ss'
  }),
  format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Créer le logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'tp-realtime' },
  transports: [
    // Console avec format coloré
    new transports.Console({
      format: consoleFormat
    }),
    // Fichier pour tous les logs
    new transports.File({ 
      filename: path.join(__dirname, 'logs', 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Fichier séparé pour les erreurs
    new transports.File({ 
      filename: path.join(__dirname, 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Si on est en production, on peut réduire les logs console
if (process.env.NODE_ENV === 'production') {
  logger.transports[0].level = 'error';
}

module.exports = logger;