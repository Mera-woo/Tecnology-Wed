/* =================================================================
   PNotas - Motor de la aplicacion
   -----------------------------------------------------------------
   El codigo esta separado por bloques, cada uno agrupa una
   funcionalidad completa para que sea comodo de leer y ampliar:
     1) MODO CLARO / OSCURO
     2) UTILIDADES (avisos, errores de campo)
     3) CUENTAS: almacenamiento, claves y sesion
     4) INICIAR SESION Y REGISTRO (con validaciones)
     5) NAVEGACION ENTRE VISTAS
     6) ALMACENAMIENTO DE NOTAS (por usuario) Y CARGA DESDE JSON
     7) PINTAR NOTAS EN PANTALLA (filtros y buscador)
     8) MODAL: CREAR Y EDITAR NOTA
     9) ELIMINAR NOTA (con deshacer)
    10) INICIALIZACION

   Nota: es una app 100% en el navegador (proyecto escolar). Las claves
   se guardan con hash, pero sin servidor no es seguridad real: para
   produccion la autenticacion debe vivir en un backend.
   ================================================================= */

const $ = (id) => document.getElementById(id);


/* 1) MODO CLARO / OSCURO */

const alternarModo = $('cambiarModo');
const metaTema = document.querySelector('meta[name="theme-color"]');

const aplicarModo = (oscuro) => {
    document.body.classList.toggle('darkMode', oscuro);
    alternarModo.setAttribute('aria-pressed', String(oscuro));
    alternarModo.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    if (metaTema) metaTema.content = oscuro ? '#454444' : '#e6e8ee';
};

// Se respeta la eleccion guardada; si no hay, se usa la preferencia del sistema.
// (se conserva la clave y los valores 'active' / 'null' de la version anterior)
const modoGuardado = localStorage.getItem('darkMode');
aplicarModo(modoGuardado === 'active' ||
    (modoGuardado === null && window.matchMedia('(prefers-color-scheme: dark)').matches));

alternarModo.addEventListener('click', () => {
    const oscuro = !document.body.classList.contains('darkMode');
    aplicarModo(oscuro);
    localStorage.setItem('darkMode', oscuro ? 'active' : 'null');
});


/* 2) UTILIDADES */

const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Aviso breve abajo de la pantalla. opciones: { accion, onAccion, duracion }
const mostrarToast = (mensaje, opciones = {}) => {
    const cont = $('toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    const texto = document.createElement('span');
    texto.textContent = mensaje;
    t.appendChild(texto);

    let cerrado = false;
    const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        t.classList.add('sale');
        setTimeout(() => t.remove(), reducirMovimiento ? 0 : 200);
    };

    if (opciones.accion) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'toastBtn';
        b.textContent = opciones.accion;
        b.addEventListener('click', () => { opciones.onAccion?.(); cerrar(); });
        t.appendChild(b);
    }
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'toastCerrar';
    x.setAttribute('aria-label', 'Cerrar aviso');
    x.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-x"/></svg>';
    x.addEventListener('click', cerrar);
    t.appendChild(x);

    cont.appendChild(t);
    setTimeout(cerrar, opciones.duracion || 4500);
    return cerrar;
};

// Errores por campo: texto visible + aria-invalid + aria-describedby
const ponerError = (input, mensaje) => {
    const err = $(input.getAttribute('aria-describedby').split(' ').find((i) => i.startsWith('err')));
    if (mensaje) {
        input.setAttribute('aria-invalid', 'true');
        err.textContent = mensaje;
        err.classList.add('visible');
        err.classList.remove('sacude');
        void err.offsetWidth; // reinicia la animacion
        if (!reducirMovimiento) err.classList.add('sacude');
    } else {
        input.removeAttribute('aria-invalid');
        err.textContent = '';
        err.classList.remove('visible', 'sacude');
    }
    return !mensaje;
};

const limpiarErrores = (form) => {
    form.querySelectorAll('[aria-invalid]').forEach((i) => ponerError(i, ''));
};

// Aviso grande de formulario: tipo 'info' | 'error'
const ponerAviso = (el, mensaje, tipo = 'info') => {
    el.innerHTML = '';
    el.classList.toggle('error', tipo === 'error');
    if (!mensaje) { el.classList.add('oculto'); return; }
    const ico = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ico.setAttribute('class', 'ico');
    ico.setAttribute('aria-hidden', 'true');
    ico.innerHTML = `<use href="#${tipo === 'error' ? 'i-alert' : 'i-info'}"/>`;
    const p = document.createElement('span');
    p.textContent = mensaje;
    el.append(ico, p);
    el.classList.remove('oculto');
};

const setCargando = (btn, cargando) => {
    btn.disabled = cargando;
    btn.classList.toggle('cargando', cargando);
};


/* 3) CUENTAS: almacenamiento, claves y sesion */

const CLAVE_USUARIOS = 'pnotas_usuarios';
const CLAVE_SESION = 'pnotas_sesion';
const ITERACIONES = 120000;

const leerUsuarios = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE_USUARIOS)) || []; }
    catch { return []; }
};
const guardarUsuarios = (lista) => localStorage.setItem(CLAVE_USUARIOS, JSON.stringify(lista));
const normalizarCorreo = (c) => c.trim().toLowerCase();
const buscarUsuario = (correo) => leerUsuarios().find((u) => u.correo === normalizarCorreo(correo));

const aHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// PBKDF2-SHA256 con sal propia por usuario (Web Crypto). Si el navegador no
// ofrece crypto.subtle (p. ej. pagina abierta por http en red local) se usa un
// resumen simple: sirve para que la app funcione, no como proteccion real.
const hashClave = async (clave, sal) => {
    if (window.crypto?.subtle) {
        const enc = new TextEncoder();
        const base = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: enc.encode(sal), iterations: ITERACIONES, hash: 'SHA-256' }, base, 256);
        return aHex(bits);
    }
    let h = 5381;
    for (const ch of sal + clave) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
    return 'simple-' + h.toString(16);
};

const nuevaSal = () => aHex(crypto.getRandomValues(new Uint8Array(16)));

const guardarSesion = (correo, recordar) => {
    sessionStorage.removeItem(CLAVE_SESION);
    localStorage.removeItem(CLAVE_SESION);
    (recordar ? localStorage : sessionStorage).setItem(CLAVE_SESION, correo);
};
const leerSesion = () => sessionStorage.getItem(CLAVE_SESION) || localStorage.getItem(CLAVE_SESION);
const borrarSesion = () => {
    sessionStorage.removeItem(CLAVE_SESION);
    localStorage.removeItem(CLAVE_SESION);
};

let usuarioActual = null;

// Intentos fallidos por correo: 5 errores bloquean 30 segundos
const intentos = {};
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 30000;


/* 4) INICIAR SESION Y REGISTRO (con validaciones) */

const formLogin = $('formLogin');
const formRegistro = $('formRegistro');
const loginEmail = $('loginEmail');
const loginPass = $('loginPass');
const regNombre = $('regNombre');
const regEmail = $('regEmail');
const regPass = $('regPass');
const regPass2 = $('regPass2');

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_NOMBRE = /^[\p{L}][\p{L}\p{M}\s.'-]*$/u;

// Cada validador devuelve el mensaje de error o '' si el valor es valido
const validar = {
    correo(v) {
        v = v.trim();
        if (!v) return 'Escribe tu correo electrónico.';
        if (v.length > 254 || !REGEX_CORREO.test(v)) return 'Revisa el correo: debe verse como nombre@dominio.com.';
        return '';
    },
    claveLogin(v) {
        return v ? '' : 'Escribe tu contraseña.';
    },
    nombre(v) {
        v = v.trim().replace(/\s+/g, ' ');
        if (!v) return 'Dinos cómo te llamas.';
        if (v.length < 2) return 'El nombre es muy corto (mínimo 2 letras).';
        if (!REGEX_NOMBRE.test(v)) return 'Usa solo letras, espacios, punto o guion.';
        return '';
    },
    claveNueva(v) {
        if (!v) return 'Crea una contraseña.';
        if (v.length < 8) return `Faltan ${8 - v.length} caracteres (mínimo 8).`;
        if (!/\p{L}/u.test(v)) return 'Incluye al menos una letra.';
        if (!/\d/.test(v)) return 'Incluye al menos un número.';
        return '';
    },
    repetir(v) {
        if (!v) return 'Repite la contraseña para confirmar.';
        return v === regPass.value ? '' : 'Las contraseñas no coinciden.';
    }
};

// Fuerza 0-4 para el medidor
const puntuarClave = (v) => {
    let p = 0;
    if (v.length >= 8) p++;
    if (v.length >= 12) p++;
    if (/\p{Lu}/u.test(v) && /\p{Ll}/u.test(v)) p++;
    if (/[^\p{L}\d]/u.test(v)) p++;
    return p;
};
const ETIQUETAS_FUERZA = ['Usa letras y números.', 'Débil', 'Aceptable', 'Buena', 'Muy fuerte'];

regPass.addEventListener('input', () => {
    const v = regPass.value;
    // Si aun no cumple las reglas minimas nunca pasa de "Débil"
    const nivel = !v ? 0 : validar.claveNueva(v) ? 1 : Math.max(2, puntuarClave(v));
    $('fuerza').dataset.nivel = nivel;
    $('ayudaClave').textContent = ETIQUETAS_FUERZA[nivel];
});

// Validar al salir del campo, y volver a validar mientras se corrige (si ya habia error)
const enlazarValidacion = (input, fn) => {
    input.addEventListener('blur', () => { if (input.value !== '' || input.hasAttribute('aria-invalid')) ponerError(input, fn(input.value)); });
    input.addEventListener('input', () => { if (input.hasAttribute('aria-invalid')) ponerError(input, fn(input.value)); });
};
enlazarValidacion(loginEmail, validar.correo);
enlazarValidacion(regNombre, validar.nombre);
enlazarValidacion(regEmail, validar.correo);
enlazarValidacion(regPass, validar.claveNueva);
enlazarValidacion(regPass2, validar.repetir);
regPass.addEventListener('input', () => { if (regPass2.hasAttribute('aria-invalid') || regPass2.value) ponerError(regPass2, validar.repetir(regPass2.value)); });

// Mostrar / ocultar contrasena
document.querySelectorAll('.verClave').forEach((btn) => {
    btn.addEventListener('click', () => {
        const input = $(btn.dataset.target);
        const mostrar = input.type === 'password';
        input.type = mostrar ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(mostrar));
        btn.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
        btn.querySelector('use').setAttribute('href', mostrar ? '#i-eye-off' : '#i-eye');
        input.focus();
    });
});

// Aviso de Bloq Mayus
[[loginPass, 'avisoMayusLogin'], [regPass, 'avisoMayusReg']].forEach(([input, id]) => {
    const aviso = $(id);
    const revisar = (e) => aviso.classList.toggle('oculto', !e.getModifierState?.('CapsLock'));
    input.addEventListener('keyup', revisar);
    input.addEventListener('keydown', revisar);
    input.addEventListener('blur', () => aviso.classList.add('oculto'));
});

// Cambiar entre iniciar sesion y registro
const mostrarFormulario = (cual, { correo = '', aviso = '', tipoAviso = 'info' } = {}) => {
    const registro = cual === 'registro';
    formLogin.classList.toggle('oculto', registro);
    formRegistro.classList.toggle('oculto', !registro);
    const form = registro ? formRegistro : formLogin;
    form.classList.remove('entra');
    void form.offsetWidth;
    form.classList.add('entra');
    limpiarErrores(form);

    ponerAviso($('avisoLogin'), registro ? '' : aviso, tipoAviso);
    ponerAviso($('avisoRegistro'), registro ? aviso : '', tipoAviso);

    if (registro) {
        if (correo) regEmail.value = correo;
        (correo ? regNombre : regNombre).focus();
    } else {
        if (correo) loginEmail.value = correo;
        (correo ? loginPass : loginEmail).focus();
    }
};

$('irRegistro').addEventListener('click', () => mostrarFormulario('registro', { correo: loginEmail.value.trim() && !validar.correo(loginEmail.value) ? loginEmail.value.trim() : '' }));
$('irLogin').addEventListener('click', () => mostrarFormulario('login', { correo: regEmail.value.trim() && !validar.correo(regEmail.value) ? regEmail.value.trim() : '' }));

/* --- Enviar: iniciar sesion --- */
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('btnIniciarSesion');
    if (btn.disabled) return;
    ponerAviso($('avisoLogin'), '');

    const errCorreo = validar.correo(loginEmail.value);
    const errClave = validar.claveLogin(loginPass.value);
    ponerError(loginEmail, errCorreo);
    ponerError(loginPass, errClave);
    if (errCorreo || errClave) { (errCorreo ? loginEmail : loginPass).focus(); return; }

    const correo = normalizarCorreo(loginEmail.value);

    // Bloqueo temporal por demasiados intentos
    const reg = intentos[correo];
    if (reg && reg.hasta > Date.now()) {
        const seg = Math.ceil((reg.hasta - Date.now()) / 1000);
        ponerAviso($('avisoLogin'), `Demasiados intentos. Espera ${seg} s e inténtalo de nuevo.`, 'error');
        return;
    }

    const usuario = buscarUsuario(correo);

    // No esta registrado: abrimos la ventana de registro con el correo ya escrito
    if (!usuario) {
        mostrarFormulario('registro', {
            correo,
            aviso: `No encontramos una cuenta con ${correo}. Complétala aquí para crearla.`
        });
        return;
    }

    setCargando(btn, true);
    try {
        const hash = await hashClave(loginPass.value, usuario.sal);
        if (hash !== usuario.clave) {
            const r = intentos[correo] = intentos[correo] || { n: 0, hasta: 0 };
            r.n++;
            if (r.n >= MAX_INTENTOS) {
                r.n = 0;
                r.hasta = Date.now() + BLOQUEO_MS;
                ponerAviso($('avisoLogin'), 'Demasiados intentos fallidos. Espera 30 s para volver a probar.', 'error');
            } else {
                ponerError(loginPass, `Contraseña incorrecta. Te quedan ${MAX_INTENTOS - r.n} intentos.`);
            }
            loginPass.select();
            return;
        }
        delete intentos[correo];
        guardarSesion(correo, $('loginRecordar').checked);
        await entrarComoUsuario(usuario);
        formLogin.reset();
    } finally {
        setCargando(btn, false);
    }
});

/* --- Enviar: crear cuenta --- */
formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('btnRegistrar');
    if (btn.disabled) return;
    ponerAviso($('avisoRegistro'), '');

    const campos = [
        [regNombre, validar.nombre(regNombre.value)],
        [regEmail, validar.correo(regEmail.value)],
        [regPass, validar.claveNueva(regPass.value)],
        [regPass2, validar.repetir(regPass2.value)]
    ];
    campos.forEach(([input, msg]) => ponerError(input, msg));
    const primero = campos.find(([, msg]) => msg);
    if (primero) { primero[0].focus(); return; }

    const correo = normalizarCorreo(regEmail.value);
    if (buscarUsuario(correo)) {
        // Ya existe: ofrecemos ir a iniciar sesion
        ponerError(regEmail, 'Ya existe una cuenta con este correo.');
        const err = $('errRegEmail');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'enlaceBtn';
        b.textContent = 'Iniciar sesión';
        b.addEventListener('click', () => mostrarFormulario('login', { correo }));
        err.appendChild(b);
        regEmail.focus();
        return;
    }

    setCargando(btn, true);
    try {
        const sal = nuevaSal();
        const usuario = {
            nombre: regNombre.value.trim().replace(/\s+/g, ' '),
            correo,
            sal,
            clave: await hashClave(regPass.value, sal),
            creado: Date.now()
        };
        const lista = leerUsuarios();
        lista.push(usuario);
        guardarUsuarios(lista);
        guardarSesion(correo, true);
        await entrarComoUsuario(usuario, true);
        formRegistro.reset();
        $('fuerza').dataset.nivel = 0;
        $('ayudaClave').textContent = ETIQUETAS_FUERZA[0];
    } finally {
        setCargando(btn, false);
    }
});

// Cerrar sesion
$('btnCerrarSesion').addEventListener('click', () => {
    borrarSesion();
    usuarioActual = null;
    notas = [];
    inputBuscar.value = '';
    materiaActiva = null;
    mostrarVista('login');
    mostrarFormulario('login');
    mostrarToast('Cerraste sesión. ¡Hasta pronto!');
});


/* 5) NAVEGACION ENTRE VISTAS */

const logoBtn = $('logoBtn');
const vistaLogin = $('vistaLogin');
const vistaPanel = $('vistaPanel');

const mostrarVista = (cual) => {
    const panel = cual === 'panel';
    vistaLogin.classList.toggle('oculto', panel);
    vistaPanel.classList.toggle('oculto', !panel);
    $('usuarioChip').classList.toggle('oculto', !panel);
    $('btnCerrarSesion').classList.toggle('oculto', !panel);
    window.scrollTo(0, 0);
};

const entrarComoUsuario = async (usuario, esNuevo = false) => {
    usuarioActual = usuario;
    $('usuarioNombre').textContent = usuario.nombre;
    $('usuarioInicial').textContent = usuario.nombre.trim().charAt(0).toUpperCase() || '?';
    const primerNombre = usuario.nombre.trim().split(' ')[0];
    $('panelTitulo').textContent = `Hola, ${primerNombre}`;
    await cargarNotasDeUsuario();
    inputBuscar.value = '';
    materiaActiva = null;
    mostrarVista('panel');
    renderizarNotas({ animar: true });
    if (esNuevo) mostrarToast(`Cuenta creada. Te damos la bienvenida, ${primerNombre}.`);
};

// El logo lleva al panel si hay sesion, o al inicio de sesion si no
logoBtn.addEventListener('click', () => {
    if (usuarioActual) { window.scrollTo({ top: 0, behavior: reducirMovimiento ? 'auto' : 'smooth' }); return; }
    mostrarFormulario('login');
});


/* 6) ALMACENAMIENTO DE NOTAS (por usuario) Y CARGA DESDE JSON */

const claveNotas = (correo) => `pnotas_notas_${correo}`;

let notas = [];
let datosIniciales = { usuarios: [], notas: [] };

const guardarEnMemoria = () => {
    if (!usuarioActual) return;
    localStorage.setItem(claveNotas(usuarioActual.correo), JSON.stringify(notas));
};

// "2026-10-10" -> marca de tiempo en hora local (evita el desfase de un dia por zona horaria)
const aMarca = (f) => {
    if (typeof f === 'number') return f;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || '');
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    const t = new Date(f).getTime();
    return Number.isNaN(t) ? Date.now() : t;
};

const normalizarNota = (n) => ({
    id: n.id ?? Date.now() + Math.random(),
    titulo: String(n.titulo || '').slice(0, 80),
    contenido: String(n.contenido || n.descripcion || '').slice(0, 2000),
    materia: String(n.materia || '').trim().slice(0, 30),
    fecha: aMarca(n.fecha)
});

// Lee Funcionalidad.json una sola vez. Acepta el formato nuevo ({usuarios, notas})
// y el antiguo (un arreglo de notas).
const cargarDatosIniciales = async () => {
    try {
        const respuesta = await fetch('Funcionalidad.json');
        if (!respuesta.ok) throw new Error('No se pudo cargar el archivo JSON');
        const datos = await respuesta.json();
        datosIniciales = Array.isArray(datos)
            ? { usuarios: [], notas: datos }
            : { usuarios: datos.usuarios || [], notas: datos.notas || [] };
    } catch (error) {
        console.error('Error al cargar el JSON:', error);
        datosIniciales = { usuarios: [], notas: [] };
        mostrarToast('No se pudo leer Funcionalidad.json. Abre el proyecto con un servidor local para ver las notas de ejemplo.', { duracion: 7000 });
    }

    // Cuentas de prueba del JSON: se agregan si todavia no existen
    const lista = leerUsuarios();
    let cambio = false;
    datosIniciales.usuarios.forEach((u) => {
        const correo = normalizarCorreo(u.correo || '');
        if (correo && u.sal && u.clave && !lista.some((x) => x.correo === correo)) {
            lista.push({ nombre: u.nombre || correo, correo, sal: u.sal, clave: u.clave, creado: Date.now() });
            cambio = true;
        }
    });
    if (cambio) guardarUsuarios(lista);
};

// Notas del usuario: las suyas; si es la primera vez, las del JSON (o las de la version anterior)
const cargarNotasDeUsuario = async () => {
    const guardadas = localStorage.getItem(claveNotas(usuarioActual.correo));
    if (guardadas) {
        try { notas = JSON.parse(guardadas).map(normalizarNota); return; }
        catch { /* si esta danado se vuelve a sembrar */ }
    }
    // Migracion: notas guardadas por la version sin cuentas
    const antiguas = localStorage.getItem('pnotas_notas');
    if (antiguas) {
        try {
            notas = JSON.parse(antiguas).map(normalizarNota);
            localStorage.removeItem('pnotas_notas');
            guardarEnMemoria();
            return;
        } catch { /* se ignora */ }
    }
    notas = datosIniciales.notas.map(normalizarNota);
    guardarEnMemoria();
};


/* 7) PINTAR NOTAS EN PANTALLA */

const listaNotas = $('listaNotas');
const mensajeVacio = $('mensajeVacio');
const inputBuscar = $('inputBuscar');
const filtrosMateria = $('filtrosMateria');
let materiaActiva = null;

const formatearFecha = (marca) =>
    new Date(marca).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

// Tono de color estable por materia (0-3)
const tonoDeMateria = (m) => {
    let h = 0;
    for (const ch of m.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % 4;
};

const crearIcono = (id) => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;

const pintarFiltros = () => {
    const conteo = new Map();
    notas.forEach((n) => { if (n.materia) conteo.set(n.materia, (conteo.get(n.materia) || 0) + 1); });
    if (materiaActiva && !conteo.has(materiaActiva)) materiaActiva = null;

    filtrosMateria.innerHTML = '';
    filtrosMateria.classList.toggle('oculto', conteo.size < 2);
    if (conteo.size < 2) { materiaActiva = null; return; }

    const crearChip = (texto, valor, cantidad) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.setAttribute('aria-pressed', String(materiaActiva === valor));
        const t = document.createElement('span');
        t.textContent = texto;
        const c = document.createElement('span');
        c.className = 'chipNum';
        c.textContent = cantidad;
        b.append(t, c);
        b.addEventListener('click', () => {
            materiaActiva = valor;
            renderizarNotas({ animar: true });
        });
        filtrosMateria.appendChild(b);
    };
    crearChip('Todas', null, notas.length);
    [...conteo.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).forEach(([m, c]) => crearChip(m, m, c));
};

const renderizarNotas = ({ animar = false } = {}) => {
    const filtro = (inputBuscar.value || '').toLowerCase().trim();
    pintarFiltros();

    // Filtramos por materia y por titulo/contenido/materia segun el buscador; mas nuevas primero
    const visibles = notas
        .filter((n) => !materiaActiva || n.materia === materiaActiva)
        .filter((n) => !filtro ||
            n.titulo.toLowerCase().includes(filtro) ||
            n.contenido.toLowerCase().includes(filtro) ||
            n.materia.toLowerCase().includes(filtro))
        .sort((a, b) => b.fecha - a.fecha);

    // Resumen bajo el saludo
    const materias = new Set(notas.map((n) => n.materia).filter(Boolean)).size;
    $('panelResumen').textContent = notas.length === 0
        ? 'Aún no hay nada escrito.'
        : `${notas.length} ${notas.length === 1 ? 'nota' : 'notas'}` +
          (materias ? ` · ${materias} ${materias === 1 ? 'materia' : 'materias'}` : '') +
          (visibles.length !== notas.length ? ` · mostrando ${visibles.length}` : '');

    // Mensaje de vacio segun el caso
    const vacio = visibles.length === 0;
    mensajeVacio.classList.toggle('oculto', !vacio);
    if (vacio) {
        $('textoVacio').textContent = notas.length === 0
            ? 'Tu cuaderno está en blanco. Escribe la primera nota de hoy.'
            : 'Ninguna nota coincide con lo que buscas.';
        $('btnVacioNueva').classList.toggle('oculto', notas.length !== 0);
    }

    // Limpiamos y volvemos a pintar
    listaNotas.innerHTML = '';

    visibles.forEach((nota, i) => {
        const card = document.createElement('article');
        card.className = 'notaCard' + (animar && !reducirMovimiento ? ' entra' : '');
        card.style.setProperty('--i', Math.min(i, 10));
        card.innerHTML = `
            ${nota.materia ? '<span class="notaMateria"></span>' : ''}
            <h3 class="notaCardTitulo"></h3>
            <p class="notaCardContenido"></p>
            <div class="notaCardPie">
                <time class="notaCardFecha"></time>
                <div class="notaCardBotones">
                    <button type="button" class="notaBtnIcono notaBtnEditar">${crearIcono('i-edit')}</button>
                    <button type="button" class="notaBtnIcono notaBtnEliminar">${crearIcono('i-trash')}</button>
                </div>
            </div>
        `;

        // Usamos textContent para evitar inyeccion de HTML
        if (nota.materia) {
            const chip = card.querySelector('.notaMateria');
            chip.textContent = nota.materia;
            chip.dataset.tono = tonoDeMateria(nota.materia);
        }
        card.querySelector('.notaCardTitulo').textContent = nota.titulo || 'Sin título';
        const cont = card.querySelector('.notaCardContenido');
        cont.textContent = nota.contenido;
        if (!nota.contenido) cont.remove();
        const fecha = card.querySelector('.notaCardFecha');
        fecha.textContent = formatearFecha(nota.fecha);
        fecha.dateTime = new Date(nota.fecha).toISOString().slice(0, 10);

        const titulo = nota.titulo || 'sin título';
        const bEditar = card.querySelector('.notaBtnEditar');
        const bEliminar = card.querySelector('.notaBtnEliminar');
        bEditar.setAttribute('aria-label', `Editar nota ${titulo}`);
        bEditar.title = 'Editar';
        bEliminar.setAttribute('aria-label', `Eliminar nota ${titulo}`);
        bEliminar.title = 'Eliminar';
        bEditar.addEventListener('click', () => abrirModalEditar(nota.id));
        bEliminar.addEventListener('click', () => eliminarNota(nota.id));

        listaNotas.appendChild(card);
    });
};

inputBuscar.addEventListener('input', () => renderizarNotas());


/* 8) MODAL: CREAR Y EDITAR NOTA */

const modalNota = $('modalNota');
const formNota = $('formNota');
const modalTitulo = $('modalTitulo');
const inputTitulo = $('inputTitulo');
const inputMateria = $('inputMateria');
const inputContenido = $('inputContenido');
const contadorNota = $('contadorNota');

// Guarda el id de la nota que se esta editando (null = nota nueva)
let idEnEdicion = null;

const actualizarContador = () => {
    contadorNota.textContent = `${inputContenido.value.length} / 2000`;
};
inputContenido.addEventListener('input', actualizarContador);

const rellenarMaterias = () => {
    const lista = $('listaMaterias');
    lista.innerHTML = '';
    [...new Set(notas.map((n) => n.materia).filter(Boolean))].forEach((m) => {
        const o = document.createElement('option');
        o.value = m;
        lista.appendChild(o);
    });
};

const abrirModal = (titulo, nota) => {
    modalTitulo.textContent = titulo;
    inputTitulo.value = nota?.titulo || '';
    inputMateria.value = nota?.materia || '';
    inputContenido.value = nota?.contenido || '';
    limpiarErrores(formNota);
    actualizarContador();
    rellenarMaterias();
    modalNota.showModal();
    inputTitulo.focus();
};

const abrirModalNueva = () => {
    idEnEdicion = null;
    abrirModal('Nueva nota');
};

const abrirModalEditar = (id) => {
    const nota = notas.find((n) => n.id === id);
    if (!nota) return;
    idEnEdicion = id;
    abrirModal('Editar nota', nota);
};

const cerrarModal = () => {
    if (modalNota.open) modalNota.close();
    idEnEdicion = null;
};

const guardarNota = () => {
    const titulo = inputTitulo.value.trim();
    const contenido = inputContenido.value.trim();
    const materia = inputMateria.value.trim().replace(/\s+/g, ' ');

    // Validaciones: la nota necesita al menos un titulo y algo de contenido
    const errTitulo = !titulo ? 'Ponle un título para reconocerla después.' : '';
    const errContenido = !contenido ? 'Escribe algo en la nota antes de guardarla.' : '';
    ponerError(inputTitulo, errTitulo);
    ponerError(inputContenido, errContenido);
    if (errTitulo || errContenido) { (errTitulo ? inputTitulo : inputContenido).focus(); return; }

    if (idEnEdicion === null) {
        notas.unshift({ id: Date.now(), titulo, contenido, materia, fecha: Date.now() });
    } else {
        const nota = notas.find((n) => n.id === idEnEdicion);
        if (nota) {
            nota.titulo = titulo;
            nota.contenido = contenido;
            nota.materia = materia;
            nota.fecha = Date.now();
        }
    }

    const fueNueva = idEnEdicion === null;
    guardarEnMemoria();
    cerrarModal();
    renderizarNotas({ animar: fueNueva });
    mostrarToast(fueNueva ? 'Nota guardada.' : 'Cambios guardados.');
};

formNota.addEventListener('submit', (e) => { e.preventDefault(); guardarNota(); });
$('btnNuevaNota').addEventListener('click', abrirModalNueva);
$('btnVacioNueva').addEventListener('click', abrirModalNueva);
$('btnCancelarNota').addEventListener('click', cerrarModal);
enlazarValidacion(inputTitulo, (v) => (v.trim() ? '' : 'Ponle un título para reconocerla después.'));
enlazarValidacion(inputContenido, (v) => (v.trim() ? '' : 'Escribe algo en la nota antes de guardarla.'));

// Cerrar el modal al hacer clic en el fondo (fuera de la caja); Esc lo cierra de forma nativa
modalNota.addEventListener('click', (e) => {
    if (e.target === modalNota) cerrarModal();
});
// Ctrl/Cmd + Enter guarda desde el area de texto
inputContenido.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); guardarNota(); }
});


/* 9) ELIMINAR NOTA (con deshacer) */

const eliminarNota = (id) => {
    const indice = notas.findIndex((n) => n.id === id);
    if (indice === -1) return;
    const [borrada] = notas.splice(indice, 1);
    guardarEnMemoria();
    renderizarNotas();

    mostrarToast('Nota eliminada.', {
        accion: 'Deshacer',
        duracion: 6000,
        onAccion: () => {
            notas.splice(Math.min(indice, notas.length), 0, borrada);
            guardarEnMemoria();
            renderizarNotas();
        }
    });
};


/* 10) INICIALIZACION AL CARGAR LA PAGINA */

document.addEventListener('DOMContentLoaded', async () => {
    // Se leen las cuentas y notas de ejemplo del JSON y luego se restaura la sesion
    await cargarDatosIniciales();

    const correoSesion = leerSesion();
    const usuario = correoSesion && buscarUsuario(correoSesion);
    if (usuario) {
        await entrarComoUsuario(usuario);
    } else {
        borrarSesion();
        mostrarVista('login');
    }
});
