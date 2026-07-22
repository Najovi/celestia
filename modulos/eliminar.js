const nucleo = require('../nucleo');

module.exports = {
  nombre: 'Eliminar',
  emoji: '4️⃣',
  claves: ['4', 'eliminar', 'borrar'],
  pregunta: '🗑️ Decime qué querés eliminar (ej: "borrá la idea de la lámpara").',
  procesando: '🗑️ Eliminando...',
  async ejecutar(texto) {
    const ruta = await nucleo.editarConIA(texto, 'eliminar');
    return `✅ Eliminado de "${ruta}"`;
  }
};