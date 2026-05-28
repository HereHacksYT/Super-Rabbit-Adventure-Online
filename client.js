const socket = io();
const clock = new THREE.Clock();

let isOnlineMode = false;
let gameActive = false;
let maxPlayersLimit = 4;
let isDead = false;
let respawnTimer = null;
let respawnCountdown = 15;

// 3D SAHNE AYARLARI
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ad9ea); // Pastel gök mavisi
scene.fog = new THREE.Fog(0x9ad9ea, 25, 70);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// IŞIKLANDIRMA (Daha yumuşak ve pastel)
const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.55);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff5e6, 0.85);
sunLight.position.set(40, 50, 30);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -35;
sunLight.shadow.camera.right = 35;
sunLight.shadow.camera.top = 35;
sunLight.shadow.camera.bottom = -35;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.02;
scene.add(sunLight);

// --- ASIL OYUN DÜNYASI (Köy Meydanı) ---
const gameplayGroup = new THREE.Group();
scene.add(gameplayGroup);

// Ana zemin (çimen)
const groundGeo = new THREE.CircleGeometry(35, 64);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x7ba428, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
gameplayGroup.add(ground);

// İç bölge (daha açık yeşil)
const innerGroundGeo = new THREE.CircleGeometry(25, 64);
const innerGroundMat = new THREE.MeshStandardMaterial({ color: 0x96c93d, roughness: 0.8 });
const innerGround = new THREE.Mesh(innerGroundGeo, innerGroundMat);
innerGround.rotation.x = -Math.PI / 2;
innerGround.position.y = 0.02;
innerGround.receiveShadow = true;
gameplayGroup.add(innerGround);

// Çarpışma listesi
const obstacles = [];

// --- YARDIMCI FONKSİYONLAR ---
function createTree(x, z, scale = 1, type = 'oak') {
    const group = new THREE.Group();

    if (type === 'oak') {
        // Gövde (Ayrı değil, grup içinde)
        const trunkGeo = new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 2.0 * scale, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.0 * scale;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        // Yapraklar (üç katman)
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a8f29, roughness: 0.4 });
        for (let i = 0; i < 3; i++) {
            const leafGeo = new THREE.ConeGeometry(0.7 * scale - i * 0.15, 0.8 * scale, 8);
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.y = 1.6 * scale + i * 0.6 * scale;
            leaf.castShadow = true;
            leaf.receiveShadow = true;
            group.add(leaf);
        }
    } else if (type === 'pine') {
        // Gövde
        const trunkGeo = new THREE.CylinderGeometry(0.2 * scale, 0.3 * scale, 2.5 * scale, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.7 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.25 * scale;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        // Yapraklar (konik)
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.5 });
        for (let i = 0; i < 4; i++) {
            const leafGeo = new THREE.ConeGeometry(0.7 * scale - i * 0.1, 0.9 * scale, 8);
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.y = 1.8 * scale + i * 0.7 * scale;
            leaf.castShadow = true;
            leaf.receiveShadow = true;
            group.add(leaf);
        }
    }

    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    // Sadece gövdeyi engele ekle (group içindeki ilk çocuk)
    obstacles.push(group.children[0]);
    return group;
}

function createWillowTree(x, z, scale = 1.2) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 2.5 * scale, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.7 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25 * scale;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5a9e3f, roughness: 0.5 });
    const topGeo = new THREE.SphereGeometry(1.2 * scale, 8, 6);
    const top = new THREE.Mesh(topGeo, leafMat);
    top.position.y = 2.8 * scale;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // Sarkan dallar
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const dx = Math.cos(angle) * 0.8 * scale;
        const dz = Math.sin(angle) * 0.8 * scale;
        const vineGeo = new THREE.CylinderGeometry(0.05, 0.1, 1.5 * scale, 4);
        const vine = new THREE.Mesh(vineGeo, leafMat);
        vine.position.set(dx, 1.5 * scale, dz);
        vine.rotation.z = (Math.random() - 0.5) * 0.5;
        vine.rotation.x = (Math.random() - 0.5) * 0.5;
        vine.castShadow = true;
        vine.receiveShadow = true;
        group.add(vine);
    }

    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(trunk);
    return group;
}

function createMushroomHouse(x, z, colorRoof = 0xff4444) {
    const group = new THREE.Group();
    // Gövde
    const bodyGeo = new THREE.CylinderGeometry(1.0, 1.2, 2.0, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.6 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0; body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    // Çatı (mantar)
    const roofGeo = new THREE.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const roofMat = new THREE.MeshStandardMaterial({ color: colorRoof, roughness: 0.3, metalness: 0.1 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 2.0; roof.castShadow = true; roof.receiveShadow = true;
    group.add(roof);
    // Kapı
    const doorGeo = new THREE.BoxGeometry(0.5, 0.9, 0.1);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.5 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 0.6, 1.3); group.add(door);
    // Pencereler
    const windowGeo = new THREE.BoxGeometry(0.4, 0.4, 0.05);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0x333333, roughness: 0.2 });
    const winL = new THREE.Mesh(windowGeo, windowMat);
    winL.position.set(0.6, 1.2, 1.2); group.add(winL);
    const winR = new THREE.Mesh(windowGeo, windowMat);
    winR.position.set(-0.6, 1.2, 1.2); group.add(winR);

    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(group);
    return group;
}

function createFountain(x, z) {
    const group = new THREE.Group();
    // Taban
    const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.4, 16);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.4, metalness: 0.2 });
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.2; base.castShadow = true; base.receiveShadow = true;
    group.add(base);
    // Havuz
    const poolGeo = new THREE.CylinderGeometry(1.0, 1.1, 0.5, 16);
    const poolMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.3, metalness: 0.3 });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.y = 0.6; pool.castShadow = true; pool.receiveShadow = true;
    group.add(pool);
    // Su
    const waterGeo = new THREE.CylinderGeometry(0.9, 0.95, 0.1, 16);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x3399ff, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.8 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = 0.85; group.add(water);
    // Orta sütun
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.2, 8);
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    pillar.position.y = 1.2; pillar.castShadow = true; pillar.receiveShadow = true;
    group.add(pillar);
    // Üst tepsi
    const topGeo = new THREE.CylinderGeometry(0.7, 0.5, 0.3, 8);
    const top = new THREE.Mesh(topGeo, stoneMat);
    top.position.y = 1.9; top.castShadow = true; top.receiveShadow = true;
    group.add(top);

    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(group);
    return group;
}

function createBench(x, z, rotY = 0) {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    // Oturma yeri
    const seatGeo = new THREE.BoxGeometry(1.5, 0.1, 0.5);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = 0.5; seat.castShadow = true; seat.receiveShadow = true;
    group.add(seat);
    // Ayaklar
    const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
    const leg1 = new THREE.Mesh(legGeo, woodMat);
    leg1.position.set(0.6, 0.25, 0.15); group.add(leg1);
    const leg2 = new THREE.Mesh(legGeo, woodMat);
    leg2.position.set(-0.6, 0.25, 0.15); group.add(leg2);
    const leg3 = new THREE.Mesh(legGeo, woodMat);
    leg3.position.set(0.6, 0.25, -0.15); group.add(leg3);
    const leg4 = new THREE.Mesh(legGeo, woodMat);
    leg4.position.set(-0.6, 0.25, -0.15); group.add(leg4);
    // Sırtlık
    const backGeo = new THREE.BoxGeometry(1.5, 0.4, 0.05);
    const back = new THREE.Mesh(backGeo, woodMat);
    back.position.set(0, 0.75, -0.22); back.castShadow = true;
    group.add(back);

    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    gameplayGroup.add(group);
    obstacles.push(group);
    return group;
}

function createBush(x, z, scale = 1) {
    const group = new THREE.Group();
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3a6b1e, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
        const geo = new THREE.SphereGeometry(0.3 * scale, 6);
        const sphere = new THREE.Mesh(geo, bushMat);
        sphere.position.set((Math.random() - 0.5) * 0.4, 0.2 * scale, (Math.random() - 0.5) * 0.4);
        sphere.castShadow = true; sphere.receiveShadow = true;
        group.add(sphere);
    }
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    // Çalılar engel değil (geçilebilir)
    return group;
}

function createRock(x, z, scale = 1) {
    const geo = new THREE.IcosahedronGeometry(0.5 * scale, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.1 });
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(x, 0.2 * scale, z);
    rock.castShadow = true; rock.receiveShadow = true;
    rock.rotation.set(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5);
    gameplayGroup.add(rock);
    obstacles.push(rock);
    return rock;
}

function createFlower(x, z, color = 0xff69b4) {
    const group = new THREE.Group();
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.4, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.2; group.add(stem);
    const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.45; group.add(head);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    return group;
}

function createStonePath(x, z, size = 0.6) {
    const geo = new THREE.CylinderGeometry(size * 0.4, size * 0.5, 0.05, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8 });
    const stone = new THREE.Mesh(geo, mat);
    stone.position.set(x, 0.04, z);
    stone.receiveShadow = true;
    gameplayGroup.add(stone);
    return stone;
}

function createBalloon(x, y, z, color = 0xff6666) {
    const group = new THREE.Group();
    const ballGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const ballMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.2, emissive: color, emissiveIntensity: 0.2 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    group.add(ball);
    const stringGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4);
    const stringMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const string = new THREE.Mesh(stringGeo, stringMat);
    string.position.y = -0.5; group.add(string);
    group.position.set(x, y, z);
    gameplayGroup.add(group);
    return group;
}

function createBird(x, y, z) {
    const group = new THREE.Group();
    const bodyGeo = new THREE.SphereGeometry(0.1, 4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);
    const beakGeo = new THREE.ConeGeometry(0.05, 0.1, 4);
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.position.set(0, 0, 0.1); beak.rotation.x = Math.PI / 2;
    group.add(beak);
    group.position.set(x, y, z);
    gameplayGroup.add(group);
    return group;
}

// --- KÖY MEYDANINI OLUŞTUR (GENİŞLETİLDİ) ---

// Ağaçlar (çeşitli)
createTree(-10, -10, 1.1, 'oak');
createTree(10, -9, 1.0, 'pine');
createTree(-9, 10, 1.2, 'oak');
createTree(10, 9, 0.9, 'pine');
createTree(0, -13, 1.3, 'oak');
createTree(-12, 3, 1.0, 'pine');
createTree(12, -3, 1.1, 'oak');
createWillowTree(-6, 12, 1.0);
createWillowTree(7, -12, 1.1);

// Mantar evler
createMushroomHouse(-6, -5, 0xff6666);
createMushroomHouse(7, 4, 0xffaa44);
createMushroomHouse(0, -9, 0xff44ff);

// Çeşme (merkezde)
createFountain(0, 0);

// Banklar
createBench(-3, -3, 0.8);
createBench(4, -2, -0.5);
createBench(-5, 6, 1.2);
createBench(5, -7, -0.3);

// Çalılar
for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 6 + Math.random() * 14;
    createBush(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.7 + Math.random() * 1.2);
}

// Kayalar
createRock(-7, -2, 0.8);
createRock(3, 5, 1.2);
createRock(-4, -8, 0.6);
createRock(8, 7, 1.0);
createRock(-9, 4, 0.7);

// Çiçekler (çokça)
for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 4 + Math.random() * 15;
    createFlower(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.random() > 0.5 ? 0xff69b4 : 0xffd700);
}

// Taş yollar (merkezden evlere)
for (let i = 0; i < 10; i++) {
    createStonePath(-2.5 + i * 0.6, -1.5 + i * 0.3, 0.5);
    createStonePath(3 + i * 0.6, 1.5 - i * 0.3, 0.5);
    createStonePath(-1.5 + i * 0.5, 0 - i * 0.7, 0.45);
}

// Balonlar
createBalloon(-2, 4.5, -2, 0xff6666);
createBalloon(3, 5.0, 3, 0x66ff66);
createBalloon(5, 4.8, -5, 0x6666ff);
createBalloon(-5, 5.2, 5, 0xffcc00);
createBalloon(0, 6.0, -7, 0xff66ff);

// Kuşlar (dekoratif)
createBird(2, 3.5, 5);
createBird(-4, 4.0, -4);
createBird(6, 2.8, -2);
createBird(-3, 3.2, 6);

// --- LOBİ ODASI (değişmedi) ---
const lobbyGroup = new THREE.Group();
scene.add(lobbyGroup);

const cylinderGeo = new THREE.CylinderGeometry(12, 12, 15, 32, 1, true);
const cylinderMat = new THREE.MeshStandardMaterial({
    color: 0x00a2ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, roughness: 0.2, metalness: 0.1
});
const lobbyRoom = new THREE.Mesh(cylinderGeo, cylinderMat);
lobbyRoom.position.set(0, 7.5, 50);
lobbyGroup.add(lobbyRoom);

const lobbyFloorGeo = new THREE.CylinderGeometry(12, 12, 0.5, 32);
const lobbyFloorMat = new THREE.MeshStandardMaterial({ color: 0x0d47a1, roughness: 0.5 });
const lobbyFloorMesh = new THREE.Mesh(lobbyFloorGeo, lobbyFloorMat);
lobbyFloorMesh.position.set(0, -0.25, 50);
lobbyGroup.add(lobbyFloorMesh);

const pads = [];
const padPositions = [
    { x: 0, z: 47.5 },
    { x: -3.5, z: 49.5 },
    { x: 3.5, z: 49.5 },
    { x: 0, z: 52.0 }
];

for (let i = 0; i < 4; i++) {
    const padGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.2, 24);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6, roughness: 0.1 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(padPositions[i].x, 0.1, padPositions[i].z);
    lobbyGroup.add(pad);
    pads.push(pad);
}

// MODEL FABRİKASI (değişmedi)
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
let myHealth = 100;
const maxHealth = 100;

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
    isDead = true;
    gameActive = false;
    rabbit.visible = false;
    document.getElementById('death-screen').style.display = 'flex';
    respawnCountdown = 15;
    document.getElementById('countdown-display').innerText = respawnCountdown;
    respawnTimer = setInterval(() => {
        respawnCountdown--;
        document.getElementById('countdown-display').innerText = respawnCountdown;
        if (respawnCountdown <= 0) {
            clearInterval(respawnTimer);
            respawn();
        }
    }, 1000);
}

function respawn() {
    isDead = false;
    gameActive = true;
    rabbit.visible = true;
    rabbit.position.set(0, 0, 0);
    rabbit.rotation.y = 0;
    myHealth = maxHealth;
    updateHealthBar();
    document.getElementById('death-screen').style.display = 'none';
    velocityY = 0;
    jumpCount = 0;
}

function checkCollision(newX, newY, newZ) {
    if (!gameActive) return false;
    const playerBox = new THREE.Box3(
        new THREE.Vector3(newX - 0.28, newY + 0.15, newZ - 0.28),
        new THREE.Vector3(newX + 0.28, newY + 1.1, newZ + 0.28)
    );
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
        if (pX + 0.25 >= box.min.x && pX - 0.25 <= box.max.x &&
            pZ + 0.25 >= box.min.z && pZ - 0.25 <= box.max.z) {
            if (pY >= box.max.y - 0.4) {
                if (box.max.y > highestCeil) highestCeil = box.max.y;
            }
        }
    }
    return highestCeil;
}

let velocityY = 0, jumpCount = 0;
const gravity = 0.8, jumpForce = 18;

window.playSolo = function() {
    isOnlineMode = false;
    gameActive = true;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('controls-ui').style.display = 'block';
    document.getElementById('game-info-ui').style.display = 'block';
    document.getElementById('health-bar-container').style.display = 'block';
    document.getElementById('game-room-title').innerText = "TEK OYUNCULU";
    document.getElementById('game-player-count').innerText = "1";
    lobbyGroup.visible = false;
    gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0);
    rabbit.rotation.y = 0;
    myHealth = maxHealth;
    updateHealthBar();
    gameplayGroup.updateMatrixWorld(true);
};

window.createRoom = function() { isOnlineMode = true; socket.emit('createRoom', { maxPlayers: 4 }); };
window.joinRoom = function() {
    const code = document.getElementById('room-code-input').value.trim();
    if(code.length === 5) { isOnlineMode = true; socket.emit('joinRoom', code); }
};
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
    gameplayGroup.visible = false;
    lobbyGroup.visible = true;
    rabbit.position.set(padPositions[0].x, 0.2, padPositions[0].z);
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    let padIndex = 1;
    Object.keys(data.players).forEach((id) => {
        if (id !== socket.id && padIndex < 4) {
            const pos = padPositions[padIndex];
            addOtherPlayer(id, pos.x, 0.2, pos.z);
            padIndex++;
        }
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
    lobbyGroup.visible = false;
    gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0);
    rabbit.rotation.y = 0;
    myHealth = maxHealth;
    updateHealthBar();
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    Object.keys(allPlayers).forEach((id) => {
        if (id !== socket.id) addOtherPlayer(id, 0, 0, 0);
    });
    gameActive = true;
    isDead = false;
    gameplayGroup.updateMatrixWorld(true);
});

function addOtherPlayer(id, x, y, z) {
    if (otherPlayers[id]) return;
    const modelData = createRabbitModel(false);
    modelData.mesh.position.set(x, y, z);
    scene.add(modelData.mesh);
    otherPlayers[id] = {
        mesh: modelData.mesh,
        visual: modelData.visual,
        head: modelData.head,
        isAttacking: false,
        attackAnimTime: 0
    };
}

socket.on('playerMoved', (playerInfo) => {
    if (gameActive && otherPlayers[playerInfo.id]) {
        otherPlayers[playerInfo.id].mesh.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
        otherPlayers[playerInfo.id].mesh.rotation.y = playerInfo.ry;
    }
});

socket.on('playerAttacked', (id) => {
    if (gameActive && otherPlayers[id]) {
        otherPlayers[id].isAttacking = true;
        otherPlayers[id].attackAnimTime = 0;
    }
});

socket.on('knockback', (angle) => {
    if (!gameActive || isDead) return;
    rabbit.position.x += Math.sin(angle) * 2.0;
    rabbit.position.z += Math.cos(angle) * 2.0;
    socket.emit('playerMovement', { 
        x: rabbit.position.x, 
        y: rabbit.position.y, 
        z: rabbit.position.z, 
        ry: rabbit.rotation.y 
    });
});

socket.on('playerDisconnected', (id) => {
    if (otherPlayers[id]) {
        scene.remove(otherPlayers[id].mesh);
        delete otherPlayers[id];
    }
});

socket.on('hostDisconnected', () => {
    alert('Oda sahibi oyundan ayrıldı. Lobiye dönülüyor.');
    location.reload();
});

// KONTROLLER (aynı)
const zone = document.getElementById('joystick-zone'), stick = document.getElementById('joystick-stick'), maxRadius = 35;
let joystickActive = false, moveX = 0, moveZ = 0;

zone.addEventListener('touchstart', (e) => { if(!gameActive || isDead) return; joystickActive = true; handleJoystick(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
window.addEventListener('touchmove', (e) => {
    if (joystickActive && gameActive && !isDead) {
        for (let i = 0; i < e.touches.length; i++) {
            if (zone.contains(e.touches[i].target)) { handleJoystick(e.touches[i].clientX, e.touches[i].clientY); break; }
        }
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

let cameraAngleY = 0, cameraAngleX = 0.3, cameraDistance = 5, touchStartX = 0, touchStartY = 0, isTurningCamera = false;
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
            cameraAngleY -= (e.touches[i].clientX - touchStartX) * 0.006;
            cameraAngleX += (e.touches[i].clientY - touchStartY) * 0.006;
            cameraAngleX = Math.max(0.1, Math.min(1.1, cameraAngleX));
            touchStartX = e.touches[i].clientX; touchStartY = e.touches[i].clientY; break;
        }
    }
}, { passive: true });
window.addEventListener('touchend', () => { isTurningCamera = false; });

document.getElementById('jump-button').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameActive && !isDead && jumpCount < 2) {
        velocityY = jumpForce;
        jumpCount++;
    }
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
                    const angle = Math.atan2(
                        otherPos.x - rabbit.position.x,
                        otherPos.z - rabbit.position.z
                    );
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
            
            const nextX = rabbit.position.x + dirX * 9.0 * deltaTime;
            const nextZ = rabbit.position.z + dirZ * 9.0 * deltaTime;
            
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
        if (rabbit.position.y <= currentFloorY) {
            rabbit.position.y = currentFloorY;
            velocityY = 0;
            jumpCount = 0;
        }

        if (isOnlineMode) {
            Object.keys(otherPlayers).forEach((id) => {
                const other = otherPlayers[id].mesh;
                const dist = rabbit.position.distanceTo(other.position);
                if (dist < 1.2 && dist > 0.01) {
                    const angle = Math.atan2(rabbit.position.x - other.position.x, rabbit.position.z - other.position.z);
                    const pushX = Math.sin(angle) * 0.05;
                    const pushZ = Math.cos(angle) * 0.05;
                    rabbit.position.x += pushX;
                    rabbit.position.z += pushZ;
                    other.position.x -= pushX;
                    other.position.z -= pushZ;
                }
            });
        }

        if (hasMoved || isAttacking) {
            socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y });
        }

        camera.position.x = rabbit.position.x - Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        camera.position.z = rabbit.position.z - Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
        camera.position.y = rabbit.position.y + Math.sin(cameraAngleX) * cameraDistance;
        camera.lookAt(rabbit.position.x, rabbit.position.y + 0.4, rabbit.position.z);
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});