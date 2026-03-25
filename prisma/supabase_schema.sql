-- 1. Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Enums if they don't exist
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

-- 3. Update 'users' table
-- Assuming columns like name, email, password already exist.
-- Adding/modifying requested columns if necessary.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 4. Update admin user
UPDATE users
SET is_admin = TRUE
WHERE email = 'simongatungo300@gmail.com';

-- 5. Update 'user_addresses' table
-- (Assuming user_id and others exist, otherwise add them)
-- This is just an example of how to add/modify
-- ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS street TEXT;

-- 6. Update 'products' table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS average_rating NUMERIC(2,1) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;
-- If price is not numeric, you might need to cast it (dangerous if data exists)
-- ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(10,2);

-- 7. Update 'orders' table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
-- Map existing string status to enum if possible, or just change type
-- This part is tricky if there's existing data. 
-- For now, we add the status column if it doesn't exist.
-- If it exists as TEXT, we might need a separate migration.
-- ALTER TABLE orders ALTER COLUMN status TYPE order_status USING status::order_status;

-- 8. Update 'reviews' table
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verified_purchase BOOLEAN DEFAULT true;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_votes INTEGER DEFAULT 0;

-- 9. Create Indexes if they don't exist
-- SQL doesn't have "CREATE INDEX IF NOT EXISTS" in all versions, 
-- but PostgreSQL 9.5+ does.
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
