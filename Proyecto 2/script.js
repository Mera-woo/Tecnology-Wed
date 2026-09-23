let darkmode = localStorage.getItem('darkMode');
const alternarModo = document.getElementById('cambiarModo');

const activaModoO = () => {
    document.body.classList.add('darkMode');
    localStorage.setItem('darkMode', 'active');
}

const desactivaModoO = () => {
    document.body.classList.remove('darkMode');
    localStorage.setItem('darkMode', 'null');
}

if(darkmode === "active") activaModoO()

alternarModo.addEventListener("click", () => {
    darkmode !== "active" ? activaModoO() : desactivaModoO()
})