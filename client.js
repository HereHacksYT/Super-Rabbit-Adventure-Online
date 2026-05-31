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
let isModerator = false;
let infiniteJump = false;

let joystickActive = false;
let moveX = 0;
let moveZ = 0;

const monkeys = [];
let hasKey = false;
let cageOpened = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 120, 400);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.7);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
sunLight.position.set(200, 350, 150);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -150;
sunLight.shadow.camera.right = 150;
sunLight.shadow.camera.top = 150;
sunLight.shadow.camera.bottom = -150;
sunLight.shadow.mapSize.width = 4096;
sunLight.shadow.mapSize.height = 4096;
scene.add(sunLight);

const gameplayGroup = new THREE.Group();
scene.add(gameplayGroup);
const obstacles = [];
const portals = [];

// --- DOKULAR ---
function createCanvasTexture(width, height, drawFunc) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFunc(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
}

const groundTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5a8a3c'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8000; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        ctx.fillStyle = `rgb(${80 + Math.random()*60}, ${120 + Math.random()*50}, ${30 + Math.random()*40})`;
        ctx.fillRect(x, y, 1 + Math.random() * 3, 2 + Math.random() * 5);
    }
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(30, 50, 10, ${Math.random() * 0.25})`;
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 3 + 0.5, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(160, 200, 80, ${Math.random() * 0.2})`;
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 2 + 0.3, 0, Math.PI * 2); ctx.fill();
    }
});

const blockGrassTexture = createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6daa2e'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
        ctx.fillStyle = `rgb(${100 + Math.random()*40}, ${150 + Math.random()*60}, ${30 + Math.random()*30})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 4, 6);
    }
    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(50,80,20,${Math.random()*0.3})`;
        ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*3+1, 0, Math.PI*2); ctx.fill();
    }
});

const rainforestGroundTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#3d5a1e'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
        ctx.fillStyle = `rgb(${50 + Math.random()*40}, ${80 + Math.random()*40}, ${20 + Math.random()*25})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(20, 30, 5, ${Math.random() * 0.35})`;
        ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*4+1, 0, Math.PI*2); ctx.fill();
    }
});

const mossyStoneTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
        const y = row * 64; const offset = (row % 2) * 32;
        for (let col = 0; col < 8; col++) {
            const x = col * 64 + offset;
            ctx.fillStyle = `rgb(${120 + Math.random()*40}, ${120 + Math.random()*40}, ${120 + Math.random()*40})`;
            ctx.fillRect(x + 2, y + 2, 60, 28);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2, y + 2, 60, 28);
        }
    }
    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(60, 110, 40, ${Math.random() * 0.6})`;
        ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*12+3, 0, Math.PI*2); ctx.fill();
    }
    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(80, 140, 50, ${Math.random() * 0.4})`;
        ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*8+2, 0, Math.PI*2); ctx.fill();
    }
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * w, y = Math.random() < 0.5 ? Math.random() * 80 : h - Math.random() * 80;
        ctx.fillStyle = `rgba(50, 100, 30, ${Math.random() * 0.7})`;
        ctx.beginPath(); ctx.arc(x, y, Math.random()*15+5, 0, Math.PI*2); ctx.fill();
    }
});

const dirtTexture = createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8B6B4D'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
        const shade = 100 + Math.random() * 50;
        ctx.fillStyle = `rgb(${shade}, ${shade*0.7}, ${shade*0.4})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 3, 3);
    }
});

const woodTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c49a6c'; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x, 0, 2, h); }
    for (let i = 0; i < 600; i++) {
        ctx.strokeStyle = `rgba(100, 60, 20, ${Math.random()*0.5})`; ctx.lineWidth = Math.random()*3+0.5;
        ctx.beginPath(); const y = Math.random() * h; ctx.moveTo(0, y);
        for (let x = 0; x < w; x += 10) ctx.lineTo(x, y + Math.sin(x*0.05)*8);
        ctx.stroke();
    }
    for (let i = 0; i < 15; i++) {
        const bx = Math.random() * w, by = Math.random() * h, r = 3 + Math.random() * 8;
        ctx.fillStyle = `rgba(80, 40, 20, 0.7)`;
        ctx.beginPath(); ctx.ellipse(bx, by, r, r*1.5, 0, 0, Math.PI*2); ctx.fill();
    }
});

const stoneTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
        const y = row * 64; const offset = (row % 2) * 32;
        for (let col = 0; col < 8; col++) {
            const x = col * 64 + offset;
            ctx.fillStyle = `rgb(${120 + Math.random()*40}, ${120 + Math.random()*40}, ${120 + Math.random()*40})`;
            ctx.fillRect(x + 2, y + 2, 60, 28);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2, y + 2, 60, 28);
        }
    }
    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.2})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 4, 3);
    }
});

const roofTileTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7a2e2e'; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 12; row++) {
        const y = row * 42; const offset = (row % 2) * 21;
        for (let col = 0; col < 12; col++) {
            const x = col * 42 + offset;
            ctx.fillStyle = `rgb(${150 + Math.random()*30}, ${40 + Math.random()*20}, ${30 + Math.random()*20})`;
            ctx.fillRect(x + 2, y + 2, 38, 18);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(x + 2, y + 2, 38, 18);
            ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + 2, y + 30, 38, 10);
        }
    }
    for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random()*0.2})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 3, 2);
    }
});

const barkTexture = createCanvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6B4F3C'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 800; i++) {
        ctx.strokeStyle = `rgba(40, 20, 10, ${Math.random()*0.5})`; ctx.lineWidth = Math.random()*4+2;
        ctx.beginPath(); ctx.moveTo(0, Math.random()*h); ctx.lineTo(w, Math.random()*h); ctx.stroke();
    }
});

const leafTexture = createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3d7a1c'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = `rgb(${40 + Math.random()*30}, ${100 + Math.random()*50}, ${20 + Math.random()*20})`;
        ctx.fillRect(Math.random()*w, Math.random()*h, 2, 3);
    }
});

// --- MALZEMELER ---
const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.9 });
groundTexture.repeat.set(12, 12);
const rainforestGroundMat = new THREE.MeshStandardMaterial({ map: rainforestGroundTexture, roughness: 0.85 });
rainforestGroundTexture.repeat.set(16, 16);
const blockGrassMat = new THREE.MeshStandardMaterial({ map: blockGrassTexture, roughness: 0.85 });
blockGrassTexture.repeat.set(8, 8);
const dirtMat = new THREE.MeshStandardMaterial({ map: dirtTexture, roughness: 0.75 });
dirtTexture.repeat.set(4, 4);
const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.65 });
const stoneWallMat = new THREE.MeshStandardMaterial({ map: stoneTexture, roughness: 0.6 });
const mossyWallMat = new THREE.MeshStandardMaterial({ map: mossyStoneTexture, roughness: 0.65 });
const barkMat = new THREE.MeshStandardMaterial({ map: barkTexture, roughness: 0.7 });
const leafMat = new THREE.MeshStandardMaterial({ map: leafTexture, roughness: 0.4 });
const roofMat = new THREE.MeshStandardMaterial({ map: roofTileTexture, roughness: 0.55 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.15, metalness: 1.0, emissive: 0xff8800, emissiveIntensity: 1.2 });

// --- MOD MENÜ ---
const modMenuHTML = `
<div id="mod-menu" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(0,0,0,0.95); padding:25px; border-radius:15px; z-index:30; color:white; text-align:center; border:2px solid gold; min-width:250px;">
    <h2 style="color:gold; margin-bottom:15px;">🔧 Mod Menü</h2>
    <p id="mod-coords" style="color:#ffeb3b; font-size:16px; margin:10px 0;"></p>
    <button id="btn-infinite-jump" style="padding:12px 20px; margin:8px; background:#444; color:white; border:1px solid white; border-radius:8px; cursor:pointer; width:90%;">999 Zıplama: KAPALI</button>
    <button onclick="closeModMenu()" style="padding:12px 20px; margin:8px; background:#c44; color:white; border:1px solid white; border-radius:8px; cursor:pointer; width:90%;">Kapat</button>
</div>`;
document.body.insertAdjacentHTML('beforeend', modMenuHTML);
window.closeModMenu = function() { document.getElementById('mod-menu').style.display = 'none'; };
document.getElementById('btn-infinite-jump').addEventListener('click', function() {
    infiniteJump = !infiniteJump;
    this.textContent = '999 Zıplama: ' + (infiniteJump ? 'AÇIK' : 'KAPALI');
    this.style.background = infiniteJump ? '#4a4' : '#444';
});
window.openModPrompt = function() {
    const code = prompt('Mod kodu:');
    if (code === '1234') { isModerator = true; document.getElementById('mod-menu').style.display = 'block'; }
    else alert('Hatalı kod!');
};

// --- MOBİL KAYDIRMA ---
document.addEventListener('touchmove', function(e) {
    if (!e.target.closest('#joystick-zone') && !e.target.closest('.action-btn') && !e.target.closest('#mod-btn')) e.preventDefault();
}, { passive: false });

// --- KLAVYE ---
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' && gameActive && !isDead) {
        e.preventDefault();
        if (infiniteJump || jumpCount < 3) { velocityY = jumpForce; jumpCount++; }
    }
    if ((e.key === 'e' || e.key === 'f') && gameActive && !isDead && !isAttacking) {
        e.preventDefault();
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
    if (e.key === 'm' && e.ctrlKey && e.shiftKey) {
        const code = prompt('Mod kodu:');
        if (code === '1234') { isModerator = true; document.getElementById('mod-menu').style.display = 'block'; }
    }
});
document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// --- JOYSTICK ---
const zone = document.getElementById('joystick-zone'), stick = document.getElementById('joystick-stick'), maxRadius = 35;
zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!gameActive || isDead) return;
    joystickActive = true;
    handleJoystick(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener('touchmove', (e) => {
    if (joystickActive && gameActive && !isDead) {
        e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
            if (zone.contains(e.touches[i].target)) { handleJoystick(e.touches[i].clientX, e.touches[i].clientY); break; }
        }
    }
}, { passive: false });
zone.addEventListener('touchend', () => { joystickActive = false; stick.style.transform = 'translate(0px, 0px)'; moveX = 0; moveZ = 0; });
function handleJoystick(cx, cy) {
    const r = zone.getBoundingClientRect();
    let dx = cx - (r.left + r.width/2), dy = cy - (r.top + r.height/2);
    let dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > maxRadius) { dx = (dx/dist)*maxRadius; dy = (dy/dist)*maxRadius; }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    moveX = dx / maxRadius; moveZ = dy / maxRadius;
}

// --- BUTONLAR ---
document.getElementById('jump-button').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameActive && !isDead && (infiniteJump || jumpCount < 3)) { velocityY = jumpForce; jumpCount++; }
}, { passive: false });
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
}, { passive: false });

// --- ANA MERKEZ ---
const squareSize = 94;
const groundGeo = new THREE.PlaneGeometry(squareSize, squareSize);
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); ground.receiveShadow = true;
gameplayGroup.add(ground);

function createShadowlessWall(x, z, w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    const wall = new THREE.Mesh(g, stoneWallMat);
    wall.position.set(x, h/2, z); wall.castShadow = false; wall.receiveShadow = false;
    gameplayGroup.add(wall); obstacles.push(wall);
}
createShadowlessWall(0, 48, squareSize, 100, 2);
createShadowlessWall(0, -48, squareSize, 100, 2);
createShadowlessWall(48, 0, 2, 100, squareSize);
createShadowlessWall(-48, 0, 2, 100, squareSize);

function createMossyWallSegment(x, z, w, h, d, rot = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    const wall = new THREE.Mesh(g, mossyWallMat);
    wall.position.set(x, h/2, z); wall.rotation.y = rot;
    wall.castShadow = true; wall.receiveShadow = true;
    gameplayGroup.add(wall); obstacles.push(wall);
}
function createEnclosingWalls(minX, minZ, maxX, maxZ, h = 25) {
    const wX = maxX - minX, wZ = maxZ - minZ, seg = 50;
    const tc = Math.ceil(wX/seg), tl = wX/tc + 1;
    for (let i = 0; i < tc; i++) createMossyWallSegment(minX + (i+0.5)*(wX/tc), maxZ, tl, h, 2, 0);
    for (let i = 0; i < tc; i++) createMossyWallSegment(minX + (i+0.5)*(wX/tc), minZ, tl, h, 2, 0);
    const lc = Math.ceil(wZ/seg), ll = wZ/lc + 1;
    for (let i = 0; i < lc; i++) createMossyWallSegment(minX, minZ + (i+0.5)*(wZ/lc), ll, h, 2, Math.PI/2);
    for (let i = 0; i < lc; i++) createMossyWallSegment(maxX, minZ + (i+0.5)*(wZ/lc), ll, h, 2, Math.PI/2);
}

function createBigGrassBlock(x, z, w, d, h) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), dirtMat);
    body.position.y = h/2; body.castShadow = true; body.receiveShadow = true;
    grp.add(body); obstacles.push(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w-0.1, 0.2, d-0.1), blockGrassMat);
    top.position.y = h + 0.1; top.receiveShadow = true;
    grp.add(top); obstacles.push(top);
    grp.position.set(x, 0, z); gameplayGroup.add(grp);
}
function createWoodenHouse(x, z, rot = 0) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 6), woodMat);
    body.position.y = 2.5; body.castShadow = true; body.receiveShadow = true;
    grp.add(body); obstacles.push(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.8, 4), roofMat);
    roof.position.y = 6.4; roof.rotation.y = Math.PI/4; roof.castShadow = true; roof.receiveShadow = true;
    grp.add(roof); obstacles.push(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3, 0.2), new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.5 }));
    door.position.set(0, 1.5, 3.1); grp.add(door);
    grp.position.set(x, 0, z); grp.rotation.y = rot; gameplayGroup.add(grp);
}
function createBigTree(x, z, scale = 2) {
    const grp = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3*scale, 0.45*scale, 3*scale, 16), barkMat);
    trunk.position.y = 1.5*scale; trunk.castShadow = true; trunk.receiveShadow = true;
    grp.add(trunk); obstacles.push(trunk);
    for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.85*scale - i*0.12, 16, 12), leafMat);
        s.position.set((Math.random()-0.5)*0.6*scale, 2.4*scale + i*0.55*scale, (Math.random()-0.5)*0.6*scale);
        s.castShadow = true; s.receiveShadow = true; grp.add(s);
    }
    grp.position.set(x, 0, z); gameplayGroup.add(grp);
}
function createRock(x, z, scale = 1) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8*scale, 0), new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.2 }));
    rock.position.set(x, 0.3*scale, z); rock.castShadow = true; rock.receiveShadow = true;
    rock.rotation.set(Math.random()*0.5, Math.random()*0.5, Math.random()*0.5);
    gameplayGroup.add(rock); obstacles.push(rock);
}
function createGoldenPortal(x, z, tx, tz) {
    const grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 0.5, 32), goldMat);
    base.position.y = 0.25; base.castShadow = true; base.receiveShadow = true; grp.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.14, 16, 40), goldMat);
    ring.rotation.x = Math.PI/2; ring.position.y = 1; grp.add(ring);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.15, metalness: 1.0, emissive: 0xff8800, emissiveIntensity: 1.0, transparent: true, opacity: 0.6 }));
    inner.position.y = 1; grp.add(inner);
    const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 24), goldMat);
    topRing.rotation.x = Math.PI/2; topRing.position.y = 1.8; grp.add(topRing);
    const topBall = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), goldMat);
    topBall.position.y = 1.9; grp.add(topBall);
    grp.position.set(x, 0, z); gameplayGroup.add(grp);
    portals.push({ mesh: grp, target: new THREE.Vector3(tx, 0, tz) });
}
function createSign(x, z, text, rot = 0) {
    const grp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 3.5, 8), new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 }));
    pole.position.y = 1.75; pole.castShadow = true; grp.add(pole);
    const board = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.7 }));
    board.position.y = 3; board.castShadow = true; board.receiveShadow = true; grp.add(board);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c49a6c'; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#2d1a0a'; ctx.font = 'bold 48px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1), new THREE.MeshBasicMaterial({ map: tex }));
    textPlane.position.set(0, 3, 0.11); grp.add(textPlane);
    grp.position.set(x, 0, z); grp.rotation.y = rot; gameplayGroup.add(grp);
}

// --- YAĞMUR ---
let rainParticles = null;
function createRainSystem(x, z, w, d) {
    if (rainParticles) gameplayGroup.remove(rainParticles);
    const count = 5000; const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i*3] = x + (Math.random()-0.5)*w;
        pos[i*3+1] = Math.random()*60;
        pos[i*3+2] = z + (Math.random()-0.5)*d;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rainParticles = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaaccff, size: 0.25, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    gameplayGroup.add(rainParticles);
}
function updateRain(active, x, z, w, d) {
    if (!rainParticles) return; rainParticles.visible = active; if (!active) return;
    const pos = rainParticles.geometry.attributes.position.array;
    for (let i = 0; i < pos.length/3; i++) {
        pos[i*3+1] -= 0.6 + Math.random()*0.4;
        if (pos[i*3+1] < 0) { pos[i*3] = x + (Math.random()-0.5)*w; pos[i*3+1] = 50 + Math.random()*10; pos[i*3+2] = z + (Math.random()-0.5)*d; }
    }
    rainParticles.geometry.attributes.position.needsUpdate = true;
}

// --- YAĞMURLU ORMAN ---
const rfMinX = 75, rfMaxX = 325, rfMinZ = 75, rfMaxZ = 325;
const rfCenterX = (rfMinX+rfMaxX)/2, rfCenterZ = (rfMinZ+rfMaxZ)/2, rfWidth = rfMaxX-rfMinX, rfDepth = rfMaxZ-rfMinZ;
const rfGround = new THREE.Mesh(new THREE.PlaneGeometry(rfWidth, rfDepth), rainforestGroundMat);
rfGround.rotation.x = -Math.PI/2; rfGround.position.set(rfCenterX, 0, rfCenterZ); rfGround.receiveShadow = true;
gameplayGroup.add(rfGround);
createEnclosingWalls(rfMinX, rfMinZ, rfMaxX, rfMaxZ);
createRainSystem(rfCenterX, rfCenterZ, rfWidth, rfDepth);
for (let row = -100; row <= 100; row += 30) for (let col = -100; col <= 100; col += 30) if (Math.abs(row) > 30 || Math.abs(col) > 30) createBigTree(rfCenterX+col, rfCenterZ+row, 1.5+Math.random());
for (let row = -90; row <= 90; row += 45) for (let col = -90; col <= 90; col += 45) createRock(rfCenterX+col+10, rfCenterZ+row+10, 0.8+Math.random()*0.8);

// --- BÜYÜK KÜP ---
const cubeH = 25;
const cube = new THREE.Mesh(new THREE.BoxGeometry(20, cubeH, 30), new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 }));
cube.position.set(175, cubeH/2, 140); cube.castShadow = true; cube.receiveShadow = true;
gameplayGroup.add(cube); obstacles.push(cube);
const cubeTop = new THREE.Mesh(new THREE.BoxGeometry(19.8, 0.3, 29.8), blockGrassMat);
cubeTop.position.set(175, cubeH+0.15, 140); cubeTop.receiveShadow = true;
gameplayGroup.add(cubeTop); obstacles.push(cubeTop);

// --- MAYMUNLAR ---
function createMonkey(x, y, z) {
    const g = new THREE.Group(); g.name = 'monkey';
    const fm = new THREE.MeshStandardMaterial({ color: 0x6B4226, roughness: 0.6 }), bm = new THREE.MeshStandardMaterial({ color: 0x8B5A3C, roughness: 0.6 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.25,0.15,0.3), fm)).position.set(-0.2,0.1,0.1);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.25,0.15,0.3), fm)).position.set(0.2,0.1,0.1);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.6,6), bm)).position.set(-0.2,0.4,0.05);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.6,6), bm)).position.set(0.2,0.4,0.05);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.4,1,8), bm); body.position.y = 0.8; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const arm = new THREE.CylinderGeometry(0.08,0.1,0.7,6);
    const al = new THREE.Mesh(arm, bm); al.position.set(-0.45,1.1,0); al.rotation.z = 0.5; g.add(al);
    const ar = new THREE.Mesh(arm, bm); ar.position.set(0.45,1.1,0); ar.rotation.z = -0.5; g.add(ar);
    const banana = new THREE.Group(); banana.position.set(0.65,1.25,0.15);
    const bc = new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0), new THREE.Vector3(0.05,0.2,0.05), new THREE.Vector3(0,0.4,0.1), new THREE.Vector3(-0.05,0.55,0.05), new THREE.Vector3(0,0.65,0)]);
    banana.add(new THREE.Mesh(new THREE.TubeGeometry(bc, 8, 0.04, 6, false), new THREE.MeshStandardMaterial({ color: 0xFFE135, roughness: 0.4 }))); g.add(banana);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8), new THREE.MeshStandardMaterial({ color: 0xA0704A, roughness: 0.5 })); head.position.y = 1.5; head.castShadow = true; head.receiveShadow = true; g.add(head);
    const ear = new THREE.SphereGeometry(0.1,6,6); const em = new THREE.MeshStandardMaterial({ color: 0xD4956B, roughness: 0.5 });
    g.add(new THREE.Mesh(ear, em)).position.set(-0.25,1.65,0); g.add(new THREE.Mesh(ear, em)).position.set(0.25,1.65,0);
    const eye = new THREE.SphereGeometry(0.06,6,6); const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    g.add(new THREE.Mesh(eye, eyeMat)).position.set(-0.1,1.6,0.25); g.add(new THREE.Mesh(eye, eyeMat)).position.set(0.1,1.6,0.25);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07,6,6), new THREE.MeshStandardMaterial({ color: 0x4A2A1A, roughness: 0.4 }))).position.set(0,1.52,0.28);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.06,0.5,6), bm); tail.position.set(0,0.5,-0.35); tail.rotation.x = 0.6; g.add(tail);
    g.position.set(x, y, z);
    g.userData = { homeX: x, homeY: y, homeZ: z, targetX: x, targetZ: z, speed: 0.25, attackRange: 1.5, chaseRange: 10, homeRange: 15, health: 50, maxHealth: 50, isDead: false, deathTime: 0 };
    gameplayGroup.add(g); obstacles.push(g); monkeys.push(g);
}
createMonkey(175, 25.3, 140); createMonkey(168, 25.3, 130); createMonkey(182, 25.3, 150);

// --- MAYMUN CAN BAR ---
const mhc = document.createElement('div'); mhc.id = 'monkey-health'; mhc.style.cssText = 'display:none; position:absolute; top:55px; left:15px; z-index:5; width:180px; height:15px; background:rgba(0,0,0,0.6); border-radius:7px; border:1px solid white; overflow:hidden;';
mhc.innerHTML = '<div id="mhf" style="width:100%; height:100%; background:linear-gradient(90deg, #f44336, #ff5722);"></div><div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:white; font-size:10px;" id="mht">50/50</div>';
document.body.appendChild(mhc);

// --- ANAHTAR ---
let keyMesh = null;
function createKey(x, y, z) {
    const g = new THREE.Group();
    const km = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.2, metalness: 0.9, emissive: 0x886600, emissiveIntensity: 0.5 });
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.2,0.06,8,16), km)).position.y = 0.6;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.7,8), km)).position.y = 0.15;
    for (let i = 0; i < 2; i++) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.08,0.08), km)).position.set(0.08, i*0.15, 0);
    g.position.set(x, y, z); g.visible = false; gameplayGroup.add(g); keyMesh = g;
}
createKey(180, 25.5, 140);

// --- KAFES VE PAMUK ---
let cageGroup = null;
function createRabbitStatue() {
    const g = new THREE.Group(); const wm = new THREE.MeshStandardMaterial({ color: 0xffffff }); const bm = new THREE.MeshStandardMaterial({ color: 0xdddddd });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.75,0.75), wm); body.position.y = 0.4; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.55,0.55), wm); head.position.y = 0.95; head.position.z = 0.1; g.add(head);
    const ear = new THREE.BoxGeometry(0.12,0.55,0.06);
    g.add(new THREE.Mesh(ear, wm)).position.set(-0.16,0.45,-0.05); g.add(new THREE.Mesh(ear, wm)).position.set(0.16,0.45,-0.05);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), wm)).position.set(0,0.25,-0.4);
    const fg = new THREE.BoxGeometry(0.24,0.16,0.34);
    g.add(new THREE.Mesh(fg, bm)).position.set(-0.32,0.08,0.22); g.add(new THREE.Mesh(fg, bm)).position.set(0.32,0.08,0.22);
    g.add(new THREE.Mesh(fg, bm)).position.set(-0.32,-0.08,-0.22); g.add(new THREE.Mesh(fg, bm)).position.set(0.32,-0.08,-0.22);
    return g;
}
function createCage(x, z) {
    const g = new THREE.Group(); const bm = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.3 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(3,0.2,3), bm); floor.position.y = 0.1; floor.receiveShadow = true; g.add(floor); obstacles.push(floor);
    for (let i = 0; i < 8; i++) { const a = (i/8)*Math.PI*2; const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,3,8), bm); bar.position.set(Math.cos(a)*1.3, 1.7, Math.sin(a)*1.3); bar.castShadow = true; g.add(bar); obstacles.push(bar); }
    const ring = new THREE.TorusGeometry(1.3,0.08,8,16);
    const tr = new THREE.Mesh(ring, bm); tr.rotation.x = Math.PI/2; tr.position.y = 3.1; g.add(tr); obstacles.push(tr);
    const br = new THREE.Mesh(ring, bm); br.rotation.x = Math.PI/2; br.position.y = 0.3; g.add(br); obstacles.push(br);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3), new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.3, emissive: 0x330000 })); lock.position.set(0,1.8,1.35); lock.name = 'lock'; g.add(lock);
    const statue = createRabbitStatue(); statue.position.set(0,0.5,0); statue.scale.set(0.8,0.8,0.8); g.add(statue);
    g.position.set(x, 0, z); gameplayGroup.add(g); cageGroup = g;
}
createCage(190, 150);

// --- PARKUR ---
function createStep(x, z, y) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(3,0.5,3), new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 }));
    s.position.set(x, y, z); s.castShadow = true; s.receiveShadow = true; gameplayGroup.add(s); obstacles.push(s);
}
const steps = [{x:167,z:124},{x:171,z:124},{x:175,z:124},{x:179,z:124},{x:186,z:128},{x:186,z:133},{x:186,z:138},{x:186,z:143},{x:179,z:156},{x:175,z:156},{x:171,z:156},{x:167,z:156},{x:164,z:143},{x:164,z:138},{x:164,z:133},{x:164,z:128}];
steps.forEach((p, i) => createStep(p.x, p.z, 0.25 + i*(25/16)));

// --- ANA MERKEZ ELEMANLARI ---
createWoodenHouse(-25, -20, 0.2); createWoodenHouse(20, 15, -0.3); createWoodenHouse(-25, 25, 0.5);
createBigGrassBlock(30, -25, 8, 8, 8); createBigGrassBlock(-30, -15, 9, 10, 6); createBigGrassBlock(30, 25, 10, 8, 7); createBigGrassBlock(-30, -30, 9, 9, 10); createBigGrassBlock(25, 0, 8, 8, 6);
createBigTree(-35, -35, 2); createBigTree(35, -30, 1.8); createBigTree(-30, 35, 2.2); createBigTree(35, 35, 2); createBigTree(-40, 10, 1.8); createBigTree(40, -10, 2); createBigTree(-40, -15, 2); createBigTree(40, 15, 2); createBigTree(-15, -40, 1.8); createBigTree(15, 40, 1.8);
createGoldenPortal(0, 40, 200, 80); createSign(0, 43, "Yağmurlu Orman", Math.PI);
createGoldenPortal(200, 80, 0, 37); createSign(200, 76, "Geri Dön", 0);

// --- KOORDİNAT ---
const coordSpan = document.createElement('span'); coordSpan.id = 'coords'; coordSpan.style.marginLeft = '15px'; coordSpan.style.color = '#ffeb3b';
document.getElementById('game-info-ui').appendChild(coordSpan);

// --- TAVŞAN MODEL ---
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff }), otherBodyMat = new THREE.MeshStandardMaterial({ color: 0xddf0ff });
const noseMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa }), eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
function createRabbitModel(isLocal) {
    const g = new THREE.Group(), v = new THREE.Group(); g.add(v); const m = isLocal ? bodyMat : otherBodyMat;
    v.add(new THREE.Mesh(new THREE.BoxGeometry(0.7,0.75,0.75), m)).position.y = 0.4;
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.55,0.55), m); h.position.y = 0.95; h.position.z = 0.1; h.castShadow = true; v.add(h);
    h.add(new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1), noseMat)).position.set(0,-0.05,0.33);
    const eg = new THREE.BoxGeometry(0.07,0.07,0.07); h.add(new THREE.Mesh(eg, eyeMat)).position.set(-0.18,0.1,0.25); h.add(new THREE.Mesh(eg, eyeMat)).position.set(0.18,0.1,0.25);
    const ear = new THREE.BoxGeometry(0.12,0.55,0.06); h.add(new THREE.Mesh(ear, m)).position.set(-0.16,0.45,-0.05); h.add(new THREE.Mesh(ear, m)).position.set(0.16,0.45,-0.05);
    v.add(new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), m)).position.set(0,0.25,-0.4);
    const fm = new THREE.MeshStandardMaterial({ color: 0xcccccc }), fg = new THREE.BoxGeometry(0.24,0.16,0.34);
    g.add(new THREE.Mesh(fg, fm)).position.set(-0.32,0.08,0.22); g.add(new THREE.Mesh(fg, fm)).position.set(0.32,0.08,0.22);
    g.add(new THREE.Mesh(fg, fm)).position.set(-0.32,-0.08,-0.22); g.add(new THREE.Mesh(fg, fm)).position.set(0.32,-0.08,-0.22);
    return { mesh: g, visual: v, head: h, feet: g.children };
}
const player = createRabbitModel(true);
const rabbit = player.mesh; scene.add(rabbit);
let otherPlayers = {}, isAttacking = false, attackAnimTime = 0, myHealth = 100, inRainforest = false;
function showModBtn() { document.getElementById('mod-btn').style.display = 'flex'; }
function updateHealthBar() { const p = (myHealth/100)*100; document.getElementById('health-bar-fill').style.width = p + '%'; document.getElementById('health-text').innerText = myHealth + '/100'; }
function die() { if (isDead) return; isDead = true; gameActive = false; rabbit.visible = false; document.getElementById('death-screen').style.display = 'flex'; respawnCountdown = 15; document.getElementById('countdown-display').innerText = respawnCountdown; respawnTimer = setInterval(() => { respawnCountdown--; document.getElementById('countdown-display').innerText = respawnCountdown; if (respawnCountdown <= 0) { clearInterval(respawnTimer); respawn(); } }, 1000); }
function respawn() { isDead = false; gameActive = true; rabbit.visible = true; rabbit.position.set(0,0,0); myHealth = 100; updateHealthBar(); document.getElementById('death-screen').style.display = 'none'; velocityY = 0; jumpCount = 0; }
function checkCollision(nx, ny, nz) { if (!gameActive) return false; const box = new THREE.Box3(new THREE.Vector3(nx-0.28, ny+0.15, nz-0.28), new THREE.Vector3(nx+0.28, ny+1.1, nz+0.28)); gameplayGroup.updateMatrixWorld(true); for (const o of obstacles) { if (!o || !o.parent) continue; const ob = new THREE.Box3().setFromObject(o); if (box.intersectsBox(ob) && ny < ob.max.y - 0.3) return true; } return false; }
function getFloorY(px, py, pz) { let h = 0; gameplayGroup.updateMatrixWorld(true); for (const o of obstacles) { if (!o || !o.parent) continue; const b = new THREE.Box3().setFromObject(o); if (px+0.25 >= b.min.x && px-0.25 <= b.max.x && pz+0.25 >= b.min.z && pz-0.25 <= b.max.z && py >= b.max.y-0.4 && b.max.y > h) h = b.max.y; } return h; }
let velocityY = 0, jumpCount = 0;
const gravity = 0.8, jumpForce = 15.3;

window.playSolo = function() { isOnlineMode = false; gameActive = true; document.getElementById('main-menu').style.display = 'none'; document.getElementById('controls-ui').style.display = 'block'; document.getElementById('game-info-ui').style.display = 'block'; document.getElementById('health-bar-container').style.display = 'block'; document.getElementById('game-room-title').innerText = "TEK OYUNCULU"; document.getElementById('game-player-count').innerText = "1"; showModBtn(); gameplayGroup.visible = true; rabbit.position.set(0,0,0); rabbit.rotation.y = 0; myHealth = 100; updateHealthBar(); gameplayGroup.updateMatrixWorld(true); };
window.createRoom = function() { isOnlineMode = true; socket.emit('createRoom', { maxPlayers: 4 }); };
window.joinRoom = function() { const c = document.getElementById('room-code-input').value.trim(); if (c.length === 5) { isOnlineMode = true; socket.emit('joinRoom', c); } };
window.hostStartGame = function() { socket.emit('startGameSignal'); };

socket.on('roomCreated', (d) => { setupLobbyUI(d); }); socket.on('roomUpdate', (d) => { setupLobbyUI(d); });
const lobbyGroup = new THREE.Group(); scene.add(lobbyGroup);
const pads = [], pp = [{x:0,z:47.5},{x:-3.5,z:49.5},{x:3.5,z:49.5},{x:0,z:52}];
for (const p of pp) { const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.3,0.2,24), new THREE.MeshStandardMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6 })); pad.position.set(p.x,0.1,p.z); lobbyGroup.add(pad); pads.push(pad); }
function setupLobbyUI(d) { maxPlayersLimit = d.maxPlayers; document.getElementById('main-menu').style.display = 'none'; document.getElementById('lobby-ui').style.display = 'block'; document.getElementById('ui-room-code').innerText = d.roomCode; document.getElementById('ui-player-count').innerText = `Oyuncu: ${Object.keys(d.players).length} / ${maxPlayersLimit}`; if (d.hostId === socket.id) { document.getElementById('ui-start-btn').style.display = 'block'; document.getElementById('ui-waiting-msg').style.display = 'none'; } else { document.getElementById('ui-start-btn').style.display = 'none'; document.getElementById('ui-waiting-msg').style.display = 'block'; } gameplayGroup.visible = false; lobbyGroup.visible = true; rabbit.position.set(pp[0].x, 0.2, pp[0].z); for (const id of Object.keys(otherPlayers)) scene.remove(otherPlayers[id].mesh); otherPlayers = {}; let pi = 1; for (const id of Object.keys(d.players)) if (id !== socket.id && pi < 4) { const pos = pp[pi]; addOtherPlayer(id, pos.x, 0.2, pos.z); pi++; } }
socket.on('gameStartedAtAll', (ap) => { document.getElementById('lobby-ui').style.display = 'none'; document.getElementById('controls-ui').style.display = 'block'; document.getElementById('game-info-ui').style.display = 'block'; document.getElementById('health-bar-container').style.display = 'block'; document.getElementById('game-room-title').innerText = "ODA: " + document.getElementById('ui-room-code').innerText; document.getElementById('game-player-count').innerText = Object.keys(ap).length; showModBtn(); lobbyGroup.visible = false; gameplayGroup.visible = true; rabbit.position.set(0,0,0); rabbit.rotation.y = 0; myHealth = 100; updateHealthBar(); for (const id of Object.keys(otherPlayers)) scene.remove(otherPlayers[id].mesh); otherPlayers = {}; for (const id of Object.keys(ap)) if (id !== socket.id) addOtherPlayer(id, 0, 0, 0); gameActive = true; isDead = false; gameplayGroup.updateMatrixWorld(true); });
function addOtherPlayer(id, x, y, z) { if (otherPlayers[id]) return; const m = createRabbitModel(false); m.mesh.position.set(x, y, z); scene.add(m.mesh); otherPlayers[id] = { mesh: m.mesh, visual: m.visual, head: m.head, isAttacking: false, attackAnimTime: 0 }; }
socket.on('playerMoved', (pi) => { if (gameActive && otherPlayers[pi.id]) { otherPlayers[pi.id].mesh.position.set(pi.x, pi.y, pi.z); otherPlayers[pi.id].mesh.rotation.y = pi.ry; } });
socket.on('playerAttacked', (id) => { if (gameActive && otherPlayers[id]) { otherPlayers[id].isAttacking = true; otherPlayers[id].attackAnimTime = 0; } });
socket.on('knockback', (ang) => { if (!gameActive || isDead) return; rabbit.position.x += Math.sin(ang)*2; rabbit.position.z += Math.cos(ang)*2; socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y }); });
socket.on('playerDisconnected', (id) => { if (otherPlayers[id]) { scene.remove(otherPlayers[id].mesh); delete otherPlayers[id]; } });
socket.on('hostDisconnected', () => { alert('Oda sahibi ayrıldı.'); location.reload(); });

// --- KAMERA ---
let cameraAngleY = 0, cameraAngleX = 0.4, cameraDistance = 10, touchStartX = 0, touchStartY = 0, isTurningCamera = false;
window.addEventListener('touchstart', (e) => { if (e.touches.length === 1 && !zone.contains(e.target) && !document.getElementById('jump-button').contains(e.target) && !document.getElementById('attack-button').contains(e.target)) { isTurningCamera = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; } }, { passive: true });
window.addEventListener('touchmove', (e) => { if (!isTurningCamera) return; for (let i = 0; i < e.touches.length; i++) { if (!zone.contains(e.touches[i].target) && !document.getElementById('jump-button').contains(e.touches[i].target) && !document.getElementById('attack-button').contains(e.touches[i].target)) { cameraAngleY -= (e.touches[i].clientX - touchStartX) * 0.005; cameraAngleX += (e.touches[i].clientY - touchStartY) * 0.005; cameraAngleX = Math.max(0.1, Math.min(1.2, cameraAngleX)); touchStartX = e.touches[i].clientX; touchStartY = e.touches[i].clientY; break; } } }, { passive: true });
window.addEventListener('touchend', () => { isTurningCamera = false; });

// --- MAYMUN AI + ANAHTAR + KAFES ---
let monkeyCooldown = 0;
function updateMonkeys(dt) {
    if (monkeyCooldown > 0) monkeyCooldown -= dt;
    let allDead = monkeys.length > 0;
    for (const mk of monkeys) {
        const ud = mk.userData;
        if (ud.isDead) { if (Date.now() - ud.deathTime > 60000) { ud.isDead = false; ud.health = ud.maxHealth; mk.visible = true; mk.position.set(ud.homeX, ud.homeY, ud.homeZ); } continue; }
        const d = new THREE.Vector2(mk.position.x - rabbit.position.x, mk.position.z - rabbit.position.z).length();
        const dh = new THREE.Vector2(mk.position.x - ud.homeX, mk.position.z - ud.homeZ).length();
        if (d < ud.chaseRange && dh < ud.homeRange) {
            const a = Math.atan2(rabbit.position.x - mk.position.x, rabbit.position.z - mk.position.z);
            ud.targetX = mk.position.x + Math.sin(a) * ud.speed; ud.targetZ = mk.position.z + Math.cos(a) * ud.speed;
            mk.rotation.y = a;
            if (d < ud.attackRange && monkeyCooldown <= 0) { monkeyCooldown = 1.5; myHealth -= 10; updateHealthBar(); if (myHealth <= 0) die(); }
        } else if (dh > 0.5) {
            const a = Math.atan2(ud.homeX - mk.position.x, ud.homeZ - mk.position.z);
            ud.targetX = mk.position.x + Math.sin(a) * ud.speed; ud.targetZ = mk.position.z + Math.cos(a) * ud.speed;
            mk.rotation.y = a;
        }
        mk.position.x += (ud.targetX - mk.position.x) * 0.1; mk.position.z += (ud.targetZ - mk.position.z) * 0.1;
        mk.position.y = ud.homeY + Math.abs(Math.sin(Date.now()*0.005 + ud.homeX)) * 0.2;
        if (d < ud.chaseRange) { mhc.style.display = 'block'; document.getElementById('mhf').style.width = (ud.health/ud.maxHealth*100) + '%'; document.getElementById('mht').innerText = ud.health + '/' + ud.maxHealth; }
        if (isAttacking && d < ud.attackRange + 0.5 && attackAnimTime < 0.2) { ud.health -= 25; if (ud.health <= 0) { ud.health = 0; ud.isDead = true; ud.deathTime = Date.now(); mk.visible = false; mhc.style.display = 'none'; } }
        allDead = allDead && ud.isDead;
    }
    if (allDead && !hasKey && keyMesh) keyMesh.visible = true;
    if (keyMesh && keyMesh.visible && !hasKey && rabbit.position.distanceTo(keyMesh.position) < 2) { hasKey = true; keyMesh.visible = false; keyMesh.position.set(0,0,0); keyMesh.scale.set(0.5,0.5,0.5); rabbit.add(keyMesh); keyMesh.position.set(0, 2, 0); keyMesh.visible = true; }
    if (hasKey && cageGroup && !cageOpened && rabbit.position.distanceTo(cageGroup.position) < 3) { cageOpened = true; for (const c of [...cageGroup.children]) { const i = obstacles.indexOf(c); if (i > -1) obstacles.splice(i, 1); } gameplayGroup.remove(cageGroup); cageGroup = null; if (keyMesh) { rabbit.remove(keyMesh); keyMesh = null; hasKey = false; } const msg = document.createElement('div'); msg.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; font-size:48px; font-weight:bold; text-shadow:0 0 20px gold; z-index:100;'; msg.innerText = 'Pamuk Kurtuldu!'; document.body.appendChild(msg); setTimeout(() => { msg.style.transition = 'opacity 1s'; msg.style.opacity = '0'; setTimeout(() => document.body.removeChild(msg), 1000); }, 2000); }
}

// --- ANA DÖNGÜ ---
let legWiggle = 0;
function animate() {
    requestAnimationFrame(animate); const dt = Math.min(clock.getDelta(), 0.1); updateMonkeys(dt);
    let mx = 0, mz = 0; if (joystickActive) { mx = moveX; mz = moveZ; } if (keys['w'] || keys['arrowup']) mz = -1; if (keys['s'] || keys['arrowdown']) mz = 1; if (keys['a'] || keys['arrowleft']) mx = -1; if (keys['d'] || keys['arrowright']) mx = 1;
    document.getElementById('coords').innerText = `X:${Math.round(rabbit.position.x)} Y:${Math.round(rabbit.position.y)} Z:${Math.round(rabbit.position.z)}`;
    const inRF = rabbit.position.x > rfMinX && rabbit.position.x < rfMaxX && rabbit.position.z > rfMinZ && rabbit.position.z < rfMaxZ;
    updateRain(inRF, rfCenterX, rfCenterZ, rfWidth, rfDepth);
    scene.fog = inRF ? new THREE.Fog(0x556633, 40, 120) : new THREE.Fog(0x87CEEB, 120, 400);
    ambientLight.intensity = inRF ? 0.4 : 0.7;
    if (gameActive && !isDead) { for (const p of portals) if (new THREE.Vector2(rabbit.position.x - p.mesh.position.x, rabbit.position.z - p.mesh.position.z).length() < 2.5 && Date.now()/1000 - lastTeleportTime > teleportCooldown) { lastTeleportTime = Date.now()/1000; document.getElementById('death-screen').style.display = 'flex'; document.getElementById('death-screen').style.background = 'rgba(0,0,0,0.95)'; document.querySelector('.death-text').innerText = 'YÜKLENİYOR...'; document.getElementById('countdown-display').innerText = ''; setTimeout(() => { rabbit.position.x = p.target.x; rabbit.position.z = p.target.z; document.getElementById('death-screen').style.display = 'none'; }, 600); break; } }
    if (isOnlineMode && !gameActive && !isDead) { rabbit.rotation.y += 1.2 * dt; for (const id of Object.keys(otherPlayers)) otherPlayers[id].mesh.rotation.y += 1.2 * dt; camera.position.set(0, 3.5, 43); camera.lookAt(0, 1.2, 50); }
    if (gameActive && !isDead) {
        if (Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05) {
            const fx = Math.sin(cameraAngleY), fz = Math.cos(cameraAngleY), rx = Math.sin(cameraAngleY+Math.PI/2), rz = Math.cos(cameraAngleY+Math.PI/2);
            const dx = (fx*-mz) - (rx*mx), dz = (fz*-mz) - (rz*mx);
            const nx = rabbit.position.x + dx*12*dt, nz = rabbit.position.z + dz*12*dt;
            if (!checkCollision(nx, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nx;
            if (!checkCollision(rabbit.position.x, rabbit.position.y, nz)) rabbit.position.z = nz;
            rabbit.rotation.y = Math.atan2(dx, dz);
            legWiggle += 15*dt;
            player.feet[0].position.y = 0.08 + Math.abs(Math.sin(legWiggle))*0.12;
            player.feet[3].position.y = 0.08 + Math.abs(Math.sin(legWiggle))*0.12;
            player.feet[1].position.y = 0.08 + Math.abs(Math.cos(legWiggle))*0.12;
            player.feet[2].position.y = 0.08 + Math.abs(Math.cos(legWiggle))*0.12;
        } else { for (const f of player.feet) f.position.y = 0.08; }
        if (isAttacking) { attackAnimTime += 12*dt; const f = Math.sin(attackAnimTime*Math.PI); if (attackAnimTime <= 1) { player.visual.position.z = f*0.5; player.head.position.z = 0.1 + f*0.25; player.head.rotation.x = f*0.4; } else { isAttacking = false; player.visual.position.z = 0; player.head.position.z = 0.1; player.head.rotation.x = 0; } }
        for (const id of Object.keys(otherPlayers)) { const op = otherPlayers[id]; if (op.isAttacking) { op.attackAnimTime += 12*dt; const f = Math.sin(op.attackAnimTime*Math.PI); if (op.attackAnimTime <= 1) { op.visual.position.z = f*0.5; op.head.position.z = 0.1 + f*0.25; op.head.rotation.x = f*0.4; } else { op.isAttacking = false; op.visual.position.z = 0; op.head.position.z = 0.1; op.head.rotation.x = 0; } } }
        const fy = getFloorY(rabbit.position.x, rabbit.position.y, rabbit.position.z); velocityY -= gravity*60*dt; rabbit.position.y += velocityY*dt;
        if (rabbit.position.y <= fy) { rabbit.position.y = fy; velocityY = 0; jumpCount = 0; }
        if (isOnlineMode) for (const id of Object.keys(otherPlayers)) { const o = otherPlayers[id].mesh; if (rabbit.position.distanceTo(o.position) < 1.2 && rabbit.position.distanceTo(o.position) > 0.01) { const a = Math.atan2(rabbit.position.x - o.position.x, rabbit.position.z - o.position.z); rabbit.position.x += Math.sin(a)*0.05; rabbit.position.z += Math.cos(a)*0.05; o.position.x -= Math.sin(a)*0.05; o.position.z -= Math.cos(a)*0.05; } }
        socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y });
        camera.position.x = rabbit.position.x - Math.sin(cameraAngleY)*Math.cos(cameraAngleX)*cameraDistance;
        camera.position.z = rabbit.position.z - Math.cos(cameraAngleY)*Math.cos(cameraAngleX)*cameraDistance;
        camera.position.y = rabbit.position.y + Math.sin(cameraAngleX)*cameraDistance;
        camera.lookAt(rabbit.position.x, rabbit.position.y + 0.4, rabbit.position.z);
    }
    renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });