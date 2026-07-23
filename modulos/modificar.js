const nucleo = require('../nucleo');

module.exports = {
  nombre: 'Modificar',
  emoji: '3️⃣',
  claves: ['3', 'modificar'],
  pregunta: '✏️ Decime qué querés modificar (ej: "cambiá mi peso a 70kg").',
  procesando: '✏️ Modificando...',
  async ejecutar(texto) {
    const candidatas = await nucleo.elegirNotasRelevantes(texto);
    if (candidatas.length === 0) {
      return '🤔 No encontré ninguna nota relacionada con eso. Probá ser más específico, o mirá con "Explorar carpetas" (opción 5).';
    }

    const mensaje = candidatas.length === 1
      ? `✏️ Voy a modificar "${candidatas[0]}" según tu pedido. ¿Confirmás? Escribí "sí", o "no" para cancelar.`
      : `✏️ Encontré estas notas relacionadas:\n\n${candidatas.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nEscribí el número de la que querés modificar, o "no" para cancelar.`;

    return { texto: mensaje, confirmarEdicion: { instruccion: texto, candidatas } };
  },
  async confirmar(rutaNota, instruccion) {
    const resultado = await nucleo.aplicarEdicion(rutaNota, instruccion, 'modificar');
    if (resultado && resultado.sinCambios) {
      return `🤔 No encontré en "${rutaNota}" algo que coincida claramente con eso. No se modificó nada.`;
    }
    return `✅ Modificado en "${rutaNota}"`;
  }
};