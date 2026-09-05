const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// =====================================================
// POSTGRESQL CONNECTION
// =====================================================

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "kaolin_system",
  password: "sigd090??",
  port: 5432,
});

pool.query("SELECT NOW()", (error, result) => {
  if (error) {
    console.error("Database connection failed:", error.message);
  } else {
    console.log("PostgreSQL connected successfully.");
  }
});

// =====================================================
// TEST ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.json({
    message: "Gwaram Kaolin Supply Chain System Backend is running.",
  });
});

// =====================================================
// CREATE DEFAULT ADMIN
// Run once automatically if no admin exists
// =====================================================

async function createDefaultAdmin() {
  try {
    const adminEmail = "admin@gwaramkaolin.com";
    const adminPassword = "Admin123";

    const existingAdmin = await pool.query(
      `SELECT user_id FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [adminEmail]
    );

    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      await pool.query(
        `INSERT INTO users
        (full_name, phone, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          "System Administrator",
          "0000000000",
          adminEmail,
          passwordHash,
          "admin",
        ]
      );

      console.log("Default administrator created.");
      console.log("Email:", adminEmail);
      console.log("Password:", adminPassword);
    }
  } catch (error) {
    console.error("Admin creation error:", error.message);
  }
}

createDefaultAdmin();

// =====================================================
// ADMIN LOGIN
// =====================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT user_id, full_name, email, password_hash, role
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    const user = result.rows[0];

    if (String(user.role).toLowerCase() !== "admin") {
      return res.status(403).json({
        error: "This account does not have administrator access.",
      });
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        error: "Invalid email or password.",
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
    console.error("Login error:", error.message);

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
    const result = await pool.query(
      "SELECT * FROM workers ORDER BY worker_id DESC"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      `INSERT INTO workers
      (user_id, worker_type, skill, availability, daily_rate, site_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        user_id || null,
        worker_type,
        skill,
        availability,
        daily_rate,
        site_id || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// MINING SITES
// =====================================================

app.get("/api/mining-sites", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM mining_sites ORDER BY site_id DESC"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/mining-sites", async (req, res) => {
  try {
    const { site_name, location, description, status } = req.body;

    const result = await pool.query(
      `INSERT INTO mining_sites
      (site_name, location, description, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [site_name, location, description, status]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// KAOLIN PRODUCTS
// =====================================================

app.get("/api/kaolin-products", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM kaolin_products ORDER BY product_id DESC"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      `INSERT INTO kaolin_products
      (product_name, grade, quantity_available, unit, price_per_unit)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        product_name,
        grade,
        quantity_available,
        unit,
        price_per_unit,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// CUSTOMERS
// =====================================================

app.get("/api/customers", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM customers ORDER BY customer_id DESC"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const { full_name, phone, email, address } = req.body;

    const result = await pool.query(
      `INSERT INTO customers
      (full_name, phone, email, address)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [full_name, phone, email || null, address || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// SUPPLIERS
// =====================================================

app.get("/api/suppliers", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM suppliers ORDER BY supplier_id DESC"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      `INSERT INTO suppliers
      (supplier_name, phone, email, address, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        supplier_name,
        phone || null,
        email || null,
        address || null,
        status || "active",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// ORDERS
// =====================================================

app.get("/api/orders", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY order_id DESC"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const {
      customer_id,
      product_id,
      quantity,
      total_amount,
      order_status,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO orders
      (customer_id, product_id, quantity, total_amount, order_status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        customer_id,
        product_id,
        quantity,
        total_amount,
        order_status || "pending",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});