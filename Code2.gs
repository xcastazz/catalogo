/**
 * BACKEND del catálogo MAEVO — vive dentro de tu Google Sheet (Apps Script).
 * Pega esto reemplazando TODO el contenido anterior de Code.gs.
 */

// 🔑 Clave para el panel de administrador (agregar/eliminar productos).
const CLAVE_ADMIN = 'CAMBIA_ESTA_CLAVE_1234';

const HOJA_PRODUCTOS = 'Productos';
const HOJA_PEDIDOS = 'Pedidos';

// --- LEER datos ---
// Sin parámetros: devuelve el catálogo de productos (uso público).
// Con ?telefono=xxxx: devuelve los pedidos de ese teléfono ("Mis pedidos").
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const telefono = e.parameter && e.parameter.telefono;

  if (telefono) {
    const pedidos = leerHoja(ss.getSheetByName(HOJA_PEDIDOS))
      .filter(p => soloDigitos(p.telefono) === soloDigitos(telefono))
      .map(p => ({ ...p, items: undefined }));
    return respuesta({ pedidos });
  }

  const productos = leerHoja(ss.getSheetByName(HOJA_PRODUCTOS));
  return respuesta({ productos });
}

// --- ESCRIBIR datos ---
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const body = JSON.parse(e.postData.contents);

  // Crear pedido: lo hace el CLIENTE, no requiere clave de admin.
  if (body.accion === 'crearPedido') {
    if (!body.items || !body.items.length) return respuesta({ error: 'El carrito está vacío' });
    const total = body.items.reduce((s, it) => s + Number(it.precioUnitario) * Number(it.cantidad), 0);
    const id = Utilities.getUuid();
    const shPedidos = ss.getSheetByName(HOJA_PEDIDOS);
    shPedidos.appendRow([
      id, new Date(), body.cliente, body.telefono, body.direccion, body.ciudad,
      body.notas || '', body.metodoPago, JSON.stringify(body.items), total, 'Pendiente'
    ]);

    // Descontar stock de cada producto
    const shProd = ss.getSheetByName(HOJA_PRODUCTOS);
    const datos = shProd.getDataRange().getValues();
    body.items.forEach(item => {
      for (let i = 1; i < datos.length; i++) {
        if (datos[i][0] === item.productoId) {
          const stockActual = datos[i][4];
          shProd.getRange(i + 1, 5).setValue(Math.max(0, stockActual - Number(item.cantidad)));
          break;
        }
      }
    });
    return respuesta({ ok: true, id, total });
  }

  // Acciones de administrador: requieren clave.
  if (body.clave !== CLAVE_ADMIN) {
    return respuesta({ error: 'Clave incorrecta' });
  }

  if (body.accion === 'agregarProducto') {
    ss.getSheetByName(HOJA_PRODUCTOS).appendRow([
      Utilities.getUuid(), body.nombre, body.categoria, body.precio, body.stock, body.descripcion
    ]);
    return respuesta({ ok: true });
  }

  if (body.accion === 'eliminarProducto') {
    const sh = ss.getSheetByName(HOJA_PRODUCTOS);
    const datos = sh.getDataRange().getValues();
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === body.id) { sh.deleteRow(i + 1); break; }
    }
    return respuesta({ ok: true });
  }

  return respuesta({ error: 'Acción no reconocida' });
}

// --- Funciones de apoyo ---
function soloDigitos(s) { return String(s || '').replace(/\D/g, ''); }

function leerHoja(sheet) {
  const datos = sheet.getDataRange().getValues();
  const headers = datos.shift();
  return datos
    .filter(fila => fila[0] !== '')
    .map(fila => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = fila[i]);
      return obj;
    });
}

function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
