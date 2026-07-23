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

    // Borrar el archivo entero es más fuerte que borrar un fragmento: pedimos una
    // confirmación aparte y más explícita antes de hacerlo.
    if (candidatas.length === 1 && await nucleo.esBorradoDeNotaCompleta(texto)) {
      return {
        texto: `🗑️ Esto suena a que querés borrar la nota COMPLETA "${candidatas[0]}", no solo una parte. Esta acción es más fuerte que un borrado parcial. Si estás seguro, escribí exactamente: borrar todo`,
        confirmarBorradoTotal: { ruta: candidatas[0] }
      };
    }

    const mensaje = candidatas.length === 1
      ? `🗑️ Voy a eliminar eso de "${candidatas[0]}". ¿Confirmás? Escribí "sí", o "no" para cancelar.`
      : `🗑️ Encontré estas notas relacionadas:\n\n${candidatas.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nEscribí el número de la que corresponde, o "no" para cancelar.`;

    return { texto: mensaje, confirmarEdicion: { instruccion: texto, candidatas } };
  },
  async confirmar(rutaNota, instruccion) {
    const resultado = await nucleo.aplicarEdicion(rutaNota, instruccion, 'eliminar');
    if (resultado && resultado.sinCambios) {
      return `🤔 No encontré en "${rutaNota}" algo que coincida claramente con eso. No se eliminó nada.`;
    }
    return `✅ Eliminado de "${rutaNota}"`;
  },
  async confirmarBorradoTotal(ruta) {
    await nucleo.borrarNotaCompleta(ruta);
    return `🗑️ Nota "${ruta}" eliminada por completo. Si fue un error, escribí "deshacer".`;
  }
};