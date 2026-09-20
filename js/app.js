import { auth } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { initAccountsManager, createAccount, addCharacterToAccount, renderAccounts } from './accounts-manager.js';
import { initCraftingManager } from './crafting.js';
import { initTrackerManager, addFarmLog } from './tracker.js';
import { initRaidsManager } from './raids.js';

let authTabMode = 'login'; // 'login' | 'register'

document.addEventListener('DOMContentLoaded', () => {
    initRaidsManager();
    setupEventListeners();
});

// ESCUCHADOR DE ESTADO DE AUTENTICACIÓN
onAuthStateChanged(auth, (user) => {
    const publicContainer = document.getElementById('publicLoginContainer');
    const privateContainer = document.getElementById('privateAppContainer');

    if (user) {
        // Usuario logueado: Ocultar login público y mostrar la suite privada
        if (publicContainer) publicContainer.style.display = 'none';
        if (privateContainer) privateContainer.style.display = 'flex';

        // Actualizar datos del usuario en UI
        document.getElementById('userAvatar').src = user.photoURL || 'https://via.placeholder.com/40';
        document.getElementById('userName').textContent = user.displayName || user.email.split('@')[0];
        document.getElementById('dashUserName').textContent = user.displayName || user.email.split('@')[0];

        // Inicializar escuchadores de Firestore
        initAccountsManager(user);
        initCraftingManager(user);
        initTrackerManager(user);

        // Ir por defecto al Dashboard
        window.navigateTo('dashboard');
    } else {
        // Usuario no logueado: Mostrar únicamente la tarjeta de login centrada
        if (publicContainer) publicContainer.style.display = 'flex';
        if (privateContainer) privateContainer.style.display = 'none';

        initAccountsManager(null);
        initCraftingManager(null);
        initTrackerManager(null);
    }
});

// NAVEGACIÓN TIPO SPA / PESTAÑAS
window.navigateTo = (sectionId, event = null) => {
    if (event) event.preventDefault();

    // Ocultar todas las secciones
    document.querySelectorAll('.app-section').forEach(sec => sec.classList.remove('active'));
    
    // Desactivar todos los enlaces de la navbar
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    // Activar sección actual
    const targetSection = document.getElementById(`section-${sectionId}`);
    if (targetSection) targetSection.classList.add('active');

    // Marcar pestaña activa en la navbar
    const activeLink = document.querySelector(`.nav-link[data-target="${sectionId}"]`);
    if (activeLink) activeLink.classList.add('active');
};

// CAMBIAR PESTAÑA ENTRE LOGIN Y REGISTRO
window.switchAuthTab = (mode) => {
    authTabMode = mode;
    const btnLogin = document.getElementById('tabBtnLogin');
    const btnRegister = document.getElementById('tabBtnRegister');
    const btnSubmit = document.getElementById('btnAuthSubmit');

    if (mode === 'login') {
        btnLogin.classList.add('active');
        btnRegister.classList.remove('active');
        btnSubmit.textContent = 'Ingresar';
    } else {
        btnRegister.classList.add('active');
        btnLogin.classList.remove('active');
        btnSubmit.textContent = 'Crear Cuenta';
    }
};

// AUTENTICACIÓN GOOGLE
window.handleGoogleLogin = async () => {
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
        console.error("Error al iniciar sesión con Google:", e);
        alert("Error de autenticación con Google.");
    }
};

// OLVIDÉ MI CONTRASEÑA
window.handleForgotPassword = async (event) => {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    if (!email) {
        alert("Por favor ingresa tu correo electrónico en el campo superior para enviarte el enlace de recuperación.");
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        alert(`Se ha enviado un correo de recuperación a ${email}.`);
    } catch (e) {
        console.error(e);
        alert("No se pudo enviar el correo de recuperación. Verifica la dirección.");
    }
};

// CERRAR SESIÓN
window.handleLogout = () => signOut(auth);

// CONFIGURACIÓN DE EVENT LISTENERS Y FORMULARIOS
function setupEventListeners() {
    // Formulario de Login / Registro por Email
    document.getElementById('formAuth')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value.trim();
        const pass = document.getElementById('authPassword').value;

        try {
            if (authTabMode === 'login') {
                await signInWithEmailAndPassword(auth, email, pass);
            } else {
                await createUserWithEmailAndPassword(auth, email, pass);
            }
        } catch (e) {
            console.error(e);
            alert("Error de autenticación: " + e.message);
        }
    });

    // Formulario Nueva Cuenta
    document.getElementById('formAddAccount')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createAccount({
            server: document.getElementById('accServer').value.trim(),
            chronicle: document.getElementById('accChronicle').value.trim(),
            username: document.getElementById('accUsername').value.trim(),
            secretNotes: document.getElementById('accNotes').value.trim()
        });
        e.target.reset();
        document.getElementById('addAccountModal').style.display = 'none';
    });

    // Formulario Agregar Personaje
    document.getElementById('formAddChar')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const accountId = document.getElementById('charAccountId').value;
        await addCharacterToAccount(accountId, {
            name: document.getElementById('charName').value.trim(),
            className: document.getElementById('charClass').value.trim(),
            level: parseInt(document.getElementById('charLevel').value, 10),
            equipment: document.getElementById('charGear').value.trim()
        });
        e.target.reset();
        document.getElementById('addCharModal').style.display = 'none';
    });

    // Formulario Registrar Farmeo
    document.getElementById('formAddFarmLog')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addFarmLog({
            date: new Date().toLocaleDateString(),
            adena: parseInt(document.getElementById('farmAdena').value, 10) || 0,
            ancientAdena: parseInt(document.getElementById('farmAncientAdena').value, 10) || 0,
            donateCoins: parseInt(document.getElementById('farmDonateCoins').value, 10) || 0,
            sealStones: parseInt(document.getElementById('farmSealStones').value, 10) || 0
        });
        e.target.reset();
    });
}

// Disparador de renderizado para el filtro de servidor
window.triggerAccountRender = () => renderAccounts();