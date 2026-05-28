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

    // 1. ODA OLUŞTURMA (Max Oyuncu Ayarlı)
    socket.on('createRoom', (config) => {
        const roomCode = Math.floor(10000 + Math.random() * 90000).toString();
        
        // Gelen max_player verisini güvenli hale getiriyoruz (min 2, max 10)
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
        
        rooms[roomCode].players[socket.id] = { id: socket.id, x: 0, y: 0, z: 0, ry: 0, isAttacking: false };
        
        socket.emit('roomCreated', { 
            roomCode: roomCode, 
            players: rooms[roomCode].players,
            maxPlayers: rooms[roomCode].maxPlayers 
        });
    });

    // 2. ODAYA KATILMA İŞLEMİ (Limit Kontrollü)
    socket.on('joinRoom', (roomCode) => {
        if (rooms[roomCode]) {
            if (rooms[roomCode].isStarted) {
                socket.emit('roomError', 'Bu oyun zaten başladı, içeri giremezsin!');
                return;
            }

            // ODA DOLU MU KONTROLÜ
            const currentPlayersCount = Object.keys(rooms[roomCode].players).length;
            if (currentPlayersCount >= rooms[roomCode].maxPlayers) {
                socket.emit('roomError', `Oda tamamen dolu! (Maksimum ${rooms[roomCode].maxPlayers} kişi)`);
                return;
            }

            currentRoom = roomCode;
            socket.join(roomCode);
            
            rooms[roomCode].players[socket.id] = { id: socket.id, x: 0, y: 0, z: 0, ry: 0, isAttacking: false };
            
            io.to(roomCode).emit('roomUpdate', { 
                roomCode: roomCode, 
                players: rooms[roomCode].players, 
                hostId: rooms[roomCode].hostId,
                maxPlayers: rooms[roomCode].maxPlayers
            });
        } else {
            socket.emit('roomError', 'Böyle bir oda kodu bulunamadı!');
        }
    });

    // 3. MAÇI BAŞLATMA
    socket.on('startGameSignal', () => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].hostId === socket.id) {
            rooms[currentRoom].isStarted = true;
            io.to(currentRoom).emit('gameStartedAtAll', rooms[currentRoom].players);
        }
    });

    // 4. KONUM VERİSİ
    socket.on('playerMovement', (movementData) => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].isStarted && rooms[currentRoom].players[socket.id]) {
            rooms[currentRoom].players[socket.id].x = movementData.x;
            rooms[currentRoom].players[socket.id].y = movementData.y;
            rooms[currentRoom].players[socket.id].z = movementData.z;
            rooms[currentRoom].players[socket.id].ry = movementData.ry;
            
            socket.to(currentRoom).emit('playerMoved', rooms[currentRoom].players[socket.id]);
        }
    });

    // 5. KAFA ATMA
    socket.on('playerAttack', () => {
        if (currentRoom && rooms[currentRoom] && rooms[currentRoom].isStarted) {
            socket.to(currentRoom).emit('playerAttacked', socket.id);
        }
    });

    // 6. KOPMA DURUMU
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            delete rooms[currentRoom].players[socket.id];
            
            if (rooms[currentRoom].hostId === socket.id) {
                const remainingIds = Object.keys(rooms[currentRoom].players);
                if (remainingIds.length > 0) {
                    rooms[currentRoom].hostId = remainingIds[0];
                    io.to(currentRoom).emit('roomUpdate', { roomCode: currentRoom, players: rooms[currentRoom].players, hostId: rooms[currentRoom].hostId, maxPlayers: rooms[currentRoom].maxPlayers });
                }
            } else {
                io.to(currentRoom).emit('roomUpdate', { roomCode: currentRoom, players: rooms[currentRoom].players, hostId: rooms[currentRoom].hostId, maxPlayers: rooms[currentRoom].maxPlayers });
            }

            socket.to(currentRoom).emit('playerDisconnected', socket.id);
            
            if (Object.keys(rooms[currentRoom].players).length === 0) {
                delete rooms[currentRoom];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Max oyuncu ayarlı lobi sunucusu aktif! Port: ${PORT}`);
});