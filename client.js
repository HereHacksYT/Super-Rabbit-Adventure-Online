// client.js - PARÇALARI KİLİTLİ TOMBİK TAVŞAN & SQUASH-STRETCH ZIPLAMA SİSTEMİ

// 1. ONLINE SUNUCU BAĞLANTISI
const socket = io();

socket.on('connect', () => {
    console.log('Sunucuya bağlanıldı! ID:', socket.id);
});

// 2. SAHNE VE KAMERA
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// 3. RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); 
renderer.shadowMap.enabled = true; 
document.getElementById('canvas-container').appendChild(renderer.domElement);

function enterFullScreen() {
    const doc = document.documentElement;
    if (doc.requestFullscreen) doc.requestFullscreen();
    else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
}
document.addEventListener('touchstart', enterFullScreen, { once: true });

// 4. IŞIKLANDIRMA
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); 
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// 5. HARİTA VE OYUN ALANI (Videodaki blokların yerleşimi)
const floorGeometry = new THREE.PlaneGeometry(60, 60);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 }); 
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; 
floor.receiveShadow = true; 
scene.add(floor);

const obstacles = [];
function createCube(x, y, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    mesh.geometry.computeBoundingBox();
    obstacles.push(mesh);
}

// Videondaki gibi tırmanılabilir renkli bloklar
createCube(3, 0.5, -4, 2, 1, 2, 0xffeb3b);   // Sarı alçak blok
createCube(-3, 1, -8, 2, 2, 2, 0xff9800);   // Turuncu blok
createCube(0, 1.5, -12, 3, 3, 3, 0x9c27b0); // Mor büyük blok
createCube(-5, 0.5, -2, 3, 1, 3, 0x00bcd4); // Turkuaz blok

// SALLANAN KUKLA (DUMMY)
const dummyGeometry = new THREE.BoxGeometry(1, 2.5, 1);
const dummyMaterial = new THREE.MeshStandardMaterial({ color: 0xe67e22 }); 
const dummy = new THREE.Mesh(dummyGeometry, dummyMaterial);
dummy.position.set(0, 1.25, -5); 
dummy.castShadow = true;
dummy.receiveShadow = true;
dummy.geometry.computeBoundingBox();
scene.add(dummy);
obstacles.push(dummy); 

let isDummyHit = false;
let dummySwayTime = 0;

function swayDummy() {
    isDummyHit = true;
    dummySwayTime = 0; 
}

// 6. TAMAMEN KİLİTLİ VE TOMBİK TAVŞAN MODELİ
const rabbit = new THREE.Group();
rabbit.position.set(0, 0.6, 0); 
scene.add(rabbit);

// Animasyonların parçaları uçurmaması için her şeyi tutan ana iç grup
const rabbitVisualGroup = new THREE.Group();
rabbit.add(rabbitVisualGroup);

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }); 
const noseMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa, roughness: 0.3 }); 
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });   

// TOMBİK GÖVDE: Genişliği ve yüksekliği artırılmış pofuduk kutu
const bodyGeo = new THREE.BoxGeometry(1.3, 1.1, 1.4);
const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
bodyMesh.position.y = 0.4;
bodyMesh.castShadow = true;
bodyMesh.receiveShadow = true;
rabbitVisualGroup.add(bodyMesh);

// KİLİTLİ KAFA GRUBU: Göz, burun ve kulaklar bu gruba ekleniyor. Asla havada kalmazlar!
const headGroup = new THREE.Group();
headGroup.position.set(0, 1.1, 0.3); 
rabbitVisualGroup.add(headGroup);

// Tombik Kafa
const headGeo = new THREE.BoxGeometry(0.9, 0.85, 0.85);
const headMesh = new THREE.Mesh(headGeo, bodyMat);
headMesh.castShadow = true;
headMesh.receiveShadow = true;
headGroup.add(headMesh);

// Ayrılmayan Burun
const noseGeo = new THREE.BoxGeometry(0.18, 0.14, 0.12);
const noseMesh = new THREE.Mesh(noseGeo, noseMat);
noseMesh.position.set(0, -0.08, 0.43); 
noseMesh.castShadow = true;
headGroup.add(noseMesh); 

// Gözler
const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);
const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
eyeL.position.set(-0.25, 0.1, 0.41);
headGroup.add(eyeL);

const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
eyeR.position.set(0.25, 0.1, 0.41);
headGroup.add(eyeR);

// Tombik Kulaklar
const earGeo = new THREE.BoxGeometry(0.18, 0.7, 0.12);
const earL = new THREE.Mesh(earGeo, bodyMat);
earL.position.set(-0.25, 0.6, -0.05);
earL.castShadow = true;
headGroup.add(earL);

const earR = new THREE.Mesh(earGeo, bodyMat);
earR.position.set(0.25, 0.6, -0.05);
earR.castShadow = true;
headGroup.add(earR);

// Kilitli Tombik Kuyruk
const tailGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
const tailMesh = new THREE.Mesh(tailGeo, bodyMat);
tailMesh.position.set(0, 0.3, -0.75);
tailMesh.castShadow = true;
rabbitVisualGroup.add(tailMesh);

// Patiler (Yürüme sallantısı için ana gruba bağlıdır)
const footGeo = new THREE.BoxGeometry(0.3, 0.2, 0.4);
const footMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 });
const createFoot = (x, z) => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(x, 0.1, z);
    foot.castShadow = true;
    rabbit.add(foot);
    return foot;
};
const fFL = createFoot(-0.4, 0.4);  
const fFR = createFoot(0.4, 0.4);   
const fBL = createFoot(-0.4, -0.3); 
const fBR = createFoot(0.4, -0.3);  

// VURMA EFEKTİ
const attackGeometry = new THREE.RingGeometry(0.2, 0.9, 16);
const attackMaterial = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0, side: THREE.DoubleSide });
const attackEffect = new THREE.Mesh(attackGeometry, attackMaterial);
scene.add(attackEffect);
attackEffect.rotation.x = Math.PI / 2; 

let isAttacking = false;
let attackAnimTime = 0;

// ÇARPIŞMA (COLLISION) KONTROLÜ
function checkCollision(newX, newY, newZ) {
    const playerBox = new THREE.Box3(
        new THREE.Vector3(newX - 0.65, newY - 0.6, newZ - 0.7),
        new THREE.Vector3(newX + 0.65, newY + 1.2, newZ + 0.7)
    );
    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.intersectsBox(obstacleBox)) return true; 
    }
    return false;
}

// YERDEN YÜKSEKLİK BULMA (Blokların üstünde durabilmek için)
function getFloorY(x, z) {
    let highestY = 0;
    const playerBox = new THREE.Box3(
        new THREE.Vector3(x - 0.65, -100, z - 0.7),
        new THREE.Vector3(x + 0.65, 100, z + 0.7)
    );
    
    for (let i = 0; i < obstacles.length; i++) {
        const obsBox = new THREE.Box3().setFromObject(obstacles[i]);
        // Sadece X ve Z ekseninde çakışma var mı bakıyoruz
        if (playerBox.min.x < obsBox.max.x && playerBox.max.x > obsBox.min.x &&
            playerBox.min.z < obsBox.max.z && playerBox.max.z > obsBox.min.z) {
            if (obsBox.max.y > highestY) {
                highestY = obsBox.max.y;
            }
        }
    }
    return highestY;
}

// FİZİK KONTROLLERİ
let velocityY = 0;
let jumpCount = 0;
let isJumping = false;
const gravity = 0.014;
const jumpForce = 0.34;

// JOYSTICK DÜZENEĞİ
const zone = document.getElementById('joystick-zone');
const stick = document.getElementById('joystick-stick');
const maxRadius = 35; 

let joystickActive = false;
let moveX = 0, moveZ = 0;

zone.addEventListener('touchstart', (e) => {
    joystickActive = true;
    handleJoystick(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (joystickActive) {
        for (let i = 0; i < e.touches.length; i++) {
            if (zone.contains(e.touches[i].target)) {
                handleJoystick(e.touches[i].clientX, e.touches[i].clientY);
                break;
            }
        }
    }
}, { passive: true });

zone.addEventListener('touchend', () => {
    joystickActive = false;
    stick.style.transform = 'translate(0px, 0px)';
    moveX = 0; moveZ = 0;
});

function handleJoystick(clientX, clientY) {
    const zoneRect = zone.getBoundingClientRect();
    const centerX = zoneRect.left + zoneRect.width / 2;
    const centerY = zoneRect.top + zoneRect.height / 2;
    let deltaX = clientX - centerX, deltaY = clientY - centerY;
    let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > maxRadius) {
        deltaX = (deltaX / distance) * maxRadius;
        deltaY = (deltaY / distance) * maxRadius;
    }
    stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    moveX = deltaX / maxRadius; moveZ = deltaY / maxRadius;
}

// KAMERA DÖNDÜRME
let cameraAngleY = 0; 
let touchStartX = 0;
let isTurningCamera = false;

window.addEventListener('touchstart', (e) => {
    const jumpBtn = document.getElementById('jump-button');
    const attackBtn = document.getElementById('attack-button');
    if (!zone.contains(e.target) && !jumpBtn.contains(e.target) && !attackBtn.contains(e.target)) {
        isTurningCamera = true;
        touchStartX = e.touches[0].clientX;
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (!isTurningCamera) return;
    const jumpBtn = document.getElementById('jump-button');
    const attackBtn = document.getElementById('attack-button');
    for (let i = 0; i < e.touches.length; i++) {
        if (!zone.contains(e.touches[i].target) && !jumpBtn.contains(e.touches[i].target) && !attackBtn.contains(e.touches[i].target)) {
            let deltaX = e.touches[i].clientX - touchStartX;
            cameraAngleY -= deltaX * 0.005; 
            touchStartX = e.touches[i].clientX;
            break;
        }
    }
}, { passive: true });

window.addEventListener('touchend', () => { isTurningCamera = false; });

// BUTON TETİKLEYİCİLERİ
function executeJump() {
    if (jumpCount < 2) {
        velocityY = jumpForce;
        jumpCount++;
        isJumping = true;
    }
}

function executeAttack() {
    if (!isAttacking) {
        isAttacking = true;
        attackAnimTime = 0;
        const distToDummy = rabbit.position.distanceTo(dummy.position);
        if (distToDummy < 2.5) { 
            swayDummy();
        }
    }
}

const jumpButton = document.getElementById('jump-button');
const attackButton = document.getElementById('attack-button');

jumpButton.addEventListener('touchend', (e) => { e.preventDefault(); executeJump(); });
attackButton.addEventListener('touchend', (e) => { e.preventDefault(); executeAttack(); });
jumpButton.addEventListener('click', (e) => { e.preventDefault(); executeJump(); });
attackButton.addEventListener('click', (e) => { e.preventDefault(); executeAttack(); });

// 7. OYUN DÖNGÜSÜ VE GERÇEKÇİ MOBİL OYUN ANİMASYONLARI
const speed = 0.14;
const cameraDistance = 6.5, cameraHeight = 4.0;    
let legWiggle = 0;

function animate() {
    requestAnimationFrame(animate);

    // BLOK ÜSTÜ DURMA VE YERÇEKİMİ HESABI
    const targetFloorY = getFloorY(rabbit.position.x, rabbit.position.z);
    
    velocityY -= gravity;
    rabbit.position.y += velocityY;

    // Alt sınır veya platform yüzeyine basma kontrolü
    const currentGroundY = Math.max(0.6, targetFloorY + 0.6);

    if (rabbit.position.y <= currentGroundY) {
        rabbit.position.y = currentGroundY;
        
        // Düşerken yere çarpma anında hafifçe büzülme (Squash) efekti
        if (velocityY < -0.05) {
            rabbitVisualGroup.scale.set(1.2, 0.8, 1.2);
        }
        
        velocityY = 0;
        jumpCount = 0;
        isJumping = false;
    }

    // Pürüzsüz animasyon ölçeğini normale döndürme (Esneklik sönümlemesi)
    rabbitVisualGroup.scale.x += (1.0 - rabbitVisualGroup.scale.x) * 0.2;
    rabbitVisualGroup.scale.y += (1.0 - rabbitVisualGroup.scale.y) * 0.2;
    rabbitVisualGroup.scale.z += (1.0 - rabbitVisualGroup.scale.z) * 0.2;

    // HAREKET VE YÜRÜME
    if (joystickActive && (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05)) {
        const forwardX = Math.sin(cameraAngleY), forwardZ = Math.cos(cameraAngleY);
        const rightX = Math.sin(cameraAngleY + Math.PI / 2), rightZ = Math.cos(cameraAngleY + Math.PI / 2);
        const directionX = (forwardX * -moveZ) - (rightX * moveX);
        const directionZ = (forwardZ * -moveZ) - (rightZ * moveX);
        
        const nextX = rabbit.position.x + directionX * speed;
        const nextZ = rabbit.position.z + directionZ * speed;
        
        if (!checkCollision(nextX, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nextX;
        if (!checkCollision(rabbit.position.x, rabbit.position.y, nextZ)) rabbit.position.z = nextZ;
        
        rabbit.rotation.y = Math.atan2(directionX, directionZ);

        // Tombik Yürüme Sallantısı (Gözler kafa içinde kilitliyken sadece tüm vücut tatlışça yaylanır)
        if (!isJumping) {
            legWiggle += 0.22;
            fFL.position.y = 0.1 + Math.abs(Math.sin(legWiggle)) * 0.15;
            fBR.position.y = 0.1 + Math.abs(Math.sin(legWiggle)) * 0.15;
            fFR.position.y = 0.1 + Math.abs(Math.cos(legWiggle)) * 0.15;
            fBL.position.y = 0.1 + Math.abs(Math.cos(legWiggle)) * 0.15;
            
            // Koşarken gövde öne-arkaya pürüzsüzce yaylanır
            rabbitVisualGroup.position.y = Math.sin(legWiggle * 2) * 0.04;
        }
    } else {
        if (!isJumping) {
            fFL.position.y = 0.1; fFR.position.y = 0.1;
            fBL.position.y = 0.1; fBR.position.y = 0.1;
            rabbitVisualGroup.position.y = 0;
        }
    }

    // MOBİL PLATFORM TARZI ZIPLAMA (YUKARI DOĞRU UZAMA / STRETCH)
    if (isJumping) {
        if (velocityY > 0) {
            // Yukarı fırlarken dikey olarak pürüzsüzce esner, parçalar asla ayrılmaz!
            rabbitVisualGroup.scale.set(0.85, 1.25, 0.85);
        } else {
            // Aşağı düşerken hafifçe havada toparlanır
            rabbitVisualGroup.scale.set(1.0, 1.0, 1.0);
        }
        
        // Havada ayaklar gövdeye doğru çekilir
        fFL.position.y = 0.25; fFR.position.y = 0.25;
        fBL.position.y = 0.25; fBR.position.y = 0.25;
    }

    // VURUŞ EFEKTİ
    if (isAttacking) {
        attackAnimTime += 0.15;
        const attackOffsetX = Math.sin(rabbit.rotation.y) * 1.0;
        const attackOffsetZ = Math.cos(rabbit.rotation.y) * 1.0;
        
        attackEffect.position.set(rabbit.position.x + attackOffsetX, rabbit.position.y - 0.4, rabbit.position.z + attackOffsetZ);
        attackEffect.scale.set(attackAnimTime, attackAnimTime, attackAnimTime);
        
        const opacity = Math.max(0, 1 - (attackAnimTime / 2));
        attackMaterial.opacity = opacity;

        if (attackAnimTime >= 2.0) {
            isAttacking = false;
            attackMaterial.opacity = 0;
        }
    }

    // KUKLA SALLANMASI
    if (isDummyHit) {
        dummySwayTime += 0.12;
        let dummySwayAngle = Math.sin(dummySwayTime * 2.0) * 5 * Math.pow(0.90, dummySwayTime);
        dummy.rotation.z = dummySwayAngle * (Math.PI / 180);
        if (Math.abs(dummySwayAngle) < 0.02) {
            isDummyHit = false;
            dummy.rotation.z = 0;
        }
    }

    // KAMERA TAKİBİ
    camera.position.x = rabbit.position.x - Math.sin(cameraAngleY) * cameraDistance;
    camera.position.z = rabbit.position.z - Math.cos(cameraAngleY) * cameraDistance;
    camera.position.y = rabbit.position.y + cameraHeight;
    camera.lookAt(rabbit.position.x, rabbit.position.y + 0.3, rabbit.position.z);

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
