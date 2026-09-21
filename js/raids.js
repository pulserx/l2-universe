import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, deleteDoc, doc, onSnapshot, query, updateDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// BASE DE DATOS EXTENDIDA DE RAID BOSSES CON IMÁGENES Y GUÍAS DE ACCESO
export const RAID_BOSSES_DB = [
    {
        id: 'valakas',
        name: 'Valakas (Dragon of Fire)',
        level: 85,
        type: 'EPIC',
        location: 'Valakas Lair (Goddard)',
        respawnHours: 264,
        image: 'https://l2wiki.com/images/1/1d/Valakas.jpg',
        guide: 'Paso 1: Teleport a Goddard -> Forge of the Gods. Paso 2: Atraviesa la zona de lava hasta el NPC Klein. Paso 3: Entrega el ítem "Floating Stone" (Quest Into the Flame) e ingresa al pasillo que lleva a la cueva de Valakas.'
    },
    {
        id: 'antharas',
        name: 'Antharas (Dragon of Earth)',
        level: 85,
        type: 'EPIC',
        location: 'Antharas Lair (Giran)',
        respawnHours: 192,
        image: 'https://l2wiki.com/images/3/30/Antharas.jpg',
        guide: 'Paso 1: Teleport a Giran -> Dragon Valley. Paso 2: Corre hacia el fondo del mapa hasta ingresar a Antharas Lair. Paso 3: Habla con el Heart of Volcano con la "Portal Stone" (Quest Audience with the Land Dragon).'
    },
    {
        id: 'baium',
        name: 'Baium',
        level: 75,
        type: 'EPIC',
        location: 'Tower of Insolence Piso 14',
        respawnHours: 120,
        image: 'https://l2wiki.com/images/6/62/Baium.jpg',
        guide: 'Paso 1: Teleport a Aden -> Tower of Insolence. Paso 2: Sube hasta el Piso 13 por los portales. Paso 3: Usa la Angelic Vortex con la "Blooded Fabric" (Quest An Arrogant Search) para entrar a la sala del Trono del Rey Baium.'
    },
    {
        id: 'zakken',
        name: 'Zakken',
        level: 60,
        type: 'EPIC',
        location: 'Devil\'s Isle (Giran)',
        respawnHours: 48,
        image: 'https://l2wiki.com/images/9/91/Zakken.jpg',
        guide: 'Paso 1: Teleport desde Giran hacia Devil\'s Isle. Paso 2: Atraviesa la cueva pirata nadando por los túneles hasta la nave central. Paso 3: Entra al barco en la sala interior al medianoche del tiempo del juego.'
    },
    {
        id: 'queen_ant',
        name: 'Queen Ant',
        level: 40,
        type: 'EPIC',
        location: 'Ant Nest (Gludio)',
        respawnHours: 36,
        image: 'https://l2wiki.com/images/c/c8/Queen_Ant.jpg',
        guide: 'Paso 1: Teleport desde Gludio hacia Ant Nest. Paso 2: Sigue el camino hacia las profundidades del hormiguero. Paso 3: Entra a la cámara real limpia de larvas sin llevar PJs de nivel superior al 48 para evitar la petrificación.'
    },
    {
        id: 'frintezza',
        name: 'Frintezza',
        level: 85,
        type: 'EPIC',
        location: 'Imperial Tomb (Goddard)',
        respawnHours: 48,
        image: 'https://l2wiki.com/images/0/0e/Frintezza.jpg',
        guide: 'Paso 1: Teleport a Goddard -> Imperial Tomb. Paso 2: Consigue el Frintezza Magic Force Field Removal Scroll (Quest Last Imperial Prince). Paso 3: Ingresa en Command Channel de 4 a 5 partys para activar la sinfonía.'
    },
    {
        id: 'barakiel',
        name: 'Flame of Splendor Anais (Barakiel)',
        level: 80,
        type: '76-80',
        location: 'Valley of Saints (Rune)',
        respawnHours: 18,
        image: 'https://l2wiki.com/images/7/7b/Item_6885.png',
        guide: 'Paso 1: Teleport a Rune -> Valley of Saints. Paso 2: Sigue la quebrada norte hacia la cima de la colina. Esencial para la Quest de Noblesse (Staff of Goddess).'
    },
    {
        id: 'varka_hero',
        name: 'Varka\'s Hero Shadith',
        level: 80,
        type: '80+',
        location: 'Varka Silenos Outpost',
        respawnHours: 24,
        image: 'https://l2wiki.com/images/a/a2/Item_6379.png',
        guide: 'Paso 1: Teleport desde Goddard a Varka Silenos Settlement. Paso 2: Adéntrate en el campamento central con Alianza Ketra Nivel 3 o superior para invocar al jefe.'
    }
];

let raidTimersUnsubscribe = null;
let activeRaidTimers = [];

export function initRaidsManager(user) {
    setupRaidSearchAndFilters();

    if (raidTimersUnsubscribe) {
        raidTimersUnsubscribe();
        raidTimersUnsubscribe = null;
    }

    if (!user) {
        activeRaidTimers = [];
        renderRaidBosses();
        return;
    }

    const timersRef = collection(db, 'users', user.uid, 'raid_timers');
    raidTimersUnsubscribe = onSnapshot(query(timersRef), (snapshot) => {
        activeRaidTimers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderRaidBosses();
        checkRaidSpawnsAndNotify();
    });
}

function setupRaidSearchAndFilters() {
    const searchInput = document.getElementById('raidSearchInput');
    const filterSelect = document.getElementById('raidLevelFilter');

    if (searchInput) {
        searchInput.oninput = () => renderRaidBosses();
    }
    if (filterSelect) {
        filterSelect.onchange = () => renderRaidBosses();
    }
}

export function renderRaidBosses() {
    const grid = document.getElementById('raidsGrid');
    if (!grid) return;

    const queryText = document.getElementById('raidSearchInput')?.value.toLowerCase().trim() || '';
    const filterVal = document.getElementById('raidLevelFilter')?.value || 'ALL';

    const filtered = RAID_BOSSES_DB.filter(rb => {
        const matchesText = rb.name.toLowerCase().includes(queryText) || rb.location.toLowerCase().includes(queryText);
        let matchesFilter = true;
        if (filterVal === 'EPIC') matchesFilter = rb.type === 'EPIC';
        if (filterVal === '70-75') matchesFilter = rb.level >= 70 && rb.level <= 75;
        if (filterVal === '76-80') matchesFilter = rb.level >= 76 && rb.level <= 80;
        if (filterVal === '80+') matchesFilter = rb.level >= 80 && rb.type !== 'EPIC';

        return matchesText && matchesFilter;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="text-center text-muted py-4 w-100"><p>No se encontraron Raid Bosses.</p></div>';
        return;
    }

    grid.innerHTML = filtered.map(rb => {
        const activeTimer = activeRaidTimers.find(t => t.bossId === rb.id);
        let statusHtml = `<span class="badge badge-cyan">Respawn estimado: ~${rb.respawnHours} hrs</span>`;

        if (activeTimer && activeTimer.deathTime) {
            const deathDate = new Date(activeTimer.deathTime);
            const nextSpawnDate = new Date(deathDate.getTime() + rb.respawnHours * 60 * 60 * 1000);
            const now = new Date();

            if (now >= nextSpawnDate) {
                statusHtml = `<span class="badge badge-green">¡POSIBLEMENTE VIVO! (Nació ${nextSpawnDate.toLocaleTimeString()})</span>`;
            } else {
                statusHtml = `<div class="raid-respawn-box mt-1">
                    <small class="text-gold fw-bold">Próximo Respawn:</small> 
                    <span class="font-mono text-cyan">${nextSpawnDate.toLocaleString()}</span>
                </div>`;
            }
        }

        return `
            <div class="card raid-card">
                <div class="d-flex gap-3 align-items-center mb-2">
                    <img src="${rb.image}" class="raid-boss-img" alt="${rb.name}" onerror="this.src='https://l2wiki.com/images/7/7b/Item_6885.png'">
                    <div>
                        <span class="badge ${rb.type === 'EPIC' ? 'badge-purple' : 'badge-cyan'}">Lvl ${rb.level} ${rb.type}</span>
                        <h3 class="mt-1">${rb.name}</h3>
                        <small class="text-muted"><i class="fa-solid fa-location-dot"></i> ${rb.location}</small>
                    </div>
                </div>

                <div class="my-2">
                    ${statusHtml}
                </div>

                <div class="raid-guide-box my-2">
                    <strong><i class="fa-solid fa-compass text-gold"></i> Cómo llegar:</strong>
                    <p class="mt-1">${rb.guide}</p>
                </div>

                <div class="d-flex justify-content-between align-items-center mt-3">
                    <button class="btn btn-outline btn-sm" onclick="window.openAddRaidTimerModal('${rb.id}', '${rb.name.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-clock"></i> Registrar Horario
                    </button>
                    ${activeTimer ? `
                        <button class="btn-icon danger" onclick="window.deleteRaidTimer('${activeTimer.id}')" title="Limpiar temporizador">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

window.openAddRaidTimerModal = (bossId, bossName) => {
    document.getElementById('raidBossId').value = bossId;
    document.getElementById('raidBossNameDisplay').value = bossName;
    document.getElementById('addRaidTimerModal').style.display = 'flex';
};

function checkRaidSpawnsAndNotify() {
    activeRaidTimers.forEach(t => {
        const rb = RAID_BOSSES_DB.find(b => b.id === t.bossId);
        if (rb && t.deathTime) {
            const deathDate = new Date(t.deathTime);
            const nextSpawnDate = new Date(deathDate.getTime() + rb.respawnHours * 60 * 60 * 1000);
            const now = new Date();
            const diffMinutes = (nextSpawnDate - now) / 1000 / 60;

            if (diffMinutes > 0 && diffMinutes <= 30) {
                if (window.addNotification) {
                    window.addNotification(`⚠️ ALERTA: ${rb.name} está por nacer en aproximadamente ${Math.round(diffMinutes)} minutos.`);
                }
            }
        }
    });
}

window.deleteRaidTimer = async (timerDocId) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await deleteDoc(doc(db, 'users', user.uid, 'raid_timers', timerDocId));
    } catch (e) {
        console.error("Error al borrar horario de raid:", e);
    }
};