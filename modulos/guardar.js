const nucleo = require('../nucleo');

module.exports = {
  nombre: 'Guardar / Anotar',
  emoji: '1️⃣',
  claves: ['1', 'guardar', 'anotar'],
  pregunta: '📝 Decime qué querés guardar.',
  procesando: '🤖 Decidiendo dónde guardarlo...',
  async ejecutar(texto) {
    const resultado = await nucleo.anotarInteligente(texto);
    if (resultado.necesitaNombre) {
      return {
        texto: '🤔 No encontré una nota adecuada para esto. ¿Querés que cree una carpeta nueva? Decime el nombre.',
        pendiente: { contenido: texto }
      };
    }
    return `✅ Guardado en "${resultado.ruta}"`;
  },
  async continuar(nombreCarpeta, pendiente) {
    const nombre = nombreCarpeta.trim();
    const ruta = await nucleo.crearCarpetaConNota(nombre, pendiente.contenido);
    return `✅ Carpeta "${nombre}" creada, guardado en "${ruta}"`;
  }
};