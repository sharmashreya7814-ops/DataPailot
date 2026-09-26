import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { Logger } from '../utils/logger';

/**
 * Initializes the default demo SQLite database in `data/datapilot_demo.sqlite`
 * so users have instant access to rich sample data out of the box.
 */
export function ensureDemoDatabase(): void {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (err) {
      Logger.warn('Could not create data directory for demo db', { error: String(err) });
      return;
    }
  }

  const dbFile = path.join(dataDir, 'datapilot_demo.sqlite');
  if (fs.existsSync(dbFile)) {
    try {
      const db = new DatabaseSync(dbFile);
      const cols = db.prepare("PRAGMA table_info(customers)").all() as any[];
      const hasGender = cols.some(c => c.name === 'gender');
      if (!hasGender) {
        db.exec("ALTER TABLE customers ADD COLUMN gender TEXT;");
        db.exec("UPDATE customers SET gender = CASE customer_id % 3 WHEN 1 THEN 'Female' WHEN 2 THEN 'Male' ELSE 'Other' END;");
      }
      db.close();
    } catch (err) {
      Logger.warn('Could not verify/migrate demo database customers columns', { error: String(err) });
    }
    return; // Already initialized
  }

  try {
    const db = new DatabaseSync(dbFile);

    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        gender TEXT,
        city TEXT,
        country TEXT DEFAULT 'USA',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        stock_quantity INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
      );

      CREATE TABLE IF NOT EXISTS order_items (
        order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(order_id),
        FOREIGN KEY(product_id) REFERENCES products(product_id)
      );

      INSERT INTO customers (first_name, last_name, email, gender, city, country) VALUES
        ('Alice', 'Smith', 'alice.smith@example.com', 'Female', 'San Francisco', 'USA'),
        ('Bob', 'Jones', 'bob.jones@example.com', 'Male', 'New York', 'USA'),
        ('Charlie', 'Brown', 'charlie.brown@example.com', 'Other', 'London', 'UK'),
        ('Diana', 'Prince', 'diana.prince@example.com', 'Female', 'Chicago', 'USA'),
        ('Evan', 'Wright', 'evan.wright@example.com', 'Male', 'Toronto', 'Canada'),
        ('Fiona', 'Gallagher', 'fiona.g@example.com', 'Other', 'Chicago', 'USA'),
        ('George', 'Clark', 'george.c@example.com', 'Female', 'Austin', 'USA');

      INSERT INTO products (name, category, price, stock_quantity) VALUES
        ('UltraBook Pro 15', 'Electronics', 1299.99, 45),
        ('Wireless Noise-Canceling Headphones', 'Audio', 199.99, 120),
        ('Ergonomic Mesh Office Chair', 'Furniture', 249.50, 30),
        ('Mechanical Gaming Keyboard', 'Accessories', 89.99, 85),
        ('4K Ultra HD 27-inch Monitor', 'Displays', 349.99, 40),
        ('Smart Fitness Watch v2', 'Wearables', 149.00, 95),
        ('Standing Desk Electric Frame', 'Furniture', 399.00, 25);

      INSERT INTO orders (customer_id, order_date, status, total_amount) VALUES
        (1, '2025-01-10 10:30:00', 'COMPLETED', 1499.98),
        (2, '2025-01-12 14:15:00', 'COMPLETED', 249.50),
        (3, '2025-01-15 09:00:00', 'COMPLETED', 439.98),
        (4, '2025-01-18 16:45:00', 'PENDING', 1299.99),
        (5, '2025-01-20 11:20:00', 'COMPLETED', 349.99),
        (6, '2025-01-22 13:10:00', 'COMPLETED', 548.99),
        (7, '2025-01-25 15:30:00', 'SHIPPED', 199.99);

      INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
        (1, 1, 1, 1299.99),
        (1, 2, 1, 199.99),
        (2, 3, 1, 249.50),
        (3, 4, 1, 89.99),
        (3, 5, 1, 349.99),
        (4, 1, 1, 1299.99),
        (5, 5, 1, 349.99),
        (6, 2, 1, 199.99),
        (6, 5, 1, 349.99),
        (7, 2, 1, 199.99);
    `);

    db.close();
    Logger.info('Demo SQLite database created at data/datapilot_demo.sqlite');
  } catch (err) {
    Logger.warn('Failed to seed demo SQLite database', { error: String(err) });
  }
}
