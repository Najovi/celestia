const fs = require('fs');
const path = require('path');
const obsidian = require('./obsidian');
const ollama = require('./ollama');
const whisper = require('./whisper');

let pistas = [];
try {
  pistas = require('./pistas.json');
} catch (e) {
  console.warn('[CelestIA] No encontré nucleo/pistas.json — copiá nucleo/pistas.example.json para activar los atajos por palabra clave. Sigo sin ellos por ahora.');
}

// Caché en memoria: evita releer y re-resumir todo el vault en cada consulta.
// Se invalida puntualmente cuando una nota se crea o se edita.
const cacheResumenes = new Map(); // ruta -> resumen
let cacheNotas = null;
let cacheNotasEn = 0;
const CACHE_NOTAS_TTL_MS = 30_000;

async function listarNotasCacheadas() {
  const ahora = Date.now();
  if (cacheNotas && (ahora - cacheNotasEn) < CACHE_NOTAS_TTL_MS) return cacheNotas;
  cacheNotas = await obsidian.listarNotas();
  cacheNotasEn = ahora;
  return cacheNotas;
}

function invalidarCacheNotas() { cacheNotas = null; }
function invalidarResumen(ruta) { cacheResumenes.delete(ruta); }

function guardarBackup(ruta, contenidoOriginal) {
  const carpetaBackup = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(carpetaBackup)) fs.mkdirSync(carpetaBackup, { recursive: true });
  const nombreSeguro = ruta.replace(/[\/\\]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(carpetaBackup, `${nombreSeguro}.${timestamp}.md`), contenidoOriginal);
}

async function fusionarNota(rutaArchivo, ideaCruda) {
  const contenidoOriginal = await obsidian.leerNota(rutaArchivo);

  const prompt = `Sos un asistente que integra contenido nuevo dentro de una nota de Obsidian ya existente.

NOTA ACTUAL (completa, tal cual está guardada):
<<<INICIO>>>
${contenidoOriginal}
<<<FIN>>>

MENSAJE DEL USUARIO con la idea nueva a integrar (puede venir dictado por voz, con muletillas, desorden o frases como "quiero agregar" o "guardá esto" que NO son parte del contenido, solo describen la intención):
"${ideaCruda}"

Tu tarea:
1. Extraé la idea real del mensaje del usuario, descartando muletillas y frases dirigidas al asistente.
2. Integrá esa idea en el lugar más adecuado de la nota.
3. Redactala breve y clara, en primera persona, en el mismo estilo del resto de la sección.
4. Devolvé la NOTA COMPLETA con la idea ya integrada.

REGLAS INQUEBRANTABLES:
- NO borres, resumas ni alteres el contenido original.
- Solo AGREGÁ el contenido nuevo en el lugar correcto.
- No agregues comentarios tuyos.

Devolvé ÚNICAMENTE:
<<<INICIO>>>
(nota completa acá)
<<<FIN>>>`;

  const respuesta = await ollama.preguntar(prompt, 0.2);
  const contenidoNuevo = ollama.extraerEntreMarcadores(respuesta);
  if (!contenidoNuevo) throw new Error(`No se pudo interpretar la respuesta del modelo:\n${respuesta}`);

  if (contenidoNuevo.length < contenidoOriginal.trim().length * 0.9) {
    throw new Error(`El contenido devuelto es sospechosamente más corto. No se guardó por seguridad.`);
  }

  guardarBackup(rutaArchivo, contenidoOriginal);
  await obsidian.sobrescribirNota(rutaArchivo, contenidoNuevo);
  invalidarResumen(rutaArchivo);
}

async function obtenerResumenEstructura(ruta) {
  if (cacheResumenes.has(ruta)) return cacheResumenes.get(ruta);
  try {
    const contenido = await obsidian.leerNota(ruta);
    const encabezados = ollama.extraerEncabezados(contenido);
    const resumen = encabezados.length ? encabezados.join(' | ') : contenido.replace(/\n+/g, ' ').slice(0, 100);
    cacheResumenes.set(ruta, resumen);
    return resumen;
  } catch (e) {
    return '(no se pudo leer)';
  }
}

function buscarPorPistas(texto) {
  const t = texto.toLowerCase();
  const notasEncontradas = new Set();
  for (const pista of pistas) {
    if (pista.claves.some(clave => t.includes(clave))) {
      notasEncontradas.add(pista.nota);
    }
  }
  return Array.from(notasEncontradas);
}

const PALABRAS_VACIAS = new Set([
  'que', 'para', 'como', 'pero', 'esta', 'estan', 'están', 'donde', 'dónde', 'cuando', 'cuándo',
  'desde', 'hasta', 'sobre', 'tengo', 'tiene', 'tenés', 'vos', 'yo', 'me', 'mi', 'tu', 'su', 'sus',
  'les', 'nos', 'una', 'uno', 'unos', 'unas', 'del', 'las', 'los', 'por', 'con', 'sin', 'muy', 'mas',
  'más', 'ese', 'esa', 'eso', 'esos', 'esas', 'este', 'esto', 'estos', 'estas', 'cual', 'cuál',
  'cuales', 'cuáles', 'quien', 'quién', 'quienes', 'quiénes', 'porque', 'porqué', 'soy', 'eres',
  'son', 'fue', 'ser', 'estar', 'hay', 'sea', 'sean', 'algo', 'alguna', 'algún', 'todo', 'toda',
]);

// Palabras "significativas" del mensaje: sirven como pistas rápidas para la próxima vez.
function extraerPalabrasClave(texto) {
  return [...new Set(
    texto.toLowerCase()
      .replace(/[^\p{L}\s]/gu, '')
      .split(/\s+/)
      .filter(p => p.length > 3 && !PALABRAS_VACIAS.has(p))
  )].slice(0, 4);
}

function guardarPistas() {
  fs.writeFileSync(path.join(__dirname, 'pistas.json'), JSON.stringify(pistas, null, 2));
}

// Autoaprendizaje: cuando el usuario confirma que una consulta encontró lo que buscaba,
// guardamos sus palabras clave apuntando a esas notas para resolverla más rápido la próxima vez.
function aprenderDeConsulta(pregunta, notas) {
  const claves = extraerPalabrasClave(pregunta);
  if (claves.length === 0 || !notas || notas.length === 0) return;

  for (const nota of notas) {
    const existente = pistas.find(p => p.nota === nota);
    if (existente) {
      const nuevas = claves.filter(c => !existente.claves.includes(c));
      existente.claves.push(...nuevas);
    } else {
      pistas.push({ claves, nota });
    }
  }
  guardarPistas();
}

async function elegirNotasRelevantes(pregunta) {
  const notasPorPistas = buscarPorPistas(pregunta);

  const notas = await listarNotasCacheadas();
  const resumenes = [];
  for (const nota of notas) resumenes.push(`- "${nota}": ${await obtenerResumenEstructura(nota)}`);

  const prompt = `Tenés estas notas de un vault de Obsidian, cada una con sus encabezados/temas principales:

${resumenes.join('\n')}

Pregunta del usuario: "${pregunta}"

Elegí cuáles notas (1 a 3 como máximo) son las más relevantes, basándote en los temas reales que ves arriba. Respondé ÚNICAMENTE con las rutas exactas entre comillas, separadas por coma. Solo si ninguna tiene relación real, respondé "NINGUNA".`;

  const respuesta = await ollama.preguntar(prompt, 0.1);
  const notasPorModelo = respuesta.toUpperCase().includes('NINGUNA')
    ? []
    : notas.filter(n => respuesta.includes(n));

  // Combinamos pistas + modelo, sin duplicados, priorizando las pistas primero
  const combinado = [...new Set([...notasPorPistas, ...notasPorModelo])];
  return combinado.slice(0, 3);
}

async function decidirNotaDestino(textoNuevo) {
  const notas = await listarNotasCacheadas();
  const listaTexto = notas.map((n, i) => `${i + 1}. ${n}`).join('\n');

  const prompt = `Sos un asistente que organiza un "segundo cerebro" en Obsidian.

Notas existentes:
${listaTexto}

Información nueva:
"${textoNuevo}"

Elegí la nota EXISTENTE más adecuada por tema, copiando la ruta EXACTA. Si ninguna es apropiada, respondé "NUEVA:nombre-corto.md".
Respondé ÚNICAMENTE con la ruta o "NUEVA:...".`;

  const respuesta = await ollama.preguntar(prompt, 0.1);
  if (respuesta.startsWith('NUEVA:')) {
    return { ruta: respuesta.replace('NUEVA:', '').trim(), esNueva: true };
  }
  return { ruta: respuesta, esNueva: false };
}

// Intenta ubicar la info en una nota existente. Si no hay ninguna adecuada
// (o la que eligió el modelo resultó no existir), devolvemos necesitaNombre
// para que quien llama le pida al usuario cómo llamar a la carpeta nueva.
async function anotarInteligente(textoNuevo) {
  const decision = await decidirNotaDestino(textoNuevo);
  if (decision.esNueva) {
    return { necesitaNombre: true };
  }

  try {
    await fusionarNota(decision.ruta, textoNuevo);
    return { ruta: decision.ruta, necesitaNombre: false };
  } catch (e) {
    if (String(e.message).includes('(404)')) return { necesitaNombre: true };
    throw e;
  }
}

// Reescribe un mensaje crudo (a veces dictado por voz, con muletillas o
// instrucciones al asistente tipo "guardá esto") como una nota personal
// prolija, en primera persona, sin perder ni inventar información.
async function reescribirComoNota(textoCrudo) {
  const prompt = `Sos un asistente que ayuda a una persona a llevar sus notas personales en Obsidian.

Mensaje original, tal como lo dijo o escribió (puede tener muletillas, desorden propio de hablar, o frases dirigidas al asistente como "guardá esto" o "anotá que"):
"${textoCrudo}"

Reescribilo como una nota personal: en primera persona, clara y ordenada, tal como la persona la escribiría para sí misma. Si el contenido tiene pasos, ingredientes o ítems, usá una lista. No agregues información que no esté en el mensaje original, ni inventes datos, ni agregues comentarios tuyos.

Devolvé ÚNICAMENTE el contenido reescrito.`;

  return await ollama.preguntar(prompt, 0.3);
}

// Genera un título corto y apto para nombre de archivo a partir del contenido.
async function generarTitulo(textoCrudo) {
  const prompt = `Basándote en este contenido, generá un título corto (entre 3 y 6 palabras) que describa el tema, apto para usar como nombre de archivo.

Contenido: "${textoCrudo}"

Respondé ÚNICAMENTE con el título, sin comillas ni puntuación final.`;

  const respuesta = await ollama.preguntar(prompt, 0.2);
  const limpio = respuesta.replace(/["/\\:*?<>|]/g, '').trim();
  return limpio.slice(0, 60);
}

async function crearCarpetaConNota(nombreCarpeta, contenidoCrudo) {
  const contenido = await reescribirComoNota(contenidoCrudo);
  const titulo = (await generarTitulo(contenidoCrudo)) || nombreCarpeta;
  const nombreArchivo = `${nombreCarpeta}/${titulo}.md`;
  await obsidian.crearNota(nombreArchivo, `# ${titulo}\n\n${contenido}\n`);
  invalidarCacheNotas();
  return nombreArchivo;
}

async function responderConsulta(pregunta) {
  const notasRelevantes = await elegirNotasRelevantes(pregunta);
  if (notasRelevantes.length === 0) {
    return { texto: 'No encontré información relevante en tu vault para responder eso.', notas: [] };
  }

  let contexto = '';
  for (const nota of notasRelevantes) {
    contexto += `\n--- ${nota} ---\n${await obsidian.leerNota(nota)}\n`;
  }

  const prompt = `Basándote ÚNICAMENTE en el siguiente contenido de las notas del usuario, respondé la pregunta de forma breve y directa.

${contexto}

Pregunta: "${pregunta}"

Si la información no está en las notas, decilo claramente. No inventes datos.`;

  const respuesta = await ollama.preguntar(prompt, 0.2);
  return { texto: `${respuesta}\n\n📄 Fuente: ${notasRelevantes.join(', ')}`, notas: notasRelevantes };
}

async function editarConIA(instruccion, tipoOperacion) {
  const notasRelevantes = await elegirNotasRelevantes(instruccion);
  if (notasRelevantes.length === 0) throw new Error('No encontré ninguna nota relacionada con eso.');

  const rutaNota = notasRelevantes[0];
  const contenidoOriginal = await obsidian.leerNota(rutaNota);

  const instruccionEspecifica = tipoOperacion === 'eliminar'
    ? `Eliminá de la nota la información que coincide con: "${instruccion}". Sacá esa parte y dejá el resto igual. Renumerá listas si corresponde.`
    : `Modificá en la nota la información que coincide, según: "${instruccion}". Cambiá SOLO esa parte, dejando el resto igual.`;

  const prompt = `Sos un asistente que edita una nota de Obsidian existente.

NOTA ACTUAL:
<<<INICIO>>>
${contenidoOriginal}
<<<FIN>>>

Instrucción: ${instruccionEspecifica}

Devolvé ÚNICAMENTE:
<<<INICIO>>>
(nota completa editada)
<<<FIN>>>`;

  const respuesta = await ollama.preguntar(prompt, 0.1);
  const contenidoNuevo = ollama.extraerEntreMarcadores(respuesta);
  if (!contenidoNuevo) throw new Error('No se pudo interpretar la respuesta del modelo');

  guardarBackup(rutaNota, contenidoOriginal);
  await obsidian.sobrescribirNota(rutaNota, contenidoNuevo);
  invalidarResumen(rutaNota);
  return rutaNota;
}

module.exports = {
  ...obsidian,
  transcribirAudio: whisper.transcribir,
  fusionarNota, anotarInteligente, crearCarpetaConNota, responderConsulta, editarConIA,
  elegirNotasRelevantes, decidirNotaDestino, aprenderDeConsulta
};