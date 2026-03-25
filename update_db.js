import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const sql = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- We don't want to re-create tables if they exist, but Prisma already handles the schema.
-- This script will focus on the parts that Prisma might not handle or that the user specifically requested.

UPDATE users
SET is_admin = TRUE
WHERE email = 'simongatungo300@gmail.com';

-- Ensure enums exist (if not already created by Prisma)
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
`;

async function runSQL() {
    try {
        await client.connect();
        console.log('Connected to database');
        await client.query(sql);
        console.log('SQL executed successfully');
    } catch (err) {
        console.error('Error executing SQL:', err);
    } finally {
        await client.end();
    }
}

runSQL();
