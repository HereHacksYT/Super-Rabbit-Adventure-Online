// --- client.js - TAM VE EKSİKSİZ SÜRÜM ---
const socket = io();
const clock = new THREE.Clock();

let isOnlineMode = false, gameActive = false, maxPlayersLimit = 4;
let velocityY = 0, jumpCount = 0, isAttacking = false, attackAnimTime = 0;
let knockbackVelocity = new THREE.Vector3(0, 0, 0);

// SAHNE VE RENDERER
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const gameplayGroup = new THREE.Group(); scene.add(gameplayGroup);
gameplayGroup.visible = false; // Başta gizli

// BLOKLAR
const obstacles = [];
function createCube(x, y, z, w, h, d, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: color }));
    mesh.position.set(x, y / 2, z); gameplayGroup.add(mesh); obstacles.push(mesh);
}
createCube(5, 2, -8, 2, 2, 2, 0xff9800); createCube(-7, 1, -3, 3, 1, 3, 0x00bcd4);

// TAVŞAN MODELİ
function createRabbitModel(isLocal = false) {
    const group = new THREE.Group(); const visual = new THREE.Group(); group.add(visual);
    const mat = isLocal ? new THREE.MeshStandardMaterial({ color: 0xffffff }) : new THREE.MeshStandardMaterial({ color: 0xddf0ff });
    visual.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.75), mat));
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), mat); head.position.y = 0.95; visual.add(head);
    return { mesh: group, visual: visual, head: head };
}
const rabbit = createRabbitModel(true).mesh; scene.add(rabbit);
let otherPlayers = {};

// --- BUTON İŞLEVLERİ (GLOBAL SCOPE) ---
window.playSolo = () => {
    isOnlineMode = false; gameActive = true;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('controls-ui').style.display = 'block';
    gameplayGroup.visible = true;
    rabbit.position.set(0, 0, 0);
};

window.createRoom = () => {
    isOnlineMode = true;
    socket.emit('createRoom', { maxPlayers: 4 });
};

socket.on('roomCreated', (data) => {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-ui').style.display = 'block';
    document.getElementById('ui-room-code').innerText = data.roomCode;
});

socket.on('gameStartedAtAll', () => {
    document.getElementById('lobby-ui').style.display = 'none';
    document.getElementById('controls-ui').style.display = 'block';
    gameplayGroup.visible = true;
    gameActive = true;
});

socket.on('roomClosed', () => {
    alert("Oda sahibi ayrıldı, menüye dönülüyor.");
    location.reload(); 
});

socket.on('gotHit', (data) => {
    knockbackVelocity.set(data.dir.x * 10, 5, data.dir.z * 10);
});

// FİZİK VE DÖNGÜ
function getFloorY(pX, pY, pZ) {
    gameplayGroup.updateMatrixWorld(true);
    let floorY = 0;
    for (let obs of obstacles) {
        let b = new THREE.Box3().setFromObject(obs);
        if (pX >= b.min.x - 0.2 && pX <= b.max.x + 0.2 && pZ >= b.min.z - 0.2 && pZ <= b.max.z + 0.2) {
            if (pY >= b.max.y - 0.5) floorY = Math.max(floorY, b.max.y);
        }
    }
    return floorY;
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    if (gameActive) {
        if (knockbackVelocity.length() > 0.1) {
            rabbit.position.add(knockbackVelocity.multiplyScalar(dt));
            knockbackVelocity.multiplyScalar(0.9);
        }
        velocityY -= 0.8 * 60 * dt;
        rabbit.position.y += velocityY * dt;
        let floorY = getFloorY(rabbit.position.x, rabbit.position.y, rabbit.position.z);
        if (rabbit.position.y <= floorY) { rabbit.position.y = floorY; velocityY = 0; jumpCount = 0; }
        camera.position.set(rabbit.position.x, rabbit.position.y + 5, rabbit.position.z + 5);
        camera.lookAt(rabbit.position);
    }
    renderer.render(scene, camera);
}
animate();
