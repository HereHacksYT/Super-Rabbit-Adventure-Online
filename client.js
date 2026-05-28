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
scene.fog = new THREE.Fog(0x87CEEB, 150, 400);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// IŞIKLANDIRMA
const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.6);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff5e6, 0.9);
sunLight.position.set(200, 250, 200);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -200;
sunLight.shadow.camera.right = 200;
sunLight.shadow.camera.top = 200;
sunLight.shadow.camera.bottom = -200;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const gameplayGroup = new THREE.Group();
scene.add(gameplayGroup);

const obstacles = [];
const portals = [];

// --- ADA İNŞA YARDIMCILARI ---
function createGround(x, z, radius, color = 0x7ba428, roughness = 0.9) {
    const geo = new THREE.CircleGeometry(radius, 64);
    const mat = new THREE.MeshStandardMaterial({ color: color, roughness: roughness });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    gameplayGroup.add(mesh);
    return mesh;
}

function createTree(x, z, scale = 1, type = 'round') {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 2.5 * scale, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25 * scale; trunk.castShadow = true; trunk.receiveShadow = true;
    group.add(trunk);
    if (type === 'round') {
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a8f29, roughness: 0.4 });
        for (let i = 0; i < 4; i++) {
            const sGeo = new THREE.SphereGeometry(0.65 * scale - i * 0.1, 8, 6);
            const s = new THREE.Mesh(sGeo, leafMat);
            s.position.set((Math.random() - 0.5) * 0.6 * scale, 2.0 * scale + i * 0.5 * scale, (Math.random() - 0.5) * 0.6 * scale);
            s.castShadow = true; s.receiveShadow = true;
            group.add(s);
        }
    } else if (type === 'cone') {
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.5 });
        for (let i = 0; i < 4; i++) {
            const cGeo = new THREE.ConeGeometry(0.65 * scale - i * 0.1, 0.8 * scale, 8);
            const c = new THREE.Mesh(cGeo, leafMat);
            c.position.y = 1.9 * scale + i * 0.65 * scale;
            c.castShadow = true; c.receiveShadow = true;
            group.add(c);
        }
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(trunk);
    return group;
}

function createBush(x, z, scale = 1) {
    const group = new THREE.Group();
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3a6b1e, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
        const sGeo = new THREE.SphereGeometry(0.35 * scale, 6);
        const s = new THREE.Mesh(sGeo, bushMat);
        s.position.set((Math.random() - 0.5) * 0.5 * scale, 0.2 * scale, (Math.random() - 0.5) * 0.5 * scale);
        s.castShadow = true; s.receiveShadow = true;
        group.add(s);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createFlower(x, z, color = 0xffaa88) {
    const group = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.5, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.25; group.add(stem);
    const headGeo = new THREE.SphereGeometry(0.16, 6, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.6; group.add(head);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createPond(x, z, radius = 1.8) {
    const group = new THREE.Group();
    const pondGeo = new THREE.CircleGeometry(radius, 32);
    const pondMat = new THREE.MeshStandardMaterial({ color: 0x3399ff, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.7 });
    const pond = new THREE.Mesh(pondGeo, pondMat);
    pond.rotation.x = -Math.PI / 2; pond.position.y = 0.05;
    group.add(pond);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createPortal(x, z, targetX, targetZ, color = 0x00ffff) {
    const group = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(1.0, 0.15, 16, 32);
    const ringMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.8, roughness: 0.2 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 1.2;
    group.add(ring);
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.5, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.3 });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 1.25;
    group.add(pillar);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    portals.push({ mesh: group, target: new THREE.Vector3(targetX, 0, targetZ), color: color });
    return group;
}

function createBench(x, z, rotY = 0) {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    const seatGeo = new THREE.BoxGeometry(1.4, 0.1, 0.5);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = 0.45; seat.castShadow = true; seat.receiveShadow = true;
    group.add(seat);
    for (let i = -1; i <= 1; i += 2) {
        const legGeo = new THREE.BoxGeometry(0.1, 0.45, 0.1);
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(i * 0.6, 0.225, 0.15); group.add(leg);
        const leg2 = new THREE.Mesh(legGeo, woodMat);
        leg2.position.set(i * 0.6, 0.225, -0.15); group.add(leg2);
    }
    const backGeo = new THREE.BoxGeometry(1.4, 0.35, 0.05);
    const back = new THREE.Mesh(backGeo, woodMat);
    back.position.set(0, 0.65, -0.22); back.castShadow = true;
    group.add(back);
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    gameplayGroup.add(group);
    obstacles.push(group);
    return group;
}

function createMushroomHouse(x, z, colorRoof = 0xff4444) {
    const group = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(1.0, 1.2, 2.0, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.6 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0; body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    const roofGeo = new THREE.SphereGeometry(1.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const roofMat = new THREE.MeshStandardMaterial({ color: colorRoof, roughness: 0.3, metalness: 0.1 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 2.0; roof.castShadow = true; roof.receiveShadow = true;
    group.add(roof);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(group);
    return group;
}

// --- 1. BAŞLANGIÇ ADASI (Super Bear Adventure Hub) ---
createGround(0, 0, 22, 0x8cc63e, 0.85);
createPond(0, 0, 1.8);
createTree(-5, -4, 0.9, 'round');
createTree(6, -3, 0.85, 'round');
createTree(-6, 5, 0.95, 'cone');
createTree(7, 6, 0.9, 'cone');
createBush(-3, -6, 0.8);
createBush(4, -5, 0.7);
createBush(-4, 6, 0.8);
createFlower(2, 2, 0xffaa88);
createFlower(-2, -2, 0xffcc44);
createFlower(3, -3, 0xff6699);
createFlower(-3, 3, 0xff8844);
createBench(5, 5, -0.5);
createBench(-5, -5, 0.7);
createMushroomHouse(8, -7, 0xffaa44);
createMushroomHouse(-8, 8, 0xff66aa);

// Portallar (diğer adalara)
createPortal(0, -16, 0, -250, 0xff8844);   // Güney -> Çöl
createPortal(16, 0, 250, 0, 0x44ff44);     // Doğu -> Mantar
createPortal(-16, 0, -250, 0, 0xff4444);   // Batı -> Volkan
createPortal(0, 16, 0, 250, 0x44ffff);     // Kuzey -> Kar
createPortal(12, -12, 180, -180, 0xcc44ff); // GD -> Kristal
createPortal(-12, 12, -180, 180, 0xffaa00); // KB -> Harabe

// --- 2. KAR ADASI (Kuzey, z = 250) ---
const snowX = 0, snowZ = 250;
createGround(snowX, snowZ, 25, 0xe0f0ff, 0.6);
for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 18;
    const tree = createTree(snowX + Math.cos(angle) * r, snowZ + Math.sin(angle) * r, 0.8 + Math.random() * 0.6, 'cone');
    tree.children[0].material.color.set(0x6B4226);
}
for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 17;
    const iceGeo = new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.5, 0);
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, roughness: 0.1, metalness: 0.3 });
    const ice = new THREE.Mesh(iceGeo, iceMat);
    ice.position.set(snowX + Math.cos(angle) * r, 0.2, snowZ + Math.sin(angle) * r);
    ice.castShadow = true; ice.receiveShadow = true;
    gameplayGroup.add(ice);
    obstacles.push(ice);
}
createPortal(snowX, snowZ - 16, 0, 10, 0x44ffff); // Geri dönüş

// --- 3. ÇÖL ADASI (Güney, z = -250) ---
const desertX = 0, desertZ = -250;
createGround(desertX, desertZ, 28, 0xedc9af, 0.9);
for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 18;
    const cactusGroup = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.25, 2.5, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.7 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25; trunk.castShadow = true; trunk.receiveShadow = true;
    cactusGroup.add(trunk);
    for (let j = 0; j < 3; j++) {
        const armGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6);
        const arm = new THREE.Mesh(armGeo, trunkMat);
        arm.position.set((Math.random() - 0.5) * 0.6, 1.0 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6);
        arm.rotation.z = (Math.random() - 0.5) * 0.8;
        arm.rotation.x = (Math.random() - 0.5) * 0.8;
        arm.castShadow = true;
        cactusGroup.add(arm);
    }
    cactusGroup.position.set(desertX + Math.cos(angle) * r, 0, desertZ + Math.sin(angle) * r);
    gameplayGroup.add(cactusGroup);
    obstacles.push(trunk);
}
createPortal(desertX, desertZ + 16, 0, -10, 0xff8844);

// --- 4. MANTAR ADASI (Doğu, x = 250) ---
const mushX = 250, mushZ = 0;
createGround(mushX, mushZ, 25, 0x7a5c8a, 0.85);
for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 18;
    const stemGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.0 + Math.random() * 2.5, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xf5e6d3, roughness: 0.6 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 1.2; stem.castShadow = true; stem.receiveShadow = true;
    const capGeo = new THREE.SphereGeometry(0.9 + Math.random() * 0.8, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: [0xff5555, 0x55ff55, 0x5555ff, 0xff55ff][Math.floor(Math.random() * 4)], roughness: 0.3 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = stem.position.y + 1.5; cap.castShadow = true;
    const group = new THREE.Group();
    group.add(stem); group.add(cap);
    group.position.set(mushX + Math.cos(angle) * r, 0, mushZ + Math.sin(angle) * r);
    gameplayGroup.add(group);
    obstacles.push(stem);
}
createPortal(mushX - 16, mushZ, 10, 0, 0x44ff44);

// --- 5. VOLKAN ADASI (Batı, x = -250) ---
const volcX = -250, volcZ = 0;
createGround(volcX, volcZ, 25, 0x3a3a3a, 0.8);
for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const r = 12 + Math.random() * 10;
    const poolGeo = new THREE.CircleGeometry(2 + Math.random() * 2.5, 32);
    const poolMat = new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.9, roughness: 0.2 });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(volcX + Math.cos(angle) * r, 0.05, volcZ + Math.sin(angle) * r);
    gameplayGroup.add(pool);
}
for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 15;
    const rockGeo = new THREE.IcosahedronGeometry(0.6 + Math.random() * 1.0, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(volcX + Math.cos(angle) * r, 0.3, volcZ + Math.sin(angle) * r);
    rock.castShadow = true; rock.receiveShadow = true;
    gameplayGroup.add(rock);
    obstacles.push(rock);
}
createPortal(volcX + 16, volcZ, -10, 0, 0xff4444);

// --- 6. KRİSTAL ADASI (GD, x = 180, z = -180) ---
const crystalX = 180, crystalZ = -180;
createGround(crystalX, crystalZ, 22, 0x2a1a3a, 0.7);
for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 15;
    const crystalGeo = new THREE.OctahedronGeometry(0.4 + Math.random() * 0.7, 0);
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0xcc88ff, roughness: 0.2, metalness: 0.4, emissive: 0x220044, emissiveIntensity: 0.5 });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(crystalX + Math.cos(angle) * r, 0.4, crystalZ + Math.sin(angle) * r);
    crystal.castShadow = true; crystal.receiveShadow = true;
    crystal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    gameplayGroup.add(crystal);
    obstacles.push(crystal);
}
createPortal(crystalX - 12, crystalZ + 12, 10, -10, 0xcc44ff);

// --- 7. HARABE ADASI (KB, x = -180, z = 180) ---
const ruinX = -180, ruinZ = 180;
createGround(ruinX, ruinZ, 22, 0x8b7d6b, 0.9);
for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 10 + Math.random() * 10;
    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.5, 3.0 + Math.random() * 2.5, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xccbbaa, roughness: 0.7 });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(ruinX + Math.cos(angle) * r, 1.5, ruinZ + Math.sin(angle) * r);
    pillar.castShadow = true; pillar.receiveShadow = true;
    gameplayGroup.add(pillar);
    obstacles.push(pillar);
}
createPortal(ruinX + 12, ruinZ - 12, -10, 10, 0xffaa00);

// --- LOBİ (aynı) ---
const lobbyGroup = new THREE.Group();
scene.add(lobbyGroup);
const cylinderGeo = new THREE.CylinderGeometry(12, 12, 15, 32, 1, true);
const cylinderMat = new THREE.MeshStandardMaterial({ color: 0x00a2ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1 });
const lobbyRoom = new THREE.Mesh(cylinderGeo, cylinderMat);
lobbyRoom.position.set(0, 7.5, 50);
lobbyGroup.add(lobbyRoom);
const lobbyFloorGeo = new THREE.CylinderGeometry(12, 12, 0.5, 32);
const lobbyFloorMat = new THREE.MeshStandardMaterial({ color: 0x0d47a1, roughness: 0.5 });
const lobbyFloorMesh = new THREE.Mesh(lobbyFloorGeo, lobbyFloorMat);
lobbyFloorMesh.position.set(0, -0.25, 50);
lobbyGroup.add(lobbyFloorMesh);
const pads = [];
const padPositions = [{ x: 0, z: 47.5 }, { x: -3.5, z: 49.5 }, { x: 3.5, z: 49.5 }, { x: 0, z: 52.0 }];
for (let i = 0; i < 4; i++) {
    const padGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.2, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6, roughness: 0.1 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(padPositions[i].x, 0.1, padPositions[i].z);
    lobbyGroup.add(pad);
    pads.push(pad);
}

// MODEL FABRİKASI (AYNI)
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
    respawnTimer = setInterval(() => {
        respawnCountdown--;
        document.getElementById('countdown-display').innerText = respawnCountdown;
        if (respawnCountdown <= 0) { clearInterval(respawnTimer); respawn(); }
    }, 1000);
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
        if (playerBox.intersectsBox(obstacleBox)) {
            if (newY >= obstacleBox.max.y - 0.3) continue;
            return true;
        }
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
            if (pY >= box.max.y - 0.4) { if (box.max.y > highestCeil) highestCeil = box.max.y; }
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

socket.on('roomCreated', (data) => { setupLobbyUI(data); });
socket.on('roomUpdate', (data) => { setupLobbyUI(data); });
function setupLobbyUI(data) {
    maxPlayersLimit = data.maxPlayers;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-ui').style.display = 'block';
    document.getElementById('ui-room-code').innerText = data.roomCode;
    const currentCount = Object.keys(data.players).length;
    document.getElementById('ui-player-count').innerText = `Oyuncu: ${currentCount} / ${maxPlayersLimit}`;
    if (data.hostId === socket.id) {
        document.getElementById('ui-start-btn').style.display = 'block';
        document.getElementById('ui-waiting-msg').style.display = 'none';
    } else {
        document.getElementById('ui-start-btn').style.display = 'none';
        document.getElementById('ui-waiting-msg').style.display = 'block';
    }
    gameplayGroup.visible = false; lobbyGroup.visible = true;
    rabbit.position.set(padPositions[0].x, 0.2, padPositions[0].z);
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    let padIndex = 1;
    Object.keys(data.players).forEach((id) => {
        if (id !== socket.id && padIndex < 4) { const pos = padPositions[padIndex]; addOtherPlayer(id, pos.x, 0.2, pos.z); padIndex++; }
    });
}
socket.on('gameStartedAtAll', (allPlayers) => {
    document.getElementById('lobby-ui').style.display = 'none';
    document.getElementById('controls-ui').style.display = 'block';
    document.getElementById('game-info-ui').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';
    const currentCode = document.getElementById('ui-room-code').innerText;
    document.getElementById('game-room-title').innerText = "ODA: " + currentCode;
    document.getElementById('game-player-count').innerText = Object.keys(allPlayers).length;
    lobbyGroup.visible = false; gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0); rabbit.rotation.y = 0;
    myHealth = maxHealth; updateHealthBar();
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    Object.keys(allPlayers).forEach((id) => { if (id !== socket.id) addOtherPlayer(id, 0, 0, 0); });
    gameActive = true; isDead = false;
    gameplayGroup.updateMatrixWorld(true);
});
function addOtherPlayer(id, x, y, z) {
    if (otherPlayers[id]) return;
    const modelData = createRabbitModel(false);
    modelData.mesh.position.set(x, y, z); scene.add(modelData.mesh);
    otherPlayers[id] = { mesh: modelData.mesh, visual: modelData.visual, head: modelData.head, isAttacking: false, attackAnimTime: 0 };
}
socket.on('playerMoved', (playerInfo) => {
    if (gameActive && otherPlayers[playerInfo.id]) {
        otherPlayers[playerInfo.id].mesh.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
        otherPlayers[playerInfo.id].mesh.rotation.y = playerInfo.ry;
    }
});
socket.on('playerAttacked', (id) => { if (gameActive && otherPlayers[id]) { otherPlayers[id].isAttacking = true; otherPlayers[id].attackAnimTime = 0; } });
socket.on('knockback', (angle) => {
    if (!gameActive || isDead) return;
    rabbit.position.x += Math.sin(angle) * 2.0; rabbit.position.z += Math.cos(angle) * 2.0;
    socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y });
});
socket.on('playerDisconnected', (id) => { if (otherPlayers[id]) { scene.remove(otherPlayers[id].mesh); delete otherPlayers[id]; } });
socket.on('hostDisconnected', () => { alert('Oda sahibi oyundan ayrıldı.'); location.reload(); });

// KONTROLLER
const zone = document.getElementById('joystick-zone'), stick = document.getElementById('joystick-stick'), maxRadius = 35;
let joystickActive = false, moveX = 0, moveZ = 0;
zone.addEventListener('touchstart', (e) => { if(!gameActive || isDead) return; joystickActive = true; handleJoystick(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
window.addEventListener('touchmove', (e) => {
    if (joystickActive && gameActive && !isDead) {
        for (let i = 0; i < e.touches.length; i++) { if (zone.contains(e.touches[i].target)) { handleJoystick(e.touches[i].clientX, e.touches[i].clientY); break; } }
    }
}, { passive: true });
zone.addEventListener('touchend', () => { joystickActive = false; stick.style.transform = 'translate(0px, 0px)'; moveX = 0; moveZ = 0; });
function handleJoystick(clientX, clientY) {
    const zoneRect = zone.getBoundingClientRect();
    let deltaX = clientX - (zoneRect.left + zoneRect.width / 2), deltaY = clientY - (zoneRect.top + zoneRect.height / 2);
    let dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (dist > maxRadius) { deltaX = (deltaX / dist) * maxRadius; deltaY = (deltaY / dist) * maxRadius; }
    stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    moveX = deltaX / maxRadius; moveZ = deltaY / maxRadius;
}
let cameraAngleY = 0, cameraAngleX = 0.4, cameraDistance = 6, touchStartX = 0, touchStartY = 0, isTurningCamera = false;
window.addEventListener('touchstart', (e) => {
    const jBtn = document.getElementById('jump-button'), aBtn = document.getElementById('attack-button');
    if (e.touches.length === 1 && !zone.contains(e.target) && !jBtn.contains(e.target) && !aBtn.contains(e.target)) {
        isTurningCamera = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
    }
}, { passive: true });
window.addEventListener('touchmove', (e) => {
    if (!isTurningCamera) return;
    const jBtn = document.getElementById('jump-button'), aBtn = document.getElementById('attack-button');
    for (let i = 0; i < e.touches.length; i++) {
        if (!zone.contains(e.touches[i].target) && !jBtn.contains(e.touches[i].target) && !aBtn.contains(e.target)) {
            cameraAngleY -= (e.touches[i].clientX - touchStartX) * 0.005;
            cameraAngleX += (e.touches[i].clientY - touchStartY) * 0.005;
            cameraAngleX = Math.max(0.1, Math.min(1.2, cameraAngleX));
            touchStartX = e.touches[i].clientX; touchStartY = e.touches[i].clientY; break;
        }
    }
}, { passive: true });
window.addEventListener('touchend', () => { isTurningCamera = false; });
document.getElementById('jump-button').addEventListener('touchstart', (e) => {
    e.preventDefault(); if (gameActive && !isDead && jumpCount < 2) { velocityY = jumpForce; jumpCount++; }
});
document.getElementById('attack-button').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameActive && !isDead && !isAttacking) {
        isAttacking = true; attackAnimTime = 0;
        if (isOnlineMode) socket.emit('playerAttack');
        if (isOnlineMode && gameActive) {
            Object.keys(otherPlayers).forEach((id) => {
                const otherPos = otherPlayers[id].mesh.position;
                const dist = rabbit.position.distanceTo(otherPos);
                if (dist < 2.0) {
                    const angle = Math.atan2(otherPos.x - rabbit.position.x, otherPos.z - rabbit.position.z);
                    socket.emit('playerKnockback', { targetId: id, angle: angle });
                }
            });
        }
    }
});

// ANA DÖNGÜ + PORTAL
let legWiggle = 0;
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    let hasMoved = false;

    if (gameActive && !isDead) {
        const now = Date.now() / 1000;
        for (let i = 0; i < portals.length; i++) {
            const p = portals[i];
            const dist = new THREE.Vector2(rabbit.position.x - p.mesh.position.x, rabbit.position.z - p.mesh.position.z).length();
            if (dist < 2.5 && (now - lastTeleportTime > teleportCooldown)) {
                lastTeleportTime = now;
                document.getElementById('death-screen').style.display = 'flex';
                document.getElementById('death-screen').style.background = 'rgba(0,0,0,0.95)';
                document.querySelector('.death-text').innerText = 'YÜKLENİYOR...';
                document.getElementById('countdown-display').innerText = '';
                setTimeout(() => {
                    rabbit.position.x = p.target.x;
                    rabbit.position.z = p.target.z;
                    document.getElementById('death-screen').style.display = 'none';
                }, 800);
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
            const forwardX = Math.sin(cameraAngleY), forwardZ = Math.cos(cameraAngleY);
            const rightX = Math.sin(cameraAngleY + Math.PI / 2), rightZ = Math.cos(cameraAngleY + Math.PI / 2);
            const dirX = (forwardX * -moveZ) - (rightX * moveX);
            const dirZ = (forwardZ * -moveZ) - (rightZ * moveX);
            const nextX = rabbit.position.x + dirX * 12.0 * deltaTime;
            const nextZ = rabbit.position.z + dirZ * 12.0 * deltaTime;
            if (!checkCollision(nextX, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nextX;
            if (!checkCollision(rabbit.position.x, rabbit.position.y, nextZ)) rabbit.position.z = nextZ;
            rabbit.rotation.y = Math.atan2(dirX, dirZ);
            hasMoved = true;
            legWiggle += 15 * deltaTime;
            footFL.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footBR.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footFR.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
            footBL.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
        } else {
            footFL.position.y = 0.08; footFR.position.y = 0.08; footBL.position.y = 0.08; footBR.position.y = 0.08;
        }
        if (isAttacking) {
            attackAnimTime += 12 * deltaTime; const factor = Math.sin(attackAnimTime * Math.PI);
            if (attackAnimTime <= 1.0) { rabbitVisualGroup.position.z = factor * 0.5; head.position.z = 0.1 + factor * 0.25; head.rotation.x = factor * 0.4; }
            else { isAttacking = false; rabbitVisualGroup.position.z = 0; head.position.z = 0.1; head.rotation.x = 0; }
        }
        Object.keys(otherPlayers).forEach((id) => {
            const p = otherPlayers[id];
            if (p.isAttacking) {
                p.attackAnimTime += 12 * deltaTime; const factor = Math.sin(p.attackAnimTime * Math.PI);
                if (p.attackAnimTime <= 1.0) { p.visual.position.z = factor * 0.5; p.head.position.z = 0.1 + factor * 0.25; p.head.rotation.x = factor * 0.4; }
                else { p.isAttacking = false; p.visual.position.z = 0; p.head.position.z = 0.1; p.head.rotation.x = 0; }
            }
        });

        const currentFloorY = getFloorY(rabbit.position.x, rabbit.position.y, rabbit.position.z);
        velocityY -= gravity * 60 * deltaTime;
        rabbit.position.y += velocityY * deltaTime;
        if (rabbit.position.y <= currentFloorY) { rabbit.position.y = currentFloorY; velocityY = 0; jumpCount = 0; }

        if (isOnlineMode) {
            Object.keys(otherPlayers).forEach((id) => {
                const other = otherPlayers[id].mesh;
                const dist = rabbit.position.distanceTo(other.position);
                if (dist < 1.2 && dist > 0.01) {
                    const angle = Math.atan2(rabbit.position.x - other.position.x, rabbit.position.z - other.position.z);
                    const pushX = Math.sin(angle) * 0.05; const pushZ = Math.cos(angle) * 0.05;
                    rabbit.position.x += pushX; rabbit.position.z += pushZ;
                    other.position.x -= pushX; other.position.z -= pushZ;
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