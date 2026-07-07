const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

const activeGames = {};

io.on('connection', socket => {
    console.log('New client connected to Lobby', socket.id);

    socket.on('createLobby', maxPlayers => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();

        activeGames[roomId] = {
            id: roomId,
            status: 'waiting',
            maxPlayers: maxPlayers,
            targetScore: 5000,
            startingPlayerId: socket.id,
            endgameTriggered: false,
            winnersThisRound: [],
            finalPlacements: [],
            players: [socket.id],
            gameState: {
                activePlayerId: null,
                playerScores: {},
                currentTurn: {
                    temporaryScore: 0,
                    savedDiceThisTurn: [],
                    activeDice: [1, 1, 1, 1, 1, 1],
                    diceLeftToRoll: 6
                }
            }
        };
        activeGames[roomId].gameState.playerScores[socket.id] = 0;

        socket.join(roomId);

        socket.emit('lobbyCreated', roomId);
        io.to(roomId).emit('roomUpdate', activeGames[roomId]);
    });

    socket.on('joinLobby', roomId => {
        const game = activeGames[roomId];

        if (!game) {
            socket.emit('error', 'Room does not exist!');
            return;
        }
        if (game.status !== 'waiting') {
            socket.emit('error', 'Game is already in progress!');
            return;
        }
        if (game.players.length >= game.maxPlayers) {
            socket.emit('error', 'Room is full!');
            return;
        }

        game.players.push(socket.id);
        game.gameState.playerScores[socket.id] = 0;
        socket.join(roomId);

        if (game.players.length === game.maxPlayers) {
            game.status = 'playing';
            game.gameState.activePlayerId = game.players[0];
        }

        io.to(roomId).emit('roomUpdate', game);
    });

    socket.on('rollDice', roomId => {
        const game = activeGames[roomId];
        if (!game || game.status !== 'playing') return;
        if (socket.id !== game.gameState.activePlayerId) return;


        const amountToRoll = game.gameState.currentTurn.diceLeftToRoll;

        game.gameState.currentTurn.activeDice = Array.from(
            { length: amountToRoll },
            () => Math.floor(Math.random() * 6) + 1
        );

        io.to(roomId).emit('roomUpdate', game);
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('Lobby-Server is running on Port 3000');
});