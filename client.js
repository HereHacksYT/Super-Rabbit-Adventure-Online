const socket = io();
const clock = new THREE.Clock();

const hitSound = new Audio('hit.mp3');
const jumpSound = new Audio('jump.mp3');

hitSound.volume = 0.7;
jumpSound.volume = 0.5;

let isOnlineMode = false;
let gameActive = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);


// =========================
// KAMERA
// =========================

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);


// =========================
// RENDERER
// =========================

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.shadowMap.enabled = true;

document
.getElementById('canvas-container')
.appendChild(renderer.domElement);


// =========================
// IŞIKLAR
// =========================

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    0.7
);

scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(
    0xffffff,
    1.2
);

dirLight.position.set(25, 45, 25);

dirLight.castShadow = true;

dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;

scene.add(dirLight);


// =========================
// GÖKYÜZÜ
// =========================

const skyGeo = new THREE.SphereGeometry(
    300,
    32,
    32
);

const skyMat = new THREE.MeshBasicMaterial({
    color: 0x87ceeb,
    side: THREE.BackSide
});

const sky = new THREE.Mesh(
    skyGeo,
    skyMat
);

scene.add(sky);


// =========================
// GÜNEŞ
// =========================

const sun = new THREE.Mesh(

    new THREE.SphereGeometry(
        5,
        24,
        24
    ),

    new THREE.MeshBasicMaterial({
        color: 0xffeb3b
    })

);

sun.position.set(
    80,
    100,
    -80
);

scene.add(sun);


// =========================
// GAMEPLAY GROUP
// =========================

const gameplayGroup = new THREE.Group();

scene.add(gameplayGroup);


// =========================
// ZEMİN
// =========================

const floorGeo = new THREE.PlaneGeometry(
    80,
    80
);

const floorMat = new THREE.MeshStandardMaterial({
    color: 0x66bb6a,
    roughness: 1
});

const floor = new THREE.Mesh(
    floorGeo,
    floorMat
);

floor.rotation.x = -Math.PI / 2;

floor.receiveShadow = true;

gameplayGroup.add(floor);


// =========================
// ENGELLER
// =========================

const obstacles = [];

function createCube(
    x,
    y,
    z,
    w,
    h,
    d,
    color
) {

    const geo = new THREE.BoxGeometry(
        w,
        h,
        d
    );

    const mat = new THREE.MeshStandardMaterial({
        color: color
    });

    const mesh = new THREE.Mesh(
        geo,
        mat
    );

    mesh.position.set(
        x,
        y / 2,
        z
    );

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    gameplayGroup.add(mesh);

    obstacles.push(mesh);
}


// =========================
// PLATFORMAR
// =========================

createCube(
    5,
    2,
    -8,
    2,
    2,
    2,
    0xff9800
);

createCube(
    -7,
    1,
    -3,
    3,
    1,
    3,
    0x00bcd4
);

createCube(
    0,
    3,
    -15,
    4,
    3,
    4,
    0x9c27b0
);

createCube(
    8,
    1,
    6,
    2,
    1,
    2,
    0xffeb3b
);

createCube(
    12,
    2,
    -12,
    3,
    2,
    3,
    0x795548
);

createCube(
    -14,
    3,
    -18,
    4,
    3,
    4,
    0x607d8b
);

createCube(
    15,
    1,
    10,
    5,
    1,
    5,
    0x9e9e9e
);


// =========================
// AĞAÇLAR
// =========================

function createTree(x, z) {

    const trunk = new THREE.Mesh(

        new THREE.CylinderGeometry(
            0.3,
            0.4,
            2
        ),

        new THREE.MeshStandardMaterial({
            color: 0x8b5a2b
        })

    );

    trunk.position.set(
        x,
        1,
        z
    );

    trunk.castShadow = true;

    const leaves = new THREE.Mesh(

        new THREE.SphereGeometry(
            1.4,
            12,
            12
        ),

        new THREE.MeshStandardMaterial({
            color: 0x2ecc71
        })

    );

    leaves.position.set(
        x,
        2.8,
        z
    );

    leaves.castShadow = true;

    gameplayGroup.add(trunk);
    gameplayGroup.add(leaves);
}

createTree(10, -10);
createTree(-10, -10);
createTree(14, 3);
createTree(-12, 8);
createTree(5, 14);
createTree(-18, -4);


// =========================
// ÇİMENLER
// =========================

function createGrass(x, z) {

    const grass = new THREE.Mesh(

        new THREE.BoxGeometry(
            0.2,
            0.5,
            0.2
        ),

        new THREE.MeshStandardMaterial({
            color: 0x4caf50
        })

    );

    grass.position.set(
        x,
        0.25,
        z
    );

    gameplayGroup.add(grass);
}

for (let i = 0; i < 80; i++) {

    createGrass(

        (Math.random() - 0.5) * 60,

        (Math.random() - 0.5) * 60

    );

}


// =========================
// TAŞLAR
// =========================

function createRock(x, z, size) {

    const rock = new THREE.Mesh(

        new THREE.DodecahedronGeometry(size),

        new THREE.MeshStandardMaterial({
            color: 0x757575
        })

    );

    rock.position.set(
        x,
        size / 2,
        z
    );

    rock.castShadow = true;

    gameplayGroup.add(rock);
}

createRock(6, -20, 1);
createRock(-6, -16, 1.3);
createRock(18, 2, 0.8);
// =========================
// TAVŞAN MODELİ
// =========================

const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff
});

const otherBodyMat = new THREE.MeshStandardMaterial({
    color: 0xddf0ff
});

const noseMat = new THREE.MeshStandardMaterial({
    color: 0xffaaaa
});

const eyeMat = new THREE.MeshBasicMaterial({
    color: 0x333333
});

function createRabbitModel(isLocal = false) {

    const group = new THREE.Group();

    const visualGroup = new THREE.Group();

    group.add(visualGroup);

    const currentMat = isLocal
        ? bodyMat
        : otherBodyMat;


    // BODY
    const body = new THREE.Mesh(

        new THREE.BoxGeometry(
            0.7,
            0.75,
            0.75
        ),

        currentMat
    );

    body.position.y = 0.4;

    body.castShadow = true;

    visualGroup.add(body);


    // HEAD
    const head = new THREE.Mesh(

        new THREE.BoxGeometry(
            0.55,
            0.55,
            0.55
        ),

        currentMat
    );

    head.position.y = 0.95;
    head.position.z = 0.1;

    head.castShadow = true;

    visualGroup.add(head);


    // NOSE
    const nose = new THREE.Mesh(

        new THREE.BoxGeometry(
            0.1,
            0.1,
            0.1
        ),

        noseMat
    );

    nose.position.y = -0.05;
    nose.position.z = 0.33;

    head.add(nose);


    // EYES
    const eyeGeo = new THREE.BoxGeometry(
        0.07,
        0.07,
        0.07
    );

    const eyeL = new THREE.Mesh(
        eyeGeo,
        eyeMat
    );

    eyeL.position.set(
        -0.18,
        0.1,
        0.25
    );

    head.add(eyeL);

    const eyeR = new THREE.Mesh(
        eyeGeo,
        eyeMat
    );

    eyeR.position.set(
        0.18,
        0.1,
        0.25
    );

    head.add(eyeR);


    // EARS
    const earGeo = new THREE.BoxGeometry(
        0.12,
        0.55,
        0.06
    );

    const earL = new THREE.Mesh(
        earGeo,
        currentMat
    );

    earL.position.set(
        -0.16,
        0.45,
        -0.05
    );

    head.add(earL);

    const earR = new THREE.Mesh(
        earGeo,
        currentMat
    );

    earR.position.set(
        0.16,
        0.45,
        -0.05
    );

    head.add(earR);


    // TAIL
    const tail = new THREE.Mesh(

        new THREE.BoxGeometry(
            0.2,
            0.2,
            0.2
        ),

        currentMat
    );

    tail.position.set(
        0,
        0.25,
        -0.4
    );

    visualGroup.add(tail);


    // FEET
    const footGeo = new THREE.BoxGeometry(
        0.24,
        0.16,
        0.34
    );

    const footMat = new THREE.MeshStandardMaterial({
        color: 0xcccccc
    });

    const fFL = new THREE.Mesh(
        footGeo,
        footMat
    );

    fFL.position.set(
        -0.32,
        0.08,
        0.22
    );

    group.add(fFL);

    const fFR = new THREE.Mesh(
        footGeo,
        footMat
    );

    fFR.position.set(
        0.32,
        0.08,
        0.22
    );

    group.add(fFR);

    const fBL = new THREE.Mesh(
        footGeo,
        footMat
    );

    fBL.position.set(
        -0.32,
        -0.08,
        -0.22
    );

    group.add(fBL);

    const fBR = new THREE.Mesh(
        footGeo,
        footMat
    );

    fBR.position.set(
        0.32,
        -0.08,
        -0.22
    );

    group.add(fBR);

    return {
        mesh: group,
        visual: visualGroup,
        head: head,
        feet: [
            fFL,
            fFR,
            fBL,
            fBR
        ]
    };

}


// =========================
// LOCAL PLAYER
// =========================

const localPlayer = createRabbitModel(true);

const rabbit = localPlayer.mesh;

const rabbitVisualGroup =
    localPlayer.visual;

const head =
    localPlayer.head;

const [
    footFL,
    footFR,
    footBL,
    footBR
] = localPlayer.feet;

scene.add(rabbit);


// =========================
// ONLINE PLAYERS
// =========================

let otherPlayers = {};


// =========================
// SALDIRI
// =========================

let isAttacking = false;
let attackAnimTime = 0;


// =========================
// FİZİK
// =========================

let velocityY = 0;

let jumpCount = 0;

const gravity = 0.8;

const jumpForce = 18;


// =========================
// ÇARPIŞMA
// =========================

function checkCollision(
    newX,
    newY,
    newZ
) {

    if (!gameActive)
        return false;

    const playerBox = new THREE.Box3(

        new THREE.Vector3(
            newX - 0.28,
            newY + 0.15,
            newZ - 0.28
        ),

        new THREE.Vector3(
            newX + 0.28,
            newY + 1.1,
            newZ + 0.28
        )

    );

    gameplayGroup.updateMatrixWorld(true);

    for (let i = 0; i < obstacles.length; i++) {

        const obstacleBox =
            new THREE.Box3()
            .setFromObject(obstacles[i]);

        if (
            playerBox.intersectsBox(obstacleBox)
        ) {

            if (
                newY >= obstacleBox.max.y - 0.2
            ) {
                continue;
            }

            return true;
        }

    }

    return false;
}


// =========================
// PLATFORM YÜKSEKLİĞİ
// =========================

function getFloorY(
    pX,
    pY,
    pZ
) {

    gameplayGroup.updateMatrixWorld(true);

    let highestCeil = 0;

    for (let i = 0; i < obstacles.length; i++) {

        const obstacleBox =
            new THREE.Box3()
            .setFromObject(obstacles[i]);

        if (

            pX + 0.25 >= obstacleBox.min.x &&

            pX - 0.25 <= obstacleBox.max.x &&

            pZ + 0.25 >= obstacleBox.min.z &&

            pZ - 0.25 <= obstacleBox.max.z

        ) {

            if (
                pY >= obstacleBox.max.y - 0.4
            ) {

                if (
                    obstacleBox.max.y >
                    highestCeil
                ) {

                    highestCeil =
                        obstacleBox.max.y;

                }

            }

        }

    }

    return highestCeil;
}
// =========================
// JOYSTICK
// =========================

const zone =
document.getElementById(
    'joystick-zone'
);

const stick =
document.getElementById(
    'joystick-stick'
);

const maxRadius = 35;

let joystickActive = false;

let moveX = 0;
let moveZ = 0;


zone.addEventListener(
    'touchstart',
    (e) => {

        if (!gameActive) return;

        joystickActive = true;

        handleJoystick(
            e.touches[0].clientX,
            e.touches[0].clientY
        );

    },
    { passive: true }
);


window.addEventListener(
    'touchmove',
    (e) => {

        if (
            joystickActive &&
            gameActive
        ) {

            for (
                let i = 0;
                i < e.touches.length;
                i++
            ) {

                if (
                    zone.contains(
                        e.touches[i].target
                    )
                ) {

                    handleJoystick(
                        e.touches[i].clientX,
                        e.touches[i].clientY
                    );

                    break;
                }

            }

        }

    },
    { passive: true }
);


zone.addEventListener(
    'touchend',
    () => {

        joystickActive = false;

        stick.style.transform =
            'translate(0px,0px)';

        moveX = 0;
        moveZ = 0;

    }
);


function handleJoystick(
    clientX,
    clientY
) {

    const zoneRect =
        zone.getBoundingClientRect();

    let deltaX =
        clientX -
        (
            zoneRect.left +
            zoneRect.width / 2
        );

    let deltaY =
        clientY -
        (
            zoneRect.top +
            zoneRect.height / 2
        );

    let dist = Math.sqrt(
        deltaX * deltaX +
        deltaY * deltaY
    );

    if (dist > maxRadius) {

        deltaX =
            (deltaX / dist) *
            maxRadius;

        deltaY =
            (deltaY / dist) *
            maxRadius;

    }

    stick.style.transform =
        `translate(${deltaX}px,${deltaY}px)`;

    moveX = deltaX / maxRadius;
    moveZ = deltaY / maxRadius;

}


// =========================
// ZIPLAMA
// =========================

document
.getElementById('jump-button')
.addEventListener(
    'touchstart',
    (e) => {

        e.preventDefault();

        if (
            gameActive &&
            jumpCount < 2
        ) {

            velocityY = jumpForce;

            jumpCount++;

            jumpSound.currentTime = 0;

            jumpSound.play();

        }

    }
);


// =========================
// SALDIRI
// =========================

document
.getElementById('attack-button')
.addEventListener(
    'touchstart',
    (e) => {

        e.preventDefault();

        if (
            gameActive &&
            !isAttacking
        ) {

            isAttacking = true;

            attackAnimTime = 0;

            hitSound.currentTime = 0;

            hitSound.play();

            if (isOnlineMode) {

                socket.emit(
                    'playerAttack'
                );

            }

        }

    }
);


// =========================
// KAMERA
// =========================

let cameraAngleY = 0;

let cameraAngleX = 0.3;

let cameraDistance = 5;


// =========================
// ANIMATE
// =========================

let legWiggle = 0;

function animate() {

    requestAnimationFrame(
        animate
    );

    const deltaTime =
        Math.min(
            clock.getDelta(),
            0.1
        );

    let hasMoved = false;


    if (
        joystickActive &&
        (
            Math.abs(moveX) > 0.05 ||
            Math.abs(moveZ) > 0.05
        )
    ) {

        const forwardX =
            Math.sin(cameraAngleY);

        const forwardZ =
            Math.cos(cameraAngleY);

        const rightX =
            Math.sin(
                cameraAngleY +
                Math.PI / 2
            );

        const rightZ =
            Math.cos(
                cameraAngleY +
                Math.PI / 2
            );

        const dirX =
            (forwardX * -moveZ) -
            (rightX * moveX);

        const dirZ =
            (forwardZ * -moveZ) -
            (rightZ * moveX);

        const nextX =
            rabbit.position.x +
            dirX * 9 * deltaTime;

        const nextZ =
            rabbit.position.z +
            dirZ * 9 * deltaTime;

        if (
            !checkCollision(
                nextX,
                rabbit.position.y,
                rabbit.position.z
            )
        ) {

            rabbit.position.x =
                nextX;

        }

        if (
            !checkCollision(
                rabbit.position.x,
                rabbit.position.y,
                nextZ
            )
        ) {

            rabbit.position.z =
                nextZ;

        }

        rabbit.rotation.y =
            Math.atan2(
                dirX,
                dirZ
            );

        hasMoved = true;

        legWiggle +=
            15 * deltaTime;

    }


    const currentFloorY =
        getFloorY(

            rabbit.position.x,

            rabbit.position.y,

            rabbit.position.z

        );

    velocityY -=
        gravity * 60 * deltaTime;

    rabbit.position.y +=
        velocityY * deltaTime;

    if (
        rabbit.position.y <=
        currentFloorY
    ) {

        rabbit.position.y =
            currentFloorY;

        velocityY = 0;

        jumpCount = 0;

    }


    if (isAttacking) {

        attackAnimTime +=
            12 * deltaTime;

        const factor =
            Math.sin(
                attackAnimTime *
                Math.PI
            );

        if (
            attackAnimTime <= 1
        ) {

            rabbitVisualGroup
            .position.z =
                factor * 0.5;

        } else {

            isAttacking = false;

            rabbitVisualGroup
            .position.z = 0;

        }

    }


    if (hasMoved) {

        socket.emit(
            'playerMovement',
            {

                x: rabbit.position.x,
                y: rabbit.position.y,
                z: rabbit.position.z,
                ry: rabbit.rotation.y

            }
        );

    }


    camera.position.x =

        rabbit.position.x -

        Math.sin(cameraAngleY) *

        Math.cos(cameraAngleX) *

        cameraDistance;


    camera.position.z =

        rabbit.position.z -

        Math.cos(cameraAngleY) *

        Math.cos(cameraAngleX) *

        cameraDistance;


    camera.position.y =

        rabbit.position.y +

        Math.sin(cameraAngleX) *

        cameraDistance;


    camera.lookAt(

        rabbit.position.x,

        rabbit.position.y + 0.4,

        rabbit.position.z

    );


    renderer.render(
        scene,
        camera
    );

}

animate();


// =========================
// RESIZE
// =========================

window.addEventListener(
    'resize',
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

    }
);