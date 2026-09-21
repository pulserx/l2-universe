import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    deleteDoc, 
    updateDoc, 
    query, 
    orderBy, 
    serverTimestamp,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
let craftProjects = [];
let craftStats = { success: 0, fail: 0 };
let activeCompletingProjectId = null;
let unsubscribeCraftListener = null;
let unsubscribeStatsListener = null;

const interludeRecipes = [
    {
        id: 'rec_draconic_bow',
        name: 'Draconic Bow (Grade S)',
        mats: [
            { name: 'Recipe: Draconic Bow (60%)', qty: 1 },
            { name: 'Draconic Bow Shaft', qty: 17 },
            { name: 'Dragon Bone', qty: 100 },
            { name: 'Enchanted Dragon Skin', qty: 100 },
            { name: 'Mold Hardener', qty: 20 },
            { name: 'Enchanted Bone', qty: 150 },
            { name: 'Crystal: S-Grade', qty: 340 },
            { name: 'Gemstone S', qty: 40 }
        ]
    },
    {
        id: 'rec_angel_slayer',
        name: 'Angel Slayer (Grade S)',
        mats: [
            { name: 'Recipe: Angel Slayer (60%)', qty: 1 },
            { name: 'Angel Slayer Blade', qty: 17 },
            { name: 'Dragon Bone', qty: 100 },
            { name: 'Enchanted Dragon Skin', qty: 100 },
            { name: 'Mold Hardener', qty: 20 },
            { name: 'Enchanted Bone', qty: 150 },
            { name: 'Crystal: S-Grade', qty: 340 },
            { name: 'Gemstone S', qty: 40 }
        ]
    },
    {
        id: 'rec_draconic_leather_armor',
        name: 'Draconic Leather Armor (Grade S)',
        mats: [
            { name: 'Recipe: Draconic Leather Armor (60%)', qty: 1 },
            { name: 'Draconic Leather Armor Part', qty: 14 },
            { name: 'Enchanted Dragon Skin', qty: 70 },
            { name: 'Mold Glue', qty: 35 },
            { name: 'Asofe', qty: 35 },
            { name: 'Crystal: S-Grade', qty: 280 },
            { name: 'Gemstone S', qty: 25 }
        ]
    },
    {
        id: 'rec_imperial_crusader_breastplate',
        name: 'Imperial Crusader Breastplate (Grade S)',
        mats: [
            { name: 'Recipe: Imperial Crusader Breastplate (60%)', qty: 1 },
            { name: 'Imperial Crusader Breastplate Part', qty: 14 },
            { name: 'Imperial Diamond', qty: 70 },
            { name: 'Mold Lubricant', qty: 35 },
            { name: 'Enkanterion', qty: 35 },
            { name: 'Crystal: S-Grade', qty: 310 },
            { name: 'Gemstone S', qty: 30 }
        ]
    },
    {
        id: 'rec_major_arcana_robe',
        name: 'Major Arcana Robe (Grade S)',
        mats: [
            { name: 'Recipe: Major Arcana Robe (60%)', qty: 1 },
            { name: 'Major Arcana Robe Fabric', qty: 14 },
            { name: 'Cloth of Silver', qty: 70 },
            { name: 'Mold Hardener', qty: 35 },
            { name: 'Crystal: S-Grade', qty: 280 },
            { name: 'Gemstone S', qty: 25 }
        ]
    }
];

export function initCraftingManager(user) {
    currentUser = user;
    if (unsubscribeCraftListener) {
        unsubscribeCraftListener();
        unsubscribeCraftListener = null;
    }
    if (unsubscribeStatsListener) {
        unsubscribeStatsListener();
        unsubscribeStatsListener = null;
    }

    setupRecipeSelectOptions();

    if (!user) {
        craftProjects = [];
        craftStats = { success: 0, fail: 0 };
        renderCraftProjects();
        updateCraftStatsUI();
        return;
    }

    // Escuchar contador global de Success / Fail de crafteo
    const statsDocRef = doc(db, 'users', user.uid, 'settings', 'craft_stats');
    unsubscribeStatsListener = onSnapshot(statsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            craftStats = docSnap.data();
        } else {
            craftStats = { success: 0, fail: 0 };
        }
        updateCraftStatsUI();
    });

    const craftRef = collection(db, 'users', user.uid, 'craft_projects');
    const q = query(craftRef, orderBy('createdAt', 'desc'));

    unsubscribeCraftListener = onSnapshot(q, (snapshot) => {
        craftProjects = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderCraftProjects();
        updateDashboardCraftCount();
    }, (error) => {
        console.error("Error al escuchar proyectos de crafteo:", error);
    });
}

function setupRecipeSelectOptions() {
    const select = document.getElementById('craftRecipeSelect');
    if (!select) return;

    let html = `<option value="">-- Selecciona una receta --</option>`;
    interludeRecipes.forEach(r => {
        html += `<option value="${r.id}">${r.name}</option>`;
    });

    select.innerHTML = html;

    select.onchange = (e) => {
        const recipeId = e.target.value;
        const recipe = interludeRecipes.find(r => r.id === recipeId);
        renderRecipePreview(recipe);
    };
}

function renderRecipePreview(recipe) {
    const container = document.getElementById('recipePreviewContainer');
    if (!container) return;

    if (!recipe) {
        container.innerHTML = `<p class="text-muted text-center py-3">Selecciona una receta arriba para ver los materiales requeridos.</p>`;
        return;
    }

    container.innerHTML = `
        <div class="mt-2">
            <h4 class="text-cyan mb-2"><i class="fa-solid fa-screwdriver-wrench me-1"></i> ${recipe.name}</h4>
            <div class="recipe-mats-list mb-3">
                ${recipe.mats.map(m => `
                    <div class="recipe-mat-item">
                        <span class="mat-name"><i class="fa-solid fa-cube text-purple"></i> ${m.name}</span>
                        <span class="mat-qty">x${m.qty}</span>
                    </div>
                `).join('')}
            </div>
            <button class="btn btn-primary w-100" onclick="window.startCraftProject('${recipe.id}')">
                <i class="fa-solid fa-rocket me-1"></i> Iniciar Proyecto de Farm
            </button>
        </div>
    `;
}

window.startCraftProject = async (recipeId) => {
    if (!currentUser) return;
    const recipe = interludeRecipes.find(r => r.id === recipeId);
    if (!recipe) return;

    try {
        const craftRef = collection(db, 'users', currentUser.uid, 'craft_projects');
        const userProgress = {};
        recipe.mats.forEach(m => {
            userProgress[m.name] = 0;
        });

        await addDoc(craftRef, {
            recipeId: recipe.id,
            recipeName: recipe.name,
            mats: recipe.mats,
            userProgress,
            status: 'IN_PROGRESS',
            createdAt: serverTimestamp()
        });

        window.addNotification(`🚀 Proyecto iniciado: ${recipe.name}`);
    } catch (err) {
        console.error("Error al crear proyecto:", err);
    }
};

window.updateMaterialProgress = async (projectId, matName, value) => {
    if (!currentUser) return;
    const project = craftProjects.find(p => p.id === projectId);
    if (!project) return;

    const newProgress = { ...project.userProgress, [matName]: Math.max(0, Number(value) || 0) };
    const docRef = doc(db, 'users', currentUser.uid, 'craft_projects', projectId);

    await updateDoc(docRef, {
        userProgress: newProgress
    });
};

window.deleteCraftProject = async (projectId) => {
    if (!currentUser) return;
    if (confirm("¿Seguro que deseas cancelar o eliminar este proyecto?")) {
        const docRef = doc(db, 'users', currentUser.uid, 'craft_projects', projectId);
        await deleteDoc(docRef);
    }
};

// ACTIVAR MODAL DE ELECCIÓN SUCCESS / FAIL
window.triggerCraftCompletion = (projectId) => {
    activeCompletingProjectId = projectId;
    const overlay = document.getElementById('celebrationOverlay');
    if (overlay) overlay.style.display = 'flex';
};

// RESOLVER EL INTENTO DE CRAFT (SUCCESS O FAIL) Y ACTUALIZAR ESTADÍSTICAS
window.resolveCraftAttempt = async (resultType) => {
    const overlay = document.getElementById('celebrationOverlay');
    if (overlay) overlay.style.display = 'none';

    if (!currentUser || !activeCompletingProjectId) return;

    try {
        // Actualizar contadores en Firestore
        craftStats.success = Number(craftStats.success) || 0;
        craftStats.fail = Number(craftStats.fail) || 0;

        if (resultType === 'SUCCESS') {
            craftStats.success++;
            window.addNotification(`🎉 ¡Crafteo exitoso (Success)! Ítem conseguido.`);
        } else {
            craftStats.fail++;
            window.addNotification(`💥 Intento de crafteo fallido (Fail). ¡A seguir intentándolo!`);
        }

        const statsDocRef = doc(db, 'users', currentUser.uid, 'settings', 'craft_stats');
        await setDoc(statsDocRef, craftStats);

        // Eliminar el proyecto completado de la lista activa
        const docRef = doc(db, 'users', currentUser.uid, 'craft_projects', activeCompletingProjectId);
        await deleteDoc(docRef);

        activeCompletingProjectId = null;
        updateCraftStatsUI();
    } catch (err) {
        console.error("Error al registrar resultado de crafteo:", err);
    }
};

export function renderCraftProjects() {
    const grid = document.getElementById('activeCraftProjects');
    if (!grid) return;

    if (craftProjects.length === 0) {
        grid.innerHTML = `
            <div class="card text-center py-5 w-100">
                <p class="text-muted"><i class="fa-solid fa-hammer mb-2 fs-lg"></i><br>No tienes proyectos de crafteo activos.<br>Selecciona una receta a la izquierda para comenzar.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = craftProjects.map(p => {
        let totalRequired = 0;
        let totalCurrent = 0;

        p.mats.forEach(m => {
            totalRequired += m.qty;
            totalCurrent += Math.min(m.qty, p.userProgress[m.name] || 0);
        });

        const pct = totalRequired > 0 ? Math.floor((totalCurrent / totalRequired) * 100) : 0;
        const isCompleted = pct >= 100;

        return `
            <div class="card mb-3 border-cyan">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h4 class="text-cyan"><i class="fa-solid fa-cubes me-1"></i> ${p.recipeName}</h4>
                    <button class="btn-icon danger" onclick="window.deleteCraftProject('${p.id}')" title="Eliminar Proyecto">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>

                <div class="progress-bar-bg mb-3" style="background: rgba(255,255,255,0.05); border-radius: 6px; height: 12px; overflow: hidden; border: 1px solid rgba(255,0,55,0.2);">
                    <div class="progress-bar-fill" style="width: ${pct}%; background: linear-gradient(90deg, #ff0037, #f59e0b); height: 100%;"></div>
                </div>
                <div class="d-flex justify-content-between align-items-center fs-sm mb-3">
                    <span class="text-muted">Progreso Global:</span>
                    <div class="d-flex align-items-center gap-3">
                        <strong class="${isCompleted ? 'text-green' : 'text-gold'}">${pct}% Completado</strong>
                        ${isCompleted ? `<button class="btn btn-primary btn-sm" onclick="window.triggerCraftCompletion('${p.id}')"><i class="fa-solid fa-hammer me-1"></i> ¡A Craftear!</button>` : ''}
                    </div>
                </div>

                <div class="mats-progress-list">
                    ${p.mats.map(m => {
                        const cur = p.userProgress[m.name] || 0;
                        const done = cur >= m.qty;
                        return `
                            <div class="recipe-mat-item">
                                <span class="mat-name ${done ? 'text-green' : ''}">
                                    <i class="fa-solid ${done ? 'fa-circle-check text-green' : 'fa-circle-notch text-cyan'}"></i> ${m.name}
                                </span>
                                <div class="d-flex align-items-center gap-2">
                                    <input type="number" class="form-control text-center p-1" style="width: 75px; height: 30px; font-size: 0.85rem;" 
                                        value="${cur}" min="0" max="${m.qty}"
                                        onchange="window.updateMaterialProgress('${p.id}', '${m.name}', this.value)">
                                    <span class="mat-qty">/ ${m.qty}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function updateDashboardCraftCount() {
    const countEl = document.getElementById('dashCraftCount');
    if (countEl) countEl.textContent = craftProjects.length;
}

function updateCraftStatsUI() {
    const successEl = document.getElementById('craftSuccessCount');
    const failEl = document.getElementById('craftFailCount');
    const ratioBadge = document.getElementById('craftRatioBadge');

    const s = Number(craftStats.success) || 0;
    const f = Number(craftStats.fail) || 0;
    const total = s + f;
    const ratio = total > 0 ? Math.round((s / total) * 100) : 0;

    if (successEl) successEl.textContent = s;
    if (failEl) failEl.textContent = f;
    if (ratioBadge) ratioBadge.textContent = `Tasa de Éxito: ${ratio}%`;
}