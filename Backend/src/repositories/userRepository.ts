import pool from '../config/db';

export interface User {
    username: string;
    password_hash: string;
    credits: number;
    last_login: Date;
}

export const userRepository = {
    async init(): Promise<void> {
        const query = `
            CREATE TABLE IF NOT EXISTS users (
                                                 username VARCHAR(50) PRIMARY KEY,
                password_hash VARCHAR(255) NOT NULL,
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

    async create(username: string, passwordHash: string): Promise<User> {
        const res = await pool.query(
            'INSERT INTO users (username, password_hash, credits, last_login) VALUES ($1, $2, 1000, CURRENT_DATE) RETURNING *',
            [username, passwordHash]
        );
        return res.rows[0];
    },

    async loginAndApplyDailyBonus(username: string, bonusAmount: number): Promise<{ user: User; bonusGiven: boolean }> {
        const query = `
            WITH before_update AS (
                SELECT last_login <> CURRENT_DATE AS eligible
                FROM users
                WHERE username = $1
            )
            UPDATE users
            SET
                credits = users.credits + (CASE WHEN (SELECT eligible FROM before_update) THEN $2 ELSE 0 END),
                last_login = CURRENT_DATE
            WHERE username = $1
                RETURNING users.*, (SELECT eligible FROM before_update) AS bonus_given;
        `;
        const res = await pool.query(query, [username, bonusAmount]);
        const row = res.rows[0];
        const { bonus_given, ...user } = row;
        return { user, bonusGiven: bonus_given };
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

    async getAll(): Promise<Pick<User, 'username' | 'credits'>[]> {
        const res = await pool.query('SELECT username, credits FROM users');
        return res.rows;
    }
};