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

let authTabMode = 'login';
let systemNotifications = [];

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

// ESCUCHADOR DE SESIÓN CON COMPROBACIÓN Y ASIGNACIÓN CORRECTA DE AVATAR GOOGLE
onAuthStateChanged(auth, async (user) => {
    const publicContainer = document.getElementById('publicLoginContainer');
    const privateContainer = document.getElementById('privateAppContainer');

    if (user) {
        if (publicContainer) publicContainer.style.display = 'none';
        if (privateContainer) privateContainer.style.display = 'flex';

        // ASIGNACIÓN DE FOTO DE PERFIL GOOGLE Y NOMBRES DE USUARIO
        const avatarEl = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        const dashNameEl = document.getElementById('dashUserName');

        if (avatarEl) {
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=ff0037&color=fff`;
            avatarEl.src = user.photoURL || fallbackAvatar;
        }
        if (nameEl) nameEl.textContent = user.displayName || user.email.split('@')[0];
        if (dashNameEl) dashNameEl.textContent = user.displayName || user.email.split('@')[0];

        // Inicializar gestores de Firestore con las colecciones del usuario
        initAccountsManager(user);
        initCraftingManager(user);
        initTrackerManager(user);
        initRaidsManager(user);

        window.navigateTo('dashboard');
    } else {
        if (publicContainer) publicContainer.style.display = 'flex';
        if (privateContainer) privateContainer.style.display = 'none';

        initAccountsManager(null);
        initCraftingManager(null);
        initTrackerManager(null);
        initRaidsManager(null);
    }
});

window.navigateTo = (sectionId, event = null) => {
    if (event) event.preventDefault();

    document.querySelectorAll('.app-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    const targetSection = document.getElementById(`section-${sectionId}`);
    if (targetSection) targetSection.classList.add('active');

    const activeLink = document.querySelector(`.nav-link[data-target="${sectionId}"]`);
    if (activeLink) activeLink.classList.add('active');
};

window.switchAuthTab = (mode) => {
    authTabMode = mode;
    const btnLogin = document.getElementById('tabBtnLogin');
    const btnRegister = document.getElementById('tabBtnRegister');
    const btnSubmit = document.getElementById('btnAuthSubmit');

    if (mode === 'login') {
        if (btnLogin) btnLogin.classList.add('active');
        if (btnRegister) btnRegister.classList.remove('active');
        if (btnSubmit) btnSubmit.textContent = 'Ingresar';
    } else {
        if (btnRegister) btnRegister.classList.add('active');
        if (btnLogin) btnLogin.classList.remove('active');
        if (btnSubmit) btnSubmit.textContent = 'Crear Cuenta';
    }
};

window.handleGoogleLogin = async () => {
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
        console.error("Error al iniciar sesión con Google:", e);
        alert("Error de autenticación con Google: " + e.message);
    }
};

window.handleForgotPassword = async (event) => {
    event.preventDefault();
    const email = document.getElementById('authEmail')?.value.trim();
    if (!email) {
        alert("Por favor ingresa tu correo electrónico para enviarte el enlace de recuperación.");
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

window.handleLogout = () => signOut(auth);

// SISTEMA DE NOTIFICACIONES Y ALERTAS
window.toggleNotificationDropdown = () => {
    const dropdown = document.getElementById('notifDropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
};

window.addNotification = (msg) => {
    if (!systemNotifications.includes(msg)) {
        systemNotifications.unshift(msg);
        renderNotifications();
    }
};

window.clearNotifications = () => {
    systemNotifications = [];
    renderNotifications();
};

function renderNotifications() {
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');
    if (!badge || !list) return;

    if (systemNotifications.length > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = systemNotifications.length;
        list.innerHTML = systemNotifications.map(n => `<div class="notif-item">${n}</div>`).join('');
    } else {
        badge.style.display = 'none';
        list.innerHTML = '<p class="text-muted text-center fs-sm py-2">Sin notificaciones pendientes.</p>';
    }
}

// FUNCIÓN PARA CERRAR CUALQUIER MODAL
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show', 'active');
    }
};

function setupEventListeners() {
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

    // GUARDAR CUENTA Y CERRAR MODAL AUTOMÁTICAMENTE
    document.getElementById('formAddAccount')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const server = document.getElementById('accServer')?.value.trim();
        const chronicle = document.getElementById('accChronicle')?.value.trim();
        const username = document.getElementById('accUsername')?.value.trim();
        const secretNotes = document.getElementById('accNotes')?.value.trim();

        if (!server || !chronicle || !username) return;

        try {
            await createAccount({ server, chronicle, username, secretNotes });
            window.addNotification("✅ Cuenta de juego guardada con éxito.");
            window.closeModal('addAccountModal');
            e.target.reset();
        } catch (err) {
            console.error("Error guardando cuenta:", err);
            alert("Ocurrió un error al intentar guardar la cuenta.");
        }
    });

    // AÑADIR PERSONAJE Y CERRAR MODAL AUTOMÁTICAMENTE
    document.getElementById('formAddChar')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const accountId = document.getElementById('charAccountId')?.value;
        const name = document.getElementById('charName')?.value.trim();
        const className = document.getElementById('charClass')?.value.trim();
        const level = parseInt(document.getElementById('charLevel')?.value, 10);
        const equipment = document.getElementById('charGear')?.value.trim();

        if (!accountId || !name || !className) return;

        try {
            await addCharacterToAccount(accountId, { name, className, level, equipment });
            window.addNotification("✅ Personaje añadido con éxito.");
            window.closeModal('addCharModal');
            e.target.reset();
        } catch (err) {
            console.error("Error añadiendo personaje:", err);
            alert("Ocurrió un error al intentar añadir el personaje.");
        }
    });

    document.getElementById('formAddFarmLog')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await addFarmLog({
                date: new Date().toLocaleDateString(),
                adena: parseInt(document.getElementById('farmAdena')?.value, 10) || 0,
                ancientAdena: parseInt(document.getElementById('farmAncientAdena')?.value, 10) || 0,
                donateCoins: parseInt(document.getElementById('farmDonateCoins')?.value, 10) || 0,
                ls76: parseInt(document.getElementById('farmLifeStone76')?.value, 10) || 0,
                midLs76: parseInt(document.getElementById('farmMidLifeStone76')?.value, 10) || 0,
                topLs76: parseInt(document.getElementById('farmTopLifeStone76')?.value, 10) || 0,
                giantsCodex: parseInt(document.getElementById('farmGiantsCodex')?.value, 10) || 0,
                scrolls: parseInt(document.getElementById('farmScrolls')?.value, 10) || 0,
                letters: parseInt(document.getElementById('farmLetters')?.value, 10) || 0,
                hearts: parseInt(document.getElementById('farmHearts')?.value, 10) || 0
            });
            window.addNotification("✅ Jornada de farmeo registrada correctamente.");
            e.target.reset();
        } catch (err) {
            console.error("Error registrando jornada:", err);
            alert("Ocurrió un error al intentar guardar el farmeo.");
        }
    });

    document.getElementById('formRaidTimer')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const bossId = document.getElementById('raidBossId')?.value;
        const deathTime = document.getElementById('raidDeathTime')?.value;

        if (!bossId || !deathTime) return;

        try {
            const { collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const { db } = await import("./firebase-config.js");
            await addDoc(collection(db, 'users', user.uid, 'raid_timers'), {
                bossId,
                deathTime,
                createdAt: serverTimestamp()
            });
            window.addNotification("⏰ Horario de Raid Boss registrado con éxito.");
            window.closeModal('addRaidTimerModal');
            e.target.reset();
        } catch (err) {
            console.error("Error al registrar horario:", err);
            alert("No se pudo guardar el horario del Raid Boss.");
        }
    });
}

window.triggerAccountRender = () => renderAccounts();