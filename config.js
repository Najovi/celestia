require('dotenv').config();

function requerido(nombre) {
    const valor = process.env[nombre];
    if (!valor) {
        console.error(`[CelestIA] Falta la variable de entorno ${nombre} en tu archivo .env. Revisá .env.example.`);
        process.exit(1);
    }
    return valor;
}

// Acepta tanto "5491122334455" como el JID completo "5491122334455@s.whatsapp.net".
function normalizarNumero(numero) {
    const limpio = numero.trim().replace(/[^\d@.a-z]/gi, '');
    return limpio.includes('@') ? limpio : `${limpio}@s.whatsapp.net`;
}

const numerosPermitidosRaw = requerido('ALLOWED_NUMBERS');
const ALLOWED_NUMBERS = numerosPermitidosRaw
    .split(',')
    .map(n => n.trim())
    .filter(Boolean)
    .map(normalizarNumero);

if (ALLOWED_NUMBERS.length === 0) {
    console.error('[CelestIA] ALLOWED_NUMBERS está vacío. Definí al menos tu propio número para poder usar el bot.');
    process.exit(1);
}

module.exports = {
    ALLOWED_NUMBERS,
    PALABRA_CLAVE: (process.env.PALABRA_CLAVE || 'celestia').toLowerCase(),

    OBSIDIAN_API_KEY: requerido('OBSIDIAN_API_KEY'),
    OBSIDIAN_URL: requerido('OBSIDIAN_URL'),

    OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
    OLLAMA_MODEL: requerido('OLLAMA_MODEL'),

    WHISPER_PATH: requerido('WHISPER_PATH'),
    WHISPER_MODEL: requerido('WHISPER_MODEL'),
};
