const nucleo = require('../nucleo');

module.exports = {
  nombre: 'Guardar / Anotar',
  emoji: '1️⃣',
  claves: ['1', 'guardar', 'anotar'],
  pregunta: '📝 Decime qué querés guardar.',
  procesando: '🤖 Decidiendo dónde guardarlo...',
  async ejecutar(texto) {
    const ruta = await nucleo.anotarInteligente(texto);
    return `✅ Guardado en "${ruta}"`;
  }
};