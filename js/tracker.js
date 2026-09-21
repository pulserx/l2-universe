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
let farmLogs = [];
let unsubscribeTrackerListener = null;

export function initTrackerManager(user) {
    currentUser = user;
    if (unsubscribeTrackerListener) {
        unsubscribeTrackerListener();
        unsubscribeTrackerListener = null;
    }

    setupTrackerFormHandler();

    if (!user) {
        farmLogs = [];
        renderFarmLogs();
        updateDashboardLogsCount();
        return;
    }

    const logsRef = collection(db, 'users', user.uid, 'farm_logs');
    const q = query(logsRef, orderBy('createdAt', 'desc'));

    unsubscribeTrackerListener = onSnapshot(q, (snapshot) => {
        farmLogs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderFarmLogs();
        updateDashboardLogsCount();
    }, (error) => {
        console.error("Error al escuchar registros de farmeo:", error);
    });
}

function setupTrackerFormHandler() {
    const form = document.getElementById('formAddFarmLog');
    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) {
            alert("Debes iniciar sesión para guardar registros.");
            return;
        }

        const adena = document.getElementById('farmAdena').value.trim();
        const ancientAdena = document.getElementById('farmAncientAdena').value.trim();
        const donateCoins = document.getElementById('farmDonateCoins').value.trim();
        const giantsCodex = document.getElementById('farmGiantsCodex').value.trim();

        // Subsecciones
        const lsType = document.getElementById('lsTypeSelect').value;
        const lsLevel = document.getElementById('lsLevelSelect').value;
        const lsQty = document.getElementById('farmLifeStonesQty').value.trim();
        const lsKey = `${lsType} (${lsLevel})`;

        const scrollVariant = document.getElementById('scrollVariantSelect').value;
        const scrollCategory = document.getElementById('scrollCategorySelect').value;
        const scrollGrade = document.getElementById('scrollGradeSelect').value;
        const scrollQty = document.getElementById('farmScrollsQty').value.trim();
        const scrollKey = `${scrollVariant} ${scrollCategory} (${scrollGrade})`;

        const letter = document.getElementById('letterSelect').value;
        const lettersQty = document.getElementById('farmLettersQty').value.trim();

        const heart = document.getElementById('heartSelect').value;
        const heartsQty = document.getElementById('farmHeartsQty').value.trim();

        const questItem = document.getElementById('questItemSelect').value;
        const questQty = document.getElementById('farmQuestItemQty').value.trim();

        const itemsMap = {};
        if (lsQty && Number(lsQty) > 0) itemsMap[lsKey] = lsQty;
        if (scrollQty && Number(scrollQty) > 0) itemsMap[scrollKey] = scrollQty;
        if (lettersQty && Number(lettersQty) > 0) itemsMap[letter] = lettersQty;
        if (heartsQty && Number(heartsQty) > 0) itemsMap[heart] = heartsQty;
        if (questQty && Number(questQty) > 0) itemsMap[questItem] = questQty;

        const newLog = {
            adena: adena || '0',
            ancientAdena: ancientAdena || '0',
            donateCoins: donateCoins || '0',
            giantsCodex: giantsCodex || '0',
            items: itemsMap,
            dateStr: new Date().toLocaleDateString(),
            createdAt: serverTimestamp()
        };

        try {
            const logsRef = collection(db, 'users', currentUser.uid, 'farm_logs');
            await addDoc(logsRef, newLog);
            form.reset();
            window.addNotification("✅ Jornada de farmeo guardada con éxito.");
        } catch (err) {
            console.error("Error al guardar jornada:", err);
            alert("Error al guardar en Firebase.");
        }
    };
}

window.deleteFarmLog = async (logId) => {
    if (!currentUser) return;
    if (confirm("¿Estás seguro de eliminar este registro de farmeo?")) {
        try {
            const docRef = doc(db, 'users', currentUser.uid, 'farm_logs', logId);
            await deleteDoc(docRef);
            window.addNotification("🗑️ Registro eliminado correctamente.");
        } catch (err) {
            console.error("Error al eliminar registro:", err);
        }
    }
};

export function renderFarmLogs() {
    const tbody = document.getElementById('farmLogsTableBody');
    if (!tbody) return;

    if (farmLogs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">No hay registros de farmeo guardados todavía.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = farmLogs.map(log => {
        const itemsEntries = log.items ? Object.entries(log.items) : [];
        const itemsFormatted = itemsEntries.length > 0 
            ? itemsEntries.map(([k, v]) => `<span class="badge badge-purple me-1 mb-1" style="font-size:0.75rem;">${k}: <strong>x${v}</strong></span>`).join('') 
            : '<span class="text-muted fs-sm">Sin ítems</span>';

        return `
            <tr>
                <td class="font-mono text-cyan">${log.dateStr}</td>
                <td class="font-mono text-gold">${log.adena}</td>
                <td class="font-mono text-purple">${log.ancientAdena}</td>
                <td class="font-mono text-cyan">${log.donateCoins}</td>
                <td>${itemsFormatted}</td>
                <td class="text-end">
                    <button class="btn-icon danger" onclick="window.deleteFarmLog('${log.id}')" title="Eliminar Registro">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateDashboardLogsCount() {
    const countEl = document.getElementById('dashLogsCount');
    if (countEl) countEl.textContent = `${farmLogs.length} Días`;
}