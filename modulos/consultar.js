const nucleo = require('../nucleo');

module.exports = {
  nombre: 'Consultar',
  emoji: '2️⃣',
  claves: ['2', 'consultar'],
  pregunta: '🔎 Decime qué querés consultar.',
  procesando: '🔎 Buscando en tu vault...',
  async ejecutar(texto) {
    const { texto: respuesta, notas } = await nucleo.responderConsulta(texto);
    if (notas.length === 0) return respuesta;
    return { texto: respuesta, aprendizaje: { pregunta: texto, notas } };
  }
};