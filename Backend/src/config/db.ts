import { Pool } from 'pg';

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'starkle_db',
    password: 'geheim',
    port: 5432,
});

export default pool;