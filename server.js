const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "inventory.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const DB_PATH = path.join(DATA_DIR, "inventory.db");
const DATABASE_URL = process.env.DATABASE_URL || "";
const JWT_SECRET = process.env.JWT_SECRET || "inventory-demo-secret-change-me";
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
let activeDatabaseMode = DATABASE_URL ? "postgres" : "sqlite";
let postgresPool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const origin = req.get("Origin");

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(!origin || allowedOrigins.has(origin) ? 204 : 403);
  }

  next();
});
app.use(express.static(__dirname));

function fallbackToSqlite(error) {
  if (!postgresPool) {
    return;
  }

  if (error && error.code === "ECONNREFUSED") {
    console.warn("PostgreSQL unavailable, falling back to SQLite.", error.message);
  }

  postgresPool.end().catch(() => undefined);
  postgresPool = null;
  activeDatabaseMode = "sqlite";
}

async function ensureDatabaseMode() {
  if (!postgresPool) {
    return;
  }

  try {
    await postgresPool.query("SELECT 1");
    activeDatabaseMode = "postgres";
  } catch (error) {
    fallbackToSqlite(error);
  }
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureDataFiles() {
  ensureDataDir();

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ products: [], activities: [], transactions: [], suppliers: [], customers: [], invoices: [] }, null, 2), "utf8");
  }

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

ensureDataDir();
const sqliteDb = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

async function dbRun(sql, params = []) {
  if (postgresPool) {
    try {
      const result = await postgresPool.query(sql, params);
      return { id: result.rows[0]?.id ?? null, changes: result.rowCount ?? 0 };
    } catch (error) {
      fallbackToSqlite(error);
    }
  }

  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

async function dbAll(sql, params = []) {
  if (postgresPool) {
    try {
      const result = await postgresPool.query(sql, params);
      return result.rows;
    } catch (error) {
      fallbackToSqlite(error);
    }
  }

  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

async function dbGet(sql, params = []) {
  if (postgresPool) {
    try {
      const result = await postgresPool.query(sql, params);
      return result.rows[0] || null;
    } catch (error) {
      fallbackToSqlite(error);
    }
  }

  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

async function initializeDatabase() {
  ensureDataFiles();

  if (DATABASE_URL) {
    await ensureDatabaseMode();
  }

  const tableSql = [
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      supplier TEXT,
      low_stock_alert INTEGER DEFAULT 5,
      quantity INTEGER DEFAULT 0,
      price REAL DEFAULT 0,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      action TEXT NOT NULL,
      quantity INTEGER DEFAULT 0,
      total_value REAL DEFAULT 0,
      timestamp TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user'
    )`
  ];

  for (const sql of tableSql) {
    await dbRun(sql);
  }

  await seedDefaultState();
  await seedDefaultAdmin();
}

async function seedDefaultState() {
  const counts = await Promise.all([
    dbGet("SELECT COUNT(*) AS count FROM products"),
    dbGet("SELECT COUNT(*) AS count FROM activities"),
    dbGet("SELECT COUNT(*) AS count FROM transactions"),
    dbGet("SELECT COUNT(*) AS count FROM suppliers"),
    dbGet("SELECT COUNT(*) AS count FROM customers"),
    dbGet("SELECT COUNT(*) AS count FROM invoices")
  ]);

  const hasAnyData = counts.some((row) => Number(row?.count || 0) > 0);
  if (hasAnyData) {
    return;
  }

  const now = new Date().toISOString();

  await dbRun(`INSERT INTO products (id, name, category, supplier, low_stock_alert, quantity, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    "prod-1", "Notebook", "Stationery", "Office Supply Co.", 10, 45, 12, now
  ]);
  await dbRun(`INSERT INTO products (id, name, category, supplier, low_stock_alert, quantity, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    "prod-2", "Mouse", "Electronics", "Tech Hub", 8, 18, 28, now
  ]);
  await dbRun(`INSERT INTO products (id, name, category, supplier, low_stock_alert, quantity, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    "prod-3", "Coffee Beans", "Food", "Market Fresh", 6, 9, 18, now
  ]);

  await dbRun(`INSERT INTO activities (id, message, timestamp) VALUES (?, ?, ?)`, ["act-1", "Inventory initialized", now]);

  await dbRun(`INSERT INTO transactions (id, product_name, action, quantity, total_value, timestamp) VALUES (?, ?, ?, ?, ?, ?)`, [
    "txn-1", "Notebook", "Sold", 3, 36, now
  ]);
  await dbRun(`INSERT INTO transactions (id, product_name, action, quantity, total_value, timestamp) VALUES (?, ?, ?, ?, ?, ?)`, [
    "txn-2", "Mouse", "Restocked", 8, 224, now
  ]);

  await dbRun(`INSERT INTO suppliers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)`, ["supplier-1", "Office Supply Co.", "050-111-2222", "", now]);
  await dbRun(`INSERT INTO suppliers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)`, ["supplier-2", "Tech Hub", "050-333-4444", "", now]);

  await dbRun(`INSERT INTO customers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)`, ["customer-1", "Ahmad Ali", "050-555-6666", "", now]);
  await dbRun(`INSERT INTO customers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)`, ["customer-2", "Sara Hassan", "050-777-8888", "", now]);

  await dbRun(`INSERT INTO invoices (id, customer_name, product_name, quantity, unit_price, subtotal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    "INV-1", "Ahmad Ali", "Notebook", 2, 12, 24, now
  ]);
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "user"
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function readUsers() {
  const rows = await dbAll("SELECT * FROM users ORDER BY id ASC");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role || "user"
  }));
}

async function writeUsers(users) {
  await dbRun("DELETE FROM users");

  for (const user of users) {
    await dbRun(
      "INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
      [user.id, user.name, user.email, user.password, user.role || "user"]
    );
  }
}

async function seedDefaultAdmin() {
  const users = await readUsers();
  const adminEmail = "admin@inventory.local";

  if (!users.some((user) => user.email === adminEmail)) {
    users.push({
      id: "admin-1",
      name: "Administrator",
      email: adminEmail,
      password: bcrypt.hashSync("admin123", 10),
      role: "admin"
    });
    await writeUsers(users);
  }
}

async function readState() {
  const [products, activities, transactions, suppliers, customers, invoices] = await Promise.all([
    dbAll("SELECT * FROM products ORDER BY created_at DESC, name ASC"),
    dbAll("SELECT * FROM activities ORDER BY timestamp DESC LIMIT 20"),
    dbAll("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 20"),
    dbAll("SELECT * FROM suppliers ORDER BY name ASC"),
    dbAll("SELECT * FROM customers ORDER BY name ASC"),
    dbAll("SELECT * FROM invoices ORDER BY created_at DESC LIMIT 50")
  ]);

  return {
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      supplier: product.supplier,
      lowStockAlert: Number(product.low_stock_alert || 5),
      quantity: Number(product.quantity || 0),
      price: Number(product.price || 0),
      createdAt: product.created_at
    })),
    activities: activities.map((activity) => ({
      id: activity.id,
      message: activity.message,
      timestamp: activity.timestamp
    })),
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      productName: transaction.product_name,
      action: transaction.action,
      quantity: Number(transaction.quantity || 0),
      totalValue: Number(transaction.total_value || 0),
      timestamp: transaction.timestamp
    })),
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email || ""
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || ""
    })),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      customerName: invoice.customer_name,
      productName: invoice.product_name,
      quantity: Number(invoice.quantity || 0),
      unitPrice: Number(invoice.unit_price || 0),
      subtotal: Number(invoice.subtotal || 0),
      createdAt: invoice.created_at
    }))
  };
}

async function writeState(state) {
  const nextState = {
    products: Array.isArray(state.products) ? state.products : [],
    activities: Array.isArray(state.activities) ? state.activities : [],
    transactions: Array.isArray(state.transactions) ? state.transactions : [],
    suppliers: Array.isArray(state.suppliers) ? state.suppliers : [],
    customers: Array.isArray(state.customers) ? state.customers : [],
    invoices: Array.isArray(state.invoices) ? state.invoices : []
  };

  await dbRun("DELETE FROM products");
  await dbRun("DELETE FROM activities");
  await dbRun("DELETE FROM transactions");
  await dbRun("DELETE FROM suppliers");
  await dbRun("DELETE FROM customers");
  await dbRun("DELETE FROM invoices");

  for (const product of nextState.products) {
    await dbRun(
      "INSERT INTO products (id, name, category, supplier, low_stock_alert, quantity, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [product.id || `prod-${Date.now()}`, product.name || "Unknown", product.category || "Uncategorized", product.supplier || "N/A", Number(product.lowStockAlert || 5), Number(product.quantity || 0), Number(product.price || 0), product.createdAt || new Date().toISOString()]
    );
  }

  for (const activity of nextState.activities) {
    await dbRun("INSERT INTO activities (id, message, timestamp) VALUES (?, ?, ?)", [activity.id || `act-${Date.now()}`, activity.message || "", activity.timestamp || new Date().toISOString()]);
  }

  for (const transaction of nextState.transactions) {
    await dbRun("INSERT INTO transactions (id, product_name, action, quantity, total_value, timestamp) VALUES (?, ?, ?, ?, ?, ?)", [
      transaction.id || `txn-${Date.now()}`,
      transaction.productName || "",
      transaction.action || "",
      Number(transaction.quantity || 0),
      Number(transaction.totalValue || 0),
      transaction.timestamp || new Date().toISOString()
    ]);
  }

  for (const supplier of nextState.suppliers) {
    await dbRun("INSERT INTO suppliers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)", [
      supplier.id || `supplier-${Date.now()}`,
      supplier.name || "",
      supplier.phone || "",
      supplier.email || "",
      new Date().toISOString()
    ]);
  }

  for (const customer of nextState.customers) {
    await dbRun("INSERT INTO customers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)", [
      customer.id || `customer-${Date.now()}`,
      customer.name || "",
      customer.phone || "",
      customer.email || "",
      new Date().toISOString()
    ]);
  }

  for (const invoice of nextState.invoices) {
    await dbRun("INSERT INTO invoices (id, customer_name, product_name, quantity, unit_price, subtotal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      invoice.id || `INV-${Date.now()}`,
      invoice.customerName || "",
      invoice.productName || "",
      Number(invoice.quantity || 0),
      Number(invoice.unitPrice || 0),
      Number(invoice.subtotal || 0),
      invoice.createdAt || new Date().toISOString()
    ]);
  }

  return nextState;
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Inventory API is running", database: activeDatabaseMode });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password || String(password).length < 6) {
    return res.status(400).json({ message: "Name, email, and password (minimum 6 characters) are required." });
  }

  const users = await readUsers();
  const normalizedEmail = String(email).trim().toLowerCase();

  if (users.some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const newUser = {
    id: `user-${Date.now()}`,
    name: String(name).trim(),
    email: normalizedEmail,
    password: bcrypt.hashSync(String(password), 10),
    role: "user"
  };

  users.push(newUser);
  await writeUsers(users);

  const safeUser = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
  const token = createToken(safeUser);

  res.status(201).json({ token, user: safeUser });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const users = await readUsers();
  const user = users.find((candidate) => candidate.email === normalizedEmail);

  if (!user || !bcrypt.compareSync(String(password), user.password)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: createToken(safeUser), user: safeUser });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const users = await readUsers();
  const user = users.find((candidate) => candidate.id === req.user.id);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ user: safeUser });
});

app.get("/api/state", requireAuth, async (req, res) => {
  res.json(await readState());
});

app.post("/api/state", requireAuth, async (req, res) => {
  const incoming = req.body || {};
  const nextState = {
    products: Array.isArray(incoming.products) ? incoming.products : [],
    activities: Array.isArray(incoming.activities) ? incoming.activities : [],
    transactions: Array.isArray(incoming.transactions) ? incoming.transactions : [],
    suppliers: Array.isArray(incoming.suppliers) ? incoming.suppliers : [],
    customers: Array.isArray(incoming.customers) ? incoming.customers : [],
    invoices: Array.isArray(incoming.invoices) ? incoming.invoices : []
  };

  await writeState(nextState);
  res.json(nextState);
});

app.get("/api/products", requireAuth, async (req, res) => {
  const state = await readState();
  res.json(state.products);
});

app.post("/api/products", requireAuth, async (req, res) => {
  const state = await readState();
  const product = req.body;

  if (!product || !product.name) {
    return res.status(400).json({ message: "Product name is required." });
  }

  state.products.push(product);
  await writeState(state);
  res.status(201).json(product);
});

app.put("/api/products/:id", requireAuth, async (req, res) => {
  const state = await readState();
  const productId = String(req.params.id);
  const index = state.products.findIndex((product) => String(product.id) === productId);

  if (index === -1) {
    return res.status(404).json({ message: "Product not found." });
  }

  state.products[index] = { ...state.products[index], ...req.body };
  await writeState(state);
  res.json(state.products[index]);
});

app.delete("/api/products/:id", requireAuth, async (req, res) => {
  const state = await readState();
  const productId = String(req.params.id);
  const originalLength = state.products.length;
  state.products = state.products.filter((product) => String(product.id) !== productId);

  if (state.products.length === originalLength) {
    return res.status(404).json({ message: "Product not found." });
  }

  await writeState(state);
  res.json({ success: true });
});

app.delete("/api/products", requireAuth, async (req, res) => {
  const state = await readState();
  state.products = [];
  await writeState(state);
  res.json({ success: true });
});

app.get("/api/activities", requireAuth, async (req, res) => {
  const state = await readState();
  res.json(state.activities);
});

app.get("/api/transactions", requireAuth, async (req, res) => {
  const state = await readState();
  res.json(state.transactions);
});

app.get("/api/suppliers", requireAuth, async (req, res) => {
  const state = await readState();
  res.json(state.suppliers);
});

app.post("/api/suppliers", requireAuth, async (req, res) => {
  const state = await readState();
  const incoming = req.body || {};
  const name = String(incoming.name || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Supplier name is required." });
  }

  const supplier = {
    id: incoming.id || `supplier-${Date.now()}`,
    name,
    phone: String(incoming.phone || "").trim(),
    email: String(incoming.email || "").trim()
  };

  state.suppliers.push(supplier);
  await writeState(state);
  res.status(201).json(supplier);
});

app.delete("/api/suppliers/:id", requireAuth, async (req, res) => {
  const state = await readState();
  const originalLength = state.suppliers.length;
  state.suppliers = state.suppliers.filter((supplier) => String(supplier.id) !== String(req.params.id));

  if (state.suppliers.length === originalLength) {
    return res.status(404).json({ message: "Supplier not found." });
  }

  await writeState(state);
  res.json({ success: true });
});

app.get("/api/customers", requireAuth, async (req, res) => {
  const state = await readState();
  res.json(state.customers);
});

app.post("/api/customers", requireAuth, async (req, res) => {
  const state = await readState();
  const incoming = req.body || {};
  const name = String(incoming.name || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Customer name is required." });
  }

  const customer = {
    id: incoming.id || `customer-${Date.now()}`,
    name,
    phone: String(incoming.phone || "").trim(),
    email: String(incoming.email || "").trim()
  };

  state.customers.push(customer);
  await writeState(state);
  res.status(201).json(customer);
});

app.delete("/api/customers/:id", requireAuth, async (req, res) => {
  const state = await readState();
  const originalLength = state.customers.length;
  state.customers = state.customers.filter((customer) => String(customer.id) !== String(req.params.id));

  if (state.customers.length === originalLength) {
    return res.status(404).json({ message: "Customer not found." });
  }

  await writeState(state);
  res.json({ success: true });
});

app.get("/api/invoices", requireAuth, async (req, res) => {
  const state = await readState();
  res.json(state.invoices);
});

app.post("/api/invoices", requireAuth, async (req, res) => {
  const state = await readState();
  const incoming = req.body || {};
  const customerName = String(incoming.customerName || "").trim();
  const productName = String(incoming.productName || "").trim();
  const quantity = Number(incoming.quantity);
  const unitPrice = Number(incoming.unitPrice);

  if (!customerName || !productName || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return res.status(400).json({ message: "Valid customer, product, quantity and price are required." });
  }

  const invoice = {
    id: incoming.id || `INV-${Date.now()}`,
    customerName,
    productName,
    quantity,
    unitPrice,
    subtotal: quantity * unitPrice,
    createdAt: incoming.createdAt || new Date().toISOString()
  };

  state.invoices.unshift(invoice);
  await writeState(state);
  res.status(201).json(invoice);
});

app.get("/api/reports", requireAuth, async (req, res) => {
  const state = await readState();
  const totalProducts = state.products.length;
  const lowStockCount = state.products.filter((product) => {
    const alertLevel = Number(product.lowStockAlert) || 5;
    return product.quantity === 0 || product.quantity <= alertLevel;
  }).length;
  const inventoryValue = state.products.reduce((sum, product) => sum + (Number(product.quantity || 0) * Number(product.price || 0)), 0);
  const totalRevenue = state.transactions
    .filter((transaction) => transaction.action === "Sold")
    .reduce((sum, transaction) => sum + Number(transaction.totalValue || 0), 0);
  const invoiceCount = state.invoices.length;
  const topProduct = state.transactions.reduce((best, tx) => {
    const currentName = String(tx.productName || "");
    if (!currentName) {
      return best;
    }
    const amount = Number(tx.totalValue || 0);
    if (!best || amount > best.totalValue) {
      return { productName: currentName, totalValue: amount };
    }
    return best;
  }, null);

  res.json({
    totalProducts,
    lowStockCount,
    inventoryValue,
    totalRevenue,
    invoiceCount,
    topProduct
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

initializeDatabase().catch((error) => {
  console.error("Failed to initialize database", error);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`Inventory API running on http://localhost:${PORT}`);
  console.log(activeDatabaseMode === "postgres" ? "PostgreSQL connected via DATABASE_URL" : "SQLite database active");
  console.log("Default admin login: admin@inventory.local / admin123");
});
