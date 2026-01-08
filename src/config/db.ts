import mysql from "mysql2/promise";
import 'dotenv/config'; // Ensure env vars are loaded if this file is imported first/independently, though index.ts will also have it.

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "dblocal",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
