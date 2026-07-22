const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const os = require('os');
const path = require('path');
const nucleo = require('./nucleo');
const { cargarModulos, generarMenu, interpretarOpcion } = require('./modulos');
const { ALLOWED_NUMBERS, PALABRA_CLAVE } = require('./config');

const RECONEXION_DELAY_MS = 3000;
const estados = new Map();

const modulos = cargarModulos();
const MENU = generarMenu(modulos);

console.log(`📦 Módulos cargados: ${modulos.map(m => m.nombre).join(', ')}`);
console.log(`🔒 Números permitidos: ${ALLOWED_NUMBERS.join(', ')}`);

// Baileys agrega un sufijo de dispositivo (":12") a algunos JID; lo sacamos
// para poder comparar contra la lista de números permitidos.
function normalizarJid(jid) {
  return jid.replace(/:\d+(?=@)/, '');
}

// WhatsApp puede identificar al remitente con un LID (@lid) en vez de su
// número real; Baileys expone el número real en key.remoteJidAlt cuando eso pasa.
function estaPermitido(remitente, remitenteAlt) {
  if (ALLOWED_NUMBERS.includes(normalizarJid(remitente))) return true;
  if (remitenteAlt && ALLOWED_NUMBERS.includes(normalizarJid(remitenteAlt))) return true;
  return false;
}

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['CelestIA', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) { console.log('📱 Escaneá este código QR:'); qrcode.generate(qr, { small: true }); }
    if (connection === 'close') {
      const motivo = lastDisconnect?.error?.output?.statusCode;
      const debeReconectar = motivo !== DisconnectReason.loggedOut;
      console.log('❌ Conexión cerrada. ¿Reconectar?', debeReconectar);
      if (debeReconectar) setTimeout(iniciar, RECONEXION_DELAY_MS);
    } else if (connection === 'open') {
      console.log('✅ Conectado a WhatsApp correctamente!');
    }
  });

  async function manejarMensaje(mensaje) {
    if (!mensaje.message) return;
    if (mensaje.key.fromMe) return;

    const remitente = mensaje.key.remoteJid;
    if (!estaPermitido(remitente, mensaje.key.remoteJidAlt)) return; // ignoramos en silencio a cualquiera que no sea el dueño

    const contenido = mensaje.message;
    const textoPlano = contenido.conversation || contenido.extendedTextMessage?.text;
    const esAudio = !!contenido.audioMessage;

    try {
      let texto = textoPlano;

      if (esAudio) {
        await sock.sendMessage(remitente, { text: '🎙️ Transcribiendo...' });
        const buffer = await downloadMediaMessage(mensaje, 'buffer', {});
        const rutaTemp = path.join(os.tmpdir(), `celestia_audio_${Date.now()}.ogg`);
        fs.writeFileSync(rutaTemp, buffer);
        try {
          texto = await nucleo.transcribirAudio(rutaTemp);
        } finally {
          try { fs.unlinkSync(rutaTemp); } catch (_) {}
        }
        console.log(`📝 Transcripción: "${texto}"`);
      }

      if (!texto) return;

      const textoLower = texto.trim().toLowerCase();
      const sesion = estados.get(remitente);

      // Sin sesión activa: solo reaccionamos a la palabra clave
      if (!sesion) {
        if (textoLower === PALABRA_CLAVE) {
          estados.set(remitente, { paso: 'esperando_opcion' });
          await sock.sendMessage(remitente, { text: MENU });
        }
        // Si no dijo la palabra clave, lo ignoramos silenciosamente (no hay sesión, no molestamos)
        return;
      }

      // Con sesión activa: comandos globales primero
      if (textoLower === 'exit') {
        estados.delete(remitente);
        await sock.sendMessage(remitente, { text: `👋 Sesión cerrada. Escribí "${PALABRA_CLAVE}" cuando quieras volver.` });
        return;
      }

      if (textoLower === 'menu') {
        estados.set(remitente, { paso: 'esperando_opcion' });
        await sock.sendMessage(remitente, { text: MENU });
        return;
      }

      // Paso: esperando confirmación de si la consulta encontró lo que el usuario buscaba
      if (sesion.paso === 'esperando_feedback') {
        const esPositivo = ['si', 'sí', 'sirvio', 'sirvió', 'gracias', 'bien', 'genial', 'perfecto'].includes(textoLower);
        if (esPositivo) {
          const { pregunta, notas } = sesion.feedbackContext;
          nucleo.aprenderDeConsulta(pregunta, notas);
          estados.set(remitente, { paso: 'esperando_opcion' });
          await sock.sendMessage(remitente, { text: '🧠 Guardado, la próxima lo va a encontrar más rápido.\n\n(Escribí "menu" para ver opciones o "exit" para salir)' });
          return;
        }
        // No fue una confirmación: no lo tratamos como error, seguimos el mensaje como si estuviera en el menú
        sesion.paso = 'esperando_opcion';
      }

      // Paso: esperando que elija opción del menú
      if (sesion.paso === 'esperando_opcion') {
        const modulo = interpretarOpcion(modulos, texto);
        if (!modulo) {
          await sock.sendMessage(remitente, { text: '❓ No entendí la opción.\n\n' + MENU });
          return;
        }

        if (modulo.interactivo) {
          const resultado = await modulo.iniciar();
          estados.set(remitente, { paso: 'modulo_interactivo', modulo, estadoModulo: resultado.estado });
          await sock.sendMessage(remitente, { text: resultado.texto });
          return;
        }

        if (modulo.sinEntrada) {
          estados.set(remitente, { paso: 'esperando_opcion' }); // volvemos a esperar opción, no cerramos sesión
          const respuesta = await modulo.ejecutar();
          await sock.sendMessage(remitente, { text: respuesta + '\n\n(Escribí "menu" para ver opciones o "exit" para salir)' });
          return;
        }

        estados.set(remitente, { paso: 'esperando_contenido', modulo });
        await sock.sendMessage(remitente, { text: modulo.pregunta });
        return;
      }

      // Paso: dentro de un módulo interactivo (explorador)
      if (sesion.paso === 'modulo_interactivo') {
        const { modulo, estadoModulo } = sesion;
        const resultado = await modulo.manejarMensaje(texto, estadoModulo);
        estados.set(remitente, { paso: 'modulo_interactivo', modulo, estadoModulo: resultado.estado });
        await sock.sendMessage(remitente, { text: resultado.texto });
        return;
      }

      // Paso: esperando el contenido real para un módulo simple
      if (sesion.paso === 'esperando_contenido') {
        const { modulo } = sesion;

        await sock.sendMessage(remitente, { text: modulo.procesando });
        const resultado = await modulo.ejecutar(texto);
        const esAprendible = resultado && typeof resultado === 'object';
        const textoRespuesta = esAprendible ? resultado.texto : resultado;

        if (esAprendible && resultado.aprendizaje) {
          estados.set(remitente, { paso: 'esperando_feedback', feedbackContext: resultado.aprendizaje });
          await sock.sendMessage(remitente, { text: `${textoRespuesta}\n\n¿Te sirvió? Escribí "sí" para que lo recuerde la próxima vez.` });
        } else if (esAprendible && resultado.pendiente) {
          estados.set(remitente, { paso: 'esperando_nombre_carpeta', modulo, pendiente: resultado.pendiente });
          await sock.sendMessage(remitente, { text: textoRespuesta });
        } else {
          estados.set(remitente, { paso: 'esperando_opcion' }); // sesión sigue abierta
          await sock.sendMessage(remitente, { text: textoRespuesta + '\n\n(Escribí "menu" para ver opciones o "exit" para salir)' });
        }
        return;
      }

      // Paso: esperando el nombre de carpeta para guardar contenido que no encajaba en ninguna nota existente
      if (sesion.paso === 'esperando_nombre_carpeta') {
        const { modulo, pendiente } = sesion;
        await sock.sendMessage(remitente, { text: '📁 Creando carpeta y guardando...' });
        const respuesta = await modulo.continuar(texto, pendiente);
        estados.set(remitente, { paso: 'esperando_opcion' });
        await sock.sendMessage(remitente, { text: respuesta + '\n\n(Escribí "menu" para ver opciones o "exit" para salir)' });
        return;
      }

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error.message);
      estados.set(remitente, { paso: 'esperando_opcion' }); // no cerramos la sesión entera por un error
      await sock.sendMessage(remitente, { text: `❌ Hubo un error: ${error.message}\n\nEscribí "menu" para ver opciones o "exit" para salir.` });
    }
  }

  sock.ev.on('messages.upsert', (m) => {
    for (const mensaje of m.messages) manejarMensaje(mensaje);
  });
}

iniciar();
