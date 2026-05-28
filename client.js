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
dirLight.position.set(10, 20, 15);
dirLight.castShadow = true;
scene.add(dirLight);

// 5. OYUN ZEMİNİ
const floorGeometry = new THREE.PlaneGeometry(50, 50);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// 6. ANA KARAKTER (Geçici 3D Küp Tavşan)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const rabbit = new THREE.Mesh(geometry, material);
rabbit.position.y = 0.5;
rabbit.castShadow = true;
scene.add(rabbit);

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

// --- YENİ EKLENEN KISIM: EKRANI SÜRÜKLEYEREK KAMERAYI ÇEVİRME ---
let cameraAngleY = 0; // Kameranın küp etrafındaki dönüş açısı
let touchStartX = 0;
let isTurningCamera = false;

window.addEventListener('touchstart', (e) => {
    // Eğer dokunulan yer sol alttaki joystick alanı DEĞİLSE, kamera çevirmedir
    if (!zone.contains(e.target)) {
        isTurningCamera = true;
        touchStartX = e.touches[0].clientX;
    }
});

window.addEventListener('touchmove', (e) => {
    if (!isTurningCamera) return;
    
    // Joystick dışındaki parmak hareketini bul
    for (let i = 0; i < e.touches.length; i++) {
        if (!zone.contains(e.touches[i].target)) {
            let deltaX = e.touches[i].clientX - touchStartX;
            cameraAngleY -= deltaX * 0.005; // Çevirme hassasiyeti
            touchStartX = e.touches[i].clientX;
            break;
        }
    }
});

window.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
        isTurningCamera = false;
    }
});
// -----------------------------------------------------------------

// 8. EKRAN YENİLEME VE ANİMASYON DÖNGÜSÜ
const speed = 0.15;
const cameraDistance = 10; // Kameranın küpe uzaklığı
const cameraHeight = 6;    // Kameranın yüksekliği

function animate() {
    requestAnimationFrame(animate);

    if (joystickActive && (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05)) {
        // Kameranın baktığı açıya göre hareket yönünü hesapla
        // Böylece kamera nereye bakarsa ileri basınca oraya gider
        const forwardX = Math.sin(cameraAngleY);
        const forwardZ = Math.cos(cameraAngleY);
        const rightX = Math.sin(cameraAngleY + Math.PI / 2);
        const rightZ = Math.cos(cameraAngleY + Math.PI / 2);

        // Küpü kameranın açısına göre yürüten matematik:
        const directionX = (forwardX * -moveZ) + (rightX * moveX);
        const directionZ = (forwardZ * -moveZ) + (rightZ * moveX);

        rabbit.position.x += directionX * speed;
        rabbit.position.z += directionZ * speed;
        
        // Karakter yürüdüğü yöne baksın
        rabbit.rotation.y = Math.atan2(directionX, directionZ);
    }

    // KAMERAYI KÜPÜN ETRAFINDAN DÖNDÜREREK TAKİP ETTİRME
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
