import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    deleteDoc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
let accountsList = [];
let unsubscribeListener = null;

export function initAccountsManager(user) {
    currentUser = user;
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }

    if (!user) {
        accountsList = [];
        renderAccounts();
        return;
    }

    const accountsRef = collection(db, 'users', user.uid, 'accounts');
    const q = query(accountsRef, orderBy('createdAt', 'desc'));

    unsubscribeListener = onSnapshot(q, (snapshot) => {
        accountsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        updateServerFilterOptions();
        renderAccounts();
        updateDashboardAccountsCount();
    }, (error) => {
        console.error("Error al escuchar cuentas en Firestore:", error);
    });
}

export async function createAccount({ server, chronicle, username, secretNotes }) {
    if (!currentUser) throw new Error("Usuario no autenticado");

    const accountsRef = collection(db, 'users', currentUser.uid, 'accounts');
    await addDoc(accountsRef, {
        server,
        chronicle,
        username,
        secretNotes: secretNotes || '',
        characters: [],
        createdAt: serverTimestamp()
    });
}

export async function addCharacterToAccount(accountId, { name, className, level, equipment }) {
    if (!currentUser) throw new Error("Usuario no autenticado");

    const accDocRef = doc(db, 'users', currentUser.uid, 'accounts', accountId);
    const newChar = {
        id: 'char_' + Date.now(),
        name,
        className,
        level: Number(level) || 80,
        equipment: equipment || ''
    };

    await updateDoc(accDocRef, {
        characters: arrayUnion(newChar)
    });
}

export async function removeCharacterFromAccount(accountId, characterObj) {
    if (!currentUser) return;

    const accDocRef = doc(db, 'users', currentUser.uid, 'accounts', accountId);
    await updateDoc(accDocRef, {
        characters: arrayRemove(characterObj)
    });
}

export async function deleteAccount(accountId) {
    if (!currentUser) return;
    if (confirm("¿Estás seguro de eliminar esta cuenta y todos sus personajes?")) {
        const accDocRef = doc(db, 'users', currentUser.uid, 'accounts', accountId);
        await deleteDoc(accDocRef);
    }
}

window.openAddCharModal = (accountId) => {
    const inputAccId = document.getElementById('charAccountId');
    if (inputAccId) inputAccId.value = accountId;

    const modal = document.getElementById('addCharModal');
    if (modal) {
        modal.style.display = 'flex';
    }
};

window.deleteAccountClick = (accountId) => deleteAccount(accountId);

window.removeCharacterClick = (accountId, charId) => {
    const acc = accountsList.find(a => a.id === accountId);
    if (!acc) return;
    const charObj = (acc.characters || []).find(c => c.id === charId);
    if (charObj) {
        removeCharacterFromAccount(accountId, charObj);
    }
};

function updateServerFilterOptions() {
    const filterSelect = document.getElementById('accountServerFilter');
    if (!filterSelect) return;

    const currentVal = filterSelect.value;
    const servers = [...new Set(accountsList.map(a => a.server))];

    let html = `<option value="ALL">Todos los Servidores</option>`;
    servers.forEach(srv => {
        html += `<option value="${srv}" ${srv === currentVal ? 'selected' : ''}>${srv}</option>`;
    });

    filterSelect.innerHTML = html;
}

export function renderAccounts() {
    const grid = document.getElementById('accountsGrid');
    if (!grid) return;

    const filterSelect = document.getElementById('accountServerFilter');
    const selectedServer = filterSelect ? filterSelect.value : 'ALL';

    const filtered = selectedServer === 'ALL' 
        ? accountsList 
        : accountsList.filter(a => a.server === selectedServer);

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="card text-center py-4 w-100">
                <p class="text-muted"><i class="fa-solid fa-folder-open mb-2 fs-lg"></i><br>No hay cuentas guardadas para mostrar.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(acc => {
        const chars = acc.characters || [];
        return `
            <div class="account-card card border-cyan">
                <div class="account-card-header d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <span class="badge badge-purple">${acc.chronicle}</span>
                        <h3 class="account-title mt-1"><i class="fa-solid fa-server text-cyan"></i> ${acc.server}</h3>
                    </div>
                    <button class="btn-icon danger" onclick="window.deleteAccountClick('${acc.id}')" title="Eliminar Cuenta">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

                <div class="account-info mb-3">
                    <p><strong>Login ID:</strong> <span class="font-mono text-gold">${acc.username}</span></p>
                    ${acc.secretNotes ? `<p class="text-muted fs-sm mt-1"><i class="fa-solid fa-note-sticky"></i> ${acc.secretNotes}</p>` : ''}
                </div>

                <div class="characters-section">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <strong class="fs-sm"><i class="fa-solid fa-users text-cyan"></i> Personajes (${chars.length})</strong>
                        <button class="btn btn-sm btn-outline" onclick="window.openAddCharModal('${acc.id}')">
                            <i class="fa-solid fa-user-plus"></i> Añadir PJ
                        </button>
                    </div>

                    <div class="characters-list">
                        ${chars.length === 0 ? '<p class="text-muted fs-sm italic">Sin personajes asociados.</p>' : ''}
                        ${chars.map(c => `
                            <div class="character-item card mb-2 p-2">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <strong class="text-cyan">${c.name}</strong> 
                                        <span class="fs-sm text-muted">(Lv. ${c.level}${c.className})</span>
                                    </div>
                                    <button class="btn-icon-sm danger" onclick="window.removeCharacterClick('${acc.id}', '${c.id}')" title="Eliminar PJ">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                                ${c.equipment ? `<p class="fs-xs text-gold mt-1 mb-0"><i class="fa-solid fa-shield-halved"></i> ${c.equipment}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateDashboardAccountsCount() {
    const dashCount = document.getElementById('dashAccountsCount');
    if (dashCount) {
        dashCount.textContent = accountsList.length;
    }
}