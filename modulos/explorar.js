const cerebro = require('../nucleo');

function nombreCorto(ruta) {
  const partes = ruta.replace(/\/$/, '').split('/');
  return partes[partes.length - 1].replace('.md', '');
}

function armarTextoNivel(carpetas, notas, rutaActual) {
  const items = [...carpetas, ...notas];
  const lineas = items.map((item, i) => {
    const esCarpeta = item.endsWith('/');
    return `${i + 1}. ${esCarpeta ? '📁' : '📄'} ${nombreCorto(item)}`;
  });

  const ubicacion = rutaActual ? `📂 ${rutaActual}` : '📂 Raíz de tu vault';
  return `${ubicacion}\n\n${lineas.join('\n')}\n\nEscribí el número para entrar/ver.\n(".." para volver, "menu" para salir)`;
}

async function mostrarListado(rutaActual) {
  const { carpetas, notas } = await cerebro.listarDirectorio(rutaActual);
  return {
    texto: armarTextoNivel(carpetas, notas, rutaActual),
    estado: { modo: 'lista', rutaActual, items: [...carpetas, ...notas] }
  };
}

module.exports = {
  nombre: 'Explorar carpetas',
  emoji: '5️⃣',
  claves: ['5', 'explorar', 'carpetas', 'mis carpetas'],
  interactivo: true,

  async iniciar() {
    return mostrarListado('');
  },

  async manejarMensaje(texto, estado) {
    const t = texto.trim().toLowerCase();

    if (t === '..') {
      // Si estábamos viendo una nota, ".." nos devuelve a la lista de la carpeta actual (sin subir de nivel)
      if (estado.modo === 'nota') {
        return mostrarListado(estado.rutaActual);
      }

      // Si estábamos viendo una lista, ".." sube un nivel real
      if (!estado.rutaActual) {
        return { texto: '📂 Ya estás en la raíz. Escribí "menu" para salir.', estado };
      }
      const partes = estado.rutaActual.replace(/\/$/, '').split('/');
      partes.pop();
      const rutaAnterior = partes.length ? partes.join('/') + '/' : '';
      return mostrarListado(rutaAnterior);
    }

    const num = parseInt(t, 10);
    const elegido = (!isNaN(num) && estado.items[num - 1])
      ? estado.items[num - 1]
      : estado.items.find(i => nombreCorto(i).toLowerCase().includes(t));

    if (!elegido) {
      return { texto: '❓ No encontré esa opción. Elegí un número de la lista, o "menu" para salir.', estado };
    }

    if (elegido.endsWith('/')) {
      return mostrarListado(elegido);
    } else {
      const contenido = await cerebro.leerNota(elegido);
      const textoResp = `📄 *${nombreCorto(elegido)}*\n\n${contenido}\n\n(".." para volver, "menu" para salir)`;
      // Guardamos modo 'nota', pero mantenemos rutaActual e items para poder volver a la lista con ".."
      return { texto: textoResp, estado: { modo: 'nota', rutaActual: estado.rutaActual, items: estado.items } };
    }
  }
};