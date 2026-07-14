import { Server, Socket } from 'socket.io';
import { userRepository } from '../repositories/userRepository';
import { scoreGroup, calculatePoolScore, hasAnyScoringOption, countValues } from '../utils/diceScoring';

export interface GameState {
    activePlayerId: string | null;
    playerScores: Record<string, number>;
    activeIds: string[];
    lockedOrder: string[];
    cycle: { triggerId: string; participantIds: string[] } | null;
    turnSeq: number;
    currentTurn: {
        collectedDice: number[];
        lastGroups: number[][];
        bankedThisTurn: number;
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
    players: string[];
    playerNames: string[];
    finalPlacements: string[];
    gameState: GameState;
}

function getPayoutPercentages(playerCount: number): number[] {
    switch (playerCount) {
        case 2: return [1.0, 0.0];
        case 3: return [0.75, 0.25, 0.0];
        case 4: return [0.65, 0.25, 0.10, 0.0];
        case 5: return [0.55, 0.25, 0.15, 0.05, 0.0];
        case 6: return [0.50, 0.25, 0.15, 0.10, 0.0, 0.0];
        case 7: return [0.45, 0.25, 0.15, 0.10, 0.05, 0.0, 0.0];
        case 8: return [0.40, 0.25, 0.15, 0.10, 0.07, 0.03, 0.0, 0.0];
        default: return [1.0];
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

function isUserInActiveLobby(username: string, games: Record<string, Game>): boolean {
    return Object.values(games).some(
        g => (g.status === 'waiting' || g.status === 'playing') && g.playerNames.includes(username)
    );
}

function resetTurnState(game: Game): void {
    game.gameState.currentTurn = {
        collectedDice: [],
        lastGroups: [],
        bankedThisTurn: 0,
        activeDice: [],
        diceLeftToRoll: 6
    };
}

function nextActiveId(activeIds: string[], currentId: string): string {
    const idx = activeIds.indexOf(currentId);
    return activeIds[(idx + 1) % activeIds.length];
}

async function finishGame(io: Server, roomId: string, game: Game, activeGames: Record<string, Game>): Promise<void> {
    game.finalPlacements = game.gameState.lockedOrder.map(
        id => game.playerNames[game.players.indexOf(id)]
    );
    game.status = 'finished';

    const percentages = getPayoutPercentages(game.finalPlacements.length);

    try {
        const rewardPromises = game.gameState.lockedOrder.map(async (playerId, index) => {
            const playerIdx = game.players.indexOf(playerId);
            const username = game.playerNames[playerIdx];
            const share = percentages[index] || 0;
            const reward = Math.round(game.totalPot * share);

            if (reward > 0) {
                await userRepository.addCredits(username, reward);
            }

            const updatedUser = await userRepository.findByUsername(username);
            if (updatedUser) {
                io.to(playerId).emit('creditsUpdate', { credits: updatedUser.credits });
            }
        });

        await Promise.all(rewardPromises);

        io.to(roomId).emit('roomUpdate', game);
        io.to(roomId).emit('gameFinished', { game });
    } catch (err) {
        console.error(err);
    }
}

async function resolvePlayerTurn(
    io: Server,
    roomId: string,
    game: Game,
    activeGames: Record<string, Game>,
    playerId: string,
    turnScore: number
): Promise<void> {
    const gs = game.gameState;
    gs.playerScores[playerId] = (gs.playerScores[playerId] || 0) + turnScore;

    if (!gs.cycle) {
        if (gs.playerScores[playerId] >= game.targetScore) {
            gs.cycle = { triggerId: playerId, participantIds: [playerId] };
        }
        const next = nextActiveId(gs.activeIds, playerId);
        gs.activePlayerId = next;
        resetTurnState(game);
        gs.turnSeq++;
        io.to(roomId).emit('roomUpdate', game);
        return;
    }

    gs.cycle.participantIds.push(playerId);

    if (gs.cycle.participantIds.length < gs.activeIds.length) {
        const next = nextActiveId(gs.activeIds, playerId);
        gs.activePlayerId = next;
        resetTurnState(game);
        gs.turnSeq++;
        io.to(roomId).emit('roomUpdate', game);
        return;
    }

    const participants = gs.cycle.participantIds;
    const reachers = participants.filter(id => gs.playerScores[id] >= game.targetScore);
    const remainingAfterRemoval = gs.activeIds.length - reachers.length;

    const sortByScore = (ids: string[]) =>
        [...ids].sort((a, b) => {
            const diff = (gs.playerScores[b] || 0) - (gs.playerScores[a] || 0);
            if (diff !== 0) return diff;
            return gs.activeIds.indexOf(a) - gs.activeIds.indexOf(b);
        });

    if (remainingAfterRemoval <= 1) {
        const sorted = sortByScore(participants);
        gs.lockedOrder.push(...sorted);
        gs.activeIds = gs.activeIds.filter(id => !participants.includes(id));
        gs.cycle = null;

        if (gs.activeIds.length === 0) {
            gs.turnSeq++;
            await finishGame(io, roomId, game, activeGames);
            return;
        }
    } else {
        const sortedReachers = sortByScore(reachers);
        gs.lockedOrder.push(...sortedReachers);
        gs.activeIds = gs.activeIds.filter(id => !reachers.includes(id));
        gs.cycle = null;
    }

    const next = nextActiveId(gs.activeIds, playerId);
    gs.activePlayerId = next;
    resetTurnState(game);
    gs.turnSeq++;
    io.to(roomId).emit('roomUpdate', game);
}

async function removePlayerFromGame(
    io: Server,
    roomId: string,
    game: Game,
    activeGames: Record<string, Game>,
    socketId: string,
    username: string
): Promise<void> {
    const playerIndex = game.players.indexOf(socketId);
    if (playerIndex === -1) return;

    if (game.status === 'waiting') {
        game.players.splice(playerIndex, 1);
        game.playerNames.splice(playerIndex, 1);
        delete game.gameState.playerScores[socketId];

        await userRepository.addCredits(username, game.betAmount);
        game.totalPot -= game.betAmount;

        if (game.players.length === 0) {
            delete activeGames[roomId];
        } else {
            io.to(roomId).emit('roomUpdate', game);
        }
        io.emit('lobbiesUpdate', getLobbySummaries(activeGames));
        return;
    }

    if (game.status === 'playing') {
        const gs = game.gameState;
        const wasActivePlayer = gs.activePlayerId === socketId;

        gs.activeIds = gs.activeIds.filter(id => id !== socketId);
        if (gs.cycle) {
            gs.cycle.participantIds = gs.cycle.participantIds.filter(id => id !== socketId);
        }

        game.players.splice(playerIndex, 1);
        game.playerNames.splice(playerIndex, 1);
        delete gs.playerScores[socketId];

        if (gs.activeIds.length <= 1) {
            if (gs.activeIds.length === 1) {
                gs.lockedOrder.push(gs.activeIds[0]);
            }
            gs.activeIds = [];
            gs.turnSeq++;
            await finishGame(io, roomId, game, activeGames);
            return;
        }

        if (wasActivePlayer) {
            gs.activePlayerId = gs.activeIds[0];
            resetTurnState(game);
        }
        gs.turnSeq++;
        io.to(roomId).emit('roomUpdate', game);
    }
}

export default (io: Server, socket: Socket, activeGames: Record<string, Game>) => {

    socket.on('requestLobbies', () => {
        socket.emit('lobbiesUpdate', getLobbySummaries(activeGames));
    });

    socket.on('createLobby', async ({maxPlayers, betAmount, targetScore}: { maxPlayers: number, betAmount: number, targetScore: number }) => {
        if (maxPlayers < 2 || maxPlayers > 8) {
            socket.emit('error', 'Player count must be between 2 and 8!');
            return;
        }
        if (betAmount < 0 || !Number.isFinite(betAmount)) {
            socket.emit('error', 'Invalid bet amount!');
            return;
        }
        if (!Number.isFinite(targetScore) || targetScore < 500 || targetScore > 100000) {
            socket.emit('error', 'Target score must be between 500 and 100000!');
            return;
        }

        const username = (socket as any).username;
        if (!username) {
            socket.emit('error', 'Please log in!');
            return;
        }
        if (isUserInActiveLobby(username, activeGames)) {
            socket.emit('error', 'You are already in a lobby!');
            return;
        }

        try {
            const user = await userRepository.findByUsername(username);
            if (!user || user.credits < betAmount) {
                socket.emit('error', 'Not enough credits!');
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
                targetScore,
                startingPlayerId: socket.id,
                players: [socket.id],
                playerNames: [username],
                finalPlacements: [],
                gameState: {
                    activePlayerId: null,
                    playerScores: {[socket.id]: 0},
                    activeIds: [],
                    lockedOrder: [],
                    cycle: null,
                    turnSeq: 0,
                    currentTurn: {
                        collectedDice: [],
                        lastGroups: [],
                        bankedThisTurn: 0,
                        activeDice: [],
                        diceLeftToRoll: 6
                    }
                }
            };

            socket.join(roomId);
            socket.emit('lobbyCreated', roomId);
            io.to(roomId).emit('roomUpdate', activeGames[roomId]);
            io.emit('lobbiesUpdate', getLobbySummaries(activeGames));
            socket.emit('creditsUpdate', { credits: user.credits - betAmount });
        } catch (err) {
            console.log(err);
            socket.emit('error', 'Failed to create lobby!');
        }
    });

    socket.on('joinLobby', async (roomId: string) => {
        const game = activeGames[roomId];
        const username = (socket as any).username;

        if (!game || !username || game.status !== 'waiting' || game.players.length >= game.maxPlayers) {
            socket.emit('error', 'Not possible to join this lobby!');
            return;
        }
        if (game.players.includes(socket.id) || game.playerNames.includes(username)) {
            socket.emit('error', 'You are already in this lobby!');
            return;
        }
        if (isUserInActiveLobby(username, activeGames)) {
            socket.emit('error', 'You are already in another lobby!');
            return;
        }

        try {
            const user = await userRepository.findByUsername(username);
            if (!user || user.credits < game.betAmount) {
                socket.emit('error', 'Not enough credits!');
                return;
            }

            await userRepository.deductCredits(username, game.betAmount);
            game.totalPot += game.betAmount;

            game.players.push(socket.id);
            game.playerNames.push(username);
            game.gameState.playerScores[socket.id] = 0;
            socket.join(roomId);

            if (game.players.length === game.maxPlayers) {
                game.status = 'playing';
                game.gameState.activeIds = [...game.players];
                game.gameState.activePlayerId = game.gameState.activeIds[0];
            }

            socket.emit('lobbyJoined', roomId);
            io.to(roomId).emit('roomUpdate', game);
            io.emit('lobbiesUpdate', getLobbySummaries(activeGames));
            socket.emit('creditsUpdate', { credits: user.credits - game.betAmount });
        } catch (err) {
            console.log(err);
            socket.emit('error', 'Failed to join lobby!');
        }
    });

    socket.on('leaveLobby', async (roomId: string) => {
        const game = activeGames[roomId];
        const username = (socket as any).username;
        if (!game || !username) return;

        try {
            await removePlayerFromGame(io, roomId, game, activeGames, socket.id, username);
            socket.leave(roomId);

            const updatedUser = await userRepository.findByUsername(username);
            if (updatedUser) {
                socket.emit('creditsUpdate', { credits: updatedUser.credits });
            }
        } catch (err) {
            console.error(err);
        }
    });

    socket.on('disconnecting', async () => {
        const username = (socket as any).username;
        if (!username) return;

        for (const roomId of socket.rooms) {
            const game = activeGames[roomId];
            if (!game) continue;
            try {
                await removePlayerFromGame(io, roomId, game, activeGames, socket.id, username);
            } catch (err) {
                console.error(err);
            }
        }
    });

    // --- Würfel-Logik ---

    socket.on('rollDice', (roomId: string) => {
        const game = activeGames[roomId];
        if (!game || game.status !== 'playing' || socket.id !== game.gameState.activePlayerId) return;

        const turn = game.gameState.currentTurn;
        if (turn.activeDice.length > 0) {
            socket.emit('error', 'Resolve your current dice roll first!');
            return;
        }

        const amountToRoll = turn.diceLeftToRoll;
        const rolled = Array.from({ length: amountToRoll }, () => Math.floor(Math.random() * 6) + 1);

        if (!hasAnyScoringOption(rolled)) {
            io.to(roomId).emit('bust', { playerId: socket.id, roll: rolled });
            resolvePlayerTurn(io, roomId, game, activeGames, socket.id, 0);
            return;
        }

        turn.activeDice = rolled;
        game.gameState.turnSeq++;
        io.to(roomId).emit('roomUpdate', game);
    });

    socket.on('lockDice', ({ roomId, groups }: { roomId: string; groups: number[][] }) => {
        const game = activeGames[roomId];
        if (!game || game.status !== 'playing' || socket.id !== game.gameState.activePlayerId) return;

        const turn = game.gameState.currentTurn;

        for (const group of groups) {
            const result = scoreGroup(group);
            if (!result.valid) {
                socket.emit('error', `Invalid combination: ${result.reason}`);
                return;
            }
        }

        const submitted = groups.flat();
        const submittedCounts = countValues(submitted);
        const collectedCounts = countValues(turn.collectedDice);

        for (const face of Object.keys(collectedCounts)) {
            const f = Number(face);
            if ((submittedCounts[f] || 0) < collectedCounts[f]) {
                socket.emit('error', 'You cannot lose dice you already collected!');
                return;
            }
        }

        const activeCounts = countValues(turn.activeDice);
        const newlyUsed: number[] = [];
        for (const face of Object.keys(submittedCounts)) {
            const f = Number(face);
            const extra = submittedCounts[f] - (collectedCounts[f] || 0);
            if (extra > 0) {
                if ((activeCounts[f] || 0) < extra) {
                    socket.emit('error', "These dice weren't rolled!");
                    return;
                }
                for (let i = 0; i < extra; i++) newlyUsed.push(f);
            }
        }

        if (newlyUsed.length === 0) {
            socket.emit('error', 'You must use at least one newly rolled die!');
            return;
        }

        turn.activeDice = [];
        turn.collectedDice = submitted;
        turn.lastGroups = groups;

        if (turn.collectedDice.length === 6) {
            turn.bankedThisTurn += calculatePoolScore(turn.lastGroups);
            turn.collectedDice = [];
            turn.lastGroups = [];
            turn.diceLeftToRoll = 6;
            io.to(roomId).emit('hotDice', { playerId: socket.id });
        } else {
            turn.diceLeftToRoll = 6 - turn.collectedDice.length;
        }

        game.gameState.turnSeq++;
        io.to(roomId).emit('roomUpdate', game);
    });

    socket.on('bankScore', async (roomId: string) => {
        const game = activeGames[roomId];
        if (!game || game.status !== 'playing' || socket.id !== game.gameState.activePlayerId) return;

        const turn = game.gameState.currentTurn;
        if (turn.collectedDice.length === 0 && turn.bankedThisTurn === 0) {
            socket.emit('error', "You don't have any points to bank yet!");
            return;
        }

        const turnScore = turn.bankedThisTurn + calculatePoolScore(turn.lastGroups);
        await resolvePlayerTurn(io, roomId, game, activeGames, socket.id, turnScore);
    });
}