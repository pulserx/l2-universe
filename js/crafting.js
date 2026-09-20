import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, deleteDoc, doc, onSnapshot, query, updateDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const CRAFT_RECIPES = {
    'draconic_armor': {
        name: 'Draconic Leather Armor', grade: 'S', icon: 'fa-shield-halved',
        materials: [
            { id: 'recipe', name: 'Recipe: Draconic Leather Armor (60%)', required: 1 },
            { id: 'key_part', name: 'Draconic Leather Armor Texture', required: 15 },
            { id: 'mold_hardener', name: 'Mold Hardener', required: 17 },
            { id: 'enria', name: 'Enria', required: 34 },
            { id: 'asofe', name: 'Asofe', required: 34 }
        ]
    },
    'angel_slayer': {
        name: 'Angel Slayer', grade: 'S', icon: 'fa-wand-magic-sparkles',
        materials: [
            { id: 'recipe', name: 'Recipe: Angel Slayer (60%)', required: 1 },
            { id: 'key_part', name: 'Angel Slayer Blade', required: 17 },
            { id: 'gem_s', name: 'Gemstone S', required: 70 },
            { id: 'crystal_s', name: 'Crystal: S-Grade', required: 235 }
        ]
    }
};

let craftingUnsubscribe = null;
let activeProjects = [];

export function initCraftingManager(user) {
    if (craftingUnsubscribe) craftingUnsubscribe();
    renderRecipeSelector();

    if (!user) {
        activeProjects = [];
        renderActiveProjects();
        return;
    }

    const projectsRef = collection(db, 'users', user.uid, 'crafting_projects');
    craftingUnsubscribe = onSnapshot(query(projectsRef), (snapshot) => {
        activeProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderActiveProjects();
    });
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
        <div class="card">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h3><i class="fa-solid ${recipe.icon} text-cyan"></i> ${recipe.name}</h3>
                <button class="btn btn-primary" onclick="window.startFarmProject('${recipeKey}')"><i class="fa-solid fa-wheat-awn"></i> Empezar Farm</button>
            </div>
            <div class="materials-preview-grid">
                ${recipe.materials.map(mat => `<div class="mat-preview-item"><span>${mat.name}</span><strong>x${mat.required}</strong></div>`).join('')}
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

    await addDoc(collection(db, 'users', user.uid, 'crafting_projects'), {
        recipeKey, itemName: recipe.name, grade: recipe.grade, progress: initialProgress, createdAt: serverTimestamp()
    });
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

        return `
            <div class="card mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <h3>${recipe.itemName}</h3>
                    <div>
                        <span class="text-cyan font-mono fw-bold me-2">${percent}%</span>
                        <button class="btn-icon danger" onclick="window.deleteCraftProject('${project.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill ${percent === 100 ? 'complete' : ''}" style="width: ${percent}%"></div>
                </div>
                <div class="materials-preview-grid mt-2">
                    ${recipe.materials.map(mat => {
                        const cur = project.progress[mat.id] || 0;
                        return `
                            <div class="mat-preview-item">
                                <span>${mat.name}</span>
                                <input type="number" class="form-control" style="width: 70px; padding:2px;" value="${cur}" onchange="window.updateMaterialProgress('${project.id}', '${mat.id}', this.value)">
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

window.updateMaterialProgress = async (projectId, matId, value) => {
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'crafting_projects', projectId), {
        [`progress.${matId}`]: Math.max(0, parseInt(value, 10) || 0)
    });
};

window.deleteCraftProject = async (projectId) => {
    const user = auth.currentUser;
    if (user && confirm("¿Eliminar proyecto?")) {
        await deleteDoc(doc(db, 'users', user.uid, 'crafting_projects', projectId));
    }
};