const { OLLAMA_URL, OLLAMA_MODEL } = require('../config');

async function preguntar(prompt, temperatura = 0.2) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, options: { temperature: temperatura } })
  });
  if (!res.ok) throw new Error(`Ollama respondió con error (${res.status})`);
  const data = await res.json();
  return data.response.trim();
}

function extraerEntreMarcadores(texto) {
  const match = texto.match(/<<<INICIO>>>([\s\S]*?)<<<FIN>>>/);
  return match ? match[1].trim() : null;
}

function extraerEncabezados(contenido) {
  const regex = /^#{1,6}\s+(.+)$/gm;
  const encabezados = [];
  let match;
  while ((match = regex.exec(contenido)) !== null) encabezados.push(match[1].trim());
  return encabezados;
}

module.exports = { preguntar, extraerEntreMarcadores, extraerEncabezados };