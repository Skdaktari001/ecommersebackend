import pg from 'pg';
const pool = new pg.Pool({
    user: 'postgres.irzifamiusnqhzzbpswo',
    password: 'x2MMN9+3PJTrRrX',
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
});

async function fixEnums() {
    const client = await pool.connect();
    try {
        console.log('Fixing enums...');
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
                    CREATE TYPE "OrderStatus" AS ENUM ('pending', 'shipped', 'delivered', 'cancelled', 'Order Placed', 'Packing');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewStatus') THEN
                    CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');
                END IF;
            END$$;
        `);

        // Orders
        await client.query(`UPDATE orders SET status = 'pending' WHERE status NOT IN ('pending', 'shipped', 'delivered', 'cancelled', 'Order Placed', 'Packing');`);
        await client.query(`ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;`);
        await client.query(`
            ALTER TABLE orders 
            ALTER COLUMN status TYPE "OrderStatus" 
            USING status::text::"OrderStatus";
        `);
        await client.query(`ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending'::"OrderStatus";`);

        // Reviews
        await client.query(`UPDATE reviews SET status = 'pending' WHERE status NOT IN ('pending', 'approved', 'rejected');`);
        await client.query(`ALTER TABLE reviews ALTER COLUMN status DROP DEFAULT;`);
        await client.query(`
            ALTER TABLE reviews 
            ALTER COLUMN status TYPE "ReviewStatus" 
            USING status::text::"ReviewStatus";
        `);
        await client.query(`ALTER TABLE reviews ALTER COLUMN status SET DEFAULT 'pending'::"ReviewStatus";`);

        console.log('Fixed!');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}
fixEnums();
