const cerebro = require('../nucleo');

const MAX_CONTENIDO_NOTA = 4000;

function nombreCorto(ruta) {
  const partes = ruta.replace(/\/$/, '').split('/');
  return partes[partes.length - 1].replace('.md', '');
}

function armarTextoNivel(carpetas, notas, rutaActual) {
  const items = [...carpetas, ...notas];
  const ubicacion = rutaActual ? `📂 ${rutaActual}` : '📂 Raíz de tu vault';

  if (items.length === 0) {
    return `${ubicacion}\n\nEsta carpeta está vacía.\n\n(".." para volver, "menu" para salir)`;
  }

  const lineas = items.map((item, i) => {
    const esCarpeta = item.endsWith('/');
    return `${i + 1}. ${esCarpeta ? '📁' : '📄'} ${nombreCorto(item)}`;
  });

  return `${ubicacion}\n\n${lineas.join('\n')}\n\nEscribí el número para entrar/ver.\n(".." para volver, "menu" para salir)`;
}

async function mostrarListado(rutaActual) {
  const { carpetas, notas } = await cerebro.listarDirectorio(rutaActual);
  return {
    texto: armarTextoNivel(carpetas, notas, rutaActual),
    estado: { modo: 'lista', rutaActual, items: [...carpetas, ...notas] }
  };
}

// Muestra un tramo del contenido de una nota desde "desde". Si sobra contenido,
// guarda en el estado dónde quedó para poder seguir con el comando "más".
function armarRespuestaNota(ruta, contenidoCompleto, desde, estadoBase) {
  const restante = contenidoCompleto.slice(desde);
  const haySiguiente = restante.length > MAX_CONTENIDO_NOTA;
  const trozo = haySiguiente ? restante.slice(0, MAX_CONTENIDO_NOTA) : restante;
  const encabezado = desde === 0 ? `📄 *${nombreCorto(ruta)}*\n\n` : '';
  const pie = haySiguiente
    ? '\n\n[...escribí "más" para seguir leyendo...]\n\n(".." para volver, "menu" para salir)'
    : '\n\n(".." para volver, "menu" para salir)';

  return {
    texto: `${encabezado}${trozo}${pie}`,
    estado: {
      modo: 'nota',
      rutaActual: estadoBase.rutaActual,
      items: estadoBase.items,
      lectura: haySiguiente ? { ruta, contenidoCompleto, posicion: desde + trozo.length } : null
    }
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

    if ((t === 'más' || t === 'mas' || t === 'seguir') && estado.modo === 'nota' && estado.lectura) {
      const { ruta, contenidoCompleto, posicion } = estado.lectura;
      return armarRespuestaNota(ruta, contenidoCompleto, posicion, estado);
    }

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
    let elegido = (!isNaN(num) && estado.items[num - 1]) ? estado.items[num - 1] : null;

    if (!elegido) {
      const coincidencias = estado.items.filter(i => nombreCorto(i).toLowerCase().includes(t));
      if (coincidencias.length === 1) {
        elegido = coincidencias[0];
      } else if (coincidencias.length > 1) {
        const lista = coincidencias.map(i => `- ${nombreCorto(i)}`).join('\n');
        return { texto: `🔎 Hay más de una coincidencia con "${texto}":\n\n${lista}\n\nEscribí el número de la lista para elegir una.`, estado };
      }
    }

    if (!elegido) {
      return { texto: '❓ No encontré esa opción. Elegí un número de la lista, o "menu" para salir.', estado };
    }

    if (elegido.endsWith('/')) {
      return mostrarListado(elegido);
    }

    try {
      const contenido = await cerebro.leerNota(elegido);
      return armarRespuestaNota(elegido, contenido, 0, estado);
    } catch (e) {
      // No cortamos la sesión de exploración por un error de lectura puntual (nota movida/borrada, hipo de la API).
      return { texto: `❌ No pude abrir "${nombreCorto(elegido)}" (puede que se haya movido o borrado). Seguís en la lista.`, estado };
    }
  }
};