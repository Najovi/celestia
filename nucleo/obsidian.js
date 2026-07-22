const { Agent } = require('undici');
const { OBSIDIAN_URL, OBSIDIAN_API_KEY } = require('../config');

// El plugin "Local REST API" de Obsidian usa un certificado autofirmado.
// En vez de desactivar la validación de TLS para todo el proceso, la
// desactivamos solo para este agente, usado únicamente en estas llamadas.
const agenteLocal = new Agent({ connect: { rejectUnauthorized: false } });

function headers(contentType = 'text/markdown', extra = {}) {
  return { 'Authorization': `Bearer ${OBSIDIAN_API_KEY}`, 'Content-Type': contentType, ...extra };
}

function pedir(ruta, opciones = {}) {
  return fetch(`${OBSIDIAN_URL}/vault/${ruta}`, { ...opciones, dispatcher: agenteLocal });
}

async function leerNota(ruta) {
  const res = await pedir(encodeURIComponent(ruta), { method: 'GET', headers: headers() });
  if (!res.ok) throw new Error(`La nota "${ruta}" no existe o no se pudo leer (${res.status})`);
  return res.text();
}

async function crearNota(ruta, contenido) {
  const res = await pedir(encodeURIComponent(ruta), { method: 'PUT', headers: headers(), body: contenido });
  if (!res.ok) throw new Error(`Error (${res.status}) al crear "${ruta}"`);
}

async function sobrescribirNota(ruta, contenido) {
  const res = await pedir(encodeURIComponent(ruta), { method: 'PUT', headers: headers(), body: contenido });
  if (!res.ok) throw new Error(`Error (${res.status}) al guardar "${ruta}"`);
}

async function agregarANota(ruta, contenido) {
  const res = await pedir(encodeURIComponent(ruta), { method: 'POST', headers: headers(), body: `\n${contenido}` });
  if (!res.ok) throw new Error(`Error (${res.status}) al agregar a "${ruta}"`);
}

async function borrarNota(ruta) {
  const res = await pedir(encodeURIComponent(ruta), { method: 'DELETE', headers: headers() });
  if (!res.ok) throw new Error(`Error (${res.status}) al borrar "${ruta}"`);
}

async function listarNotas(carpeta = '') {
  const res = await pedir(carpeta, { method: 'GET', headers: headers() });
  if (!res.ok) throw new Error(`No se pudo listar "${carpeta}" (${res.status})`);
  const data = await res.json();

  let notas = [];
  for (const item of data.files) {
    if (item.endsWith('/')) {
      notas = notas.concat(await listarNotas(`${carpeta}${item}`));
    } else if (item.endsWith('.md')) {
      notas.push(`${carpeta}${item}`);
    }
  }
  return notas;
}

async function listarCarpetas(carpeta = '') {
  const res = await pedir(carpeta, { method: 'GET', headers: headers() });
  if (!res.ok) throw new Error(`No se pudo listar "${carpeta}" (${res.status})`);
  const data = await res.json();

  let carpetas = [];
  for (const item of data.files) {
    if (item.endsWith('/')) {
      const rutaCompleta = `${carpeta}${item}`;
      carpetas.push(rutaCompleta);
      carpetas = carpetas.concat(await listarCarpetas(rutaCompleta));
    }
  }
  return carpetas;
}

async function listarDirectorio(carpeta = '') {
  const res = await pedir(carpeta, { method: 'GET', headers: headers() });
  if (!res.ok) throw new Error(`No se pudo listar "${carpeta}" (${res.status})`);
  const data = await res.json();

  const carpetas = data.files.filter(f => f.endsWith('/')).map(f => `${carpeta}${f}`);
  const notas = data.files.filter(f => f.endsWith('.md')).map(f => `${carpeta}${f}`);
  return { carpetas, notas };
}

module.exports = { leerNota, crearNota, sobrescribirNota, agregarANota, borrarNota, listarNotas, listarCarpetas, listarDirectorio };
