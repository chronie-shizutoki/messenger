# Messenger

Una aplicación de chat en tiempo real con soporte WebSocket, que presenta una interfaz de usuario moderna y capacidades de internacionalización.

## Características

- Mensajería en tiempo real usando Socket.io
- Funcionalidad de carga de archivos e imágenes
- Soporte de notificaciones push
- Interfaz multilingüe
- Diseño responsive con efectos de animación de sakura
- Integración de base de datos SQLite

## Instalación

### Requisitos previos
- Node.js (v14 o superior)
- npm (v6 o superior)

### Pasos
1. Clonar el repositorio
   ```bash
   git clone https://github.com/quiettimejsg/messenger.git
   cd messenger
   ```

2. Instalar dependencias
   ```bash
   npm install
   ```

3. Crear un archivo `.env` (opcional) para configuración:
   ```
   PORT=3000
   ```

## Uso

### Iniciando el servidor

```bash
# Usando npm
npm start

# Usando archivo por lotes de Windows
start.bat
```

### Accediendo a la aplicación
Abre tu navegador y navega a `http://localhost:3000`

## Configuración
- **Notificaciones push**: Agrega URLs de notificación push en la configuración de la aplicación
- **Idioma**: La aplicación detecta automáticamente tu preferencia de idioma, con opción manual disponible en la configuración

## Licencia
Licencia AGPL-3.0

## Tecnologías utilizadas
- [Express](https://expressjs.com/) - Framework web
- [Socket.io](https://socket.io/) - Comunicación en tiempo real
- [SQLite3](https://www.sqlite.org/) - Base de datos
- [Sharp](https://sharp.pixelplumbing.com/) - Procesamiento de imágenes