import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendPasswordResetEmail,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { initAccountsManager, createAccount, addCharacterToAccount, renderAccounts } from './accounts-manager.js';
import { initCraftingManager } from './crafting.js';
import { initTrackerManager, addFarmLog } from './tracker.js';
import { initRaidsManager, RAID_BOSSES_DB } from './raids.js';

let authTabMode = 'login';
let systemNotifications = [];

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

onAuthStateChanged(auth, (user) => {
    const publicContainer = document.getElementById('publicLoginContainer');
    const privateContainer = document.getElementById('privateAppContainer');

    if (user) {
        if (publicContainer) publicContainer.style.display = 'none';
        if (privateContainer) privateContainer.style.display = 'flex';

        document.getElementById('userAvatar').src = user.photoURL || 'https://via.placeholder.com/40';
        document.getElementById('userName').textContent = user.displayName || user.email.split('@')[0];
        document.getElementById('dashUserName').textContent = user.displayName || user.email.split('@')[0];

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
        btnLogin.classList.add('active');
        btnRegister.classList.remove('active');
        btnSubmit.textContent = 'Ingresar';
    } else {
        btnRegister.classList.add('active');
        btnLogin.classList.remove('active');
        btnSubmit.textContent = 'Crear Cuenta';
    }
};

window.handleGoogleLogin = async () => {
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
        console.error("Error al iniciar sesión con Google:", e);
        alert("Error de autenticación con Google.");
    }
};

window.handleForgotPassword = async (event) => {
    event.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
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

    document.getElementById('formAddFarmLog')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addFarmLog({
            date: new Date().toLocaleDateString(),
            adena: parseInt(document.getElementById('farmAdena').value, 10) || 0,
            ancientAdena: parseInt(document.getElementById('farmAncientAdena').value, 10) || 0,
            donateCoins: parseInt(document.getElementById('farmDonateCoins').value, 10) || 0,
            ls76: parseInt(document.getElementById('farmLifeStone76').value, 10) || 0,
            midLs76: parseInt(document.getElementById('farmMidLifeStone76').value, 10) || 0,
            topLs76: parseInt(document.getElementById('farmTopLifeStone76').value, 10) || 0,
            giantsCodex: parseInt(document.getElementById('farmGiantsCodex').value, 10) || 0,
            scrolls: parseInt(document.getElementById('farmScrolls').value, 10) || 0,
            letters: parseInt(document.getElementById('farmLetters').value, 10) || 0,
            hearts: parseInt(document.getElementById('farmHearts').value, 10) || 0
        });
        e.target.reset();
        window.addNotification("✅ Jornada de farmeo registrada correctamente.");
    });

    document.getElementById('formRaidTimer')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const bossId = document.getElementById('raidBossId').value;
        const deathTime = document.getElementById('raidDeathTime').value;

        try {
            await addDoc(collection(db, 'users', user.uid, 'raid_timers'), {
                bossId,
                deathTime,
                createdAt: serverTimestamp()
            });
            document.getElementById('addRaidTimerModal').style.display = 'none';
            e.target.reset();
            window.addNotification("⏰ Horario de Raid Boss registrado con éxito.");
        } catch (err) {
            console.error("Error al registrar horario:", err);
        }
    });
}

window.triggerAccountRender = () => renderAccounts();