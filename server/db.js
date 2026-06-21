import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const poolConfig = connectionString 
  ? { connectionString }
  : {
      host: process.env.PGHOST || 'localhost',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'seisoapp',
      port: parseInt(process.env.PGPORT || '5432', 10),
    };

export const pool = new Pool(poolConfig);

// Helper to query the DB
export const query = (text, params) => pool.query(text, params);

export default pool;
