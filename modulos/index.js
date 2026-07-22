const fs = require('fs');
const path = require('path');

function cargarModulos() {
  const archivos = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.js') && f !== 'index.js');

  const modulos = archivos.map(archivo => require(path.join(__dirname, archivo)));
  modulos.sort((a, b) => Number(a.claves[0]) - Number(b.claves[0]));
  return modulos;
}

function generarMenu(modulos) {
  const logo = `   ✦   ˚ 　 　     ✧\n　   　⋆｡°✩\n  🌘 C E L E S T I A\n　 　   ⋆｡°✩\n   ✧　　      ˚    ✦\n\n`;
  const lineas = modulos.map(m => `${m.emoji} ${m.nombre}`);
  return `${logo}elegí una opción:\n\n${lineas.join('\n')}`;
}

function interpretarOpcion(modulos, texto) {
  const t = texto.trim().toLowerCase();
  return modulos.find(m => m.claves.some(clave => t === clave || t.includes(clave))) || null;
}

module.exports = { cargarModulos, generarMenu, interpretarOpcion };