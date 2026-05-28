// client.js - YUMUŞATILMIŞ KÖŞELİ (ROUNDED) KALİTELİ TAVŞAN SÜRÜMÜ

// 1. ONLINE SUNUCU BAĞLANTISI
const socket = io();

socket.on('connect', () => {
    console.log('Sunucuya online olarak bağlanıldı! ID:', socket.id);
});

// 2. 3D SAHNE VE KAMERA AYARLARI
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// 3. RENDERER AYARI
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

// 5. OYUN ZEMİNİ
const floorGeometry = new THREE.PlaneGeometry(60, 60);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 }); 
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; 
floor.receiveShadow = true; 
scene.add(floor);

// HARİTADAKİ ENGEL KUTULARI
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

createCube(5, 1, -8, 2, 2, 2, 0xff9800);   
createCube(-7, 0.5, -3, 3, 1, 3, 0x00bcd4); 
createCube(0, 1.5, -15, 4, 3, 4, 0x9c27b0); 
createCube(8, 0.5, 6, 2, 1, 2, 0xffeb3b);   

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
let dummySwayAngle = 0;
let dummySwayTime = 0;

function swayDummy() {
    isDummyHit = true;
    dummySwayTime = 0; 
}

// 6. YENİ NESİL KALİTELİ VE KÖŞELERİ YUVARLATILMIŞ TAVŞAN MODELİ
const rabbit = new THREE.Group();
rabbit.position.set(0, 0.5, 0); 
scene.add(rabbit);

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }); 
const noseMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa, roughness: 0.2 }); 
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });   

// KÖŞELERİ OVAL KÜP SİMÜLASYONU FONKSİYONU
function createRoundedBox(w, h, d, radius, material) {
    // Küpün köşelerini segmentler ekleyerek tatlı bir şekilde yuvarlatıyoruz
    const geometry = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
    const positionAttribute = geometry.attributes.position;
    
    // Köşeleri merkeze doğru hafifçe bükerek ovalleştirme formülü
    for (let i = 0; i < positionAttribute.count; i++) {
        let x = positionAttribute.getX(i);
        let y = positionAttribute.getY(i);
        let z = positionAttribute.getZ(i);
        
        // Köşelere yaklaştıkça içeri doğru kavis ver
        if (Math.abs(x) > (w/2 - radius)) x = Math.sign(x) * ((w/2 - radius) + Math.sqrt(Math.max(0, radius*radius - Math.pow(Math.abs(x) - (w/2 - radius), 2))) * 0.3);
        if (Math.abs(y) > (h/2 - radius)) y = Math.sign(y) * ((h/2 - radius) + Math.sqrt(Math.max(0, radius*radius - Math.pow(Math.abs(y) - (h/2 - radius), 2))) * 0.3);
        if (Math.abs(z) > (d/2 - radius)) z = Math.sign(z) * ((d/2 - radius) + Math.sqrt(Math.max(0, radius*radius - Math.pow(Math.abs(z) - (d/2 - radius), 2))) * 0.3);
        
        positionAttribute.setXYZ(i, x, y, z);
    }
    geometry.computeVertexNormals(); // Işıkların pürüzsüz yansıması için normals güncellemesi
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
}

// 1. Gövde (Köşeleri yumuşatılmış tombik gövde)
const bodyMesh = createRoundedBox(0.9, 0.9, 1.1, 0.2, bodyMat);
bodyMesh.position.y = 0.45;
rabbit.add(bodyMesh);

// 2. Kafa Konteyneri (Boyun dönme pivotu ve burun uçma hatasını çözen ana grup)
const headGroup = new THREE.Group();
headGroup.position.set(0, 0.95, 0.25); // Gövdenin ön üst kısmı
rabbit.add(headGroup);

// Kafa (Köşeleri ovalleşmiş şirin kafa)
const headMesh = createRoundedBox(0.65, 0.65, 0.65, 0.15, bodyMat);
headMesh.position.set(0, 0, 0); 
headGroup.add(headMesh);

// Burun (Kafaya tam kilitli, uçmayan küçük yuvarlak)
const noseMesh = createRoundedBox(0.14, 0.12, 0.12, 0.04, noseMat);
noseMesh.position.set(0, -0.05, 0.33); 
headGroup.add(noseMesh); 

// Sol Göz
const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.04);
const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
eyeL.position.set(-0.18, 0.08, 0.31);
headGroup.add(eyeL);

// Sağ Göz
const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
eyeR.position.set(0.18, 0.08, 0.31);
headGroup.add(eyeR);

// Kulaklar (Köşeleri yumuşak, dik ve şık)
const earL = createRoundedBox(0.16, 0.65, 0.1, 0.04, bodyMat);
earL.position.set(-0.18, 0.5, -0.05);
headGroup.add(earL);

const earR = createRoundedBox(0.16, 0.65, 0.1, 0.04, bodyMat);
earR.position.set(0.18, 0.5, -0.05);
headGroup.add(earR);

// 3. Kuyruk (Arkada tatlı bir top kutu)
const tailMesh = createRoundedBox(0.3, 0.3, 0.3, 0.1, bodyMat);
tailMesh.position.set(0, 0.3, -0.6);
rabbit.add(tailMesh);

// 4. Ayaklar (Yere tam basan, köşeleri oval küçük patiler)
const footGeo = new THREE.BoxGeometry(0.24, 0.16, 0.35);
const footMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 });
const createFoot = (x, z) => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(x, 0.08, z);
    foot.castShadow = true;
    rabbit.add(foot);
    return foot;
};
const fFL = createFoot(-0.28, 0.35);  
const fFR = createFoot(0.28, 0.35);   
const fBL = createFoot(-0.28, -0.25); 
const fBR = createFoot(0.28, -0.25);  

// VURMA EFEKTİ
const attackGeometry = new THREE.RingGeometry(0.2, 0.8, 16);
const attackMaterial = new THREE.MeshBasicMaterial({ color: 0xff1111, transparent: true, opacity: 0, side: THREE.DoubleSide });
const attackEffect = new THREE.Mesh(attackGeometry, attackMaterial);
scene.add(attackEffect);
attackEffect.rotation.x = Math.PI / 2; 

let isAttacking = false;
let attackAnimTime = 0;

// ÇARPIŞMA FONKSİYONU
function checkCollision(newX, newY, newZ) {
    const playerBox = new THREE.Box3(
        new THREE.Vector3(newX - 0.45, newY - 0.5, newZ - 0.55),
        new THREE.Vector3(newX + 0.45, newY + 0.5, newZ + 0.55)
    );
    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        if (playerBox.intersectsBox(obstacleBox)) return true; 
    }
    return false;
}

// FİZİK DEĞİŞKENLERİ
let velocityY = 0;
let jumpCount = 0;
const gravity = 0.014;
const jumpForce = 0.32;

// JOYSTICK SİSTEMİ
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

// KAMERA DÖNDÜRME SİSTEMİ
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

// MEKANİK TETİKLEYİCİLER
function executeJump() {
    if (jumpCount < 2) {
        velocityY = jumpForce;
        jumpCount++;
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

// 8. OYUN DÖNGÜSÜ VE ANİMASYONLAR
const speed = 0.15;
const cameraDistance = 7, cameraHeight = 4.5;    
let legWiggle = 0;

function animate() {
    requestAnimationFrame(animate);

    // HAREKET KONTROLÜ
    if (joystickActive && (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05)) {
        const forwardX = Math.sin(cameraAngleY), forwardZ = Math.cos(cameraAngleY);
        const rightX = Math.sin(cameraAngleY + Math.PI / 2), rightZ = Math.cos(cameraAngleY + Math.PI / 2);
        const directionX = (forwardX * -moveZ) - (rightX * moveX);
        const directionZ = (forwardZ * -moveZ) - (rightZ * moveX);
        
        const nextX = rabbit.position.x + directionX * speed;
        const nextZ = rabbit.position.z + directionZ * speed;
        
        if (!checkCollision(nextX, rabbit.position.y, rabbit.position.z)) rabbit.position.x = nextX;
        if (!checkCollision(rabbit.position.x, rabbit.position.y, nextZ)) rabbit.position.z = nextZ;
        
        // Gövde dönüşü
        rabbit.rotation.y = Math.atan2(directionX, directionZ);

        // Yürüme Patileri Animasyonu (Super Bear Adventure Tarzı)
        legWiggle += 0.25;
        fFL.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
        fBR.position.y = 0.08 + Math.abs(Math.sin(legWiggle)) * 0.12;
        fFR.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
        fBL.position.y = 0.08 + Math.abs(Math.cos(legWiggle)) * 0.12;
    } else {
        // Dururken ayakları yere sıfırla
        fFL.position.y = 0.08;
        fFR.position.y = 0.08;
        fBL.position.y = 0.08;
        fBR.position.y = 0.08;
    }

    // SALDIRI EFEKTİ ANİMASYONU
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

    // KUKLA SALLANMA
    if (isDummyHit) {
        dummySwayTime += 0.12;
        dummySwayAngle = Math.sin(dummySwayTime * 2.0) * 5 * Math.pow(0.90, dummySwayTime);
        dummy.rotation.z = dummySwayAngle * (Math.PI / 180);
        if (Math.abs(dummySwayAngle) < 0.02) {
            isDummyHit = false;
            dummy.rotation.z = 0;
        }
    }

    // YERÇEKİMİ KONTROLÜ (Uçma Sorunu Tamamen Çözüldü)
    velocityY -= gravity; 
    const nextY = rabbit.position.y + velocityY;
    if (checkCollision(rabbit.position.x, nextY, rabbit.position.z)) {
        if (velocityY < 0) { velocityY = 0; jumpCount = 0; } 
        else velocityY = -0.02;
    } else rabbit.position.y = nextY;
    
    if (rabbit.position.y <= 0.5) { 
        rabbit.position.y = 0.5; 
        velocityY = 0; 
        jumpCount = 0; 
    }

    // KAMERA TAKİBİ
    camera.position.x = rabbit.position.x - Math.sin(cameraAngleY) * cameraDistance;
    camera.position.z = rabbit.position.z - Math.cos(cameraAngleY) * cameraDistance;
    camera.position.y = rabbit.position.y + cameraHeight;
    camera.lookAt(rabbit.position.x, rabbit.position.y + 0.5, rabbit.position.z);

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});