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
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 30, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// IŞIK
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 30, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

const gameplayGroup = new THREE.Group();
scene.add(gameplayGroup);

// Yeşil zemin (düz, geniş)
const groundGeo = new THREE.PlaneGeometry(25, 25);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
gameplayGroup.add(ground);

const obstacles = [];

// Birkaç basit ahşap platform (üzerine zıplamak için)
function createPlatform(x, y, z) {
    const geo = new THREE.BoxGeometry(2, 0.3, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    gameplayGroup.add(mesh);
    obstacles.push(mesh);
}
createPlatform(3, 0.8, 3);
createPlatform(-3, 1.2, -3);
createPlatform(4, 1.5, -4);

// Etrafa birkaç ağaç (sadece gövde, basit)
function createSimpleTree(x, z) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25;
    trunk.castShadow = true; trunk.receiveShadow = true;
    group.add(trunk);
    const leafGeo = new THREE.SphereGeometry(0.8, 8, 8);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a8f29, roughness: 0.4 });
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.y = 2.5;
    leaf.castShadow = true; leaf.receiveShadow = true;
    group.add(leaf);
    group.position.set(x, 0, z);
    gameplayGroup.add(group);
    obstacles.push(trunk);
}
createSimpleTree(-6, -6);
createSimpleTree(6, -6);
createSimpleTree(-6, 6);
createSimpleTree(6, 6);
createSimpleTree(0, -7);
createSimpleTree(0, 7);
createSimpleTree(-7, 0);
createSimpleTree(7, 0);

// MODEL FABRİKASI (tavşan)
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