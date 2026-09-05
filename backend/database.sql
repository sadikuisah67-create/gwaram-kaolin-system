GWARAM KAOLIN SUPPLY CHAIN SYSTEM
Initial Database Structure
-- ============================================
-- GWARAM KAOLIN SUPPLY CHAIN SYSTEM
-- INITIAL DATABASE STRUCTURE
-- ============================================

-- 1. USERS
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'worker',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. MINING SITES
CREATE TABLE mining_sites (
    site_id SERIAL PRIMARY KEY,
    site_name VARCHAR(100) NOT NULL,
    location VARCHAR(150) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. LABOUR / WORKERS
CREATE TABLE workers (
    worker_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    worker_type VARCHAR(50),
    skill VARCHAR(100),
    availability VARCHAR(30) DEFAULT 'available',
    daily_rate DECIMAL(12,2),
    site_id INTEGER REFERENCES mining_sites(site_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. KAOLIN PRODUCTS
CREATE TABLE kaolin_products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    grade VARCHAR(50),
    quantity_available DECIMAL(12,2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'kg',
    price_per_unit DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. SUPPLY RECORDS
CREATE TABLE supply_records (
    supply_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES kaolin_products(product_id),
    site_id INTEGER REFERENCES mining_sites(site_id),
    worker_id INTEGER REFERENCES workers(worker_id),
    quantity DECIMAL(12,2) NOT NULL,
    supply_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) DEFAULT 'available'
);

-- 6. CUSTOMERS
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. ORDERS
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id),
    order_status VARCHAR(30) DEFAULT 'pending',
    total_amount DECIMAL(12,2) DEFAULT 0,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. ORDER ITEMS
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES kaolin_products(product_id),
    quantity DECIMAL(12,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL
);

-- 9. SAFETY RECORDS
CREATE TABLE safety_records (
    safety_id SERIAL PRIMARY KEY,
    worker_id INTEGER REFERENCES workers(worker_id) ON DELETE SET NULL,
    site_id INTEGER REFERENCES mining_sites(site_id) ON DELETE SET NULL,
    incident_type VARCHAR(100),
    description TEXT,
    incident_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_taken TEXT
);

-- 10. PAYMENTS
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(30) DEFAULT 'pending',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
