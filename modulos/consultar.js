const nucleo = require('../nucleo');

module.exports = {
  nombre: 'Consultar',
  emoji: '2️⃣',
  claves: ['2', 'consultar'],
  pregunta: '🔎 Decime qué querés consultar.',
  procesando: '🔎 Buscando en tu vault...',
  async ejecutar(texto) {
    return await nucleo.responderConsulta(texto);
  }
};