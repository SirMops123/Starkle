import { Request, Response } from 'express';
import { userService, InsufficientCreditsError, UserNotFoundError } from '../services/userService';

export const userController = {
    async login(req: Request, res: Response): Promise<void> {
        const { username } = req.body;

        if (!username || typeof username !== 'string') {
            res.status(400).json({ error: 'username ist mandatory' });
            return;
        }

        try {
            const user = await userService.loginOrRegister(username);
            res.status(200).json(user);
        } catch (err) {
            res.status(500).json({ error: 'Internal Error on login' });
        }
    },

    async getByUsername(req: Request, res: Response): Promise<void> {
        const { username } = req.params;

        try {
            const user = await userService.getUser(username);
            res.status(200).json(user);
        } catch (err) {
            if (err instanceof UserNotFoundError) {
                res.status(404).json({ error: err.message });
                return;
            }
            res.status(500).json({ error: 'Internal Error' });
        }
    },

    async deductCredits(req: Request, res: Response): Promise<void> {
        const { username } = req.params;
        const { amount } = req.body;

        if (typeof amount !== 'number' || amount <= 0) {
            res.status(400).json({ error: 'amount must be a positive number' });
            return;
        }

        try {
            await userService.deductCredits(username, amount);
            res.status(204).send();
        } catch (err) {
            if (err instanceof UserNotFoundError) {
                res.status(404).json({ error: err.message });
                return;
            }
            if (err instanceof InsufficientCreditsError) {
                res.status(409).json({ error: err.message });
                return;
            }
            res.status(500).json({ error: 'Internal Error' });
        }
    },

    async addCredits(req: Request, res: Response): Promise<void> {
        const { username } = req.params;
        const { amount } = req.body;

        if (typeof amount !== 'number' || amount <= 0) {
            res.status(400).json({ error: 'amount must be a positive number' });
            return;
        }

        try {
            await userService.addCredits(username, amount);
            res.status(204).send();
        } catch (err) {
            if (err instanceof UserNotFoundError) {
                res.status(404).json({ error: err.message });
                return;
            }
            res.status(500).json({ error: 'Internal Error' });
        }
    },

    async getLeaderboard(_req: Request, res: Response): Promise<void> {
        try {
            const leaderboard = await userService.getLeaderboard();
            res.status(200).json(leaderboard);
        } catch (err) {
            res.status(500).json({ error: 'Internal Error' });
        }
    },

    async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const users = await userService.getAllUsers();
            res.status(200).json(users);
        } catch (err) {
            res.status(500).json({ error: 'Internal Error' });
        }
    }
};