const nucleo = require('../nucleo');

module.exports = {
  nombre: 'Modificar',
  emoji: '3️⃣',
  claves: ['3', 'modificar'],
  pregunta: '✏️ Decime qué querés modificar (ej: "cambiá mi peso a 70kg").',
  procesando: '✏️ Modificando...',
  async ejecutar(texto) {
    const ruta = await nucleo.editarConIA(texto, 'modificar');
    return `✅ Modificado en "${ruta}"`;
  }
};