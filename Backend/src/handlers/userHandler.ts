import { Server, Socket } from 'socket.io';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { userRepository } from '../repositories/userRepository';

const MIN_PASSWORD_LENGTH = 4;

const sessionTokens = new Map<string, string>();

function sanitizeUser(user: { username: string; credits: number }) {
    return { username: user.username, credits: user.credits };
}

export default (io: Server, socket: Socket) => {

    socket.on('login', async ({ username, password }: { username: string; password: string }) => {
        if (!username || typeof username !== 'string' || username.trim().length < 3) {
            socket.emit('error', 'Username must be at least 3 characters');
            return;
        }
        if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
            socket.emit('error', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
            return;
        }

        const cleanUsername = username.trim();

        try {
            let user = await userRepository.findByUsername(cleanUsername);
            let bonusGiven = false;

            if (!user) {
                const passwordHash = await bcrypt.hash(password, 10);
                user = await userRepository.create(cleanUsername, passwordHash);
                bonusGiven = true;
            } else {
                const match = await bcrypt.compare(password, user.password_hash);
                if (!match) {
                    socket.emit('error', 'Invalid username or password');
                    return;
                }
                const result = await userRepository.loginAndApplyDailyBonus(cleanUsername, 1000);
                user = result.user;
                bonusGiven = result.bonusGiven;
            }

            const token = randomUUID();
            sessionTokens.set(cleanUsername, token);

            (socket as any).username = cleanUsername;
            socket.emit('loginSuccess', {
                ...sanitizeUser(user),
                bonusGiven,
                sessionToken: token
            });
        } catch (err) {
            console.log(err);
            socket.emit('error', 'Database error during login');
        }
    });

    socket.on('resumeSession', async ({ username, token }: { username: string; token: string }) => {
        if (!username || !token) return;

        const storedToken = sessionTokens.get(username);
        if (!storedToken || storedToken !== token) {
            socket.emit('sessionExpired');
            return;
        }

        try {
            const user = await userRepository.findByUsername(username);
            if (!user) {
                socket.emit('sessionExpired');
                return;
            }

            (socket as any).username = username;
            socket.emit('loginSuccess', {
                ...sanitizeUser(user),
                bonusGiven: false,
                sessionToken: token
            });
        } catch (err) {
            console.log(err);
            socket.emit('sessionExpired');
        }
    });

    socket.on('logout', () => {
        const username = (socket as any).username;
        if (username) {
            sessionTokens.delete(username);
        }
    });

    socket.on('requestLeaderboard', async () => {
        try {
            const topTen = await userRepository.getTopTen();
            socket.emit('leaderboardUpdate', topTen);
        } catch (err) {
            console.log(err);
        }
    });
}