// Backend MAEVO. Cambia estas dos constantes antes de publicar.
const ADMIN_INICIAL_USUARIO = 'administrador';
const ADMIN_INICIAL_PASSWORD = 'jeronimo1192_';
const HOJA_PRODUCTOS = 'Productos';
const HOJA_PEDIDOS = 'Pedidos';
const HOJA_ADMINS = 'Administradores';
const HOJA_CATEGORIAS = 'Categorias';
const HOJA_ETIQUETAS = 'Etiquetas';
const HOJA_COMPROBANTES = 'Comprobantes';
const HOJA_WHATSAPP = 'WhatsAppMensajes';
const CACHE_SESION_SEGUNDOS = 21600;
const DOMICILIOS = { medellin: 5000, metropolitana: 15000, nacional: 0 };
const WHATSAPP_API_VERSION = 'v20.0';

function doGet(e) {
  const parametros = e.parameter || {};
  const propiedades = PropertiesService.getScriptProperties();
  if (parametros['hub.mode'] === 'subscribe') {
    return parametros['hub.verify_token'] === propiedades.getProperty('WHATSAPP_VERIFY_TOKEN') ? ContentService.createTextOutput(parametros['hub.challenge'] || '') : ContentService.createTextOutput('Token inválido').setMimeType(ContentService.MimeType.TEXT);
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojas(ss);
  const telefono = e.parameter && e.parameter.telefono;
  const documento = e.parameter && e.parameter.documento;
  if (telefono) return respuesta({ pedidos: leerHoja(ss.getSheetByName(HOJA_PEDIDOS)).filter(p => soloDigitos(p.telefono) === soloDigitos(telefono) && (!documento || soloDigitos(p.documento) === soloDigitos(documento))).map(p => ({ ...p, items: undefined })) });
    return respuesta({ productos: leerHoja(ss.getSheetByName(HOJA_PRODUCTOS)), categorias: leerHoja(ss.getSheetByName(HOJA_CATEGORIAS)).map(c => c.nombre), etiquetas: leerHoja(ss.getSheetByName(HOJA_ETIQUETAS)).map(e => e.nombre) });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojas(ss);
  if (body.object === 'whatsapp_business_account') {
    procesarWebhookWhatsApp(ss, body);
    return respuesta({ ok: true });
  }
  if (body.accion === 'login') return login(ss, body);
  if (body.accion === 'crearPedido') { try { return crearPedido(ss, body); } catch (err) { return respuesta({ error: err.message || 'No se pudo crear el pedido' }); } }
  const admin = autenticar(body.token);
  if (!admin) return respuesta({ error: 'Sesión expirada' });
  if (body.accion === 'dashboard') return soloPropietario(admin, () => dashboard(ss));
  if (body.accion === 'listarPedidos') return respuesta({ pedidos: leerHoja(ss.getSheetByName(HOJA_PEDIDOS)) });
  if (body.accion === 'listarComprobantes') return respuesta({ comprobantes: leerHoja(ss.getSheetByName(HOJA_COMPROBANTES)) });
  if (body.accion === 'listarProductos') return respuesta({ productos: leerHoja(ss.getSheetByName(HOJA_PRODUCTOS)) });
  if (body.accion === 'listarAdministradores') return soloPropietario(admin, () => respuesta({ administradores: leerHoja(ss.getSheetByName(HOJA_ADMINS)).map(a => ({ usuario: a.usuario, nombre: a.nombre, rol: a.rol, activo: a.activo })) }));
  if (body.accion === 'listarCategorias') return respuesta({ categorias: leerHoja(ss.getSheetByName(HOJA_CATEGORIAS)).map(c => ({ id: c.id, nombre: c.nombre })) });
  if (body.accion === 'listarEtiquetas') return respuesta({ etiquetas: leerHoja(ss.getSheetByName(HOJA_ETIQUETAS)).map(e => ({ id: e.id, nombre: e.nombre })) });
  if (body.accion === 'listarWhatsAppMensajes') return respuesta({ mensajes: leerHoja(ss.getSheetByName(HOJA_WHATSAPP)).slice(-300), configurado: whatsappConfigurado() });
  if (body.accion === 'enviarWhatsApp') return enviarWhatsApp(ss, body);
  if (body.accion === 'obtenerConfigWhatsApp') return soloPropietario(admin, () => respuesta({ configurado: whatsappConfigurado(), phoneNumberId: PropertiesService.getScriptProperties().getProperty('WHATSAPP_PHONE_NUMBER_ID') || '', verifyToken: PropertiesService.getScriptProperties().getProperty('WHATSAPP_VERIFY_TOKEN') || '', apiVersion: PropertiesService.getScriptProperties().getProperty('WHATSAPP_API_VERSION') || WHATSAPP_API_VERSION, accessTokenConfigurado: Boolean(PropertiesService.getScriptProperties().getProperty('WHATSAPP_ACCESS_TOKEN')) }));
  if (body.accion === 'guardarConfigWhatsApp') return soloPropietario(admin, () => guardarConfigWhatsApp(body));
  if (body.accion === 'agregarAdministrador') return soloPropietario(admin, () => agregarAdministrador(ss, body, admin));
  if (body.accion === 'agregarCategoria') return soloPropietario(admin, () => agregarCategoria(ss, body));
  if (body.accion === 'eliminarCategoria') return soloPropietario(admin, () => { eliminarPorId(ss.getSheetByName(HOJA_CATEGORIAS), body.id); return respuesta({ ok: true }); });
  if (body.accion === 'agregarEtiqueta') return agregarEtiqueta(ss, body);
  if (body.accion === 'eliminarEtiqueta') return eliminarEtiqueta(ss, body);
  if (body.accion === 'agregarProducto') return agregarProducto(ss, body, admin);
  if (body.accion === 'actualizarProducto') return actualizarProducto(ss, body);
  if (body.accion === 'eliminarProducto') { eliminarPorId(ss.getSheetByName(HOJA_PRODUCTOS), body.id); return respuesta({ ok: true }); }
  if (body.accion === 'actualizarPedido') return actualizarPedido(ss, body);
  if (body.accion === 'eliminarComprobante') return soloPropietario(admin, () => { eliminarPorId(ss.getSheetByName(HOJA_COMPROBANTES), body.id); return respuesta({ ok: true }); });
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
  asegurarHoja(ss, HOJA_PRODUCTOS, ['id','nombre','categoria','precio','stock','descripcion','mediaUrl','mediaUrls','mediaType','etiquetas']);
  asegurarHoja(ss, HOJA_PEDIDOS, ['id','fecha','cliente','documento','telefono','direccion','ciudad','notas','metodoPago','zonaDomicilio','envioGratis','domicilio','items','subtotal','total','voucherId','estado']);
  const sh = asegurarHoja(ss, HOJA_ADMINS, ['usuario','passwordHash','nombre','rol','activo','creado']);
  asegurarHoja(ss, HOJA_CATEGORIAS, ['id','nombre']);
  asegurarHoja(ss, HOJA_ETIQUETAS, ['id','nombre']);
  asegurarHoja(ss, HOJA_COMPROBANTES, ['id','pedidoId','fecha','documento','cliente','telefono','direccion','ciudad','zonaDomicilio','envioGratis','domicilio','items','subtotal','total','metodoPago','estado']);
  asegurarHoja(ss, HOJA_WHATSAPP, ['id','fecha','telefono','nombre','direccion','tipo','texto','mensajeId','estado','usuario']);
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

function agregarProducto(ss, body, admin) {
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
  const mediaUrls = normalizarMedia(body.mediaUrls || body.mediaUrl);
  appendObject(ss.getSheetByName(HOJA_PRODUCTOS), { id: Utilities.getUuid(), nombre: body.nombre, categoria: body.categoria, precio: Number(body.precio), stock: Number(body.stock), descripcion: sanitizarDescripcion(body.descripcion || ''), mediaUrl: mediaUrls[0] || mediaUrl, mediaUrls: JSON.stringify(mediaUrls), mediaType, etiquetas: JSON.stringify(normalizarEtiquetas(body.etiquetas)) });
  return respuesta({ ok: true });
}

function actualizarProducto(ss, body) {
  const sh = ss.getSheetByName(HOJA_PRODUCTOS), datos = sh.getDataRange().getValues(), headers = datos[0], idCol = headers.indexOf('id');
  const fila = datos.findIndex((row, index) => index > 0 && row[idCol] === body.id);
  if (fila < 1) return respuesta({ error: 'Producto no encontrado' });
  ['nombre','categoria','precio','stock','descripcion','mediaUrl','mediaUrls','mediaType','etiquetas'].forEach(campo => {
    const col = headers.indexOf(campo);
    if (col >= 0 && body[campo] !== undefined) sh.getRange(fila + 1, col + 1).setValue(campo === 'descripcion' ? sanitizarDescripcion(body[campo]) : campo === 'mediaUrls' ? JSON.stringify(normalizarMedia(body[campo])) : campo === 'etiquetas' ? JSON.stringify(normalizarEtiquetas(body[campo])) : body[campo]);
  });
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

function agregarEtiqueta(ss, body) { const nombre = String(body.nombre || '').trim(); if (!nombre || nombre.length > 30) return respuesta({ error: 'La etiqueta debe tener entre 1 y 30 caracteres' }); const sh = ss.getSheetByName(HOJA_ETIQUETAS); if (leerHoja(sh).some(e => String(e.nombre).toLowerCase() === nombre.toLowerCase())) return respuesta({ error: 'Esa etiqueta ya existe' }); appendObject(sh, { id: Utilities.getUuid(), nombre }); return respuesta({ ok: true }); }
function eliminarEtiqueta(ss, body) { eliminarPorId(ss.getSheetByName(HOJA_ETIQUETAS), body.id); return respuesta({ ok: true }); }

function limpiarVentas(ss, admin) {
  if (admin.rol !== 'propietario') return respuesta({ error: 'Solo el propietario puede limpiar las ventas' });
  const sh = ss.getSheetByName(HOJA_PEDIDOS);
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  return respuesta({ ok: true });
}

function crearPedido(ss, body) {
  if (!body.items || !body.items.length) return respuesta({ error: 'El carrito está vacío' });
  if (!String(body.documento || '').trim()) return respuesta({ error: 'El documento es obligatorio' });
  const sh = ss.getSheetByName(HOJA_PRODUCTOS), datos = sh.getDataRange().getValues(), headers = datos[0], idCol = headers.indexOf('id'), nombreCol = headers.indexOf('nombre'), precioCol = headers.indexOf('precio'), stockCol = headers.indexOf('stock');
  const items = body.items.map(item => {
    const fila = datos.slice(1).find(row => row[idCol] === item.productoId);
    if (!fila) throw new Error('Producto no disponible: ' + item.productoId);
    const cantidad = Math.max(1, Math.floor(Number(item.cantidad)));
    if (cantidad > Number(fila[stockCol])) throw new Error('Stock insuficiente para ' + fila[nombreCol]);
    return { productoId: fila[idCol], producto: fila[nombreCol], cantidad, precioUnitario: Number(fila[precioCol]) };
  });
  const subtotal = items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0), zonaDomicilio = String(body.zonaDomicilio || 'nacional'), envioGratis = String(body.envioGratis) === 'true', domicilioBase = DOMICILIOS[zonaDomicilio] === undefined ? 0 : DOMICILIOS[zonaDomicilio], domicilio = envioGratis ? 0 : domicilioBase, total = subtotal + domicilio, id = Utilities.getUuid();
  const voucherId = Utilities.getUuid();
  appendObject(ss.getSheetByName(HOJA_PEDIDOS), { id, fecha: new Date(), cliente: body.cliente, documento: String(body.documento).trim(), telefono: body.telefono, direccion: body.direccion, ciudad: body.ciudad, notas: body.notas || '', metodoPago: body.metodoPago, zonaDomicilio, envioGratis, domicilio, items: JSON.stringify(items), subtotal, total, voucherId, estado: 'Pendiente' });
  appendObject(ss.getSheetByName(HOJA_COMPROBANTES), { id: voucherId, pedidoId: id, fecha: new Date(), documento: String(body.documento).trim(), cliente: body.cliente, telefono: body.telefono, direccion: body.direccion, ciudad: body.ciudad, zonaDomicilio, envioGratis, domicilio, items: JSON.stringify(items), subtotal, total, metodoPago: body.metodoPago, estado: 'Pendiente' });
  items.forEach(item => { for (let i = 1; i < datos.length; i++) if (datos[i][idCol] === item.productoId) { sh.getRange(i + 1, stockCol + 1).setValue(Math.max(0, Number(datos[i][stockCol]) - item.cantidad)); break; } });
  return respuesta({ ok: true, id, voucherId, subtotal, domicilio, total, zonaDomicilio, envioGratis });
}

function normalizarMedia(value) { const values = Array.isArray(value) ? value : String(value || '').split(/[\n,]+/); return values.map(url => String(url).trim()).filter(url => /^https:\/\//i.test(url)); }
function normalizarEtiquetas(value) { const values = Array.isArray(value) ? value : String(value || '').split(/[\n,]+/); return values.map(tag => String(tag).trim()).filter(Boolean).slice(0, 12); }

function whatsappConfigurado() { const propiedades = PropertiesService.getScriptProperties(); return Boolean(propiedades.getProperty('WHATSAPP_PHONE_NUMBER_ID') && propiedades.getProperty('WHATSAPP_ACCESS_TOKEN') && propiedades.getProperty('WHATSAPP_VERIFY_TOKEN')); }
function guardarConfigWhatsApp(body) {
  const phoneNumberId = String(body.phoneNumberId || '').trim(), accessToken = String(body.accessToken || '').trim(), verifyToken = String(body.verifyToken || '').trim(), apiVersion = String(body.apiVersion || WHATSAPP_API_VERSION).trim();
  if (!phoneNumberId || !accessToken || !verifyToken) return respuesta({ error: 'Phone Number ID, Access Token y Verify Token son obligatorios' });
  if (!/^v\d+\.\d+$/.test(apiVersion)) return respuesta({ error: 'La versión de API no es válida' });
  PropertiesService.getScriptProperties().setProperties({ WHATSAPP_PHONE_NUMBER_ID: phoneNumberId, WHATSAPP_ACCESS_TOKEN: accessToken, WHATSAPP_VERIFY_TOKEN: verifyToken, WHATSAPP_API_VERSION: apiVersion });
  return respuesta({ ok: true, configurado: true });
}
function procesarWebhookWhatsApp(ss, body) {
  const sh = ss.getSheetByName(HOJA_WHATSAPP), existentes = new Set(leerHoja(sh).map(m => String(m.mensajeId))), entradas = body.entry || [];
  entradas.forEach(entrada => (entrada.changes || []).forEach(cambio => (cambio.value && cambio.value.messages || []).forEach(mensaje => {
    if (existentes.has(String(mensaje.id))) return;
    const contacto = (cambio.value.contacts || []).find(c => c.wa_id === mensaje.from) || {}, texto = mensaje.text && mensaje.text.body || `[${mensaje.type || 'mensaje'}]`;
    appendObject(sh, { id: Utilities.getUuid(), fecha: new Date(Number(mensaje.timestamp || 0) * 1000 || Date.now()), telefono: mensaje.from, nombre: contacto.profile && contacto.profile.name || mensaje.from, direccion: 'entrante', tipo: mensaje.type || 'text', texto, mensajeId: mensaje.id, estado: 'recibido', usuario: '' });
    existentes.add(String(mensaje.id));
  })));
}
function enviarWhatsApp(ss, body) {
  const propiedades = PropertiesService.getScriptProperties(), phoneNumberId = propiedades.getProperty('WHATSAPP_PHONE_NUMBER_ID'), accessToken = propiedades.getProperty('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId || !accessToken) return respuesta({ error: 'La integración de WhatsApp no está configurada' });
  const telefono = soloDigitos(body.telefono), texto = String(body.texto || '').trim();
  if (!telefono || !texto) return respuesta({ error: 'El teléfono y el mensaje son obligatorios' });
  try {
    const version = propiedades.getProperty('WHATSAPP_API_VERSION') || WHATSAPP_API_VERSION, response = UrlFetchApp.fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, { method: 'post', contentType: 'application/json', headers: { Authorization: `Bearer ${accessToken}` }, payload: JSON.stringify({ messaging_product: 'whatsapp', to: telefono, type: 'text', text: { preview_url: false, body: texto } }), muteHttpExceptions: true }), status = response.getResponseCode(), data = JSON.parse(response.getContentText() || '{}');
    if (status < 200 || status >= 300) return respuesta({ error: data.error && data.error.message || 'WhatsApp rechazó el mensaje' });
    appendObject(ss.getSheetByName(HOJA_WHATSAPP), { id: Utilities.getUuid(), fecha: new Date(), telefono, nombre: body.nombre || telefono, direccion: 'saliente', tipo: 'text', texto, mensajeId: data.messages && data.messages[0] && data.messages[0].id || '', estado: 'enviado', usuario: body.usuario || '' });
    return respuesta({ ok: true });
  } catch (err) { return respuesta({ error: err.message || 'No se pudo enviar el mensaje' }); }
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
