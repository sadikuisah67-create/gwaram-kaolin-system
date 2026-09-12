const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());

// =====================================================
// DATABASE CONNECTION
// =====================================================

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false,
});

// =====================================================
// DATABASE ERROR HELPER
// =====================================================

function handleDatabaseError(res, error, action = "complete operation") {
  console.error(`${action} error:`, error);

  // Foreign key violation
  if (error.code === "23503") {
    return res.status(400).json({
      error:
        "This record cannot be deleted because it is connected to other existing records.",
    });
  }

  // Unique violation
  if (error.code === "23505") {
    return res.status(400).json({
      error:
        "A record with the same information already exists.",
    });
  }

  return res.status(500).json({
    error: `Unable to ${action}.`,
  });
}

// =====================================================
// DATABASE INITIALIZATION
// =====================================================

async function initializeDatabase() {
  try {
    console.log("Initializing database tables...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        phone VARCHAR(30),
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS mining_sites (
        site_id SERIAL PRIMARY KEY,
        site_name VARCHAR(150) NOT NULL,
        location VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workers (
        worker_id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id)
          ON DELETE SET NULL,
        worker_type VARCHAR(100) NOT NULL,
        skill VARCHAR(150) NOT NULL,
        availability VARCHAR(50) DEFAULT 'available',
        daily_rate NUMERIC(15,2) NOT NULL,
        site_id INTEGER REFERENCES mining_sites(site_id)
          ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS kaolin_products (
        product_id SERIAL PRIMARY KEY,
        product_name VARCHAR(150) NOT NULL,
        grade VARCHAR(100) NOT NULL,
        quantity_available NUMERIC(15,2) NOT NULL DEFAULT 0,
        unit VARCHAR(50) NOT NULL,
        price_per_unit NUMERIC(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        customer_id SERIAL PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        email VARCHAR(150),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        supplier_id SERIAL PRIMARY KEY,
        supplier_name VARCHAR(150) NOT NULL,
        phone VARCHAR(30),
        email VARCHAR(150),
        address TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity NUMERIC(15,2) NOT NULL,
        total_amount NUMERIC(15,2) NOT NULL,
        order_status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT orders_customer_fk
          FOREIGN KEY (customer_id)
          REFERENCES customers(customer_id)
          ON DELETE RESTRICT,
        CONSTRAINT orders_product_fk
          FOREIGN KEY (product_id)
          REFERENCES kaolin_products(product_id)
          ON DELETE RESTRICT
      )
    `);

    // Ensure older databases have these columns
    await pool.query(`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS address TEXT
    `);

    await pool.query(`
      ALTER TABLE suppliers
      ADD COLUMN IF NOT EXISTS address TEXT
    `);

    console.log("Database tables initialized successfully.");
  } catch (error) {
    console.error(
      "Database initialization error:",
      error.message
    );

    throw error;
  }
}

// =====================================================
// DEFAULT ADMINISTRATOR
// =====================================================

async function createDefaultAdmin() {
  try {
    const adminEmail = "admin@gwaramkaolin.com";
    const adminPassword = "Admin123";

    const existingAdmin = await pool.query(
      `
      SELECT user_id
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [adminEmail]
    );

    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash(
        adminPassword,
        10
      );

      await pool.query(
        `
        INSERT INTO users (
          full_name,
          phone,
          email,
          password_hash,
          role
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          "System Administrator",
          "0000000000",
          adminEmail,
          passwordHash,
          "admin",
        ]
      );

      console.log(
        "Default administrator created successfully."
      );
    } else {
      console.log(
        "Default administrator already exists."
      );
    }
  } catch (error) {
    console.error(
      "Admin creation error:",
      error.message
    );
  }
}

// =====================================================
// DATABASE STARTUP
// =====================================================

async function startDatabase() {
  try {
    await pool.query("SELECT NOW()");

    console.log(
      "PostgreSQL connected successfully."
    );

    await initializeDatabase();

    await createDefaultAdmin();

    console.log(
      "Database startup completed successfully."
    );
  } catch (error) {
    console.error(
      "Database connection failed:",
      error.message
    );
  }
}

// =====================================================
// HOME ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.json({
    message:
      "Gwaram Kaolin Supply Chain System Backend is running.",
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");

    res.json({
      status: "OK",
      message:
        "Gwaram Kaolin API and database are working.",
    });
  } catch (error) {
    console.error(
      "Health check error:",
      error.message
    );

    res.status(500).json({
      status: "ERROR",
      error: error.message,
    });
  }
});

// =====================================================
// LOGIN
// =====================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error:
          "Email and password are required.",
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error:
          "Invalid email or password.",
      });
    }

    const user = result.rows[0];

    const passwordCorrect =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordCorrect) {
      return res.status(401).json({
        error:
          "Invalid email or password.",
      });
    }

    res.json({
      message: "Login successful.",
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(
      "Login error:",
      error.message
    );

    res.status(500).json({
      error: "Login failed.",
    });
  }
});

// =====================================================
// WORKERS
// =====================================================

app.get("/api/workers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM workers
      ORDER BY worker_id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "load workers"
    );
  }
});

app.post("/api/workers", async (req, res) => {
  try {
    const {
      user_id,
      worker_type,
      skill,
      availability,
      daily_rate,
      site_id,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO workers (
        user_id,
        worker_type,
        skill,
        availability,
        daily_rate,
        site_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        user_id || null,
        worker_type,
        skill,
        availability || "available",
        daily_rate,
        site_id || null,
      ]
    );

    res.status(201).json(
      result.rows[0]
    );
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "add worker"
    );
  }
});

app.delete("/api/workers/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM workers
      WHERE worker_id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Worker not found.",
      });
    }

    res.json({
      message:
        "Worker deleted successfully.",
    });
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "delete worker"
    );
  }
});

// =====================================================
// MINING SITES
// =====================================================

app.get("/api/mining-sites", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM mining_sites
      ORDER BY site_id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "load mining sites"
    );
  }
});

app.post("/api/mining-sites", async (req, res) => {
  try {
    const {
      site_name,
      location,
      description,
      status,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO mining_sites (
        site_name,
        location,
        description,
        status
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        site_name,
        location,
        description || null,
        status || "active",
      ]
    );

    res.status(201).json(
      result.rows[0]
    );
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "add mining site"
    );
  }
});

app.delete("/api/mining-sites/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM mining_sites
      WHERE site_id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error:
          "Mining site not found.",
      });
    }

    res.json({
      message:
        "Mining site deleted successfully.",
    });
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "delete mining site"
    );
  }
});

// =====================================================
// KAOLIN PRODUCTS
// =====================================================

app.get("/api/kaolin-products", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM kaolin_products
      ORDER BY product_id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "load products"
    );
  }
});

app.post("/api/kaolin-products", async (req, res) => {
  try {
    const {
      product_name,
      grade,
      quantity_available,
      unit,
      price_per_unit,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO kaolin_products (
        product_name,
        grade,
        quantity_available,
        unit,
        price_per_unit
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        product_name,
        grade,
        quantity_available,
        unit,
        price_per_unit,
      ]
    );

    res.status(201).json(
      result.rows[0]
    );
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "add product"
    );
  }
});

// =====================================================
// DELETE PRODUCT
// =====================================================

app.delete(
  "/api/kaolin-products/:id",
  async (req, res) => {
    try {
      const productId = Number(req.params.id);

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        return res.status(400).json({
          error: "Invalid product ID.",
        });
      }

      // Check product first
      const productCheck = await pool.query(
        `
        SELECT product_id
        FROM kaolin_products
        WHERE product_id = $1
        `,
        [productId]
      );

      if (productCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Product not found.",
        });
      }

      // Check whether product is used in an order
      const orderCheck = await pool.query(
        `
        SELECT order_id
        FROM orders
        WHERE product_id = $1
        LIMIT 1
        `,
        [productId]
      );

      if (orderCheck.rows.length > 0) {
        return res.status(400).json({
          error:
            "Cannot delete this product because it is used in an existing order. Delete the related order first.",
        });
      }

      await pool.query(
        `
        DELETE FROM kaolin_products
        WHERE product_id = $1
        `,
        [productId]
      );

      res.json({
        message:
          "Product deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Product deletion error:",
        error
      );

      handleDatabaseError(
        res,
        error,
        "delete product"
      );
    }
  }
);

// =====================================================
// CUSTOMERS
// =====================================================

app.get("/api/customers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM customers
      ORDER BY customer_id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "load customers"
    );
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const {
      full_name,
      phone,
      email,
      address,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO customers (
        full_name,
        phone,
        email,
        address
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        full_name,
        phone,
        email?.trim() || null,
        address?.trim() || null,
      ]
    );

    res.status(201).json(
      result.rows[0]
    );
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "add customer"
    );
  }
});

// =====================================================
// DELETE CUSTOMER
// =====================================================

app.delete(
  "/api/customers/:id",
  async (req, res) => {
    try {
      const customerId = Number(req.params.id);

      if (
        !Number.isInteger(customerId) ||
        customerId <= 0
      ) {
        return res.status(400).json({
          error: "Invalid customer ID.",
        });
      }

      // Check customer first
      const customerCheck = await pool.query(
        `
        SELECT customer_id
        FROM customers
        WHERE customer_id = $1
        `,
        [customerId]
      );

      if (customerCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Customer not found.",
        });
      }

      // Check whether customer has an order
      const orderCheck = await pool.query(
        `
        SELECT order_id
        FROM orders
        WHERE customer_id = $1
        LIMIT 1
        `,
        [customerId]
      );

      if (orderCheck.rows.length > 0) {
        return res.status(400).json({
          error:
            "Cannot delete this customer because the customer has an existing order. Delete the related order first.",
        });
      }

      await pool.query(
        `
        DELETE FROM customers
        WHERE customer_id = $1
        `,
        [customerId]
      );

      res.json({
        message:
          "Customer deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Customer deletion error:",
        error
      );

      handleDatabaseError(
        res,
        error,
        "delete customer"
      );
    }
  }
);

// =====================================================
// SUPPLIERS
// =====================================================

app.get("/api/suppliers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM suppliers
      ORDER BY supplier_id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "load suppliers"
    );
  }
});

app.post("/api/suppliers", async (req, res) => {
  try {
    const {
      supplier_name,
      phone,
      email,
      address,
      status,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO suppliers (
        supplier_name,
        phone,
        email,
        address,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        supplier_name,
        phone?.trim() || null,
        email?.trim() || null,
        address?.trim() || null,
        status || "active",
      ]
    );

    res.status(201).json(
      result.rows[0]
    );
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "add supplier"
    );
  }
});

app.delete("/api/suppliers/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM suppliers
      WHERE supplier_id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Supplier not found.",
      });
    }

    res.json({
      message:
        "Supplier deleted successfully.",
    });
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "delete supplier"
    );
  }
});

// =====================================================
// ORDERS
// =====================================================

app.get("/api/orders", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        orders.*,
        customers.full_name AS customer_name,
        kaolin_products.product_name AS product_name
      FROM orders
      LEFT JOIN customers
        ON orders.customer_id = customers.customer_id
      LEFT JOIN kaolin_products
        ON orders.product_id = kaolin_products.product_id
      ORDER BY orders.order_id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "load orders"
    );
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const {
      customer_id,
      product_id,
      quantity,
      order_status,
    } = req.body;

    if (
      !customer_id ||
      !product_id ||
      !quantity ||
      Number(quantity) <= 0
    ) {
      return res.status(400).json({
        error:
          "Customer, product and a valid quantity are required.",
      });
    }

    const customerResult = await pool.query(
      `
      SELECT customer_id
      FROM customers
      WHERE customer_id = $1
      `,
      [customer_id]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        error: "Customer not found.",
      });
    }

    const productResult = await pool.query(
      `
      SELECT *
      FROM kaolin_products
      WHERE product_id = $1
      `,
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found.",
      });
    }

    const product = productResult.rows[0];

    const totalAmount =
      Number(product.price_per_unit) *
      Number(quantity);

    const result = await pool.query(
      `
      INSERT INTO orders (
        customer_id,
        product_id,
        quantity,
        total_amount,
        order_status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        customer_id,
        product_id,
        quantity,
        totalAmount,
        order_status || "pending",
      ]
    );

    res.status(201).json(
      result.rows[0]
    );
  } catch (error) {
    console.error(
      "Order creation error:",
      error
    );

    handleDatabaseError(
      res,
      error,
      "create order"
    );
  }
});

// =====================================================
// DELETE ORDER
// =====================================================

app.delete("/api/orders/:id", async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        error: "Invalid order ID.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM orders
      WHERE order_id = $1
      RETURNING *
      `,
      [orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Order not found.",
      });
    }

    res.json({
      message:
        "Order deleted successfully.",
    });
  } catch (error) {
    handleDatabaseError(
      res,
      error,
      "delete order"
    );
  }
});

// =====================================================
// API NOT FOUND
// =====================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    error:
      `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, async () => {
  console.log(
    `Backend server running on port ${PORT}`
  );

  await startDatabase();
});