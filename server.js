const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let rooms = {};

io.on('connection', (socket) => {

    let currentRoom = null;

    socket.on('createRoom', (config) => {

        const roomCode = Math.floor(10000 + Math.random() * 90000).toString();

        let maxPlayers = parseInt(config ? config.maxPlayers : 4);

        if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) {
            maxPlayers = 4;
        }

        rooms[roomCode] = {
            hostId: socket.id,
            isStarted: false,
            maxPlayers: maxPlayers,
            players: {}
        };

        currentRoom = roomCode;

        socket.join(roomCode);

        rooms[roomCode].players[socket.id] = {
            id: socket.id,
            x: 0,
            y: 0,
            z: 0,
            ry: 0
        };

        socket.emit('roomCreated', {
            roomCode: roomCode,
            players: rooms[roomCode].players,
            maxPlayers: maxPlayers
        });

    });

    socket.on('joinRoom', (roomCode) => {

        if (!rooms[roomCode]) {
            socket.emit('roomError', 'Oda bulunamadı!');
            return;
        }

        if (rooms[roomCode].isStarted) {
            socket.emit('roomError', 'Oyun başladı!');
            return;
        }

        const count = Object.keys(rooms[roomCode].players).length;

        if (count >= rooms[roomCode].maxPlayers) {
            socket.emit('roomError', 'Oda dolu!');
            return;
        }

        currentRoom = roomCode;

        socket.join(roomCode);

        rooms[roomCode].players[socket.id] = {
            id: socket.id,
            x: 0,
            y: 0,
            z: 0,
            ry: 0
        };

        io.to(roomCode).emit('roomUpdate', {
            roomCode: roomCode,
            players: rooms[roomCode].players,
            hostId: rooms[roomCode].hostId,
            maxPlayers: rooms[roomCode].maxPlayers
        });

    });

    socket.on('startGameSignal', () => {

        if (
            currentRoom &&
            rooms[currentRoom] &&
            rooms[currentRoom].hostId === socket.id
        ) {

            rooms[currentRoom].isStarted = true;

            io.to(currentRoom).emit(
                'gameStartedAtAll',
                rooms[currentRoom].players
            );
        }

    });

    socket.on('playerMovement', (movementData) => {

        if (
            currentRoom &&
            rooms[currentRoom] &&
            rooms[currentRoom].players[socket.id]
        ) {

            const p = rooms[currentRoom].players[socket.id];

            p.x = movementData.x;
            p.y = movementData.y;
            p.z = movementData.z;
            p.ry = movementData.ry;

            socket.to(currentRoom).emit('playerMoved', p);
        }

    });

    // VURMA + GERİ SAVRULMA
    socket.on('playerAttack', () => {

        if (
            !currentRoom ||
            !rooms[currentRoom] ||
            !rooms[currentRoom].players[socket.id]
        ) return;

        const attacker = rooms[currentRoom].players[socket.id];

        Object.values(rooms[currentRoom].players).forEach((target) => {

            if (target.id === socket.id) return;

            const dx = target.x - attacker.x;
            const dz = target.z - attacker.z;

            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance < 2.5) {

                const force = 2.8;

                const pushX = (dx / distance) * force;
                const pushZ = (dz / distance) * force;

                target.x += pushX;
                target.z += pushZ;

                io.to(currentRoom).emit('playerKnockback', {
                    id: target.id,
                    x: target.x,
                    z: target.z
                });

            }

        });

        socket.to(currentRoom).emit('playerAttacked', socket.id);

    });

    socket.on('disconnect', () => {

        if (currentRoom && rooms[currentRoom]) {

            delete rooms[currentRoom].players[socket.id];

            socket.to(currentRoom).emit(
                'playerDisconnected',
                socket.id
            );

            io.to(currentRoom).emit('roomUpdate', {
                roomCode: currentRoom,
                players: rooms[currentRoom].players,
                hostId: rooms[currentRoom].hostId,
                maxPlayers: rooms[currentRoom].maxPlayers
            });

            if (
                Object.keys(rooms[currentRoom].players).length === 0
            ) {
                delete rooms[currentRoom];
            }

        }

    });

});

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
    console.log("Rabbit Online aktif!");
});