import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- Drop existing constraints if they exist and recreate with correct onDelete behavior
DO $$ 
BEGIN 
    -- For order_items
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_product_id_fkey') THEN
        ALTER TABLE order_items DROP CONSTRAINT order_items_product_id_fkey;
    END IF;
    ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

    -- For cart_items
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_product_id_fkey') THEN
        ALTER TABLE cart_items DROP CONSTRAINT cart_items_product_id_fkey;
    END IF;
    ALTER TABLE cart_items ADD CONSTRAINT cart_items_product_id_fkey 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
END $$;
`;

async function applyChanges() {
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query(sql);
    console.log('SQL applied successfully');
  } catch (err) {
    console.error('Error applying SQL:', err);
  } finally {
    await client.end();
  }
}

applyChanges();
