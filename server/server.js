const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const path = require("path");

dotenv.config();

const app = express();
const clientPath = path.join(__dirname, "..", "client");

const seedProducts = [
  {
    name: "AeroFlex Running Shoes",
    category: "Footwear",
    price: 129,
    rating: 4.8,
    tag: "Best seller",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Everyday Canvas Tote",
    category: "Accessories",
    price: 48,
    rating: 4.6,
    tag: "New",
    image:
      "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Nimbus Knit Hoodie",
    category: "Apparel",
    price: 86,
    rating: 4.7,
    tag: "Limited",
    image:
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Studio Ceramic Bottle",
    category: "Home",
    price: 34,
    rating: 4.5,
    tag: "Eco pick",
    image:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Signal Wireless Headphones",
    category: "Tech",
    price: 159,
    rating: 4.9,
    tag: "Top rated",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Trail Weekender Duffel",
    category: "Accessories",
    price: 118,
    rating: 4.7,
    tag: "Travel",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80",
  },
];

let db;
let dbReady = false;

function hasDatabaseConfig() {
  const placeholders = new Set([
    "your-rds-endpoint",
    "your-rds-endpoint.region.rds.amazonaws.com",
    "replace-with-a-strong-password",
  ]);

  return [process.env.DB_HOST, process.env.DB_USER, process.env.DB_PASSWORD, process.env.DB_NAME].every(
    (value) => value && !placeholders.has(value)
  );
}

function productRow(product) {
  return {
    ...product,
    id: Number(product.id),
    price: Number(product.price),
    rating: Number(product.rating),
  };
}

async function initDatabase() {
  if (!hasDatabaseConfig()) {
    console.warn("RDS is not configured. Using in-memory product data.");
    return;
  }

  db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });

  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      category VARCHAR(80) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      rating DECIMAL(2,1) NOT NULL DEFAULT 0,
      tag VARCHAR(80) NOT NULL,
      image TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_name VARCHAR(120) NOT NULL,
      email VARCHAR(180) NOT NULL,
      address TEXT NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(160) NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      quantity INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(180) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [[{ count }]] = await db.query("SELECT COUNT(*) AS count FROM products");
  if (count === 0) {
    await db.query(
      "INSERT INTO products (name, category, price, rating, tag, image) VALUES ?",
      [
        seedProducts.map((product) => [
          product.name,
          product.category,
          product.price,
          product.rating,
          product.tag,
          product.image,
        ]),
      ]
    );
  }

  dbReady = true;
  console.log("Connected to RDS database.");
}

async function getProducts() {
  if (!dbReady) {
    return seedProducts.map((product, index) => productRow({ id: index + 1, ...product }));
  }

  const [rows] = await db.query(
    "SELECT id, name, category, price, rating, tag, image FROM products ORDER BY id"
  );

  return rows.map(productRow);
}

app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);
app.use(express.static(clientPath));

app.get("/api", (req, res) => {
  res.json({
    message: "E-commerce API is running",
    database: dbReady ? "rds-connected" : "memory-fallback",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    database: dbReady ? "connected" : "not-configured",
  });
});

app.get("/api/products", async (req, res, next) => {
  try {
    res.json(await getProducts());
  } catch (error) {
    next(error);
  }
});

app.post("/api/newsletter", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    if (dbReady) {
      await db.query(
        "INSERT INTO newsletter_subscribers (email) VALUES (?) ON DUPLICATE KEY UPDATE email = VALUES(email)",
        [email]
      );
    }

    res.status(201).json({ message: "You are on the list." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async (req, res, next) => {
  try {
    const { customerName, email, address, items } = req.body;
    const cleanItems = Array.isArray(items) ? items : [];

    if (!customerName || !email || !address || cleanItems.length === 0) {
      return res.status(400).json({ message: "Customer details and cart items are required." });
    }

    const products = await getProducts();
    const productMap = new Map(products.map((product) => [product.id, product]));
    const orderItems = cleanItems
      .map((item) => {
        const product = productMap.get(Number(item.id));
        const quantity = Math.max(1, Number(item.quantity || 1));
        return product ? { ...product, quantity } : null;
      })
      .filter(Boolean);

    if (orderItems.length === 0) {
      return res.status(400).json({ message: "No valid products were found in the cart." });
    }

    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (!dbReady) {
      return res.status(201).json({
        id: Date.now(),
        total,
        status: "demo-confirmed",
        message: "Order captured in demo mode. Configure RDS to persist orders.",
      });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [orderResult] = await connection.query(
        "INSERT INTO orders (customer_name, email, address, total) VALUES (?, ?, ?, ?)",
        [customerName.trim(), email.trim().toLowerCase(), address.trim(), total]
      );

      await connection.query(
        "INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES ?",
        [
          orderItems.map((item) => [
            orderResult.insertId,
            item.id,
            item.name,
            item.price,
            item.quantity,
          ]),
        ]
      );

      await connection.commit();
      res.status(201).json({ id: orderResult.insertId, total, status: "pending" });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});

const PORT = process.env.PORT || 5000;

initDatabase()
  .catch((error) => {
    console.error("Database initialization failed. Falling back to in-memory data.");
    console.error(error.message);
  })
  .finally(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
