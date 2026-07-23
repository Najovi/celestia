const nucleo = require('../nucleo');

module.exports = {
  nombre: 'Eliminar',
  emoji: '4️⃣',
  claves: ['4', 'eliminar', 'borrar'],
  pregunta: '🗑️ Decime qué querés eliminar (ej: "borrá la idea de la lámpara").',
  procesando: '🗑️ Eliminando...',
  async ejecutar(texto) {
    const candidatas = await nucleo.elegirNotasRelevantes(texto);
    if (candidatas.length === 0) {
      return '🤔 No encontré ninguna nota relacionada con eso. Probá ser más específico, o mirá con "Explorar carpetas" (opción 5).';
    }

    const mensaje = candidatas.length === 1
      ? `🗑️ Voy a eliminar eso de "${candidatas[0]}". ¿Confirmás? Escribí "sí", o "no" para cancelar.`
      : `🗑️ Encontré estas notas relacionadas:\n\n${candidatas.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nEscribí el número de la que corresponde, o "no" para cancelar.`;

    return { texto: mensaje, confirmarEdicion: { instruccion: texto, candidatas } };
  },
  async confirmar(rutaNota, instruccion) {
    await nucleo.aplicarEdicion(rutaNota, instruccion, 'eliminar');
    return `✅ Eliminado de "${rutaNota}"`;
  }
};