# MAEVO · Catálogo y tienda online

Catálogo digital con carrito de compras, pedidos, comprobante de pago y un panel administrativo privado. La tienda pública está construida en HTML y el backend usa Google Apps Script conectado a Google Sheets.

## Qué incluye

| Área | Funcionalidad |
| --- | --- |
| Tienda pública | Catálogo responsive, categorías, precios, stock e imágenes o videos |
| WhatsApp | Botón público para iniciar conversaciones con el negocio |
| Compras | Carrito, cantidades, datos de entrega, Nequi o Bancolombia |
| Pedidos | Registro en Google Sheets, descuento automático de stock y consulta por teléfono |
| Administración | Login privado, productos, medios, pedidos y administradores |
| Dashboard | Ventas, pedidos, ticket promedio, stock, estados, ventas de 30 días y productos más vendidos |

## Estructura

```text
catalogo/
├── index.html                       # Tienda pública
├── admin.html                       # Panel privado
├── Code.gs                          # Backend de Google Apps Script
├── INSTRUCCIONES_ACTUALIZACION.md   # Configuración paso a paso
└── README.md
```

## Puesta en marcha

### 1. Google Sheets

Crea una hoja de cálculo con estas pestañas y encabezados:

**Productos**

`id | nombre | categoria | precio | stock | descripcion`

**Pedidos**

`id | fecha | cliente | telefono | direccion | ciudad | notas | metodoPago | items | total | estado`

El backend agregará automáticamente las columnas multimedia y creará la pestaña `Administradores`.

### 2. Apps Script

1. Abre **Extensiones → Apps Script** desde la hoja.
2. Copia el contenido de `Code.gs`.
3. Cambia las constantes iniciales:

```js
const ADMIN_INICIAL_USUARIO = 'tu_usuario';
const ADMIN_INICIAL_PASSWORD = 'tu_contrasena_segura';
```

4. Autoriza los permisos de Google Sheets y Google Drive.
5. Publica como **Aplicación web**, ejecutando como tú y con acceso para cualquier usuario.
6. Copia la URL que termina en `/exec`.

### 3. Conectar las páginas

Pega esa URL en `API_URL` dentro de `index.html` y `admin.html`.

- Comparte únicamente `index.html` con tus clientes.
- Conserva la dirección de `admin.html` para uso privado.
- Desde el panel puedes crear cuentas adicionales con rol de administrador.

### 4. Publicar en GitHub Pages

1. Sube los archivos del proyecto a GitHub.
2. En **Settings → Pages**, selecciona la rama `main` y la carpeta raíz.
3. Usa la URL pública de `index.html` como tienda.

### 5. Botón de WhatsApp

La tienda incluye un botón que abre una conversación con el número definido en `WHATSAPP_NEGOCIO` dentro de `index.html`. El panel administrativo no incluye una bandeja ni configuración de WhatsApp.

## Carga de imágenes y videos

Desde **Productos → Nuevo producto** puedes cargar archivos de hasta 8 MB. Se guardan en el Google Drive de la cuenta que ejecuta Apps Script y se muestran en el catálogo mediante un enlace de lectura.

## Seguridad

- El catálogo público no contiene el botón ni la sección de administración.
- Las acciones administrativas requieren una sesión temporal.
- Las contraseñas se almacenan como hash SHA-256, no en texto plano.
- El propietario es el único que puede crear nuevos administradores.
- El precio final y la disponibilidad se validan en el backend antes de registrar un pedido.
- No dejes la contraseña de ejemplo en producción.

## Actualizaciones

Después de modificar `Code.gs`, crea una nueva versión desde **Implementar → Gestionar implementaciones**. Revisa la guía completa en [INSTRUCCIONES_ACTUALIZACION.md](INSTRUCCIONES_ACTUALIZACION.md).

## Estado

Proyecto preparado para GitHub Pages + Google Apps Script + Google Sheets + Google Drive.