export const RAID_BOSSES_DB = [
    {
        name: 'Flame of Splendor Anais (Barakiel)', level: 80, location: 'Valley of Saints', respawnTime: '12h - 24h',
        description: 'Requerido para la Quest de Noblesse.', strategy: 'Enfocar DPS directo y controlar los guardaespaldas.',
        drops: ['Staff of Goddess Part', 'S-Grade Enchants'], icon: 'fa-fire-flame-curved', color: '#f59e0b'
    },
    {
        name: 'Golkonda, Longhorn', level: 87, location: 'TOI Piso 11', respawnTime: '24h - 36h',
        description: 'Requerido para la Quest de Subclase.', strategy: 'Cuidado con sus ataques AoE Knockback.',
        drops: ['Infernium Scepter', 'Imperial Crusader Parts'], icon: 'fa-skull-crossbones', color: '#ef4444'
    }
];

export function initRaidsManager() {
    renderRaidBosses();
}

export function renderRaidBosses() {
    const grid = document.getElementById('raidsGrid');
    if (!grid) return;

    grid.innerHTML = RAID_BOSSES_DB.map(rb => `
        <div class="card">
            <span class="badge" style="background:${rb.color}20; color:${rb.color}">${rb.level}</span>
            <h3 class="mt-1"><i class="fa-solid ${rb.icon}" style="color:${rb.color}"></i> ${rb.name}</h3>
            <p class="text-muted mt-1">${rb.location} | Respawn: ${rb.respawnTime}</p>
            <p class="mt-2">${rb.description}</p>
        </div>
    `).join('');
}