const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { WHISPER_PATH, WHISPER_MODEL } = require('../config');

const execFileAsync = promisify(execFile);

async function convertirAWav(rutaEntrada) {
  const rutaWav = path.join(os.tmpdir(), `whisper-input-${Date.now()}.wav`);
  await execFileAsync('ffmpeg', ['-y', '-i', rutaEntrada, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', rutaWav]);
  return rutaWav;
}

// No bloquea el event loop: mientras se transcribe un audio, el bot puede
// seguir atendiendo otros mensajes.
async function transcribir(rutaAudioOriginal) {
  const rutaWav = await convertirAWav(rutaAudioOriginal);
  const prefijoSalida = path.join(os.tmpdir(), `whisper-output-${Date.now()}`);

  try {
    await execFileAsync(
      './build/bin/whisper-cli',
      ['-f', rutaWav, '-m', WHISPER_MODEL, '-l', 'es', '-nt', '-otxt', '-of', prefijoSalida],
      { cwd: WHISPER_PATH }
    );
    const rutaTexto = `${prefijoSalida}.txt`;
    const texto = fs.readFileSync(rutaTexto, 'utf-8').trim();
    fs.unlinkSync(rutaTexto);
    return texto;
  } finally {
    try { fs.unlinkSync(rutaWav); } catch (_) {}
  }
}

module.exports = { transcribir };
