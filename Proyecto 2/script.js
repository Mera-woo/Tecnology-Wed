/* =================================================================
   PNotas - Motor de la aplicacion
   -----------------------------------------------------------------
   El codigo esta separado por bloques, cada uno agrupa una
   funcionalidad completa para que sea comodo de leer y ampliar:
     1) MODO CLARO / OSCURO
     2) NAVEGACION ENTRE VISTAS (login -> panel)
     3) ALMACENAMIENTO DE NOTAS (guardar / leer en el navegador)
     4) PINTAR NOTAS EN PANTALLA
     5) MODAL: CREAR Y EDITAR NOTA
     6) ELIMINAR NOTA
     7) BUSCADOR DE NOTAS
   ================================================================= */


/* =================================================================
   1) MODO CLARO / OSCURO
   ----------------------------------------------------------------- */
let darkmode = localStorage.getItem('darkMode');
const alternarModo = document.getElementById('cambiarModo');

const activaModoO = () => {
    document.body.classList.add('darkMode');
    localStorage.setItem('darkMode', 'active');
    darkmode = 'active';
};

const desactivaModoO = () => {
    document.body.classList.remove('darkMode');
    localStorage.setItem('darkMode', 'null');
    darkmode = 'null';
};

if (darkmode === 'active') activaModoO();

alternarModo.addEventListener('click', () => {
    darkmode !== 'active' ? activaModoO() : desactivaModoO();
});


/* =================================================================
   2) NAVEGACION ENTRE VISTAS (login -> panel)
   ----------------------------------------------------------------- */
const vistaLogin = document.getElementById('vistaLogin');
const vistaPanel = document.getElementById('vistaPanel');
const btnIniciarSesion = document.getElementById('btnIniciarSesion');

const mostrarPanel = () => {
    vistaLogin.classList.add('oculto');
    vistaPanel.classList.remove('oculto');
    renderizarNotas();
};

btnIniciarSesion.addEventListener('click', mostrarPanel);


/* =================================================================
   3) ALMACENAMIENTO DE NOTAS
   -----------------------------------------------------------------
   Las notas se guardan en el navegador (localStorage) como un
   arreglo de objetos. Cada nota tiene: id, titulo, contenido y fecha.
   ----------------------------------------------------------------- */
const CLAVE_NOTAS = 'pnotas_notas';

let notas = JSON.parse(localStorage.getItem(CLAVE_NOTAS)) || [];

const guardarEnMemoria = () => {
    localStorage.setItem(CLAVE_NOTAS, JSON.stringify(notas));
};


/* =================================================================
   4) PINTAR NOTAS EN PANTALLA
   ----------------------------------------------------------------- */
const listaNotas = document.getElementById('listaNotas');
const mensajeVacio = document.getElementById('mensajeVacio');
const inputBuscar = document.getElementById('inputBuscar');

const formatearFecha = (marca) => {
    const f = new Date(marca);
    return f.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
};

const renderizarNotas = () => {
    const filtro = (inputBuscar.value || '').toLowerCase().trim();

    // Filtramos por titulo o contenido segun el buscador
    const notasVisibles = notas.filter((n) =>
        n.titulo.toLowerCase().includes(filtro) ||
        n.contenido.toLowerCase().includes(filtro)
    );

    // Mensaje de vacio segun el caso
    if (notas.length === 0) {
        mensajeVacio.textContent = 'Todavia no tienes notas. Crea tu primera nota con el boton "+ Nueva nota".';
        mensajeVacio.classList.remove('oculto');
    } else if (notasVisibles.length === 0) {
        mensajeVacio.textContent = 'No se encontraron notas que coincidan con tu busqueda.';
        mensajeVacio.classList.remove('oculto');
    } else {
        mensajeVacio.classList.add('oculto');
    }

    // Limpiamos y volvemos a pintar
    listaNotas.innerHTML = '';

    notasVisibles.forEach((nota) => {
        const card = document.createElement('article');
        card.className = 'notaCard';
        card.innerHTML = `
            <h3 class="notaCardTitulo"></h3>
            <p class="notaCardContenido"></p>
            <span class="notaCardFecha"></span>
            <div class="notaCardBotones">
                <button class="notaBtnIcono notaBtnEditar">Editar</button>
                <button class="notaBtnIcono notaBtnEliminar">Eliminar</button>
            </div>
        `;

        // Usamos textContent para evitar inyeccion de HTML
        card.querySelector('.notaCardTitulo').textContent = nota.titulo || 'Sin titulo';
        card.querySelector('.notaCardContenido').textContent = nota.contenido;
        card.querySelector('.notaCardFecha').textContent = formatearFecha(nota.fecha);

        card.querySelector('.notaBtnEditar').addEventListener('click', () => abrirModalEditar(nota.id));
        card.querySelector('.notaBtnEliminar').addEventListener('click', () => eliminarNota(nota.id));

        listaNotas.appendChild(card);
    });
};


/* =================================================================
   5) MODAL: CREAR Y EDITAR NOTA
   ----------------------------------------------------------------- */
const modalNota = document.getElementById('modalNota');
const modalTitulo = document.getElementById('modalTitulo');
const inputTitulo = document.getElementById('inputTitulo');
const inputContenido = document.getElementById('inputContenido');
const btnNuevaNota = document.getElementById('btnNuevaNota');
const btnGuardarNota = document.getElementById('btnGuardarNota');
const btnCancelarNota = document.getElementById('btnCancelarNota');

// Guarda el id de la nota que se esta editando (null = nota nueva)
let idEnEdicion = null;

const abrirModalNueva = () => {
    idEnEdicion = null;
    modalTitulo.textContent = 'Nueva nota';
    inputTitulo.value = '';
    inputContenido.value = '';
    modalNota.classList.remove('oculto');
    inputTitulo.focus();
};

const abrirModalEditar = (id) => {
    const nota = notas.find((n) => n.id === id);
    if (!nota) return;

    idEnEdicion = id;
    modalTitulo.textContent = 'Editar nota';
    inputTitulo.value = nota.titulo;
    inputContenido.value = nota.contenido;
    modalNota.classList.remove('oculto');
    inputTitulo.focus();
};

const cerrarModal = () => {
    modalNota.classList.add('oculto');
    idEnEdicion = null;
};

const guardarNota = () => {
    const titulo = inputTitulo.value.trim();
    const contenido = inputContenido.value.trim();

    // No guardamos notas totalmente vacias
    if (titulo === '' && contenido === '') {
        cerrarModal();
        return;
    }

    if (idEnEdicion === null) {
        // Crear nota nueva
        notas.unshift({
            id: Date.now(),
            titulo,
            contenido,
            fecha: Date.now()
        });
    } else {
        // Actualizar nota existente
        const nota = notas.find((n) => n.id === idEnEdicion);
        if (nota) {
            nota.titulo = titulo;
            nota.contenido = contenido;
            nota.fecha = Date.now();
        }
    }

    guardarEnMemoria();
    renderizarNotas();
    cerrarModal();
};

btnNuevaNota.addEventListener('click', abrirModalNueva);
btnGuardarNota.addEventListener('click', guardarNota);
btnCancelarNota.addEventListener('click', cerrarModal);

// Cerrar el modal al hacer clic fuera de la caja
modalNota.addEventListener('click', (e) => {
    if (e.target === modalNota) cerrarModal();
});


/* =================================================================
   6) ELIMINAR NOTA
   ----------------------------------------------------------------- */
const eliminarNota = (id) => {
    const confirmar = window.confirm('¿Seguro que quieres eliminar esta nota?');
    if (!confirmar) return;

    notas = notas.filter((n) => n.id !== id);
    guardarEnMemoria();
    renderizarNotas();
};


/* =================================================================
   7) BUSCADOR DE NOTAS
   ----------------------------------------------------------------- */
inputBuscar.addEventListener('input', renderizarNotas);
