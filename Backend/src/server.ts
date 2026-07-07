import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { userRepository } from './repositories/userRepository';
import registerUserHandlers from './handlers/userHandler';
import registerLobbyHandlers, { Game } from './handlers/lobbyHandler';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const activeGames: Record<string, Game> = {};

userRepository.init()
    .then(() => {
        console.log('PostgreSQL-Database initialized');

        io.on('connection', (socket: Socket) => {
            console.log('Client connected:', socket.id);

            registerUserHandlers(io, socket);
            registerLobbyHandlers(io, socket, activeGames);
        });

        server.listen(3000, '0.0.0.0', () => {
            console.log('Modulare TypeScript-Server running on Port 3000');
        });
    })
    .catch(err => {
        console.error('critical Error on serverstart:', err);
    });