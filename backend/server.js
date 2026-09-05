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
// POSTGRESQL CONNECTION
// =====================================================

const pool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "kaolin_system",
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT) || 5432,
});

pool
  .query("SELECT NOW()")
  .then(() => {
    console.log("PostgreSQL connected successfully.");
    createDefaultAdmin();
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
  });

// =====================================================
// HOME ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.json({
    message: "Gwaram Kaolin Supply Chain System Backend is running.",
  });
});

// =====================================================
// CREATE DEFAULT ADMIN
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
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      await pool.query(
        `
        INSERT INTO users
        (
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

      console.log("Default administrator created successfully.");
    }
  } catch (error) {
    console.error("Admin creation error:", error.message);
  }
}

// =====================================================
// LOGIN
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
      `
      SELECT
        user_id,
        full_name,
        email,
        password_hash,
        role
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email.trim()]
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
    const result = await pool.query(`
      SELECT *
      FROM workers
      ORDER BY worker_id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
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

    if (
      !worker_type ||
      !skill ||
      daily_rate === undefined ||
      daily_rate === ""
    ) {
      return res.status(400).json({
        error: "Worker type, skill and daily rate are required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO workers
      (
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
        Number(daily_rate),
        site_id || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
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
      message: "Worker deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
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
    res.status(500).json({
      error: error.message,
    });
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

    if (!site_name || !location) {
      return res.status(400).json({
        error: "Site name and location are required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO mining_sites
      (
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

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.delete("/api/mining-sites/:id", async (req, res) => {
  try {
    const workerCheck = await pool.query(
      `
      SELECT worker_id
      FROM workers
      WHERE site_id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    if (workerCheck.rows.length > 0) {
      return res.status(400).json({
        error:
          "This mining site cannot be deleted because workers are assigned to it.",
      });
    }

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
        error: "Mining site not found.",
      });
    }

    res.json({
      message: "Mining site deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
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
    res.status(500).json({
      error: error.message,
    });
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

    if (
      !product_name ||
      !grade ||
      quantity_available === "" ||
      quantity_available === undefined ||
      !unit ||
      price_per_unit === "" ||
      price_per_unit === undefined
    ) {
      return res.status(400).json({
        error: "Please complete all product fields.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO kaolin_products
      (
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
        Number(quantity_available),
        unit,
        Number(price_per_unit),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.delete("/api/kaolin-products/:id", async (req, res) => {
  try {
    const orderCheck = await pool.query(
      `
      SELECT order_id
      FROM orders
      WHERE product_id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    if (orderCheck.rows.length > 0) {
      return res.status(400).json({
        error:
          "This product cannot be deleted because it is used in an order.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM kaolin_products
      WHERE product_id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found.",
      });
    }

    res.json({
      message: "Product deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

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
    res.status(500).json({
      error: error.message,
    });
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

    if (!full_name || !phone) {
      return res.status(400).json({
        error: "Customer name and phone number are required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO customers
      (
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
        email || null,
        address || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.delete("/api/customers/:id", async (req, res) => {
  try {
    const orderCheck = await pool.query(
      `
      SELECT order_id
      FROM orders
      WHERE customer_id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    if (orderCheck.rows.length > 0) {
      return res.status(400).json({
        error:
          "This customer cannot be deleted because the customer has existing orders.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM customers
      WHERE customer_id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Customer not found.",
      });
    }

    res.json({
      message: "Customer deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

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
    res.status(500).json({
      error: error.message,
    });
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

    if (!supplier_name) {
      return res.status(400).json({
        error: "Supplier name is required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO suppliers
      (
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
        phone || null,
        email || null,
        address || null,
        status || "active",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
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
      message: "Supplier deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
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
    res.status(500).json({
      error: error.message,
    });
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

    if (!customer_id || !product_id || !quantity) {
      return res.status(400).json({
        error: "Customer, product and quantity are required.",
      });
    }

    if (Number(quantity) <= 0) {
      return res.status(400).json({
        error: "Quantity must be greater than zero.",
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
        error: "Selected customer was not found.",
      });
    }

    const productResult = await pool.query(
      `
      SELECT
        product_id,
        price_per_unit
      FROM kaolin_products
      WHERE product_id = $1
      `,
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: "Selected product was not found.",
      });
    }

    const product = productResult.rows[0];

    const totalAmount =
      Number(product.price_per_unit || 0) *
      Number(quantity);

    const result = await pool.query(
      `
      INSERT INTO orders
      (
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
        Number(customer_id),
        Number(product_id),
        Number(quantity),
        totalAmount,
        order_status || "pending",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Order creation error:", error.message);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.delete("/api/orders/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM orders
      WHERE order_id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Order not found.",
      });
    }

    res.json({
      message: "Order deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// =====================================================
// API NOT FOUND
// =====================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(
    `Backend server running on http://localhost:${PORT}`
  );
});