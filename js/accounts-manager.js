import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, deleteDoc, doc, onSnapshot, query, updateDoc, arrayUnion, arrayRemove, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let accountsUnsubscribe = null;
let currentAccounts = [];

export function initAccountsManager(user) {
    if (accountsUnsubscribe) accountsUnsubscribe();

    if (!user) {
        currentAccounts = [];
        renderAccounts();
        return;
    }

    const accountsRef = collection(db, 'users', user.uid, 'accounts');
    const q = query(accountsRef);

    accountsUnsubscribe = onSnapshot(q, (snapshot) => {
        currentAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateServerFilterOptions();
        renderAccounts();
    });
}

function updateServerFilterOptions() {
    const filterSelect = document.getElementById('accountServerFilter');
    if (!filterSelect) return;

    const currentSelected = filterSelect.value;
    const servers = [...new Set(currentAccounts.map(a => a.server))].filter(Boolean);

    filterSelect.innerHTML = '<option value="ALL">Todos los Servidores</option>';
    servers.forEach(srv => {
        const opt = document.createElement('option');
        opt.value = srv;
        opt.textContent = srv;
        if (srv === currentSelected) opt.selected = true;
        filterSelect.appendChild(opt);
    });
}

export function renderAccounts() {
    const grid = document.getElementById('accountsGrid');
    const filterValue = document.getElementById('accountServerFilter')?.value || 'ALL';
    if (!grid) return;

    const filtered = filterValue === 'ALL' 
        ? currentAccounts 
        : currentAccounts.filter(a => a.server === filterValue);

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="text-center text-muted w-100 py-4"><p>No hay cuentas registradas.</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(acc => `
        <div class="account-card card" data-id="${acc.id}">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <span class="badge badge-cyan">${acc.chronicle || 'Interlude'}</span>
                    <h3 class="mt-1"><i class="fa-solid fa-server"></i> ${acc.server}</h3>
                </div>
                <button class="btn-icon danger" onclick="window.deleteAccount('${acc.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>

            <div class="account-credentials">
                <div>
                    <small class="text-muted">Usuario</small>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="font-mono text-cyan">${acc.username}</span>
                        <button class="btn-icon" onclick="window.copyToClipboard('${acc.username}', 'Usuario')"><i class="fa-solid fa-copy"></i></button>
                    </div>
                </div>
                ${acc.secretNotes ? `
                    <div class="mt-2">
                        <small class="text-muted">Notas Secretas</small>
                        <p class="font-mono text-muted fs-sm">${acc.secretNotes}</p>
                    </div>
                ` : ''}
            </div>

            <div class="characters-section">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h4>Personajes (${acc.characters ? acc.characters.length : 0})</h4>
                    <button class="btn btn-outline btn-sm" onclick="window.openAddCharModal('${acc.id}')"><i class="fa-solid fa-plus"></i> PJ</button>
                </div>
                <div class="char-list">
                    ${acc.characters && acc.characters.length > 0 ? acc.characters.map((pj, idx) => `
                        <div class="char-item">
                            <div>
                                <strong>${pj.name}</strong> - <span class="text-muted">Lvl ${pj.level}${pj.className}</span>
                            </div>
                            <button class="btn-icon danger" onclick="window.deleteCharacter('${acc.id}',${idx})"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    `).join('') : '<small class="text-muted">Sin PJs</small>'}
                </div>
            </div>
        </div>
    `).join('');
}

export async function createAccount(accountData) {
    const user = auth.currentUser;
    if (!user) return;
    const accountsRef = collection(db, 'users', user.uid, 'accounts');
    await addDoc(accountsRef, { ...accountData, characters: [], createdAt: serverTimestamp() });
}

window.deleteAccount = async (accountId) => {
    const user = auth.currentUser;
    if (user && confirm("¿Eliminar cuenta?")) {
        await deleteDoc(doc(db, 'users', user.uid, 'accounts', accountId));
    }
};

window.openAddCharModal = (accountId) => {
    document.getElementById('charAccountId').value = accountId;
    document.getElementById('addCharModal').style.display = 'flex';
};

export async function addCharacterToAccount(accountId, charData) {
    const user = auth.currentUser;
    if (!user) return;
    const accRef = doc(db, 'users', user.uid, 'accounts', accountId);
    await updateDoc(accRef, { characters: arrayUnion(charData) });
}

window.deleteCharacter = async (accountId, charIndex) => {
    const user = auth.currentUser;
    if (!user) return;
    const targetAccount = currentAccounts.find(a => a.id === accountId);
    if (!targetAccount || !targetAccount.characters[charIndex]) return;
    await updateDoc(doc(db, 'users', user.uid, 'accounts', accountId), {
        characters: arrayRemove(targetAccount.characters[charIndex])
    });
};

window.copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => alert(`${label} copiado.`));
};