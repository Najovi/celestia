const cerebro = require('../nucleo');

module.exports = {
  nombre: 'Crear carpeta + nota',
  emoji: '7️⃣',
  claves: ['7', 'crear carpeta', 'nueva carpeta'],
  pregunta: '📁 Decime: "nombre de la carpeta: contenido a guardar". Ej: "Preparar Comida: receta de tortilla con papas y huevos"',
  procesando: '📁 Creando carpeta y guardando...',
  async ejecutar(texto) {
    const partes = texto.split(':');
    if (partes.length < 2) {
      throw new Error('Formato esperado: "Nombre de carpeta: contenido a guardar"');
    }
    const nombreCarpeta = partes[0].trim();
    const contenido = partes.slice(1).join(':').trim();

    const nombreArchivo = `${nombreCarpeta}/Nota principal.md`;
    await cerebro.crearNota(nombreArchivo, `# ${nombreCarpeta}\n\n${contenido}\n`);
    return `✅ Carpeta "${nombreCarpeta}" creada con tu nota adentro.`;
  }
};