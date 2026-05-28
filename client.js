const socket = io();
const clock = new THREE.Clock();

let isOnlineMode = false;
let gameActive = false;
let maxPlayersLimit = 4;
let isDead = false;
let respawnTimer = null;
let respawnCountdown = 15;
let lastTeleportTime = 0;
const teleportCooldown = 3;

// 3D SAHNE AYARLARI
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 100, 350);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// IŞIKLANDIRMA
const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.65);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff5e6, 0.95);
sunLight.position.set(80, 100, 60);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -120;
sunLight.shadow.camera.right = 120;
sunLight.shadow.camera.top = 120;
sunLight.shadow.camera.bottom = -120;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.0004;
scene.add(sunLight);

const gameplayGroup = new THREE.Group();
scene.add(gameplayGroup);

const obstacles = [];
const portals = [];

// --- YARDIMCI FONKSİYONLAR (YUMUŞAK HATLI) ---
function createSoftGround(x, z, radius, color = 0x8cc63e) {
    const geo = new THREE.CircleGeometry(radius, 64);
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    gameplayGroup.add(mesh);
    return mesh;
}

function createSoftHill(x, z, radius, height, color = 0x7ba428) {
    const geo = new THREE.ConeGeometry(radius, height, 32, 8);
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9 });
    const hill = new THREE.Mesh(geo, mat);
    hill.position.set(x, height / 2, z);
    hill.receiveShadow = true; hill.castShadow = true;
    gameplayGroup.add(hill);
    obstacles.push(hill);
    return hill;
}

function createSoftRock(x, z, radius = 0.9, height = 0.7) {
    const geo = new THREE.CylinderGeometry(radius * 0.85, radius, height, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.4, metalness: 0.15 });
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(x, height / 2, z);
    rock.castShadow = true; rock.receiveShadow = true;
    gameplayGroup.add(rock);
    obstacles.push(rock);
    return rock;
}

function createSoftTree(x, z, scale = 1) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.28 * scale, 0.38 * scale, 2.5 * scale, 16);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.6 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25 * scale; trunk.castShadow = true; trunk.receiveShadow = true;
    group.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a8f29, roughness: 0.35 });
    for (let i = 0; i < 4; i++) {
        const sGeo = new THREE.SphereGeometry(0.7 * scale - i * 0.1, 16, 12);
        const s = new THREE.Mesh(sGeo, leafMat);
        s.position.set((Math.random() - 0.5) * 0.5 * scale, 2.1 * scale + i * 0.5 * scale, (Math.random() - 0.5) * 0.5 * scale);
        s.castShadow = true; s.receiveShadow = true;
        group.add(s);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(trunk);
    return group;
}

function createSoftBush(x, z, scale = 1) {
    const group = new THREE.Group();
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3a6b1e, roughness: 0.55 });
    for (let i = 0; i < 5; i++) {
        const sGeo = new THREE.SphereGeometry(0.35 * scale, 8, 6);
        const s = new THREE.Mesh(sGeo, bushMat);
        s.position.set((Math.random() - 0.5) * 0.6 * scale, 0.2 * scale, (Math.random() - 0.5) * 0.6 * scale);
        s.castShadow = true; s.receiveShadow = true;
        group.add(s);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createSoftFlower(x, z, color = 0xffaa88) {
    const group = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.5, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.25; group.add(stem);
    const headGeo = new THREE.SphereGeometry(0.18, 8, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.25 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.6; group.add(head);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createSoftPond(x, z, radius = 2.0) {
    const group = new THREE.Group();
    const pondGeo = new THREE.CircleGeometry(radius, 48);
    const pondMat = new THREE.MeshStandardMaterial({ color: 0x4499dd, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.7 });
    const pond = new THREE.Mesh(pondGeo, pondMat);
    pond.rotation.x = -Math.PI / 2; pond.position.y = 0.04;
    group.add(pond);
    for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const stoneGeo = new THREE.SphereGeometry(0.2, 6, 4);
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.5 });
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.set(Math.cos(angle) * radius, 0.1, Math.sin(angle) * radius);
        stone.castShadow = true; stone.receiveShadow = true;
        group.add(stone);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createSoftMushroom(x, z, scale = 1, color = 0xff5555) {
    const group = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.22 * scale, 0.28 * scale, 1.8 * scale, 12);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xf5e6d3, roughness: 0.6 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.9 * scale; stem.castShadow = true; stem.receiveShadow = true;
    group.add(stem);
    const capGeo = new THREE.SphereGeometry(0.7 * scale, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 1.8 * scale; cap.castShadow = true; cap.receiveShadow = true;
    group.add(cap);
    for (let i = 0; i < 6; i++) {
        const dotGeo = new THREE.SphereGeometry(0.1 * scale, 4, 4);
        const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        const angle = (i / 6) * Math.PI * 2;
        dot.position.set(Math.cos(angle) * 0.45 * scale, 2.05 * scale, Math.sin(angle) * 0.45 * scale);
        group.add(dot);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(stem);
    return group;
}

function createMushroomHouse(x, z, colorRoof = 0xff6666) {
    const group = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(1.1, 1.3, 2.2, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.55 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.1; body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    const roofGeo = new THREE.SphereGeometry(1.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const roofMat = new THREE.MeshStandardMaterial({ color: colorRoof, roughness: 0.28, metalness: 0.1 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 2.2; roof.castShadow = true; roof.receiveShadow = true;
    group.add(roof);
    const doorGeo = new THREE.BoxGeometry(0.55, 1.0, 0.15);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.5 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 0.65, 1.35); group.add(door);
    const windowGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, roughness: 0.2 });
    const winL = new THREE.Mesh(windowGeo, windowMat);
    winL.rotation.x = Math.PI / 2; winL.position.set(0.65, 1.3, 1.3); group.add(winL);
    const winR = new THREE.Mesh(windowGeo, windowMat);
    winR.rotation.x = Math.PI / 2; winR.position.set(-0.65, 1.3, 1.3); group.add(winR);
    for (let i = 0; i < 8; i++) {
        const dotGeo = new THREE.SphereGeometry(0.14, 4, 4);
        const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        const angle = (i / 8) * Math.PI * 2;
        dot.position.set(Math.cos(angle) * 0.9, 2.7, Math.sin(angle) * 0.9);
        group.add(dot);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(group);
    return group;
}

function createSoftBench(x, z, rotY = 0) {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.65 });
    const seatGeo = new THREE.BoxGeometry(1.5, 0.12, 0.55);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = 0.45; seat.castShadow = true; seat.receiveShadow = true;
    group.add(seat);
    for (let i = -1; i <= 1; i += 2) {
        const legGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.45, 8);
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(i * 0.6, 0.225, 0.15); group.add(leg);
        const leg2 = new THREE.Mesh(legGeo, woodMat);
        leg2.position.set(i * 0.6, 0.225, -0.15); group.add(leg2);
    }
    const backGeo = new THREE.BoxGeometry(1.5, 0.35, 0.08);
    const back = new THREE.Mesh(backGeo, woodMat);
    back.position.set(0, 0.68, -0.22); back.castShadow = true;
    group.add(back);
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    gameplayGroup.add(group);
    obstacles.push(group);
    return group;
}

function createPortalRing(x, z, targetX, targetZ, color = 0x00ffff) {
    const group = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(0.9, 0.1, 16, 40);
    const ringMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.7, roughness: 0.2 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.15;
    group.add(ring);
    const innerGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.0, 16);
    const innerMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.3, transparent: true, opacity: 0.3 });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = 1.0;
    group.add(inner);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    portals.push({ mesh: group, target: new THREE.Vector3(targetX, 0, targetZ), color: color });
    return group;
}

// ============ BAŞLANGIÇ ADASI (SBA'NIN AYNISI) ============
createSoftGround(0, 0, 22, 0x8cc63e);
createSoftHill(0, 0, 11, 1.1, 0x8cc63e);
createSoftHill(-4, -4, 7, 0.8, 0x90c84a);
createSoftHill(5, 3, 8, 0.9, 0x8bc840);
createSoftHill(-5, 5, 6, 0.7, 0x92ca4c);

// Merkez büyük ağaç
createSoftTree(0, 0, 1.3);

// Gölet (ağacın yanında)
createSoftPond(2, -2, 1.5);

// Üç mantar ev (SBA'daki gibi)
createMushroomHouse(-6, -5, 0xff6666);
createMushroomHouse(7, 3, 0xffaa44);
createMushroomHouse(-6, 6, 0xff66aa);

// Diğer ağaçlar
createSoftTree(-9, -9, 0.9);
createSoftTree(10, -8, 0.85);
createSoftTree(-8, 10, 0.95);
createSoftTree(9, 9, 0.9);
createSoftTree(-10, 2, 0.8);
createSoftTree(11, -2, 0.85);
createSoftTree(3, -10, 0.9);
createSoftTree(-3, 10, 0.85);

// Küçük mantarlar
createSoftMushroom(-3, -3, 0.9, 0xff6666);
createSoftMushroom(5, -4, 0.8, 0xffaa44);
createSoftMushroom(-5, 3, 1.0, 0xff44ff);
createSoftMushroom(4, 5, 0.85, 0x66ff66);

// Taş platformlar
createSoftRock(-4, -5, 0.9, 0.7);
createSoftRock(5, -3, 0.8, 0.6);
createSoftRock(-5, 5, 1.0, 0.8);
createSoftRock(5, 4, 0.9, 0.7);
createSoftRock(-2, -7, 1.0, 0.9);
createSoftRock(3, 7, 0.8, 0.6);

// Banklar
createSoftBench(6, 5, -0.5);
createSoftBench(-5, -5, 0.7);
createSoftBench(0, -7, 0.2);

// Çalılar
for (let i = 0; i < 35; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 6 + Math.random() * 12;
    createSoftBush(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.6 + Math.random() * 0.8);
}

// Çiçekler
for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 14;
    createSoftFlower(Math.cos(angle) * radius, Math.sin(angle) * radius, [0xffaa88, 0xffcc44, 0xff6699, 0xff8844, 0xffff66][Math.floor(Math.random() * 5)]);
}

// Portallar
createPortalRing(0, -16, 0, -250, 0xff8844);
createPortalRing(16, 0, 250, 0, 0x44ff44);
createPortalRing(-16, 0, -250, 0, 0xff4444);
createPortalRing(0, 16, 0, 250, 0x44ffff);
createPortalRing(12, -12, 180, -180, 0xcc44ff);
createPortalRing(-12, 12, -180, 180, 0xffaa00);

// ============ DİĞER ADALAR (kaliteli) ============
// Kar
const sx = 0, sz = 250;
createSoftGround(sx, sz, 25, 0xe0f0ff);
createSoftHill(sx + 5, sz - 5, 4, 1.8, 0xd0e8ff);
createSoftHill(sx - 7, sz + 4, 3.5, 1.5, 0xd0e8ff);
for (let i = 0; i < 15; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 16;
    const tree = createSoftTree(sx + Math.cos(a) * r, sz + Math.sin(a) * r, 0.8 + Math.random() * 0.6);
    tree.children[0].material.color.set(0x6B4226);
}
for (let i = 0; i < 25; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 14;
    const iceGeo = new THREE.SphereGeometry(0.3 + Math.random() * 0.5, 6, 4);
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, roughness: 0.1, metalness: 0.3 });
    const ice = new THREE.Mesh(iceGeo, iceMat);
    ice.position.set(sx + Math.cos(a) * r, 0.2, sz + Math.sin(a) * r);
    ice.castShadow = true; ice.receiveShadow = true;
    gameplayGroup.add(ice);
    obstacles.push(ice);
}
createPortalRing(sx, sz - 16, 0, 10, 0x44ffff);

// Çöl
const dx = 0, dz = -250;
createSoftGround(dx, dz, 28, 0xedc9af);
createSoftHill(dx + 3, dz - 3, 5, 2, 0xddb89a);
createSoftHill(dx - 6, dz + 5, 4, 1.8, 0xddb89a);
for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 16;
    const cg = new THREE.Group();
    const tGeo = new THREE.CylinderGeometry(0.2, 0.25, 2.5, 8);
    const tMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.7 });
    const t = new THREE.Mesh(tGeo, tMat);
    t.position.y = 1.25; t.castShadow = true; t.receiveShadow = true;
    cg.add(t);
    for (let j = 0; j < 3; j++) {
        const armGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6);
        const arm = new THREE.Mesh(armGeo, tMat);
        arm.position.set((Math.random() - 0.5) * 0.6, 1.0 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6);
        arm.rotation.z = (Math.random() - 0.5) * 0.8; arm.rotation.x = (Math.random() - 0.5) * 0.8;
        arm.castShadow = true;
        cg.add(arm);
    }
    cg.position.set(dx + Math.cos(a) * r, 0, dz + Math.sin(a) * r);
    gameplayGroup.add(cg);
    obstacles.push(t);
}
createPortalRing(dx, dz + 16, 0, -10, 0xff8844);

// Mantar
const mx = 250, mz = 0;
createSoftGround(mx, mz, 25, 0x7a5c8a);
createSoftHill(mx - 4, mz - 4, 3, 1.5, 0x6a4c7a);
createSoftHill(mx + 6, mz + 5, 3.5, 1.8, 0x6a4c7a);
for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 16;
    const stGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.0 + Math.random() * 2.5, 8);
    const stMat = new THREE.MeshStandardMaterial({ color: 0xf5e6d3, roughness: 0.6 });
    const st = new THREE.Mesh(stGeo, stMat);
    st.position.y = 1.2; st.castShadow = true; st.receiveShadow = true;
    const cpGeo = new THREE.SphereGeometry(0.9 + Math.random() * 0.8, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const cpMat = new THREE.MeshStandardMaterial({ color: [0xff5555, 0x55ff55, 0x5555ff, 0xff55ff][Math.floor(Math.random() * 4)], roughness: 0.3 });
    const cp = new THREE.Mesh(cpGeo, cpMat);
    cp.position.y = st.position.y + 1.5; cp.castShadow = true;
    const mg = new THREE.Group();
    mg.add(st); mg.add(cp);
    mg.position.set(mx + Math.cos(a) * r, 0, mz + Math.sin(a) * r);
    gameplayGroup.add(mg);
    obstacles.push(st);
}
createPortalRing(mx - 16, mz, 10, 0, 0x44ff44);

// Volkan
const vx = -250, vz = 0;
createSoftGround(vx, vz, 25, 0x3a3a3a);
createSoftHill(vx + 5, vz - 5, 4, 2, 0x2a2a2a);
createSoftHill(vx - 7, vz + 4, 3.5, 1.5, 0x2a2a2a);
for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = 12 + Math.random() * 10;
    const pGeo = new THREE.CircleGeometry(2 + Math.random() * 2, 32);
    const pMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.9, roughness: 0.2 });
    const p = new THREE.Mesh(pGeo, pMat);
    p.rotation.x = -Math.PI / 2; p.position.set(vx + Math.cos(a) * r, 0.05, vz + Math.sin(a) * r);
    gameplayGroup.add(p);
}
for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 14;
    const rGeo = new THREE.SphereGeometry(0.6 + Math.random() * 1.0, 6, 4);
    const rMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const rk = new THREE.Mesh(rGeo, rMat);
    rk.position.set(vx + Math.cos(a) * r, 0.3, vz + Math.sin(a) * r);
    rk.castShadow = true; rk.receiveShadow = true;
    gameplayGroup.add(rk);
    obstacles.push(rk);
}
createPortalRing(vx + 16, vz, -10, 0, 0xff4444);

// Kristal
const cx = 180, cz = -180;
createSoftGround(cx, cz, 22, 0x2a1a3a);
createSoftHill(cx - 3, cz + 3, 3, 1.5, 0x1a0a2a);
for (let i = 0; i < 25; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 14;
    const crGeo = new THREE.OctahedronGeometry(0.4 + Math.random() * 0.7, 0);
    const crMat = new THREE.MeshStandardMaterial({ color: 0xcc88ff, roughness: 0.2, metalness: 0.4, emissive: 0x220044, emissiveIntensity: 0.5 });
    const cr = new THREE.Mesh(crGeo, crMat);
    cr.position.set(cx + Math.cos(a) * r, 0.4, cz + Math.sin(a) * r);
    cr.castShadow = true; cr.receiveShadow = true;
    cr.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    gameplayGroup.add(cr);
    obstacles.push(cr);
}
createPortalRing(cx - 12, cz + 12, 10, -10, 0xcc44ff);

// Harabe
const hx = -180, hz = 180;
createSoftGround(hx, hz, 22, 0x8b7d6b);
createSoftHill(hx + 4, hz - 4, 3.5, 1.8, 0x7b6d5b);
for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = 10 + Math.random() * 9;
    const piGeo = new THREE.CylinderGeometry(0.4, 0.5, 3.0 + Math.random() * 2.5, 8);
    const piMat = new THREE.MeshStandardMaterial({ color: 0xccbbaa, roughness: 0.7 });
    const pi = new THREE.Mesh(piGeo, piMat);
    pi.position.set(hx + Math.cos(a) * r, 1.5, hz + Math.sin(a) * r);
    pi.castShadow = true; pi.receiveShadow = true;
    gameplayGroup.add(pi);
    obstacles.push(pi);
}
createPortalRing(hx + 12, hz - 12, -10, 10, 0xffaa00);

// --- LOBİ (aynı) ---
const lobbyGroup = new THREE.Group();
scene.add(lobbyGroup);
const cylGeo = new THREE.CylinderGeometry(12, 12, 15, 32, 1, true);
const cylMat = new THREE.MeshStandardMaterial({ color: 0x00a2ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1 });
const lobbyRoom = new THREE.Mesh(cylGeo, cylMat);
lobbyRoom.position.set(0, 7.5, 50);
lobbyGroup.add(lobbyRoom);
const lfGeo = new THREE.CylinderGeometry(12, 12, 0.5, 32);
const lfMat = new THREE.MeshStandardMaterial({ color: 0x0d47a1, roughness: 0.5 });
const lfMesh = new THREE.Mesh(lfGeo, lfMat);
lfMesh.position.set(0, -0.25, 50);
lobbyGroup.add(lfMesh);
const pads = [];
const padPos = [{ x: 0, z: 47.5 }, { x: -3.5, z: 49.5 }, { x: 3.5, z: 49.5 }, { x: 0, z: 52.0 }];
for (let i = 0; i < 4; i++) {
    const pdGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.2, 24);
    const pdMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6, roughness: 0.1 });
    const pd = new THREE.Mesh(pdGeo, pdMat);
    pd.position.set(padPos[i].x, 0.1, padPos[i].z);
    lobbyGroup.add(pd);
    pads.push(pd);
}

// MODEL FABRİKASI
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const otherBodyMat = new THREE.MeshStandardMaterial({ color: 0xddf0ff });
const noseMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
function createRabbitModel(isLocal = false) {
    const group = new THREE.Group(); const visualGroup = new THREE.Group(); group.add(visualGroup);
    const currentMat = isLocal ? bodyMat : otherBodyMat;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.75), currentMat); body.position.y = 0.4; body.castShadow = true; visualGroup.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), currentMat); head.position.y = 0.95; head.position.z = 0.1; head.castShadow = true; visualGroup.add(head);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), noseMat); nose.position.y = -0.05; nose.position.z = 0.33; head.add(nose);
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.18, 0.1, 0.25); head.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.18, 0.1, 0.25); head.add(eyeR);
    const earGeo = new THREE.BoxGeometry(0.12, 0.55, 0.06);
    const earL = new THREE.Mesh(earGeo, currentMat); earL.position.set(-0.16, 0.45, -0.05); head.add(earL);
    const earR = new THREE.Mesh(earGeo, currentMat); earR.position.set(0.16, 0.45, -0.05); head.add(earR);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), currentMat); tail.position.set(0, 0.25, -0.4); visualGroup.add(tail);
    const footGeo = new THREE.BoxGeometry(0.24, 0.16, 0.34); const footMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const fFL = new THREE.Mesh(footGeo, footMat); fFL.position.set(-0.32, 0.08, 0.22); group.add(fFL);
    const fFR = new THREE.Mesh(footGeo, footMat); fFR.position.set(0.32, 0.08, 0.22); group.add(fFR);
    const fBL = new THREE.Mesh(footGeo, footMat); fBL.position.set(-0.32, -0.08, -0.22); group.add(fBL);
    const fBR = new THREE.Mesh(footGeo, footMat); fBR.position.set(0.32, -0.08, -0.22); group.add(fBR);
    return { mesh: group, visual: visualGroup, head: head, feet: [fFL, fFR, fBL, fBR] };
}
const localPlayer = createRabbitModel(true);
const rabbit = localPlayer.mesh; const rabbitVisualGroup = localPlayer.visual; const head = localPlayer.head;
const [footFL, footFR, footBL, footBR] = localPlayer.feet;
scene.add(rabbit);

let otherPlayers = {};
let isAttacking = false, attackAnimTime = 0;
let myHealth = 100; const maxHealth = 100;

function updateHealthBar() {
    const percent = (myHealth / maxHealth) * 100;
    document.getElementById('health-bar-fill').style.width = percent + '%';
    document.getElementById('health-text').innerText = myHealth + '/' + maxHealth;
    if (percent > 60) document.getElementById('health-bar-fill').style.background = 'linear-gradient(90deg, #4caf50, #8bc34a)';
    else if (percent > 30) document.getElementById('health-bar-fill').style.background = 'linear-gradient(90deg, #ff9800, #ffc107)';
    else document.getElementById('health-bar-fill').style.background = 'linear-gradient(90deg, #f44336, #ff5722)';
}
function die() {
    if (isDead) return;
    isDead = true; gameActive = false; rabbit.visible = false;
    document.getElementById('death-screen').style.display = 'flex';
    respawnCountdown = 15; document.getElementById('countdown-display').innerText = respawnCountdown;
    respawnTimer = setInterval(() => { respawnCountdown--; document.getElementById('countdown-display').innerText = respawnCountdown; if (respawnCountdown <= 0) { clearInterval(respawnTimer); respawn(); } }, 1000);
}
function respawn() {
    isDead = false; gameActive = true; rabbit.visible = true;
    rabbit.position.set(0, 0, 0); rabbit.rotation.y = 0;
    myHealth = maxHealth; updateHealthBar();
    document.getElementById('death-screen').style.display = 'none';
    velocityY = 0; jumpCount = 0;
}

function checkCollision(newX, newY, newZ) {
    if (!gameActive) return false;
    const playerBox = new THREE.Box3(new THREE.Vector3(newX - 0.28, newY + 0.15, newZ - 0.28), new THREE.Vector3(newX + 0.28, newY + 1.1, newZ + 0.28));
    gameplayGroup.updateMatrixWorld(true);
    for (let i = 0; i < obstacles.length; i++) {
        let obj = obstacles[i];
        if (!obj || !obj.parent) continue;
        let obstacleBox = new THREE.Box3().setFromObject(obj);
        if (playerBox.intersectsBox(obstacleBox)) { if (newY >= obstacleBox.max.y - 0.3) continue; return true; }
    }
    return false;
}
function getFloorY(pX, pY, pZ) {
    gameplayGroup.updateMatrixWorld(true);
    let highestCeil = 0;
    for (let i = 0; i < obstacles.length; i++) {
        let obj = obstacles[i];
        if (!obj || !obj.parent) continue;
        let box = new THREE.Box3().setFromObject(obj);
        if (pX + 0.25 >= box.min.x && pX - 0.25 <= box.max.x && pZ + 0.25 >= box.min.z && pZ - 0.25 <= box.max.z) {
            if (pY >= box.max.y - 0.4 && box.max.y > highestCeil) highestCeil = box.max.y;
        }
    }
    return highestCeil;
}
let velocityY = 0, jumpCount = 0;
const gravity = 0.8, jumpForce = 18;

window.playSolo = function() {
    isOnlineMode = false; gameActive = true;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('controls-ui').style.display = 'block';
    document.getElementById('game-info-ui').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';
    document.getElementById('game-room-title').innerText = "TEK OYUNCULU";
    document.getElementById('game-player-count').innerText = "1";
    lobbyGroup.visible = false; gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0); rabbit.rotation.y = 0;
    myHealth = maxHealth; updateHealthBar();
    gameplayGroup.updateMatrixWorld(true);
};
window.createRoom = function() { isOnlineMode = true; socket.emit('createRoom', { maxPlayers: 4 }); };
window.joinRoom = function() { const code = document.getElementById('room-code-input').value.trim(); if(code.length === 5) { isOnlineMode = true; socket.emit('joinRoom', code); } };
window.hostStartGame = function() { socket.emit('startGameSignal'); };

socket.on('roomCreated', (d) => { setupLobbyUI(d); });
socket.on('roomUpdate', (d) => { setupLobbyUI(d); });
function setupLobbyUI(d) {
    maxPlayersLimit = d.maxPlayers;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-ui').style.display = 'block';
    document.getElementById('ui-room-code').innerText = d.roomCode;
    const cc = Object.keys(d.players).length;
    document.getElementById('ui-player-count').innerText = `Oyuncu: ${cc} / ${maxPlayersLimit}`;
    if (d.hostId === socket.id) { document.getElementById('ui-start-btn').style.display = 'block'; document.getElementById('ui-waiting-msg').style.display = 'none'; }
    else { document.getElementById('ui-start-btn').style.display = 'none'; document.getElementById('ui-waiting-msg').style.display = 'block'; }
    gameplayGroup.visible = false; lobbyGroup.visible = true;
    rabbit.position.set(padPos[0].x, 0.2, padPos[0].z);
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    let pi = 1;
    Object.keys(d.players).forEach((id) => { if (id !== socket.id && pi < 4) { const pos = padPos[pi]; addOtherPlayer(id, pos.x, 0.2, pos.z); pi++; } });
}
socket.on('gameStartedAtAll', (ap) => {
    document.getElementById('lobby-ui').style.display = 'none';
    document.getElementById('controls-ui').style.display = 'block';
    document.getElementById('game-info-ui').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';
    document.getElementById('game-room-title').innerText = "ODA: " + document.getElementById('ui-room-code').innerText;
    document.getElementById('game-player-count').innerText = Object.keys(ap).length;
    lobbyGroup.visible = false; gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0); rabbit.rotation.y = 0;
    myHealth = maxHealth; updateHealthBar();
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    Object.keys(ap).forEach((id) => { if (id !== socket.id) addOtherPlayer(id, 0, 0, 0); });
    gameActive = true; isDead = false;
    gameplayGroup.updateMatrixWorld(true);
});
function addOtherPlayer(id, x, y, z) {
    if (otherPlayers[id]) return;
    const md = createRabbitModel(false);
    md.mesh.position.set(x, y, z); scene.add(md.mesh);
    otherPlayers[id] = { mesh: md.mesh, visual: md.visual, head: md.head, isAttacking: false, attackAnimTime: 0 };
}
socket.on('playerMoved', (pi) => { if (gameActive && otherPlayers[pi.id]) { otherPlayers[pi.id].mesh.position.set(pi.x, pi.y, pi.z); otherPlayers[pi.id].mesh.rotation.y = pi.ry; } });
socket.on('playerAttacked', (id) => { if (gameActive && otherPlayers[id]) { otherPlayers[id].isAttacking = true; otherPlayers[id].attackAnimTime = 0; } });
socket.on('knockback', (angle) => { if (!gameActive || isDead) return; rabbit.position.x += Math.sin(angle) * 2.0; rabbit.position.z += Math.cos(angle) * 2.0; socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y }); });
socket.on('playerDisconnected', (id) => { if (otherPlayers[id]) { scene.remove(otherPlayers[id].mesh); delete otherPlayers[id]; } });
socket.on('hostDisconnected', () => { alert('Oda sahibi ayrıldı.'); location.reload(); });

// KONTROLLER
const zone = document.getElementById('joystick-zone'), stick = document.getElementById('joystick-stick'), maxRadius = 35;
let joystickActive = false, moveX = 0, moveZ = 0;
zone.addEventListener('touchstart', (e) => { if(!gameActive || isDead) return; joystickActive = true; handleJoystick(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
window.addEventListener('touchmove', (e) => { if (joystickActive && gameActive && !isDead) { for (let i = 0; i < e.touches.length; i++) { if (zone.contains(e.touches[i].target)) { handleJoystick(e.touches[i].clientX, e.touches[i].clientY); break; } } } }, { passive: true });
zone.addEventListener('touchend', () => { joystickActive = false; stick.style.transform = 'translate(0px, 0px)'; moveX = 0; moveZ = 0; });
function handleJoystick(cx, cy) {
    const zr = zone.getBoundingClientRect();
    let dx = cx - (zr.left + zr.width / 2), dy = cy - (zr.top + zr.height / 2);
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    moveX = dx / maxRadius; moveZ = dy / maxRadius;
}
let cameraAngleY = 0, cameraAngleX = 0.4, cameraDistance = 6, touchStartX = 0, touchStartY = 0, isTurningCamera = false;
window.addEventListener('touchstart', (e) => {
    const jBtn = document.getElementById('jump-button'), aBtn = document.getElementById('attack-button');
    if (e.touches.length === 1 && !zone.contains(e.target) && !jBtn.contains(e.target) && !aBtn.contains(e.target)) { isTurningCamera = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
}, { passive: true });
window.addEventListener('touchmove', (e) => {
    if (!isTurningCamera) return;
    for (let i = 0; i < e.touches.length; i++) {
        if (!zone.contains(e.touches[i].target) && !document.getElementById('jump-button').contains(e.touches[i].target) && !document.getElementById('attack-button').contains(e.touches[i].target)) {
            cameraAngleY -= (e.touches[i].clientX - touchStartX) * 0.005;
            cameraAngleX += (e.touches[i].clientY - touchStartY) * 0.005;
            cameraAngleX = Math.max(0.1, Math.min(1.2, cameraAngleX));
            touchStartX = e.touches[i].clientX; touchStartY = e.touches[i].clientY; break;
        }
    }
}, { passive: true });
window.addEventListener('touchend', () => { isTurningCamera = false; });
document.getElementById('jump-button').addEventListener('touchstart', (e) => { e.preventDefault(); if (gameActive && !isDead && jumpCount < 2) { velocityY = jumpForce; jumpCount++; } });
document.getElementById('attack-button').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameActive && !isDead && !isAttacking) {
        isAttacking = true; attackAnimTime = 0;
        if (isOnlineMode) socket.emit('playerAttack');
        if (isOnlineMode && gameActive) {
            Object.keys(otherPlayers).forEach((id) => {
                const op = otherPlayers[id].mesh.position;
                if (rabbit.position.distanceTo(op) < 2.0) {
                    const angle = Math.atan2(op.x - rabbit.position.x, op.z - rabbit.position.z);
                    socket.emit('playerKnockback', { targetId: id, angle: angle });
                }
            });
        }
    }
});

// ANA DÖNGÜ
let legWiggle = 0;
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    let hasMoved = false;

    if (gameActive && !isDead) {
        const now = Date.now() / 1000;
        for (let i = 0; i < portals.length; i++) {
            const p = portals[i];
            if (new THREE.Vector2(rabbit.position.x - p.mesh.position.x, rabbit.position.z - p.mesh.position.z).length() < 2.5 && (now - lastTeleportTime > teleportCooldown)) {
                lastTeleportTime = now;
                document.getElementById('death-screen').style.display = 'flex';
                document.getElementById('death-screen').style.background = 'rgba(0,0,0,0.95)';
                document.querySelector('.death-text').innerText = 'YÜKLENİYOR...';
                document.getElementById('countdown-display').innerText = '';
                setTimeout(() => { rabbit.position.x = p.target.x; rabbit.position.z = p.target.z; document.getElementById('death-screen').style.display = 'none'; }, 800);
                break;
            }
        }
    }

    if (isOnlineMode && !gameActive && !isDead) {
        rabbit.rotation.y += 1.2 * deltaTime;
        Object.keys(otherPlayers).forEach((id) => { otherPlayers[id].mesh.rotation.y += 1.2 * deltaTime; });
        camera.position.set(0, 3.5, 43); camera.lookAt(0, 1.2, 50);
    }

    if (gameActive && !isDead) {
        if (joystickActive && (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05)) {
            const fx = Math.sin(cameraAngleY), fz = Math.cos(cameraAngleY);
            const rx = Math.sin(cameraAngleY + Math.PI / 2), rz = Math.cos(cameraAngleY + Math.PI / 2);
            const dx = (fx * -moveZ) - (rx * moveX), dz = (fz * -moveZ) - (rz * moveX);
            const nx = rabbit.position.x + dx * 12.0 * deltaTime, nz = rabbit.position.z + dz * 12.0 * deltaTime;
            if (!checkCollision(nx, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nx;
            if (!checkCollision(rabbit.position.x, rabbit.position.y, nz)) rabbit.position.z = nz;
            rabbit.rotation.y = Math.atan2(dx, dz);
            hasMoved = true;
            legWiggle += 15 * deltaTime;
            footFL.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footBR.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footFR.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
            footBL.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
        } else { footFL.position.y = 0.08; footFR.position.y = 0.08; footBL.position.y = 0.08; footBR.position.y = 0.08; }
        if (isAttacking) {
            attackAnimTime += 12 * deltaTime; const f = Math.sin(attackAnimTime * Math.PI);
            if (attackAnimTime <= 1.0) { rabbitVisualGroup.position.z = f * 0.5; head.position.z = 0.1 + f * 0.25; head.rotation.x = f * 0.4; }
            else { isAttacking = false; rabbitVisualGroup.position.z = 0; head.position.z = 0.1; head.rotation.x = 0; }
        }
        Object.keys(otherPlayers).forEach((id) => {
            const op = otherPlayers[id];
            if (op.isAttacking) {
                op.attackAnimTime += 12 * deltaTime; const f = Math.sin(op.attackAnimTime * Math.PI);
                if (op.attackAnimTime <= 1.0) { op.visual.position.z = f * 0.5; op.head.position.z = 0.1 + f * 0.25; op.head.rotation.x = f * 0.4; }
                else { op.isAttacking = false; op.visual.position.z = 0; op.head.position.z = 0.1; op.head.rotation.x = 0; }
            }
        });

        const floorY = getFloorY(rabbit.position.x, rabbit.position.y, rabbit.position.z);
        velocityY -= gravity * 60 * deltaTime;
        rabbit.position.y += velocityY * deltaTime;
        if (rabbit.position.y <= floorY) { rabbit.position.y = floorY; velocityY = 0; jumpCount = 0; }

        if (isOnlineMode) {
            Object.keys(otherPlayers).forEach((id) => {
                const other = otherPlayers[id].mesh;
                const dist = rabbit.position.distanceTo(other.position);
                if (dist < 1.2 && dist > 0.01) {
                    const angle = Math.atan2(rabbit.position.x - other.position.x, rabbit.position.z - other.position.z);
                    const px = Math.sin(angle) * 0.05, pz = Math.cos(angle) * 0.05;
                    rabbit.position.x += px; rabbit.position.z += pz;
                    other.position.x -= px; other.position.z -= pz;
                }
            });
        }
        if (hasMoved || isAttacking) socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y });

        camera.position.x = rabbit.position.x - Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        camera.position.z = rabbit.position.z - Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        camera.position.y = rabbit.position.y + Math.sin(cameraAngleX) * cameraDistance;
        camera.lookAt(rabbit.position.x, rabbit.position.y + 0.4, rabbit.position.z);
    }
    renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });