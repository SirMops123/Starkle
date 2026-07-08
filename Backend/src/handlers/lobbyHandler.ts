import {Server, Socket} from 'socket.io';
import {userRepository} from '../repositories/userRepository';

export interface GameState {
    activePlayerId: string | null;
    playerScores: Record<string, number>;
    currentTurn: {
        temporaryScore: number;
        savedDiceThisTurn: number[];
        activeDice: number[];
        diceLeftToRoll: number;
    };
}

export interface Game {
    id: string;
    status: 'waiting' | 'playing' | 'finished';
    maxPlayers: number;
    betAmount: number;
    totalPot: number;
    targetScore: number;
    startingPlayerId: string;
    endgameTriggered: boolean;
    winnersThisRound: string[];
    finalPlacements: string[];
    players: string[];
    playerNames: string[];
    gameState: GameState;
}

function getPayoutPercentages(playerCount: number): number[] {
    switch (playerCount) {
        case 2:
            return [1.0, 0.0];
        case 3:
            return [0.75, 0.25, 0.0];
        case 4:
            return [0.65, 0.25, 0.10, 0.0];
        case 5:
            return [0.55, 0.25, 0.15, 0.05, 0.0];
        case 6:
            return [0.50, 0.25, 0.15, 0.10, 0.0, 0.0];
        case 7:
            return [0.45, 0.25, 0.15, 0.10, 0.05, 0.0, 0.0];
        case 8:
            return [0.40, 0.25, 0.15, 0.10, 0.07, 0.03, 0.0, 0.0];
        default:
            return [1.0];
    }
}

function getLobbySummaries(games: Record<string, Game>) {
    return Object.values(games)
        .filter(g => g.status === 'waiting')
        .map(g => ({
            id: g.id,
            host: g.playerNames[0],
            players: g.players.length,
            maxPlayers: g.maxPlayers,
            betAmount: g.betAmount,
            status: g.status
        }));
}

export default (io: Server, socket: Socket, activeGames: Record<string, Game>) => {

    socket.on('requestLobbies', () => {
        socket.emit('lobbiesUpdate', getLobbySummaries(activeGames));
    })

    socket.on('createLobby', async ({maxPlayers, betAmount}: { maxPlayers: number, betAmount: number }) => {

        if (maxPlayers < 2 || maxPlayers > 8) {
            socket.emit('error', 'Die Spieleranzahl muss zwischen 2 und 8 liegen!');
            return;
        }

        const username = (socket as any).username
        if (!username) {
            socket.emit('error', 'Please log in !')
            return;
        }

        try {
            const user = await userRepository.findByUsername(username);

            if (!user || user.credits < betAmount) {
                socket.emit('error', 'Not enough Credits!')
                return;
            }

            await userRepository.deductCredits(username, betAmount);

            const roomId = Math.floor(1000 + Math.random() * 9000).toString();

            activeGames[roomId] = {
                id: roomId,
                status: 'waiting',
                maxPlayers,
                betAmount,
                totalPot: betAmount,
                targetScore: 5000,
                startingPlayerId: socket.id,
                endgameTriggered: false,
                winnersThisRound: [],
                finalPlacements: [],
                players: [socket.id],
                playerNames: [username],
                gameState: {
                    activePlayerId: null,
                    playerScores: {[socket.id]: 0},
                    currentTurn: {
                        temporaryScore: 0,
                        savedDiceThisTurn: [],
                        activeDice: [1, 1, 1, 1, 1, 1],
                        diceLeftToRoll: 6
                    }
                }
            };

            socket.join(roomId);
            socket.emit('lobbyCreated', roomId);
            io.to(roomId).emit('roomUpdate', activeGames[roomId]);
            io.emit('lobbiesUpdate', getLobbySummaries(activeGames));
        } catch (err) {
            console.log(err)
            socket.emit('error', 'Failed to create Lobby!')
        }
    });



    socket.on('joinLobby', async (roomId: string) => {
        const game = activeGames[roomId];
        const username = (socket as any).username
        if(!game || !username || game.status !== 'waiting' || game.players.length >= game.maxPlayers) {
            socket.emit('error', 'Not possible to join Lobby!')
            return;
        }

        try{
            const user = await userRepository.findByUsername(username);
            if (!user || user.credits < game.betAmount) {
                socket.emit('error', 'Not enough Credits!')
                return;
            }

            await userRepository.deductCredits(username,game.betAmount);
            game.totalPot += game.betAmount;

            game.players.push(socket.id);
            game.playerNames.push(username);
            game.gameState.playerScores[socket.id] = 0;
            socket.join(roomId);

            if(game.players.length === game.maxPlayers) {
                game.status = 'playing';
                //Todo maybe random
                game.gameState.activePlayerId = game.players[0];
            }

            io.to(roomId).emit('roomUpdate', game);
            io.emit('lobbiesUpdate', getLobbySummaries(activeGames));
        }catch(err){
            console.log(err);
            socket.emit('error', 'Failed to join Lobby!')
        }
    });

    socket.on('leaveLobby', async (roomId: string) => {
        const game = activeGames[roomId];
        const username = (socket as any).username;

        if (!game || !username || game.status !== 'waiting') return;

        const playerIndex = game.players.indexOf(socket.id);
        if (playerIndex !== -1) {
            try {
                game.players.splice(playerIndex, 1);
                game.playerNames.splice(playerIndex, 1);
                delete game.gameState.playerScores[socket.id];

                await userRepository.addCredits(username, game.betAmount);
                game.totalPot -= game.betAmount;

                socket.leave(roomId);

                if (game.players.length === 0) {
                    delete activeGames[roomId];
                } else {
                    io.to(roomId).emit('roomUpdate', game);
                }
                io.emit('lobbiesUpdate', getLobbySummaries(activeGames));

                const updatedUser = await userRepository.findByUsername(username);
                if (updatedUser) {
                    socket.emit('loginSuccess', { username, credits: updatedUser.credits, bonusGiven: false });
                }
            } catch (err) {
                console.error(err);
            }
        }
    });

    socket.on('disconnecting', async () => {
        const username = (socket as any).username;
        if (!username) return;

        for (const roomId of socket.rooms) {
            const game = activeGames[roomId];
            if (game && game.status === 'waiting') {
                const playerIndex = game.players.indexOf(socket.id);
                if (playerIndex !== -1) {
                    try {
                        game.players.splice(playerIndex, 1);
                        game.playerNames.splice(playerIndex, 1);
                        delete game.gameState.playerScores[socket.id];

                        await userRepository.addCredits(username, game.betAmount);
                        game.totalPot -= game.betAmount;

                        if (game.players.length === 0) {
                            delete activeGames[roomId];
                        } else {
                            io.to(roomId).emit('roomUpdate', game);
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
            io.emit('lobbiesUpdate', getLobbySummaries(activeGames));
        }
    });

    socket.on('rollDice',(roomId: string) => {
        const game = activeGames[roomId];
        if (!game || game.status !== 'playing' || socket.id !== game.gameState.activePlayerId) return;

        const amountToRoll = game.gameState.currentTurn.diceLeftToRoll;
        game.gameState.currentTurn.activeDice = Array.from(
            { length: amountToRoll },
            () => Math.floor(Math.random() * 6) + 1
        );

        io.to(roomId).emit('roomUpdate', game);
    });

    socket.on('endGameMock', async (roomId: string) => {
        const game = activeGames[roomId];
        if (!game) return;

        const percentages = getPayoutPercentages(game.playerNames.length)

        try{
            const updatePromises = game.finalPlacements.map((username,index) => {
                const share = percentages[index] || 0;
                const reward = Math.round(game.totalPot * share)
                if(reward > 0){
                    return userRepository.addCredits(username,reward);
                }
                return Promise.resolve();
            });

            await Promise.all(updatePromises);
            game.status = 'finished';

            const allUsers = await userRepository.getAll();
            io.to(roomId).emit('gameFinished', {game,user: allUsers});
        }catch(err){
            console.log(err);
        }
    })
}