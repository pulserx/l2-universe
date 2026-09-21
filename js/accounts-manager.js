import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    deleteDoc, 
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

    setupAccountFormHandler();

    if (!user) {
        accountsList = [];
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

        updateServerFilterOptions();
        renderAccounts();
        updateDashboardAccountsCount();
    }, (error) => {
        console.error("Error al escuchar cuentas:", error);
    });
}

function setupAccountFormHandler() {
    const form = document.getElementById('formAddAccount');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault(); // Evita que la página recargue y vuelva al inicio sin guardar

        if (!currentUser) {
            alert("Debes iniciar sesión para guardar cuentas.");
            return;
        }

        const server = document.getElementById('accServer').value.trim();
        const chronicle = document.getElementById('accChronicle').value.trim();
        const username = document.getElementById('accUsername').value.trim();
        const notes = document.getElementById('accNotes').value.trim();

        if (!server || !chronicle || !username) {
            alert("Por favor completa los campos obligatorios.");
            return;
        }

        const newAccount = {
            server,
            chronicle,
            username,
            notes,
            characters: [],
            createdAt: serverTimestamp()
        };

        try {
            const accountsRef = collection(db, 'users', currentUser.uid, 'accounts');
            await addDoc(accountsRef, newAccount);
            
            form.reset();
            window.closeModal('addAccountModal');
            window.addNotification(`✅ Cuenta "${username}" guardada con éxito.`);
        } catch (err) {
            console.error("Error al guardar cuenta en Firebase:", err);
            alert("Error al guardar la cuenta en la base de datos.");
        }
    };
}

window.deleteAccount = async (accountId) => {
    if (!currentUser) return;
    if (confirm("¿Estás seguro de eliminar esta cuenta y sus personajes?")) {
        try {
            const docRef = doc(db, 'users', currentUser.uid, 'accounts', accountId);
            await deleteDoc(docRef);
            window.addNotification("🗑️ Cuenta eliminada correctamente.");
        } catch (err) {
            console.error("Error al eliminar cuenta:", err);
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
            ${acc.notes ? `<p class="fs-sm mb-3 text-muted"><em>${acc.notes}</em></p>` : ''}
            
            <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top" style="border-color: rgba(255,255,255,0.05);">
                <span class="text-muted fs-sm">Personajes guardados</span>
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