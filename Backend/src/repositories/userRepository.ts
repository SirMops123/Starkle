import pool from '../config/db';

export interface User {
    username: string;
    credits: number;
    last_login: Date;
}

export const userRepository = {
    async init(): Promise<void> {
        const query = `
            CREATE TABLE IF NOT EXISTS users (
                                                 username VARCHAR(50) PRIMARY KEY,
                credits INT DEFAULT 1000,
                last_login DATE DEFAULT CURRENT_DATE
                );
        `;
        await pool.query(query);
    },

    async findByUsername(username: string): Promise<User | null> {
        const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (res.rows.length === 0) return null;
        return res.rows[0];
    },

    async create(username: string): Promise<User> {
        const res = await pool.query(
            'INSERT INTO users (username, credits, last_login) VALUES ($1, 1000, CURRENT_DATE) RETURNING *',
            [username]
        );
        return res.rows[0];
    },

    async updateCreditsAndLogin(username: string, credits: number): Promise<void> {
        await pool.query(
            'UPDATE users SET credits = $1, last_login = CURRENT_DATE WHERE username = $2',
            [credits, username]
        );
    },

    async deductCredits(username: string, amount: number): Promise<void> {
        await pool.query('UPDATE users SET credits = credits - $1 WHERE username = $2', [amount, username]);
    },

    async addCredits(username: string, amount: number): Promise<void> {
        await pool.query('UPDATE users SET credits = credits + $1 WHERE username = $2', [amount, username]);
    },

    async getTopTen(): Promise<Pick<User, 'username' | 'credits'>[]> {
        const res = await pool.query('SELECT username, credits FROM users ORDER BY credits DESC LIMIT 10');
        return res.rows;
    },

    async getAll(): Promise<User[]> {
        const res = await pool.query('SELECT username, credits FROM users');
        return res.rows;
    }
};