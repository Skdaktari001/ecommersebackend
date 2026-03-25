import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Optimized for Supabase PgBouncer
const pool = new pg.Pool({
    user: 'postgres.irzifamiusnqhzzbpswo',
    password: 'x2MMN9+3PJTrRrX',
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle database client:', err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
    adapter,
    log: ['query', 'info', 'warn', 'error']
});

export default prisma;
