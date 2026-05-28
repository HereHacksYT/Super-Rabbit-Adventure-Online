const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let rooms = {};

io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('createRoom', (config) => {
        const roomCode = Math.floor(10000 + Math.random() * 90000).toString();
        let maxPlayers = parseInt(config ? config.maxPlayers : 4);
        if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) maxPlayers = 4;

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
            x: 0, y: 0, z: 0, ry: 0,
            health: 100,
            isAttacking: false
        };

        socket.emit('roomCreated', {
            roomCode: roomCode,
            players: rooms[roomCode].players,
            maxPlayers: rooms[roomCode].maxPlayers
        });
    });

    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode]) {
            if (rooms[roomCode].isStarted) {
                socket.emit('roomError', 'Bu oyun zaten başladı!');
                return;
            }

            const currentPlayersCount = Object.keys(rooms[roomCode].players).length;
            if (currentPlayersCount >= rooms[roomCode].maxPlayers) {
                socket.emit('roomError', `Oda dolu! Maksimum ${rooms[roomCode].maxPlayers} kişi.`);
                return;
            }

            currentRoom = roomCode;
            socket.join(roomCode);

            rooms[roomCode].players[socket.id] = {
                id: socket.id,
                x: 0, y: 0, z: 0, ry: 0,
                health: 100,
                isAttacking: false
            };

            io.to(roomCode).emit('roomUpdate', {
                roomCode: roomCode,
                players: rooms[roomCode].players,
                hostId: rooms[roomCode].hostId,
                maxPlayers: rooms[roomCode].maxPlayers
            });
        } else {
            socket.emit('roomError', 'Böyle bir oda bulunamadı!');
        }
    });

    socket.on('startGameSignal', () => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].hostId === socket.id) {
            rooms[currentRoom].isStarted = true;
            io.to(currentRoom).emit('gameStartedAtAll', rooms[currentRoom].players);
        }
    });

    socket.on('playerMovement', (movementData) => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].isStarted && rooms[currentRoom].players[socket.id]) {
            rooms[currentRoom].players[socket.id].x = movementData.x;
            rooms[currentRoom].players[socket.id].y = movementData.y;
            rooms[currentRoom].players[socket.id].z = movementData.z;
            rooms[currentRoom].players[socket.id].ry = movementData.ry;

            socket.to(currentRoom).emit('playerMoved', rooms[currentRoom].players[socket.id]);
        }
    });

    // Sadece saldırı animasyonu için (hasar yok)
    socket.on('playerAttack', () => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].isStarted) {
            socket.to(currentRoom).emit('playerAttacked', socket.id);
        }
    });

    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            // Host çıkarsa ve oyun başlamışsa herkesi at
            if (rooms[currentRoom].hostId === socket.id && rooms[currentRoom].isStarted) {
                io.to(currentRoom).emit('hostDisconnected');
                // Odadaki tüm kullanıcıları odadan çıkar
                const socketsInRoom = io.sockets.adapter.rooms.get(currentRoom);
                if (socketsInRoom) {
                    socketsInRoom.forEach((socketId) => {
                        const socketToKick = io.sockets.sockets.get(socketId);
                        if (socketToKick) socketToKick.leave(currentRoom);
                    });
                }
                delete rooms[currentRoom];
            } else {
                // Normal oyuncu çıkışı
                delete rooms[currentRoom].players[socket.id];

                if (rooms[currentRoom].hostId === socket.id) {
                    // Host çıktı ama oyun başlamamıştı, yeni host ata
                    const remainingIds = Object.keys(rooms[currentRoom].players);
                    if (remainingIds.length > 0) {
                        rooms[currentRoom].hostId = remainingIds[0];
                        io.to(currentRoom).emit('roomUpdate', {
                            roomCode: currentRoom,
                            players: rooms[currentRoom].players,
                            hostId: rooms[currentRoom].hostId,
                            maxPlayers: rooms[currentRoom].maxPlayers
                        });
                    } else {
                        delete rooms[currentRoom];
                    }
                } else {
                    io.to(currentRoom).emit('playerDisconnected', socket.id);
                    io.to(currentRoom).emit('roomUpdate', {
                        roomCode: currentRoom,
                        players: rooms[currentRoom].players,
                        hostId: rooms[currentRoom].hostId,
                        maxPlayers: rooms[currentRoom].maxPlayers
                    });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Sunucu aktif: ${PORT}`);
});