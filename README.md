# CelestIA 🌘

Asistente personal por WhatsApp que organiza un "segundo cerebro" en [Obsidian](https://obsidian.md/), usando un LLM local ([Ollama](https://ollama.com/)) para decidir dónde guardar cada idea, responder preguntas sobre tus notas, y editarlas por vos. También transcribe audios con [whisper.cpp](https://github.com/ggml-org/whisper.cpp).

## ⚠️ Seguridad — leé esto antes de correrlo

El bot solo responde a los números de WhatsApp que vos definas en `ALLOWED_NUMBERS`. A cualquier otro remitente lo ignora en silencio. **Es obligatorio configurar tu propio número** — el bot no arranca sin esto. No hay ninguna otra barrera de acceso: quien controle uno de esos números tiene acceso total de lectura/escritura/edición sobre tu vault.

## Funcionalidad

- 1️⃣ **Guardar/Anotar**: decidís qué anotar en lenguaje natural, la IA elige (o crea) la nota más adecuada del vault y fusiona el contenido sin borrar lo existente.
- 2️⃣ **Consultar**: preguntás algo y el bot busca las notas relevantes (por palabras clave + criterio del modelo) y responde basándose solo en ese contenido.
- 3️⃣ **Modificar** / 4️⃣ **Eliminar**: editás partes puntuales de una nota existente en lenguaje natural.
- 5️⃣ **Explorar carpetas**: navegás tu vault carpeta por carpeta desde WhatsApp.
- 🎙️ Mensajes de audio: se transcriben automáticamente antes de procesarse como cualquier otro mensaje.
- 🧠 **Autoaprendizaje**: cuando confirmás que una Consulta encontró lo que buscabas, el bot guarda palabras clave de esa pregunta apuntando a esas notas (`nucleo/pistas.json`) para resolver consultas parecidas más rápido la próxima vez.
- 🛟 Antes de cualquier edición o fusión, se guarda un backup de la nota original en `backups/`, y si la IA devuelve un contenido sospechosamente más corto que el original, la escritura se cancela (no se pierde información por una mala respuesta del modelo).

## Requisitos

- Node.js 18+
- [Ollama](https://ollama.com/) corriendo en local, con un modelo ya descargado (`ollama pull qwen2.5-coder:7b` o el que prefieras)
- Obsidian con el plugin comunitario **Local REST API** instalado y habilitado (te da la API key y el puerto HTTPS local)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) compilado, con un modelo descargado, y `ffmpeg` instalado en el sistema
- Un número de WhatsApp propio para vincular como sesión del bot

## Instalación

```bash
npm install
cp .env.example .env
# Completá ALLOWED_NUMBERS (tu número), OBSIDIAN_API_KEY, OLLAMA_MODEL, WHISPER_PATH, etc.
cp nucleo/pistas.example.json nucleo/pistas.json
# Editá pistas.json con tus propios atajos (palabra clave -> nota de destino)
npm start
```

Al iniciar por primera vez vas a ver un código QR en la terminal: escaneálo desde WhatsApp (Dispositivos vinculados) para autenticar la sesión.

## Configuración (`.env`)

| Variable          | Descripción                                                                 |
|-------------------|------------------------------------------------------------------------------|
| `ALLOWED_NUMBERS` | **Obligatoria.** Número(s) de WhatsApp permitidos, separados por coma.       |
| `PALABRA_CLAVE`   | Palabra para activar el menú (default `celestia`).                          |
| `OBSIDIAN_API_KEY`| API key del plugin Local REST API de Obsidian. **Obligatoria.**             |
| `OBSIDIAN_URL`    | URL local del plugin (default `https://127.0.0.1:27124`).                   |
| `OLLAMA_URL`      | URL del servidor Ollama (default `http://localhost:11434`).                 |
| `OLLAMA_MODEL`    | Modelo de Ollama a usar. **Obligatoria.**                                    |
| `WHISPER_PATH`    | Carpeta donde está compilado whisper.cpp. **Obligatoria.**                   |
| `WHISPER_MODEL`   | Ruta relativa al modelo de whisper dentro de `WHISPER_PATH`. **Obligatoria.**|

## Comandos de WhatsApp

| Comando       | Descripción                                      |
|---------------|----------------------------------------------------|
| `celestia`    | Activa la sesión y muestra el menú                 |
| `menu`        | Vuelve a mostrar el menú sin cerrar la sesión       |
| `exit`        | Cierra la sesión (hay que decir la palabra clave de nuevo) |
| `1`–`5`       | Elige una opción del menú                          |

## Estructura del proyecto

```
whatsapp.js             Cliente de WhatsApp (Baileys) y enrutamiento de mensajes
config.js                Carga y valida las variables de entorno
modulos/                 Un archivo por cada opción del menú (autocargables)
nucleo/index.js          Lógica de negocio: decidir dónde guardar, fusionar, consultar, editar
nucleo/obsidian.js       Cliente de la API REST local de Obsidian
nucleo/ollama.js         Cliente de Ollama
nucleo/whisper.js        Transcripción de audio (no bloqueante)
nucleo/pistas.json       Atajos de palabra clave -> nota (no versionado, es personal)
backups/                 Copias de seguridad automáticas antes de cada edición (no versionado)
auth_info/               Sesión de WhatsApp (no versionado)
```

## Notas de seguridad

- `.env`, `auth_info/`, `backups/` y `nucleo/pistas.json` están en `.gitignore` — nunca deberían subirse al repositorio.
- El bypass de certificado TLS autofirmado está limitado únicamente a las llamadas contra Obsidian local (`nucleo/obsidian.js`), no afecta el resto del proceso.
