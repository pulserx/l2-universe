import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let trackerUnsubscribe = null;
let farmLogs = [];

export function initTrackerManager(user) {
    if (trackerUnsubscribe) trackerUnsubscribe();

    if (!user) {
        farmLogs = [];
        renderTrackerUI();
        return;
    }

    const logsRef = collection(db, 'users', user.uid, 'farm_logs');
    trackerUnsubscribe = onSnapshot(query(logsRef, orderBy('createdAt', 'desc')), (snapshot) => {
        farmLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTrackerUI();
    });
}

export function renderTrackerUI() {
    renderSummaryStats();
    renderLogsTable();
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function renderSummaryStats() {
    const totalAdena = farmLogs.reduce((acc, curr) => acc + (Number(curr.adena) || 0), 0);
    const totalAAdena = farmLogs.reduce((acc, curr) => acc + (Number(curr.ancientAdena) || 0), 0);
    const totalCoins = farmLogs.reduce((acc, curr) => acc + (Number(curr.donateCoins) || 0), 0);
    const totalStones = farmLogs.reduce((acc, curr) => acc + (Number(curr.sealStones) || 0), 0);

    if (document.getElementById('totalAdena')) document.getElementById('totalAdena').textContent = formatNumber(totalAdena);
    if (document.getElementById('totalAncientAdena')) document.getElementById('totalAncientAdena').textContent = formatNumber(totalAAdena);
    if (document.getElementById('totalDonateCoins')) document.getElementById('totalDonateCoins').textContent = formatNumber(totalCoins);
    if (document.getElementById('totalSealStones')) document.getElementById('totalSealStones').textContent = formatNumber(totalStones);
}

function renderLogsTable() {
    const tableBody = document.getElementById('farmLogsTableBody');
    if (!tableBody) return;

    if (farmLogs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Sin registros.</td></tr>';
        return;
    }

    tableBody.innerHTML = farmLogs.map(log => `
        <tr>
            <td>${log.date || 'Hoy'}</td>
            <td class="text-gold font-mono">${formatNumber(log.adena)}</td>
            <td class="text-purple font-mono">${formatNumber(log.ancientAdena)}</td>
            <td class="text-cyan font-mono">${formatNumber(log.donateCoins)}</td>
            <td class="text-green font-mono">${formatNumber(log.sealStones)}</td>
            <td class="text-end">
                <button class="btn-icon danger" onclick="window.deleteFarmLog('${log.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

export async function addFarmLog(logData) {
    const user = auth.currentUser;
    if (!user) return alert("Inicia sesión.");
    await addDoc(collection(db, 'users', user.uid, 'farm_logs'), { ...logData, createdAt: serverTimestamp() });
}

window.deleteFarmLog = async (logId) => {
    const user = auth.currentUser;
    if (user && confirm("¿Borrar registro?")) {
        await deleteDoc(doc(db, 'users', user.uid, 'farm_logs', logId));
    }
};