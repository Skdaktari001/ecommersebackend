import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
// Use pgbouncer port 6543 which seems to be working in server.js
const client = new Client({
    user: 'postgres.irzifamiusnqhzzbpswo',
    password: 'x2MMN9+3PJTrRrX',
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: {
        rejectUnauthorized: false
    }
});

async function runFix() {
    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected to database');

        // 1. Ensure Enums exist
        console.log('Checking/creating enums...');
        await client.query(`
            DO $$ BEGIN
                CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;

            DO $$ BEGIN
                CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // 2. Change column types in orders and reviews tables
        console.log('Converting columns to enums...');
        await client.query(`
            -- Backup and convert orders.status
            ALTER TABLE orders 
            ALTER COLUMN status TYPE order_status 
            USING status::text::order_status;

            -- Backup and convert reviews.status
            ALTER TABLE reviews 
            ALTER COLUMN status TYPE review_status 
            USING status::text::review_status;
        `);
        console.log('Columns converted to enums successfully');

    } catch (err) {
        console.error('Error during migration fix:', err);
    } finally {
        await client.end();
    }
}

runFix();
