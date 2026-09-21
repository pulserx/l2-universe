import { auth, db } from './firebase-config.js';
import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initAccountsManager } from './accounts-manager.js';
import { initCraftingManager } from './crafting.js';
import { initTrackerManager } from './tracker.js';
import { initRaidsManager } from './raids.js';

let notifications = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 L2 Universe - Suite Privada iniciada correctamente.");
    setupGlobalNavigation();
    setupAuthListeners();
});

// Configuración de Navegación SPA y Utilidades Globales
function setupGlobalNavigation() {
    window.navigateTo = (targetSectionId, event) => {
        if (event) event.preventDefault();
        
        document.querySelectorAll('.app-section').forEach(section => {
            section.classList.remove('active');
        });

        const target = document.getElementById(`section-${targetSectionId}`);
        if (target) {
            target.classList.add('active');
        }

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-target') === targetSectionId) {
                link.classList.add('active');
            }
        });
    };

    window.switchAuthTab = (tab) => {
        const btnLogin = document.getElementById('tabBtnLogin');
        const btnRegister = document.getElementById('tabBtnRegister');
        const submitBtn = document.getElementById('btnAuthSubmit');

        if (!btnLogin || !btnRegister || !submitBtn) return;

        if (tab === 'login') {
            btnLogin.classList.add('active');
            btnRegister.classList.remove('active');
            submitBtn.textContent = 'Ingresar';
            submitBtn.dataset.mode = 'login';
        } else {
            btnRegister.classList.add('active');
            btnLogin.classList.remove('active');
            submitBtn.textContent = 'Registrarse';
            submitBtn.dataset.mode = 'register';
        }
    };

    window.closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    };

    window.toggleNotificationDropdown = () => {
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    };

    window.clearNotifications = () => {
        notifications = [];
        renderNotifications();
    };

    window.addNotification = (msg) => {
        notifications.unshift({ text: msg, time: new Date().toLocaleTimeString() });
        renderNotifications();
    };
}

function renderNotifications() {
    const listEl = document.getElementById('notifList');
    const badgeEl = document.getElementById('notifBadge');
    if (!listEl || !badgeEl) return;

    if (notifications.length === 0) {
        listEl.innerHTML = `<p class="text-muted text-center fs-sm py-2">Sin notificaciones pendientes.</p>`;
        badgeEl.style.display = 'none';
        return;
    }

    badgeEl.style.display = 'inline-block';
    badgeEl.textContent = notifications.length;

    listEl.innerHTML = notifications.map(n => `
        <div class="notif-item">
            <span class="text-cyan font-mono" style="font-size:0.7rem;">[${n.time}]</span>
            <p>${n.text}</p>
        </div>
    `).join('');
}

// Autenticación, Firebase y Control de Sesión
function setupAuthListeners() {
    const formAuth = document.getElementById('formAuth');
    if (formAuth) {
        formAuth.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const submitBtn = document.getElementById('btnAuthSubmit');
            const isRegister = submitBtn && submitBtn.dataset.mode === 'register';

            try {
                if (isRegister) {
                    await createUserWithEmailAndPassword(auth, email, password);
                    window.addNotification("✨ Cuenta creada y registrada con éxito.");
                } else {
                    await signInWithEmailAndPassword(auth, email, password);
                    window.addNotification("👋 Sesión iniciada correctamente.");
                }
            } catch (error) {
                console.error("Error de Autenticación:", error);
                alert("Error: " + error.message);
            }
        };
    }

    window.handleGoogleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            window.addNotification("🚀 Conectado exitosamente con Google.");
        } catch (error) {
            console.error("Error Google Login:", error);
            alert("No se pudo iniciar sesión con Google: " + error.message);
        }
    };

    window.handleLogout = async () => {
        try {
            await signOut(auth);
            window.addNotification("🔒 Sesión cerrada.");
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        }
    };

    window.handleForgotPassword = async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value;
        if (!email) {
            alert("Por favor ingresa tu correo electrónico primero.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Correo de recuperación enviado con éxito.");
        } catch (error) {
            alert("Error al enviar recuperación: " + error.message);
        }
    };

    onAuthStateChanged(auth, (user) => {
        const loginContainer = document.getElementById('publicLoginContainer');
        const appContainer = document.getElementById('privateAppContainer');

        if (user) {
            console.log("Usuario autenticado:", user.email);
            if (loginContainer) loginContainer.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';

            // Actualizar datos de usuario en UI
            const userNameEl = document.getElementById('userName');
            const dashUserNameEl = document.getElementById('dashUserName');
            const userAvatarEl = document.getElementById('userAvatar');

            if (userNameEl) userNameEl.textContent = user.displayName || user.email.split('@')[0];
            if (dashUserNameEl) dashUserNameEl.textContent = user.displayName || user.email.split('@')[0];
            if (userAvatarEl && user.photoURL) userAvatarEl.src = user.photoURL;

            // Inicializar todos los módulos con el UID del usuario conectado
            initAccountsManager(user);
            initCraftingManager(user);
            initTrackerManager(user);
            initRaidsManager(user);
        } else {
            console.log("Ningún usuario autenticado. Mostrando pantalla de login.");
            if (loginContainer) loginContainer.style.display = 'flex';
            if (appContainer) appContainer.style.display = 'none';

            initAccountsManager(null);
            initCraftingManager(null);
            initTrackerManager(null);
            initRaidsManager(null);
        }
    });
}