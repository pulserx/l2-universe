import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, deleteDoc, doc, onSnapshot, query, updateDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// RECETAS USANDO ÍCONOS NATIVOS DE FONTAWESOME EN LUGAR DE IMÁGENES EXTERNAS
export const CRAFT_RECIPES = {
    'draconic_armor': {
        name: 'Draconic Leather Armor', grade: 'S', iconClass: 'fa-shield-halved',
        materials: [
            { id: 'recipe', name: 'Recipe: Draconic Leather Armor (60%)', required: 1, iconClass: 'fa-scroll' },
            { id: 'key_part', name: 'Draconic Leather Armor Texture', required: 15, iconClass: 'fa-puzzle-piece' },
            { id: 'mold_hardener', name: 'Mold Hardener', required: 17, iconClass: 'fa-vial' },
            { id: 'enria', name: 'Enria', required: 34, iconClass: 'fa-gem' },
            { id: 'asofe', name: 'Asofe', required: 34, iconClass: 'fa-cube' }
        ]
    },
    'angel_slayer': {
        name: 'Angel Slayer', grade: 'S', iconClass: 'fa-wand-magic-sparkles',
        materials: [
            { id: 'recipe', name: 'Recipe: Angel Slayer (60%)', required: 1, iconClass: 'fa-scroll' },
            { id: 'key_part', name: 'Angel Slayer Blade', required: 17, iconClass: 'fa-ring' },
            { id: 'gem_s', name: 'Gemstone S', required: 70, iconClass: 'fa-gem' },
            { id: 'crystal_s', name: 'Crystal: S-Grade', required: 235, iconClass: 'fa-diamond' }
        ]
    }
};

let craftingUnsubscribe = null;
let activeProjects = [];
let craftStats = { success: 0, fail: 0 };

export function initCraftingManager(user) {
    if (craftingUnsubscribe) {
        craftingUnsubscribe();
        craftingUnsubscribe = null;
    }
    renderRecipeSelector();

    if (!user) {
        activeProjects = [];
        craftStats = { success: 0, fail: 0 };
        renderActiveProjects();
        renderCraftStats();
        updateCraftDashboardCount();
        return;
    }

    try {
        const projectsRef = collection(db, 'users', user.uid, 'crafting_projects');
        craftingUnsubscribe = onSnapshot(query(projectsRef), (snapshot) => {
            activeProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderActiveProjects();
            calculateAndRenderStats();
            updateCraftDashboardCount();
        }, (error) => {
            console.error("Error al cargar proyectos de craft:", error);
        });
    } catch (e) {
        console.error("Error inicializando Firestore Craft:", e);
    }
}

function updateCraftDashboardCount() {
    const el = document.getElementById('dashCraftCount');
    if (el) el.textContent = activeProjects.length;
}

function calculateAndRenderStats() {
    let success = 0;
    let fail = 0;
    activeProjects.forEach(p => {
        if (p.result === 'success') success++;
        if (p.result === 'fail') fail++;
    });
    craftStats = { success, fail };
    renderCraftStats();
}

function renderCraftStats() {
    const elSuccess = document.getElementById('craftSuccessCount');
    const elFail = document.getElementById('craftFailCount');
    const elRatio = document.getElementById('craftRatioBadge');

    if (elSuccess) elSuccess.textContent = craftStats.success;
    if (elFail) elFail.textContent = craftStats.fail;

    const total = craftStats.success + craftStats.fail;
    const ratio = total > 0 ? Math.round((craftStats.success / total) * 100) : 0;
    if (elRatio) elRatio.textContent = `Tasa de Éxito: ${ratio}%`;
}

export function renderRecipeSelector() {
    const select = document.getElementById('craftRecipeSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Selecciona una Receta --</option>';
    Object.keys(CRAFT_RECIPES).forEach(key => {
        const item = CRAFT_RECIPES[key];
        select.innerHTML += `<option value="${key}">[Grado ${item.grade}] ${item.name}</option>`;
    });

    select.onchange = (e) => previewRecipe(e.target.value);
}

function previewRecipe(recipeKey) {
    const previewContainer = document.getElementById('recipePreviewContainer');
    if (!previewContainer) return;
    const recipe = CRAFT_RECIPES[recipeKey];

    if (!recipe) {
        previewContainer.innerHTML = '<p class="text-muted text-center">Selecciona una receta arriba.</p>';
        return;
    }

    previewContainer.innerHTML = `
        <div class="card text-center">
            <div class="d-flex justify-content-center align-items-center gap-2 mb-3">
                <i class="fa-solid ${recipe.iconClass} text-cyan fs-2"></i>
                <h3>${recipe.name}</h3>
            </div>
            <div class="materials-preview-grid mb-3">
                ${recipe.materials.map(mat => `
                    <div class="mat-preview-item">
                        <div class="d-flex align-items-center gap-2">
                            <i class="fa-solid ${mat.iconClass} text-purple"></i>
                            <span>${mat.name}</span>
                        </div>
                        <strong>x${mat.required}</strong>
                    </div>
                `).join('')}
            </div>
            <div class="d-flex justify-content-center gap-2">
                <button class="btn btn-primary btn-lg" onclick="window.startFarmProject('${recipeKey}')"><i class="fa-solid fa-play"></i> Empezar Farm</button>
            </div>
        </div>
    `;
}

window.startFarmProject = async (recipeKey) => {
    const user = auth.currentUser;
    if (!user) return alert("Inicia sesión primero.");
    const recipe = CRAFT_RECIPES[recipeKey];
    const initialProgress = {};
    recipe.materials.forEach(mat => initialProgress[mat.id] = 0);

    try {
        await addDoc(collection(db, 'users', user.uid, 'crafting_projects'), {
            recipeKey, itemName: recipe.name, grade: recipe.grade, progress: initialProgress, status: 'active', createdAt: serverTimestamp()
        });
    } catch (e) {
        console.error("Error creando proyecto de craft:", e);
    }
};

export function renderActiveProjects() {
    const container = document.getElementById('activeCraftProjects');
    if (!container) return;

    if (activeProjects.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4"><p>No tienes metas de farm activas.</p></div>';
        return;
    }

    container.innerHTML = activeProjects.map(project => {
        const recipe = CRAFT_RECIPES[project.recipeKey];
        if (!recipe) return '';

        let totalReq = 0, totalCur = 0;
        recipe.materials.forEach(mat => {
            totalReq += mat.required;
            totalCur += Math.min(project.progress[mat.id] || 0, mat.required);
        });
        const percent = Math.min(100, Math.round((totalCur / totalReq) * 100));
        const isComplete = percent === 100;

        return `
            <div class="card mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-2">
                        <i class="fa-solid ${recipe.iconClass} text-cyan"></i>
                        <h3>${recipe.itemName}</h3>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="text-cyan font-mono fw-bold">${percent}%</span>
                        <button class="btn-icon danger" onclick="window.deleteCraftProject('${project.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>

                <div class="progress-bar-container">
                    <div class="progress-bar-fill ${isComplete ? 'complete' : ''}" style="width: ${percent}%"></div>
                </div>

                ${isComplete && !project.result ? `
                    <div class="craft-result-options text-center my-2 p-2 card border-cyan">
                        <p class="mb-2 fw-bold text-gold">¡Meta 100% Alcanzada! Registra el resultado del crafteo:</p>
                        <div class="d-flex justify-content-center gap-2">
                            <button class="btn btn-success" onclick="window.setCraftResult('${project.id}', 'success')"><i class="fa-solid fa-check"></i> Success</button>
                            <button class="btn btn-danger-craft" onclick="window.setCraftResult('${project.id}', 'fail')"><i class="fa-solid fa-xmark"></i> Fail</button>
                        </div>
                    </div>
                ` : ''}

                ${project.result ? `
                    <div class="text-center my-1">
                        <span class="badge ${project.result === 'success' ? 'badge-green' : 'badge-purple'}">
                            Resultado: ${project.result.toUpperCase()}
                        </span>
                    </div>
                ` : ''}

                <div class="materials-tracker-list mt-2">
                    ${recipe.materials.map(mat => {
                        const cur = project.progress[mat.id] || 0;
                        return `
                            <div class="mat-tracker-row">
                                <div class="d-flex align-items-center gap-2">
                                    <i class="fa-solid ${mat.iconClass} text-cyan"></i>
                                    <span class="fs-sm">${mat.name} (${cur}/${mat.required})</span>
                                </div>
                                <div class="mat-add-wrap">
                                    <input type="number" id="input-${project.id}-${mat.id}" class="form-control mat-input-sm" placeholder="0" min="0">
                                    <button class="btn btn-outline btn-sm" onclick="window.addMaterialAmount('${project.id}', '${mat.id}', ${cur},${mat.required})">+ Agregar</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="d-flex justify-content-end gap-2 mt-3">
                    <button class="btn btn-outline btn-sm" onclick="window.navigateTo('dashboard')"><i class="fa-solid fa-arrow-left"></i> Volver atrás</button>
                    <button class="btn btn-primary btn-sm" onclick="alert('Avance guardado correctamente.')"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
                </div>
            </div>
        `;
    }).join('');
}

window.addMaterialAmount = async (projectId, matId, currentVal, requiredVal) => {
    const user = auth.currentUser;
    if (!user) return;
    const inputEl = document.getElementById(`input-${projectId}-${matId}`);
    if (!inputEl) return;

    const addVal = parseInt(inputEl.value, 10) || 0;
    if (addVal <= 0) return;

    const newVal = currentVal + addVal;

    try {
        const projectRef = doc(db, 'users', user.uid, 'crafting_projects', projectId);
        await updateDoc(projectRef, {
            [`progress.${matId}`]: newVal
        });
        inputEl.value = '';
        checkProjectCompletion(projectId);
    } catch (e) {
        console.error("Error al actualizar material:", e);
    }
};

function checkProjectCompletion(projectId) {
    const target = activeProjects.find(p => p.id === projectId);
    if (!target) return;
    const recipe = CRAFT_RECIPES[target.recipeKey];
    if (!recipe) return;

    let totalReq = 0, totalCur = 0;
    recipe.materials.forEach(mat => {
        totalReq += mat.required;
        totalCur += Math.min(target.progress[mat.id] || 0, mat.required);
    });

    if (totalCur >= totalReq) {
        const overlay = document.getElementById('celebrationOverlay');
        if (overlay) overlay.style.display = 'flex';
    }
}

window.setCraftResult = async (projectId, resultType) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await updateDoc(doc(db, 'users', user.uid, 'crafting_projects', projectId), {
            result: resultType
        });
    } catch (e) {
        console.error("Error registrando resultado de craft:", e);
    }
};

window.deleteCraftProject = async (projectId) => {
    const user = auth.currentUser;
    if (user && confirm("¿Eliminar proyecto?")) {
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'crafting_projects', projectId));
        } catch (e) {
            console.error("Error borrando proyecto:", e);
        }
    }
};