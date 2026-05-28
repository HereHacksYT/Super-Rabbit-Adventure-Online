// 1. ONLINE SUNUCU BAĞLANTISI
const socket = io();

socket.on('connect', () => {
    console.log('Sunucuya online olarak bağlanıldı! ID:', socket.id);
});

// 2. 3D SAHNE VE KAMERA AYARLARI
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// 3. RENDERER (EKRANA ÇİZİCİ) AYARI
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

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

// HARİTADAKİ RENKLİ KUTULAR (Çarpışma listesine ekleniyor)
const obstacles = [];
function createCube(x, y, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    
    // Çarpışmaları hesaplamak için her kutunun sınır alanını oluşturuyoruz
    mesh.geometry.computeBoundingBox();
    obstacles.push(mesh);
}

// Etraftaki bloklar
createCube(5, 1, -5, 2, 2, 2, 0xff9800);   
createCube(-7, 0.5, -3, 3, 1, 3, 0x00bcd4); 
createCube(0, 1.5, -12, 4, 3, 4, 0x9c27b0); 
createCube(8, 0.5, 6, 2, 1, 2, 0xffeb3b);   

// 6. ANA KARAKTER
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const rabbit = new THREE.Mesh(geometry, material);
rabbit.position.set(0, 0.5, 0);
rabbit.castShadow = true;
scene.add(rabbit);

// ÇARPIŞMA KONTROL FONKSİYONU (Yeni eklendi)
// Karakterin gitmek istediği yeni pozisyonda bir bloğa çarpıp çarpmayacağını kontrol eder
function checkCollision(newX, newY, newZ) {
    // Karakterin boyutlarına göre sanal bir sınır kutusu (Bounding Box) oluşturuyoruz
    const playerBox = new THREE.Box3(
        new THREE.Vector3(newX - 0.5, newY - 0.5, newZ - 0.5),
        new THREE.Vector3(newX + 0.5, newY + 0.5, newZ + 0.5)
    );

    // Haritadaki tüm blokları tek tek kontrol et
    for (let i = 0; i < obstacles.length; i++) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacles[i]);
        
        // Eğer karakterin kutusu ile bloğun kutusu iç içe giriyorsa çarpışma vardır!
        if (playerBox.intersectsBox(obstacleBox)) {
            return true; 
        }
    }
    return false; // Çarpışma yoksa yürümeye izin ver
}

// FİZİK VE YERÇEKİMİ DEĞİŞKENLERİ
let velocityY = 0;
let jumpCount = 0;
const gravity = 0.014;
const jumpForce = 0.32;

// 7. SABİT JOYSTICK HAREKET SİSTEMİ
const zone = document.getElementById('joystick-zone');
const stick = document.getElementById('joystick-stick');

let joystickActive = false;
let moveX = 0;
let moveZ = 0;
const maxRadius = 35; 

function handleJoystick(clientX, clientY) {
    const zoneRect = zone.getBoundingClientRect();
    const centerX = zoneRect.left + zoneRect.width / 2;
    const centerY = zoneRect.top + zoneRect.height / 2;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;
    let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > maxRadius) {
        deltaX = (deltaX / distance) * maxRadius;
        deltaY = (deltaY / distance) * maxRadius;
        distance = maxRadius;
    }

    stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    moveX = deltaX / maxRadius;
    moveZ = deltaY / maxRadius;
}

zone.addEventListener('touchstart', (e) => {
    joystickActive = true;
    handleJoystick(e.touches[0].clientX, e.touches[0].clientY);
});

window.addEventListener('touchmove', (e) => {
    if (joystickActive) {
        handleJoystick(e.touches[0].clientX, e.touches[0].clientY);
    }
});

zone.addEventListener('touchend', () => {
    joystickActive = false;
    stick.style.transform = 'translate(0px, 0px)';
    moveX = 0;
    moveZ = 0;
});

// KAMERA ÇEVİRME SİSTEMİ
let cameraAngleY = 0; 
let touchStartX = 0;
let isTurningCamera = false;

window.addEventListener('touchstart', (e) => {
    const jumpBtn = document.getElementById('jump-button');
    if (!zone.contains(e.target) && !jumpBtn.contains(e.target)) {
        isTurningCamera = true;
        touchStartX = e.touches[0].clientX;
    }
});

window.addEventListener('touchmove', (e) => {
    if (!isTurningCamera) return;
    const jumpBtn = document.getElementById('jump-button');
    for (let i = 0; i < e.touches.length; i++) {
        if (!zone.contains(e.touches[i].target) && !jumpBtn.contains(e.touches[i].target)) {
            let deltaX = e.touches[i].clientX - touchStartX;
            cameraAngleY -= deltaX * 0.005; 
            touchStartX = e.touches[i].clientX;
            break;
        }
    }
});

window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) isTurningCamera = false;
});

// 2 KEZ ZIPLAMA FONKSİYONU
function executeJump() {
    if (jumpCount < 2) {
        velocityY = jumpForce;
        jumpCount++;
    }
}

const jumpButton = document.getElementById('jump-button');

jumpButton.addEventListener('touchstart', (e) => {
    e.preventDefault(); 
    executeJump();
});

jumpButton.addEventListener('click', (e) => {
    e.preventDefault();
    executeJump();
});

// 8. EKRAN YENİLEME VE ANİMASYON DÖNGÜSÜ
const speed = 0.15;
const cameraDistance = 10; 
const cameraHeight = 6;    

function animate() {
    requestAnimationFrame(animate);

    // YÜRÜME KONTROLÜ (Çarpışma filtresi eklendi)
    if (joystickActive && (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05)) {
        const forwardX = Math.sin(cameraAngleY);
        const forwardZ = Math.cos(cameraAngleY);
        const rightX = Math.sin(cameraAngleY + Math.PI / 2);
        const rightZ = Math.cos(cameraAngleY + Math.PI / 2);

        const directionX = (forwardX * -moveZ) - (rightX * moveX);
        const directionZ = (forwardZ * -moveZ) - (rightZ * moveX);

        // Karakterin bir sonraki adımda olacağı pozisyonu hesapla
        const nextX = rabbit.position.x + directionX * speed;
        const nextZ = rabbit.position.z + directionZ * speed;

        // X ve Z ekseninde ayrı ayrı çarpışma kontrolü yapıyoruz ki duvara sürünerek yürüyebilsin
        if (!checkCollision(nextX, rabbit.position.y, rabbit.position.z)) {
            rabbit.position.x = nextX;
        }
        if (!checkCollision(rabbit.position.x, rabbit.position.y, nextZ)) {
            rabbit.position.z = nextZ;
        }

        rabbit.rotation.y = Math.atan2(directionX, directionZ);
    }

    // YERÇEKİMİ VE DÜŞEY ÇARPIŞMA UYGULAMASI
    velocityY -= gravity; 
    const nextY = rabbit.position.y + velocityY;

    // Havada bir bloğun üstüne basıyor mu ya da alttan kafasını vuruyor mu kontrolü
    if (checkCollision(rabbit.position.x, nextY, rabbit.position.z)) {
        if (velocityY < 0) {
            // Blok üstüne düştüyse: Hızı sıfırla, zıplama hakkını yenile
            velocityY = 0;
            jumpCount = 0;
        } else {
            // Blok altına kafasını vurduysa: Kafayı çarpıp aşağı düşmeye başlasın
            velocityY = -0.02;
        }
    } else {
        rabbit.position.y = nextY;
    }

    // Tabandaki yeşil zemine basma kontrolü
    if (rabbit.position.y <= 0.5) {
        rabbit.position.y = 0.5;
        velocityY = 0;
        jumpCount = 0; 
    }

    // KAMERANIN TAKİBİ
    camera.position.x = rabbit.position.x - Math.sin(cameraAngleY) * cameraDistance;
    camera.position.z = rabbit.position.z - Math.cos(cameraAngleY) * cameraDistance;
    camera.position.y = rabbit.position.y + cameraHeight;
    camera.lookAt(rabbit.position);

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
