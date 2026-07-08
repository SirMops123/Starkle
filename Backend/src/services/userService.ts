import { userRepository, User } from '../repositories/userRepository';

export class InsufficientCreditsError extends Error {
    constructor(username: string) {
        super(`User "${username}" doesnt have enough credits`);
        this.name = 'InsufficientCreditsError';
    }
}

export class UserNotFoundError extends Error {
    constructor(username: string) {
        super(`User "${username}" could not be found`);
        this.name = 'UserNotFoundError';
    }
}

const DAILY_BONUS = 1000;

export const userService = {

    async loginOrRegister(username: string): Promise<User> {
        const existing = await userRepository.findByUsername(username);

        if (!existing) {
            return userRepository.create(username);
        }

        const today = new Date().toISOString().slice(0, 10);
        const lastLogin = new Date(existing.last_login).toISOString().slice(0, 10);

        if (lastLogin !== today) {
            const newCredits = existing.credits + DAILY_BONUS;
            await userRepository.updateCreditsAndLogin(username, newCredits);
            return { ...existing, credits: newCredits, last_login: new Date() };
        }

        return existing;
    },

    async getUser(username: string): Promise<User> {
        const user = await userRepository.findByUsername(username);
        if (!user) throw new UserNotFoundError(username);
        return user;
    },

    async deductCredits(username: string, amount: number): Promise<void> {
        if (amount <= 0) {
            throw new Error('amount must be greater than 0');
        }

        const user = await userRepository.findByUsername(username);
        if (!user) throw new UserNotFoundError(username);
        if (user.credits < amount) throw new InsufficientCreditsError(username);

        await userRepository.deductCredits(username, amount);
    },

    async addCredits(username: string, amount: number): Promise<void> {
        if (amount <= 0) {
            throw new Error('amount must be greater than 0');
        }

        const user = await userRepository.findByUsername(username);
        if (!user) throw new UserNotFoundError(username);

        await userRepository.addCredits(username, amount);
    },

    async getLeaderboard(): Promise<Pick<User, 'username' | 'credits'>[]> {
        return userRepository.getTopTen();
    },

    async getAllUsers(): Promise<User[]> {
        return userRepository.getAll();
    }
};