// client.js - ÖZEL BEKLEME ALANLI VE TOPLU DÖNÜŞLÜ SÜRÜM

const socket = io();
const clock = new THREE.Clock();

let isOnlineMode = false;
let gameActive = false; // Maç başladı mı?
let maxPlayersLimit = 4;

// 3D KAMERA VE SAHNE KURULUMU
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.shadowMap.enabled = true; 
document.getElementById('canvas-container').appendChild(renderer.domElement);

// IŞIKLAR VE ASIL OYUN ZEMİNİ
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(20, 40, 20); dirLight.castShadow = true; scene.add(dirLight);

const floorGeometry = new THREE.PlaneGeometry(60, 60);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 }); 
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// --- YENİ: BAŞKA BİR YERDEKİ ÖZEL LOBİ PLATFORMU ---
// Bu platform havada duruyor, maç başlamadan önce herkes burada toplanacak!
const lobbyFloorGeo = new THREE.BoxGeometry(15, 1, 15);
const lobbyFloorMat = new THREE.MeshStandardMaterial({ color: 0x3f51b5, roughness: 0.4 }); // Mavi lobi alanı
const lobbyFloor = new THREE.Mesh(lobbyFloorGeo, lobbyFloorMat);
lobbyFloor.position.set(0, 20, 30); // Havada, bambaşka bir konum!
lobbyFloor.receiveShadow = true; lobbyFloor.castShadow = true;
scene.add(lobbyFloor);
lobbyFloor.geometry.computeBoundingBox();

// ENGELLER VE SALLANAN KUKLA (Asıl Oyun Alanında)
const obstacles = [lobbyFloor]; // Lobi zeminini de fizik nesnesi yaptık ki düşmeyelim
function createCube(x, y, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y / 2, z); mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh); mesh.geometry.computeBoundingBox(); obstacles.push(mesh); 
}
createCube(5, 2, -8, 2, 2, 2, 0xff9800);     
createCube(-7, 1, -3, 3, 1, 3, 0x00bcd4);    
createCube(0, 3, -15, 4, 3, 4, 0x9c27b0);    
createCube(8, 1, 6, 2, 1, 2, 0xffeb3b);      

const dummyGeometry = new THREE.BoxGeometry(1, 2.5, 1);
const dummyMaterial = new THREE.MeshStandardMaterial({ color: 0xe67e22 }); 
const dummy = new THREE.Mesh(dummyGeometry, dummyMaterial);
dummy.position.set(0, 1.25, -5); dummy.castShadow = true; dummy.receiveShadow = true; dummy.geometry.computeBoundingBox();
scene.add(dummy); obstacles.push(dummy); 

let isDummyHit = false, dummySwayAngle = 0, dummySwayTime = 0;
function swayDummy() { isDummyHit = true; dummySwayTime = 0; }

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

// Karakter ilk açılışta ana menüde (aşağıda) bekliyor
const localPlayer = createRabbitModel(true);
const rabbit = localPlayer.mesh; const rabbitVisualGroup = localPlayer.visual; const head = localPlayer.head;
const footFL = localPlayer.feet[0], footFR = localPlayer.feet[1], footBL = localPlayer.feet[2], footBR = localPlayer.feet[3];
rabbit.position.set(0, 0, 0); 
scene.add(rabbit);

let otherPlayers = {};
let isAttacking = false, attackAnimTime = 0;

// FİZİK MOTORU
function checkCollision(newX, newY, newZ) {
    const playerBox = new THREE.Box3(new THREE.Vector3(newX - 0.35, newY + 0.1, newZ - 0.4), new THREE.Vector3(newX + 0.35, newY + 1.1, newZ + 0.4));
    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.intersectsBox(obstacleBox)) {
            if (newY >= obstacleBox.max.y - 0.15) continue; 
            return true; 
        }
    }
    return false; 
}

function getPlatformY(x, z) {
    let highestPlatformY = 0;
    const playerBox = new THREE.Box3(new THREE.Vector3(x - 0.3, -100, z - 0.3), new THREE.Vector3(x + 0.3, 100, z + 0.3));
    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.min.x < obstacleBox.max.x && playerBox.max.x > obstacleBox.min.x && playerBox.min.z < obstacleBox.max.z && playerBox.max.z > obstacleBox.min.z) {
            if (obstacleBox.max.y > highestPlatformY) highestPlatformY = obstacleBox.max.y;
        }
    }
    return highestPlatformY; 
}

let velocityY = 0, jumpCount = 0;
const gravity = 0.8, jumpForce = 18; 

// --- PANEL BUTON KOMUTLARI ---

// TEK OYNA MODU (Direkt aşağıda başlatır)
window.playSolo = function() {
    isOnlineMode = false;
    gameActive = true; 
    document.getElementById('lobby-container').style.display = 'none';
    document.getElementById('room-info').style.display = 'block';
    document.getElementById('current-room-text').innerText = "TEK OYUNCULU";
    document.getElementById('player-count-text').innerText = "1";
    rabbit.position.set(0, 0, 0); // Asıl harita
    rabbit.rotation.y = 0;
}

// ODA OLUŞTURMA
window.createRoom = function() { 
    isOnlineMode = true;
    const maxVal = document.getElementById('max-players-range').value;
    socket.emit('createRoom', { maxPlayers: maxVal }); 
}

// ODAYA KATILMA
window.joinRoom = function() {
    const code = document.getElementById('room-code-input').value.trim();
    if(code.length === 5) {
        isOnlineMode = true;
        socket.emit('joinRoom', code);
    } else {
        alert("Oda kodu 5 basamaklı sayı olmalı!");
    }
}

window.hostStartGame = function() {
    socket.emit('startGameSignal');
}

// --- NETWORK SİNYALLERİ ---

// Kurucu odayı açınca havaya (başka yere) ışınlanır
socket.on('roomCreated', (data) => {
    maxPlayersLimit = data.maxPlayers;
    document.getElementById('lobby-container').style.display = 'none';
    document.getElementById('waiting-container').style.display = 'flex';
    document.getElementById('waiting-code-text').innerText = data.roomCode;
    document.getElementById('start-game-btn').style.display = 'block';
    document.getElementById('waiting-count-text').innerText = "1 / " + maxPlayersLimit;
    
    // BAŞKA YERE IŞINLANMA (Lobi Platformu Üzeri)
    rabbit.position.set(0, 20.5, 30); 
});

// Birileri lobiye girince çalışan ortak senkronizasyon alanı
socket.on('roomUpdate', (data) => {
    maxPlayersLimit = data.maxPlayers;
    document.getElementById('lobby-container').style.display = 'none';
    document.getElementById('waiting-container').style.display = 'flex';
    document.getElementById('waiting-code-text').innerText = data.roomCode;
    
    const currentCount = Object.keys(data.players).length;
    document.getElementById('waiting-count-text').innerText = `${currentCount} / ${maxPlayersLimit}`;

    if (data.hostId === socket.id) {
        document.getElementById('start-game-btn').style.display = 'block';
        document.getElementById('waiting-status-text').innerText = "Oyunu başlatmaya hazırsın!";
    } else {
        document.getElementById('start-game-btn').style.display = 'none';
        document.getElementById('waiting-status-text').innerText = "Kurucunun oyunu başlatması bekleniyor...";
    }

    // Kendimizi de lobi platformuna ışınlıyoruz
    rabbit.position.set(0, 20.5, 30);

    // Diğer gelen oyuncuları da lobi platformuna yan yana dizelim
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    
    let index = 1;
    Object.keys(data.players).forEach((id) => {
        if (id !== socket.id) {
            // Yan yana dizilme hesabı (x ekseninde mesafe bırakarak yerleştiriyoruz)
            let spawnX = index * 1.5; 
            if(index % 2 === 0) spawnX = -spawnX;
            
            addOtherPlayer(id, spawnX, 20.5, 30);
            index++;
        }
    });
});

// VE MAÇ BAŞLADI: Herkes aynı anda asıl haritaya (aşağıya) ışınlanır!
socket.on('gameStartedAtAll', (allPlayers) => {
    document.getElementById('waiting-container').style.display = 'none';
    document.getElementById('room-info').style.display = 'block';
    
    const currentCode = document.getElementById('waiting-code-text').innerText;
    document.getElementById('current-room-text').innerText = "ODA: " + currentCode;
    
    // 1. KENDİMİZİ ASIL MAÇ ALANINA (AŞAĞIYA) IŞINLIYORUZ
    rabbit.position.set(0, 0, 0); 
    rabbit.rotation.y = 0; 
    
    // 2. DİĞERLERİNİ DE ASIL MAÇ ALANINA ALIYORUZ VE DÖNMELERİNİ KAPATIYORUZ
    Object.keys(otherPlayers).forEach(id => scene.remove(otherPlayers[id].mesh));
    otherPlayers = {};
    
    Object.keys(allPlayers).forEach((id) => {
        if (id !== socket.id) {
            // Aşağıda normal başlasınlar
            addOtherPlayer(id, 0, 0, 0);
        }
    });
    
    document.getElementById('player-count-text').innerText = Object.keys(allPlayers).length;
    gameActive = true; // Karakter hareket kilidi açıldı!
});

socket.on('roomError', (msg) => { alert(msg); isOnlineMode = false; });

socket.on('playerMoved', (playerInfo) => {
    if (isOnlineMode && gameActive && otherPlayers[playerInfo.id]) {
        otherPlayers[playerInfo.id].mesh.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
        otherPlayers[playerInfo.id].mesh.rotation.y = playerInfo.ry;
    }
});

socket.on('playerAttacked', (id) => {
    if (isOnlineMode && gameActive && otherPlayers[id]) { otherPlayers[id].isAttacking = true; otherPlayers[id].attackAnimTime = 0; }
});

socket.on('playerDisconnected', (id) => {
    if (otherPlayers[id]) { scene.remove(otherPlayers[id].mesh); delete otherPlayers[id]; }
    document.getElementById('player-count-text').innerText = Object.keys(otherPlayers).length + 1;
});

function addOtherPlayer(id, x, y, z) {
    if (otherPlayers[id]) return;
    const modelData = createRabbitModel(false);
    modelData.mesh.position.set(x, y, z);
    scene.add(modelData.mesh);
    otherPlayers[id] = { mesh: modelData.mesh, visual: modelData.visual, head: modelData.head, isAttacking: false, attackAnimTime: 0 };
}

// MOBİL PARMAK JOYSTICK MOTORU
const zone = document.getElementById('joystick-zone'), stick = document.getElementById('joystick-stick'), maxRadius = 35; 
let joystickActive = false, moveX = 0, moveZ = 0;

zone.addEventListener('touchstart', (e) => { if(!gameActive) return; joystickActive = true; handleJoystick(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
window.addEventListener('touchmove', (e) => {
    if (joystickActive && gameActive) {
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

// KAMERA AYARLARI
let cameraAngleY = 0, cameraAngleX = 0.2, cameraDistance = 4.5, touchStartX = 0, touchStartY = 0, startTouchDistance = 0, isTurningCamera = false, isZooming = false;

window.addEventListener('touchstart', (e) => {
    if(!gameActive) return;
    const jBtn = document.getElementById('jump-button'), aBtn = document.getElementById('attack-button');
    if (e.touches.length === 2 && !zone.contains(e.target) && !jBtn.contains(e.target) && !aBtn.contains(e.target)) {
        isZooming = true; isTurningCamera = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        startTouchDistance = Math.sqrt(dx * dx + dy * dy); return;
    }
    if (e.touches.length === 1 && !zone.contains(e.target) && !jBtn.contains(e.target) && !aBtn.contains(e.target)) {
        isTurningCamera = true; touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; 
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if(!gameActive) return;
    if (isZooming && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        const curDist = Math.sqrt(dx * dx + dy * dy);
        cameraDistance += (startTouchDistance - curDist) * 0.03; cameraDistance = Math.max(3.0, Math.min(15.0, cameraDistance));
        startTouchDistance = curDist; return;
    }
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
window.addEventListener('touchend', (e) => { if (e.touches.length < 2) isZooming = false; if (e.touches.length === 0) isTurningCamera = false; });

function executeJump() { if (gameActive && jumpCount < 2) { velocityY = jumpForce; jumpCount++; } }
function executeAttack() { 
    if (gameActive && !isAttacking) { 
        isAttacking = true; attackAnimTime = 0; 
        if (isOnlineMode) socket.emit('playerAttack'); 
        if (rabbit.position.distanceTo(dummy.position) < 2.5) swayDummy(); 
    } 
}

const jb = document.getElementById('jump-button'), ab = document.getElementById('attack-button');
jb.addEventListener('touchstart', (e) => { e.preventDefault(); executeJump(); });
ab.addEventListener('touchstart', (e) => { e.preventDefault(); executeAttack(); });

// ANA UPDATE DÖNGÜSÜ
const baseSpeed = 9.0; let legWiggle = 0;

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = Math.min(clock.getDelta(), 0.1); 
    let hasMoved = false;

    // --- KRİTİK ALAN: BEKLEME ODASINDAYSAK HERKESİ BİRLİKTE DÖNDÜRÜYORUZ ---
    if (isOnlineMode && !gameActive && rabbit.position.y > 15) {
        // 1. Biz kendi eksenimizde dönüyoruz
        rabbit.rotation.y += 1.5 * deltaTime;
        
        // 2. Odadaki diğer oyuncuların modellerini de kendi eksenlerinde döndürüyoruz!
        Object.keys(otherPlayers).forEach((id) => {
            otherPlayers[id].mesh.rotation.y += 1.5 * deltaTime;
        });

        // Kamera lobi alanına kilitlensin ve herkesi net görsenti
        cameraDistance = 5.5;
        cameraAngleY = Math.PI; // Tam karşı açı
        cameraAngleX = 0.25;
    }

    // NORMAL OYUN HAREKETLERİ (Oyun başlayınca aktif olur)
    if (gameActive && joystickActive && (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05)) {
        const forwardX = Math.sin(cameraAngleY), forwardZ = Math.cos(cameraAngleY);
        const rightX = Math.sin(cameraAngleY + Math.PI / 2), rightZ = Math.cos(cameraAngleY + Math.PI / 2);
        const dirX = (forwardX * -moveZ) - (rightX * moveX);
        const dirZ = (forwardZ * -moveZ) - (rightZ * moveX);
        
        const nextX = rabbit.position.x + dirX * baseSpeed * deltaTime;
        const nextZ = rabbit.position.z + dirZ * baseSpeed * deltaTime;
        
        if (!checkCollision(nextX, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nextX;
        if (!checkCollision(rabbit.position.x, rabbit.position.y, nextZ)) rabbit.position.z = nextZ;
        
        rabbit.rotation.y = Math.atan2(dirX, dirZ);
        hasMoved = true;

        if (jumpCount === 0 && !isAttacking) { 
            legWiggle += 15 * deltaTime;
            footFL.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footBR.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
            footFR.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
            footBL.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
        }
    } else {
        if (gameActive && jumpCount === 0 && !isAttacking) { footFL.position.y = 0.08; footFR.position.y = 0.08; footBL.position.y = 0.08; footBR.position.y = 0.08; }
    }

    if (gameActive && isAttacking) {
        attackAnimTime += 12 * deltaTime; 
        const factor = Math.sin(attackAnimTime * Math.PI); 
        if (attackAnimTime <= 1.0) {
            rabbitVisualGroup.position.z = factor * 0.5; head.position.z = 0.1 + factor * 0.25; head.rotation.x = factor * 0.4;
        } else {
            isAttacking = false; rabbitVisualGroup.position.z = 0; head.position.z = 0.1; head.rotation.x = 0;
        }
    }

    if (isOnlineMode && gameActive) {
        Object.keys(otherPlayers).forEach((id) => {
            const p = otherPlayers[id];
            if (p.isAttacking) {
                p.attackAnimTime += 12 * deltaTime;
                const factor = Math.sin(p.attackAnimTime * Math.PI);
                if (p.attackAnimTime <= 1.0) {
                    p.visual.position.z = factor * 0.5; p.head.position.z = 0.1 + factor * 0.25; p.head.rotation.x = factor * 0.4;
                } else { p.isAttacking = false; p.visual.position.z = 0; p.head.position.z = 0.1; p.head.rotation.x = 0; }
            }
        });
    }

    if (gameActive && isDummyHit) {
        dummySwayTime += 7 * deltaTime;
        dummySwayAngle = Math.sin(dummySwayTime * 2.0) * 5 * Math.pow(0.90, dummySwayTime);
        dummy.rotation.z = dummySwayAngle * (Math.PI / 180);
        if (Math.abs(dummySwayAngle) < 0.02) { isDummyHit = false; dummy.rotation.z = 0; }
    }

    // FİZİK VE DÜŞÜŞ ALGILAYICI (Lobi alanındayken lobi zeminine, maçtayken asıl zemine basar)
    if (gameActive || (!gameActive && isOnlineMode)) {
        velocityY -= gravity * 60 * deltaTime; 
        const potentialNextY = rabbit.position.y + velocityY * deltaTime;
        const finalGroundY = getPlatformY(rabbit.position.x, rabbit.position.z);

        if (potentialNextY <= finalGroundY) {
            rabbit.position.y = finalGroundY; 
            if (velocityY < -2) rabbitVisualGroup.scale.set(1.15, 0.85, 1.15); 
            velocityY = 0; jumpCount = 0; 
        } else {
            rabbit.position.y = potentialNextY; if(gameActive) hasMoved = true;
        }
        
        if (isOnlineMode && gameActive && (hasMoved || isAttacking)) {
            socket.emit('playerMovement', { x: rabbit.position.x, y: rabbit.position.y, z: rabbit.position.z, ry: rabbit.rotation.y });
        }

        if (!isAttacking) {
            rabbitVisualGroup.scale.x += (1.0 - rabbitVisualGroup.scale.x) * 0.15;
            rabbitVisualGroup.scale.y += (1.0 - rabbitVisualGroup.scale.y) * 0.15;
            rabbitVisualGroup.scale.z += (1.0 - rabbitVisualGroup.scale.z) * 0.15;
        }
    }

    // KAMERA TAKİP SİSTEMİ
    camera.position.x = rabbit.position.x - Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    camera.position.z = rabbit.position.z - Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    camera.position.y = rabbit.position.y + Math.sin(cameraAngleX) * cameraDistance;
    camera.lookAt(rabbit.position.x, rabbit.position.y + 0.4, rabbit.position.z);

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});