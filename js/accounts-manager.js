import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    deleteDoc, 
    updateDoc,
    arrayUnion,
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
let accountsList = [];
let unsubscribeAccounts = null;

export function initAccountsManager(user) {
    currentUser = user;
    if (unsubscribeAccounts) {
        unsubscribeAccounts();
        unsubscribeAccounts = null;
    }

    setupAccountFormHandlers();

    if (!user) {
        // Cargar desde LocalStorage como respaldo si no hay usuario activo
        const localData = localStorage.getItem('l2_universe_accounts');
        accountsList = localData ? JSON.parse(localData) : [];
        renderAccounts();
        updateDashboardAccountsCount();
        return;
    }

    const accountsRef = collection(db, 'users', user.uid, 'accounts');
    const q = query(accountsRef, orderBy('createdAt', 'desc'));

    unsubscribeAccounts = onSnapshot(q, (snapshot) => {
        accountsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sincronizar respaldo local
        localStorage.setItem('l2_universe_accounts', JSON.stringify(accountsList));

        updateServerFilterOptions();
        renderAccounts();
        updateDashboardAccountsCount();
    }, (error) => {
        console.warn("Aviso Firebase (Cuentas): Usando respaldo local.", error);
        const localData = localStorage.getItem('l2_universe_accounts');
        accountsList = localData ? JSON.parse(localData) : [];
        updateServerFilterOptions();
        renderAccounts();
        updateDashboardAccountsCount();
    });
}

function setupAccountFormHandlers() {
    const formAcc = document.getElementById('formAddAccount');
    if (formAcc) {
        // Reemplazar nodo para evitar duplicados de listeners
        const newFormAcc = formAcc.cloneNode(true);
        formAcc.parentNode.replaceChild(newFormAcc, formAcc);

        newFormAcc.onsubmit = async (e) => {
            e.preventDefault();

            const server = document.getElementById('accServer').value.trim();
            const chronicle = document.getElementById('accChronicle').value.trim();
            const username = document.getElementById('accUsername').value.trim();
            const notes = document.getElementById('accNotes').value.trim();

            if (!server || !chronicle || !username) {
                alert("Por favor completa los campos obligatorios.");
                return;
            }

            const newAccountObj = {
                id: 'local_' + Date.now(),
                server,
                chronicle,
                username,
                notes,
                characters: [],
                createdAt: new Date().toISOString()
            };

            // Actualización optimista local inmediata
            accountsList.unshift(newAccountObj);
            localStorage.setItem('l2_universe_accounts', JSON.stringify(accountsList));
            updateServerFilterOptions();
            renderAccounts();
            updateDashboardAccountsCount();

            newFormAcc.reset();
            window.closeModal('addAccountModal');
            if (window.addNotification) window.addNotification(`✅ Cuenta "${username}" guardada con éxito.`);

            // Guardar en Firestore en segundo plano si hay usuario
            if (currentUser) {
                try {
                    const accountsRef = collection(db, 'users', currentUser.uid, 'accounts');
                    await addDoc(accountsRef, {
                        server,
                        chronicle,
                        username,
                        notes,
                        characters: [],
                        createdAt: serverTimestamp()
                    });
                } catch (err) {
                    console.error("Error al sincronizar cuenta con Firestore:", err);
                }
            }
        };
    }

    const formChar = document.getElementById('formAddChar');
    if (formChar) {
        const newFormChar = formChar.cloneNode(true);
        formChar.parentNode.replaceChild(newFormChar, formChar);

        newFormChar.onsubmit = async (e) => {
            e.preventDefault();

            const accountId = document.getElementById('charAccountId').value;
            const name = document.getElementById('charName').value.trim();
            const charClass = document.getElementById('charClass').value.trim();
            const level = Number(document.getElementById('charLevel').value) || 1;
            const gear = document.getElementById('charGear').value.trim();

            if (!accountId || !name || !charClass) {
                alert("Por favor completa los datos del personaje.");
                return;
            }

            const newChar = { name, class: charClass, level, gear };

            // Actualizar localmente
            const targetAcc = accountsList.find(a => a.id === accountId);
            if (targetAcc) {
                if (!targetAcc.characters) targetAcc.characters = [];
                targetAcc.characters.push(newChar);
                localStorage.setItem('l2_universe_accounts', JSON.stringify(accountsList));
                renderAccounts();
            }

            newFormChar.reset();
            window.closeModal('addCharModal');
            if (window.addNotification) window.addNotification(`✨ Personaje "${name}" añadido correctamente.`);

            // Sincronizar Firestore
            if (currentUser && !accountId.startsWith('local_')) {
                try {
                    const docRef = doc(db, 'users', currentUser.uid, 'accounts', accountId);
                    await updateDoc(docRef, {
                        characters: arrayUnion(newChar)
                    });
                } catch (err) {
                    console.error("Error al añadir personaje en Firestore:", err);
                }
            }
        };
    }
}

window.openAddCharModal = (accountId) => {
    const inputId = document.getElementById('charAccountId');
    if (inputId) inputId.value = accountId;
    const modal = document.getElementById('addCharModal');
    if (modal) modal.style.display = 'flex';
};

window.deleteAccount = async (accountId) => {
    if (confirm("¿Estás seguro de eliminar esta cuenta y sus personajes?")) {
        accountsList = accountsList.filter(a => a.id !== accountId);
        localStorage.setItem('l2_universe_accounts', JSON.stringify(accountsList));
        updateServerFilterOptions();
        renderAccounts();
        updateDashboardAccountsCount();
        if (window.addNotification) window.addNotification("🗑️ Cuenta eliminada correctamente.");

        if (currentUser && !accountId.startsWith('local_')) {
            try {
                const docRef = doc(db, 'users', currentUser.uid, 'accounts', accountId);
                await deleteDoc(docRef);
            } catch (err) {
                console.error("Error al eliminar cuenta en Firestore:", err);
            }
        }
    }
};

window.triggerAccountRender = () => {
    renderAccounts();
};

function updateServerFilterOptions() {
    const select = document.getElementById('accountServerFilter');
    if (!select) return;

    const servers = [...new Set(accountsList.map(acc => acc.server))];
    let html = `<option value="ALL">Todos los Servidores</option>`;
    servers.forEach(s => {
        html += `<option value="${s}">${s}</option>`;
    });
    select.innerHTML = html;
}

export function renderAccounts() {
    const grid = document.getElementById('accountsGrid');
    if (!grid) return;

    const filterVal = document.getElementById('accountServerFilter')?.value || 'ALL';
    const filtered = filterVal === 'ALL' ? accountsList : accountsList.filter(acc => acc.server === filterVal);

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="card text-center py-5 w-100">
                <p class="text-muted"><i class="fa-solid fa-users-gear mb-2 fs-lg"></i><br>No hay cuentas registradas.<br>Haz clic en "Nueva Cuenta" para comenzar.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(acc => `
        <div class="card account-card border-cyan">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <span class="badge badge-purple" style="font-size: 0.7rem;">${acc.chronicle}</span>
                    <h3 class="text-cyan mt-1">${acc.server}</h3>
                </div>
                <button class="btn-icon danger" onclick="window.deleteAccount('${acc.id}')" title="Eliminar Cuenta">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <p class="font-mono text-muted fs-sm mb-2"><i class="fa-solid fa-user me-1"></i> User: <strong>${acc.username}</strong></p>
            ${acc.notes ? `<p class="fs-sm mb-2 text-muted"><em>${acc.notes}</em></p>` : ''}
            
            <div class="characters-list mt-3 mb-2">
                <span class="text-muted fs-sm mb-1 d-block">Personajes (${acc.characters ? acc.characters.length : 0}):</span>
                ${acc.characters && acc.characters.length > 0 ? acc.characters.map(c => `
                    <div class="d-flex justify-content-between align-items-center bg-dark p-1 rounded mb-1 fs-sm">
                        <span><strong class="text-cyan">${c.name}</strong> (${c.class} - Lv.${c.level})</span>
                        <span class="text-gold" style="font-size:0.75rem;">${c.gear || ''}</span>
                    </div>
                `).join('') : '<p class="text-muted fs-sm">Sin personajes añadidos.</p>'}
            </div>

            <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top" style="border-color: rgba(255,255,255,0.05);">
                <span class="text-muted fs-sm">Acciones</span>
                <button class="btn btn-outline btn-sm" onclick="window.openAddCharModal('${acc.id}')">
                    <i class="fa-solid fa-plus"></i> Añadir PJ
                </button>
            </div>
        </div>
    `).join('');
}

function updateDashboardAccountsCount() {
    const countEl = document.getElementById('dashAccountsCount');
    if (countEl) countEl.textContent = accountsList.length;
}