# Guía paso a paso — Tu catálogo con ventas en tiempo real

No necesitas saber programar. Solo sigue el orden. Cada paso dice exactamente dónde hacer clic.

## Paso 1 — Crear la hoja de Google Sheets

1. Entra a [sheets.google.com](https://sheets.google.com) con tu cuenta de Google y crea una hoja nueva.
2. Ponle de nombre, por ejemplo, **"Catálogo - Base de datos"**.
3. Cambia el nombre de la primera pestaña (abajo) a `Productos` y en la fila 1 escribe estos encabezados, uno por columna:
   `id | nombre | categoria | precio | stock | descripcion`
4. Crea una segunda pestaña (botón `+` abajo) llamada `Ventas`, con estos encabezados:
   `id | fecha | productoId | producto | cantidad | precioUnitario | total | cliente`
5. Copia el link de esta hoja (botón "Compartir" o simplemente la URL del navegador) — lo vas a necesitar más adelante para pegarlo en `SHEET_URL`.

## Paso 2 — Pegar el código conector

1. En esa misma hoja, ve a **Extensiones → Apps Script**.
2. Verás un editor de código con un archivo `Code.gs` vacío. Borra todo lo que haya ahí.
3. Abre el archivo `Code.gs` que te entregué y copia **todo** su contenido, pégalo en ese editor.
4. Busca la línea que dice `const CLAVE_ADMIN = 'CAMBIA_ESTA_CLAVE_1234';` y cámbiala por una clave tuya (esta será tu contraseña de administrador — no se la compartas a nadie).
5. Guarda con el ícono de disquete (o Ctrl+S).

## Paso 3 — Publicar como Aplicación web

1. Arriba a la derecha, clic en **Implementar → Nueva implementación**.
2. En "Selecciona el tipo", elige **Aplicación web** (ícono de engranaje).
3. Configura: Ejecutar como **"Yo (tu correo)"**, Quién tiene acceso: **"Cualquier usuario"**.
4. Clic en **Implementar**. Google te pedirá autorizar permisos la primera vez — acepta (es tu propio script, es seguro).
5. Te va a dar una **URL de la aplicación web** (termina en `/exec`). Cópiala, la necesitas para el siguiente paso.

> Nota: cada vez que edites `Code.gs` en el futuro, debes volver a "Implementar → Gestionar implementaciones → editar → Nueva versión" para que los cambios se apliquen.

## Paso 4 — Conectar tu página

1. Abre el archivo `index.html` que te entregué con cualquier editor de texto (Bloc de notas, VS Code, o incluso GitHub directamente).
2. Busca esta línea cerca del final:
   ```js
   const API_URL = 'PEGA_AQUI_TU_URL_DE_APPS_SCRIPT';
   const SHEET_URL = 'PEGA_AQUI_EL_LINK_DE_TU_GOOGLE_SHEET';
   ```
3. Reemplaza `PEGA_AQUI_TU_URL_DE_APPS_SCRIPT` con la URL que copiaste en el Paso 3.
4. Reemplaza `PEGA_AQUI_EL_LINK_DE_TU_GOOGLE_SHEET` con el link de tu hoja del Paso 1.
5. Guarda el archivo.

## Paso 5 — Publicar la página en GitHub Pages (gratis)

1. En GitHub, crea un repositorio nuevo, por ejemplo `catalogo`.
2. Sube el archivo `index.html` (arrastrarlo en "Add file → Upload files" también funciona).
3. Ve a **Settings → Pages** del repositorio.
4. En "Branch", selecciona `main` y carpeta `/root`, luego **Save**.
5. En unos minutos, GitHub te da un link público tipo:
   `https://tu-usuario.github.io/catalogo/`
   Ese es el link que compartes con tus clientes.

## Paso 6 — Probar todo

1. Abre el link de tu página.
2. Clic en "Modo administrador", escribe tu clave.
3. Agrega un producto de prueba.
4. Ve a tu Google Sheet — debería aparecer la fila nueva al instante en la pestaña `Productos`.
5. Desde la página, registra una venta de ese producto y revisa que aparezca en la pestaña `Ventas`.
6. Para tener el archivo en Excel real cuando quieras: en Google Sheets, **Archivo → Descargar → Microsoft Excel (.xlsx)**.

---

**Si algo falla:**
- "No se pudo conectar con la hoja" → revisa que `API_URL` esté bien pegada y que la implementación sea de tipo "Aplicación web" con acceso "Cualquier usuario".
- "Clave incorrecta" → revisa que la clave que escribes en la página sea idéntica a `CLAVE_ADMIN` en `Code.gs`.
- Los productos no aparecen → revisa que los encabezados de la hoja `Productos` estén escritos exactamente igual (minúsculas, sin tildes) a los del Paso 1.
