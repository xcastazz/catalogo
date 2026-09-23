# MAEVO: catálogo público y administración privada

## 1. Configurar Google Sheets y Apps Script

1. Conserva o crea las hojas `Productos` y `Pedidos`.
2. `Productos` debe comenzar con: `id | nombre | categoria | precio | stock | descripcion`.
3. `Pedidos` debe comenzar con: `id | fecha | cliente | telefono | direccion | ciudad | notas | metodoPago | items | total | estado`.
4. En Extensiones -> Apps Script, reemplaza todo el contenido de `Code.gs` con el archivo `Code.gs` de este proyecto. Usa únicamente ese archivo; `Code2.gs` es una copia histórica y no se debe publicar.
5. Cambia `ADMIN_INICIAL_USUARIO` y, especialmente, `ADMIN_INICIAL_PASSWORD` por tus datos. La primera vez que se ejecute el backend se creará la hoja `Administradores` y esa cuenta tendrá rol `propietario`.
6. Guarda el proyecto y autoriza el acceso a Google Sheets y Google Drive cuando Apps Script lo solicite.

Las columnas `mediaUrl` y `mediaType` se agregan automáticamente a `Productos`. También se crean automáticamente `Pedidos` y `Administradores` si no existen.

## 2. Publicar el backend

En Apps Script: Implementar -> Nueva implementación -> Aplicación web. Selecciona ejecutar como tú y acceso para cualquier usuario. Copia la URL que termina en `/exec` y reemplázala en `API_URL`, tanto en `index.html` como en `admin.html`.

Cada cambio posterior en `Code.gs` requiere Implementar -> Gestionar implementaciones -> Editar -> Nueva versión.

## 3. Publicar las dos ventanas

Sube `index.html` y `admin.html` al mismo sitio de GitHub Pages. Comparte solamente la dirección de `index.html`. Abre `admin.html` desde una dirección privada que conserves tú; el catálogo público no muestra ningún enlace ni texto de administración.

El acceso real lo protege el backend: el usuario inicia sesión y recibe una sesión temporal. El propietario puede crear cuentas adicionales desde la pestaña Administradores. Las contraseñas no se guardan en texto plano, sino como hash SHA-256.

## 4. Medios y dashboard

Desde Productos -> Nuevo producto puedes cargar una imagen o video de hasta 8 MB. El archivo se guarda en el Google Drive de la cuenta que ejecuta Apps Script y se muestra en el catálogo mediante un enlace de solo lectura.

El dashboard incluye ventas totales, cantidad de pedidos, pendientes, ticket promedio, productos activos, stock, ventas de los últimos 30 días, estados, productos más vendidos, pedidos recientes y gestión de estados. Las ventas se calculan a partir de la hoja `Pedidos`.

## 5. Datos que debes revisar

- Cambia `API_URL` en ambos HTML si la URL de tu implementación es distinta.
- No publiques `admin.html` como enlace del menú ni compartas sus credenciales.
- No dejes `CAMBIA_ESTA_CONTRASENA_SEGURA` en producción.
- Si cambias el nombre de la hoja o de sus encabezados, actualiza las constantes y encabezados del backend.
- La carpeta de Drive debe permitir enlaces públicos para que las imágenes y videos sean visibles a los clientes.
