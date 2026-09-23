// Backend MAEVO. Cambia estas dos constantes antes de publicar.
const ADMIN_INICIAL_USUARIO = 'administrador';
const ADMIN_INICIAL_PASSWORD = 'jeronimo1192_';
const HOJA_PRODUCTOS = 'Productos';
const HOJA_PEDIDOS = 'Pedidos';
const HOJA_ADMINS = 'Administradores';
const HOJA_CATEGORIAS = 'Categorias';
const CACHE_SESION_SEGUNDOS = 21600;
const DOMICILIOS = { medellin: 5000, metropolitana: 15000, nacional: 0 };

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojas(ss);
  const telefono = e.parameter && e.parameter.telefono;
  if (telefono) return respuesta({ pedidos: leerHoja(ss.getSheetByName(HOJA_PEDIDOS)).filter(p => soloDigitos(p.telefono) === soloDigitos(telefono)).map(p => ({ ...p, items: undefined })) });
  return respuesta({ productos: leerHoja(ss.getSheetByName(HOJA_PRODUCTOS)), categorias: leerHoja(ss.getSheetByName(HOJA_CATEGORIAS)).map(c => c.nombre) });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojas(ss);
  if (body.accion === 'login') return login(ss, body);
  if (body.accion === 'crearPedido') { try { return crearPedido(ss, body); } catch (err) { return respuesta({ error: err.message || 'No se pudo crear el pedido' }); } }
  const admin = autenticar(body.token);
  if (!admin) return respuesta({ error: 'Sesión expirada' });
  if (body.accion === 'dashboard') return dashboard(ss);
  if (body.accion === 'listarProductos') return soloPropietario(admin, () => respuesta({ productos: leerHoja(ss.getSheetByName(HOJA_PRODUCTOS)) }));
  if (body.accion === 'listarAdministradores') return soloPropietario(admin, () => respuesta({ administradores: leerHoja(ss.getSheetByName(HOJA_ADMINS)).map(a => ({ usuario: a.usuario, nombre: a.nombre, rol: a.rol, activo: a.activo })) }));
  if (body.accion === 'listarCategorias') return respuesta({ categorias: leerHoja(ss.getSheetByName(HOJA_CATEGORIAS)).map(c => ({ id: c.id, nombre: c.nombre })) });
  if (body.accion === 'agregarAdministrador') return soloPropietario(admin, () => agregarAdministrador(ss, body, admin));
  if (body.accion === 'agregarCategoria') return soloPropietario(admin, () => agregarCategoria(ss, body));
  if (body.accion === 'eliminarCategoria') return soloPropietario(admin, () => { eliminarPorId(ss.getSheetByName(HOJA_CATEGORIAS), body.id); return respuesta({ ok: true }); });
  if (body.accion === 'agregarProducto') return soloPropietario(admin, () => agregarProducto(ss, body));
  if (body.accion === 'eliminarProducto') return soloPropietario(admin, () => { eliminarPorId(ss.getSheetByName(HOJA_PRODUCTOS), body.id); return respuesta({ ok: true }); });
  if (body.accion === 'limpiarVentas') return soloPropietario(admin, () => limpiarVentas(ss, admin));
  return respuesta({ error: 'Acción no reconocida' });
}

function login(ss, body) {
  const admins = leerHoja(ss.getSheetByName(HOJA_ADMINS));
  const encontrado = admins.find(a => String(a.usuario).toLowerCase() === String(body.usuario || '').toLowerCase() && String(a.activo) !== 'false');
  if (!encontrado || hash(body.password || '') !== encontrado.passwordHash) return respuesta({ error: 'Usuario o contraseña incorrectos' });
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('sesion_' + token, JSON.stringify({ usuario: encontrado.usuario, rol: encontrado.rol }), CACHE_SESION_SEGUNDOS);
  return respuesta({ ok: true, token, usuario: encontrado.usuario, rol: encontrado.rol, expiraEn: CACHE_SESION_SEGUNDOS });
}

function autenticar(token) { if (!token) return null; const raw = CacheService.getScriptCache().get('sesion_' + token); return raw ? JSON.parse(raw) : null; }

function asegurarHojas(ss) {
  asegurarHoja(ss, HOJA_PRODUCTOS, ['id','nombre','categoria','precio','stock','descripcion','mediaUrl','mediaType']);
  asegurarHoja(ss, HOJA_PEDIDOS, ['id','fecha','cliente','telefono','direccion','ciudad','notas','metodoPago','zonaDomicilio','domicilio','items','subtotal','total','estado']);
  const sh = asegurarHoja(ss, HOJA_ADMINS, ['usuario','passwordHash','nombre','rol','activo','creado']);
  asegurarHoja(ss, HOJA_CATEGORIAS, ['id','nombre']);
  if (sh.getLastRow() < 2) sh.appendRow([ADMIN_INICIAL_USUARIO, hash(ADMIN_INICIAL_PASSWORD), 'Propietario', 'propietario', true, new Date()]);
}

function soloPropietario(admin, accion) { return admin.rol === 'propietario' ? accion() : respuesta({ error: 'Esta opción solo está disponible para el propietario' }); }

function asegurarHoja(ss, nombre, headers) {
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  const actual = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  headers.forEach(h => { if (actual.indexOf(h) < 0) sh.getRange(1, sh.getLastColumn() + 1).setValue(h); });
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sh;
}

function agregarProducto(ss, body) {
  let mediaUrl = '', mediaType = '';
  if (body.mediaUrl) {
    if (!/^https:\/\//i.test(String(body.mediaUrl))) throw new Error('La URL multimedia debe comenzar con https://');
    mediaUrl = String(body.mediaUrl).trim();
    mediaType = String(body.mediaType || 'image/*');
  } else if (body.media && body.media.data) {
    const bytes = Utilities.base64Decode(body.media.data);
    const file = DriveApp.createFile(Utilities.newBlob(bytes, body.media.mimeType, body.media.name || 'producto'));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    mediaUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    mediaType = body.media.mimeType || '';
  }
  appendObject(ss.getSheetByName(HOJA_PRODUCTOS), { id: Utilities.getUuid(), nombre: body.nombre, categoria: body.categoria, precio: Number(body.precio), stock: Number(body.stock), descripcion: sanitizarDescripcion(body.descripcion || ''), mediaUrl, mediaType });
  return respuesta({ ok: true });
}

function agregarCategoria(ss, body) {
  const nombre = String(body.nombre || '').trim();
  if (!nombre || nombre.length > 40) return respuesta({ error: 'La categoría debe tener entre 1 y 40 caracteres' });
  const sh = ss.getSheetByName(HOJA_CATEGORIAS);
  if (leerHoja(sh).some(c => String(c.nombre).toLowerCase() === nombre.toLowerCase())) return respuesta({ error: 'Esa categoría ya existe' });
  appendObject(sh, { id: Utilities.getUuid(), nombre });
  return respuesta({ ok: true });
}

function limpiarVentas(ss, admin) {
  if (admin.rol !== 'propietario') return respuesta({ error: 'Solo el propietario puede limpiar las ventas' });
  const sh = ss.getSheetByName(HOJA_PEDIDOS);
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  return respuesta({ ok: true });
}

function crearPedido(ss, body) {
  if (!body.items || !body.items.length) return respuesta({ error: 'El carrito está vacío' });
  const sh = ss.getSheetByName(HOJA_PRODUCTOS), datos = sh.getDataRange().getValues(), headers = datos[0], idCol = headers.indexOf('id'), nombreCol = headers.indexOf('nombre'), precioCol = headers.indexOf('precio'), stockCol = headers.indexOf('stock');
  const items = body.items.map(item => {
    const fila = datos.slice(1).find(row => row[idCol] === item.productoId);
    if (!fila) throw new Error('Producto no disponible: ' + item.productoId);
    const cantidad = Math.max(1, Math.floor(Number(item.cantidad)));
    if (cantidad > Number(fila[stockCol])) throw new Error('Stock insuficiente para ' + fila[nombreCol]);
    return { productoId: fila[idCol], producto: fila[nombreCol], cantidad, precioUnitario: Number(fila[precioCol]) };
  });
  const subtotal = items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0), zonaDomicilio = String(body.zonaDomicilio || 'nacional'), domicilio = DOMICILIOS[zonaDomicilio] === undefined ? 0 : DOMICILIOS[zonaDomicilio], total = subtotal + domicilio, id = Utilities.getUuid();
  appendObject(ss.getSheetByName(HOJA_PEDIDOS), { id, fecha: new Date(), cliente: body.cliente, telefono: body.telefono, direccion: body.direccion, ciudad: body.ciudad, notas: body.notas || '', metodoPago: body.metodoPago, zonaDomicilio, domicilio, items: JSON.stringify(items), subtotal, total, estado: 'Pendiente' });
  items.forEach(item => { for (let i = 1; i < datos.length; i++) if (datos[i][idCol] === item.productoId) { sh.getRange(i + 1, stockCol + 1).setValue(Math.max(0, Number(datos[i][stockCol]) - item.cantidad)); break; } });
  return respuesta({ ok: true, id, subtotal, domicilio, total, zonaDomicilio });
}

function actualizarPedido(ss, body) { const sh = ss.getSheetByName(HOJA_PEDIDOS), datos = sh.getDataRange().getValues(), estadoCol = datos[0].indexOf('estado'), idCol = datos[0].indexOf('id'); for (let i = 1; i < datos.length; i++) if (datos[i][idCol] === body.id) sh.getRange(i + 1, estadoCol + 1).setValue(body.estado); return respuesta({ ok: true }); }

function agregarAdministrador(ss, body, admin) {
  if (admin.rol !== 'propietario') return respuesta({ error: 'Solo el propietario puede agregar administradores' });
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(body.usuario || '') || String(body.password || '').length < 8) return respuesta({ error: 'Usuario o contraseña no válidos' });
  const sh = ss.getSheetByName(HOJA_ADMINS);
  if (leerHoja(sh).some(a => String(a.usuario).toLowerCase() === body.usuario.toLowerCase())) return respuesta({ error: 'Ese usuario ya existe' });
  appendObject(sh, { usuario: body.usuario, passwordHash: hash(body.password), nombre: body.nombre || body.usuario, rol: 'administrador', activo: true, creado: new Date() });
  return respuesta({ ok: true });
}

function dashboard(ss) {
  const pedidos = leerHoja(ss.getSheetByName(HOJA_PEDIDOS)), productos = leerHoja(ss.getSheetByName(HOJA_PRODUCTOS));
  const ventas = pedidos.reduce((s, p) => s + Number(p.total || 0), 0), pendientes = pedidos.filter(p => String(p.estado) === 'Pendiente').length;
  const porDia = {}, porEstado = {}, top = {};
  pedidos.forEach(p => {
    const d = new Date(p.fecha);
    if (!isNaN(d)) { const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); porDia[key] = (porDia[key] || 0) + Number(p.total || 0); }
    const estado = p.estado || 'Pendiente'; porEstado[estado] = (porEstado[estado] || 0) + 1;
    try { JSON.parse(p.items || '[]').forEach(i => { top[i.producto] = top[i.producto] || { cantidad: 0, total: 0 }; top[i.producto].cantidad += Number(i.cantidad); top[i.producto].total += Number(i.cantidad) * Number(i.precioUnitario); }); } catch (err) {}
  });
  const dias = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); dias.push({ fecha: key, total: porDia[key] || 0 }); }
  return respuesta({ resumen: { ventas, pedidos: pedidos.length, pendientes, ticketPromedio: pedidos.length ? ventas / pedidos.length : 0, productos: productos.length, stock: productos.reduce((s, p) => s + Number(p.stock || 0), 0) }, ventasPorDia: dias, pedidosPorEstado: Object.keys(porEstado).map(estado => ({ estado, cantidad: porEstado[estado] })), productosTop: Object.keys(top).map(producto => ({ producto, ...top[producto] })).sort((a, b) => b.total - a.total).slice(0, 8), recientes: pedidos.slice(-8).reverse(), pedidos });
}

function appendObject(sh, obj) { const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]; sh.appendRow(headers.map(h => obj[h] === undefined ? '' : obj[h])); }
function eliminarPorId(sh, id) { const datos = sh.getDataRange().getValues(), idCol = datos[0].indexOf('id'); for (let i = 1; i < datos.length; i++) if (datos[i][idCol] === id) { sh.deleteRow(i + 1); return; } }
function soloDigitos(s) { return String(s || '').replace(/\D/g, ''); }
function hash(value) { const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8); return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join(''); }
function sanitizarDescripcion(value) { return String(value || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<(?!\/?(?:strong|b|em|i|u|s|br|p|ul|ol|li|a)(?:\s[^>]*)?\/?\s*>)[^>]*>/gi, '').replace(/<(strong|b|em|i|u|s|br|p|ul|ol|li)(?:\s[^>]*)?>/gi, '<$1>').replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi, function(_, url) { return /^https?:\/\//i.test(url) ? '<a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' : ''; }); }
function leerHoja(sheet) { if (!sheet || sheet.getLastRow() < 2) return []; const datos = sheet.getDataRange().getValues(), headers = datos.shift(); return datos.filter(fila => fila[0] !== '').map(fila => { const obj = {}; headers.forEach((h, i) => obj[h] = fila[i]); return obj; }); }
function respuesta(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
