import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
};

const io = new Server(server, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb' }));

// Helper to initialize DB tables with connection retry logic
async function initDatabase(retries = 10, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      // Check if hotels table exists
      const res = await query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hotels')");
      if (!res.rows[0].exists) {
        console.log('Tables do not exist. Initializing from init.sql...');
        const sqlPath = path.join(__dirname, 'init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log('Database initialized successfully.');
      } else {
        // Run migration for existing databases to add columns if they don't exist
        console.log('Running migrations on existing database schema...');
        await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)");
        await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50) UNIQUE");
        await query("ALTER TABLE hotels ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE");
        await query("ALTER TABLE daily_rooms ADD COLUMN IF NOT EXISTS checker_notes TEXT");
        await query("ALTER TABLE daily_rooms ADD COLUMN IF NOT EXISTS viewed_cleaner_notes BOOLEAN DEFAULT FALSE");
        await query("ALTER TABLE cleaning_logs ADD COLUMN IF NOT EXISTS checker_notes TEXT");
        await query("ALTER TABLE cleaning_logs ADD COLUMN IF NOT EXISTS viewed_cleaner_notes BOOLEAN DEFAULT FALSE");
        
        // Create user_hotels table if not exists and migrate data
        const tblRes = await query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_hotels')");
        if (!tblRes.rows[0].exists) {
          console.log('Creating user_hotels junction table and migrating data...');
          await query(`
            CREATE TABLE user_hotels (
              user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
              hotel_id VARCHAR(50) REFERENCES hotels(id) ON DELETE CASCADE,
              PRIMARY KEY (user_id, hotel_id)
            )
          `);

          // Migrate data from users.hotel_ids to user_hotels if column exists
          const colRes = await query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_name = 'users' AND column_name = 'hotel_ids'
            )
          `);
          if (colRes.rows[0].exists) {
            const usersRes = await query("SELECT id, hotel_ids FROM users");
            for (const u of usersRes.rows) {
              if (u.hotel_ids && u.hotel_ids.length > 0) {
                for (const hId of u.hotel_ids) {
                  // Verify that the hotel actually exists in the hotels table before linking (to prevent foreign key violation)
                  const hCheck = await query("SELECT 1 FROM hotels WHERE id = $1", [hId]);
                  if (hCheck.rows.length > 0) {
                    await query("INSERT INTO user_hotels (user_id, hotel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [u.id, hId]);
                  }
                }
              }
            }
            await query("ALTER TABLE users DROP COLUMN hotel_ids");
            console.log('Migration to user_hotels table completed successfully.');
          }
        }
        console.log('Migrations applied.');
      }

      // Ensure the default admin has password_hash and employee_code populated and valid
      const adminRes = await query("SELECT password_hash, employee_code FROM users WHERE username = 'admin'");
      if (adminRes.rows.length > 0) {
        const currentHash = adminRes.rows[0].password_hash;
        const currentCode = adminRes.rows[0].employee_code;
        const isValidSha256 = currentHash && /^[a-f0-9]{64}$/i.test(currentHash);
        
        if (!currentHash || !isValidSha256) {
          console.log('Seeding default password hash for admin (missing or invalid hash)...');
          await query(
            "UPDATE users SET password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' WHERE username = 'admin'"
          );
        }

        if (!currentCode) {
          console.log('Seeding default employee code for admin...');
          await query(
            "UPDATE users SET employee_code = 'ADMIN001' WHERE username = 'admin'"
          );
        }
      }
      return; // Success, exit retry loop
    } catch (err) {
      console.warn(`Database connection attempt ${i + 1}/${retries} failed. Retrying in ${delay / 1000}s...`);
      if (i === retries - 1) {
        console.error('Error during database initialization:', err);
      } else {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

// Generate rooms if not exist in daily_rooms
async function getOrSeedDailyRooms(hotelId, date) {
  // Verify if the hotel exists in the database
  const hExists = await query('SELECT 1 FROM hotels WHERE id = $1', [hotelId]);
  if (hExists.rows.length === 0) {
    return [];
  }

  // Query existing
  const res = await query(
    'SELECT * FROM daily_rooms WHERE hotel_id = $1 AND date = $2 ORDER BY room_number ASC',
    [hotelId, date]
  );
  if (res.rows.length > 0) {
    return res.rows.map(mapRoomDbToClient);
  }

  // Get master rooms list from hotels table
  let rooms = [];
  const hRes = await query('SELECT rooms_list, room_types FROM hotels WHERE id = $1', [hotelId]);
  if (hRes.rows[0] && hRes.rows[0].rooms_list) {
    const listStr = hRes.rows[0].rooms_list;
    const roomTypes = hRes.rows[0].room_types || [];
    const parts = listStr.split(',').map(p => p.trim()).filter(Boolean);
    for (let part of parts) {
      const [rNum, rType] = part.split(':').map(x => x.trim());
      if (rNum) {
        const floorNum = parseInt(rNum.substring(0, rNum.length - 2) || '1', 10);
        
        // Find defaultGuestCount
        const matchedType = roomTypes.find(t => t.name.toLowerCase() === (rType || 'Single').toLowerCase());
        const defaultGuests = matchedType && matchedType.defaultGuestCount !== undefined ? matchedType.defaultGuestCount : 1;

        rooms.push({
          roomNumber: rNum,
          floor: isNaN(floorNum) ? 1 : floorNum,
          type: rType || 'Single',
          guestCount: defaultGuests
        });
      }
    }
  } else {
    return [];
  }


  // Insert into daily_rooms
  const insertedRooms = [];
  for (let r of rooms) {
    const rId = `${hotelId}_${r.roomNumber}_${date}`;
    await query(
      `INSERT INTO daily_rooms 
       (id, hotel_id, date, room_number, floor, type, status, is_stay, guest_count, notes, updated_by, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, 'vacant', false, $7, '', 'system', NOW()) 
       ON CONFLICT (hotel_id, date, room_number) DO NOTHING`,
      [rId, hotelId, date, r.roomNumber, r.floor, r.type, r.guestCount]
    );

    // Fetch the newly inserted/existing record
    const rRes = await query('SELECT * FROM daily_rooms WHERE id = $1', [rId]);
    if (rRes.rows[0]) {
      insertedRooms.push(mapRoomDbToClient(rRes.rows[0]));
    }
  }

  return insertedRooms;
}

// Map PostgreSQL column names to JavaScript model properties
function mapRoomDbToClient(row) {
  return {
    id: row.room_number, // The frontend UI uses roomNumber as the ID locally
    roomNumber: row.room_number,
    floor: row.floor,
    type: row.type,
    status: row.status,
    isStay: row.is_stay,
    guestCount: row.guest_count,
    notes: row.notes || undefined,
    assignedTo: row.assigned_to || undefined,
    cleanerName: row.cleaner_name || undefined,
    isChecked: row.is_checked !== null ? row.is_checked : undefined,
    checkedBy: row.checked_by || undefined,
    checkedAt: row.checked_at ? row.checked_at.toISOString() : undefined,
    priority: row.priority || 'normal',
    photoDefect: row.photo_defect || undefined,
    checkerNotes: row.checker_notes || undefined,
    viewedCleanerNotes: row.viewed_cleaner_notes !== null ? row.viewed_cleaner_notes : undefined,
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by
  };
}

function mapLogDbToClient(row) {
  return {
    id: row.id,
    roomId: row.room_id,
    roomNumber: row.room_number,
    floor: row.floor,
    cleanerId: row.cleaner_id,
    cleanerName: row.cleaner_name,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at.toISOString(),
    durationMinutes: row.duration_minutes,
    photoBefore: row.photo_before || undefined,
    photoAfter: row.photo_after || undefined,
    notes: row.notes || undefined,
    errors: row.errors || [],
    checkedBy: row.checked_by || undefined,
    checkedAt: row.checked_at ? row.checked_at.toISOString() : undefined,
    checkerNotes: row.checker_notes || undefined,
    viewedCleanerNotes: row.viewed_cleaner_notes !== null ? row.viewed_cleaner_notes : undefined
  };
}

// Websocket Events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_hotel_date', ({ hotelId, date }) => {
    const roomName = `${hotelId}_${date}`;
    socket.join(roomName);
    console.log(`Socket ${socket.id} joined room ${roomName}`);
  });

  socket.on('join_hotel_logs', ({ hotelId }) => {
    const roomName = `${hotelId}_logs`;
    socket.join(roomName);
    console.log(`Socket ${socket.id} joined room ${roomName}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// --- REST API ENDPOINTS ---

app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

// 1. Reset Database
app.post('/api/reset', async (req, res) => {
  try {
    console.log('Resetting database...');
    const sqlPath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('Database reset completed.');
    
    // Broadcast reload trigger to all clients
    io.emit('database_reset');
    
    res.json({ success: true, message: 'Database reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Hotels
// 2. Hotels
app.get('/api/hotels', async (req, res) => {
  try {
    const result = await query('SELECT * FROM hotels ORDER BY id ASC');
    const migratedRows = await Promise.all(result.rows.map(async (h) => {
      let roomTypes = h.room_types || [];
      let updated = false;
      
      if (!roomTypes || roomTypes.length === 0) {
        roomTypes = [
          { id: `${h.id}_rt1`, name: 'Twin', cleanMinutes: 35, price: 10000, defaultGuestCount: 2 },
          { id: `${h.id}_rt2`, name: 'Single', cleanMinutes: 25, price: 5000, defaultGuestCount: 1 },
          { id: `${h.id}_rt3`, name: 'Double', cleanMinutes: 30, price: 8000, defaultGuestCount: 2 },
          { id: `${h.id}_rt4`, name: 'Suite', cleanMinutes: 60, price: 25000, defaultGuestCount: 4 }
        ];
        updated = true;
      } else {
        roomTypes = roomTypes.map(rt => {
          let rtUpdated = false;
          let price = rt.price;
          if (price === undefined || price > 100000) {
            const nameLower = rt.name.toLowerCase();
            price = 5000;
            if (nameLower.includes('suite')) price = 25000;
            else if (nameLower.includes('twin')) price = 10000;
            else if (nameLower.includes('double')) price = 8000;
            else if (nameLower.includes('single')) price = 5000;
            rtUpdated = true;
          }
          let defaultGuestCount = rt.defaultGuestCount;
          if (defaultGuestCount === undefined) {
            const nameLower = rt.name.toLowerCase();
            defaultGuestCount = 1;
            if (nameLower.includes('suite')) defaultGuestCount = 4;
            else if (nameLower.includes('twin')) defaultGuestCount = 2;
            else if (nameLower.includes('double')) defaultGuestCount = 2;
            else if (nameLower.includes('single')) defaultGuestCount = 1;
            rtUpdated = true;
          }
          if (rtUpdated) {
            updated = true;
            return { ...rt, price, defaultGuestCount };
          }
          return rt;
        });
      }
      
      if (updated) {
        await query('UPDATE hotels SET room_types = $1 WHERE id = $2', [JSON.stringify(roomTypes), h.id]);
      }
      
      return {
        id: h.id,
        name: h.name,
        description: h.description,
        roomsList: h.rooms_list,
        defaultCleanMinutes: h.default_clean_minutes,
        roomTypes,
        active: h.active !== false
      };
    }));
    res.json(migratedRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/hotels', async (req, res) => {
  const { id, name, description, defaultCleanMinutes, roomTypes, active } = req.body;
  try {
    let finalRoomTypes = roomTypes;
    if (!finalRoomTypes || finalRoomTypes.length === 0) {
      finalRoomTypes = [
        { id: `${id}_rt1`, name: 'Twin', cleanMinutes: 35, price: 10000, defaultGuestCount: 2 },
        { id: `${id}_rt2`, name: 'Single', cleanMinutes: 25, price: 5000, defaultGuestCount: 1 },
        { id: `${id}_rt3`, name: 'Double', cleanMinutes: 30, price: 8000, defaultGuestCount: 2 },
        { id: `${id}_rt4`, name: 'Suite', cleanMinutes: 60, price: 25000, defaultGuestCount: 4 }
      ];
    }
    await query(
      'INSERT INTO hotels (id, name, description, default_clean_minutes, room_types, active) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, name, description, defaultCleanMinutes || 35, JSON.stringify(finalRoomTypes), active !== false]
    );
    res.json({ id, name, description, defaultCleanMinutes, roomTypes: finalRoomTypes, active: active !== false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/hotels/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, defaultCleanMinutes, roomTypes, active } = req.body;
  try {
    await query(
      'UPDATE hotels SET name = $1, description = $2, default_clean_minutes = $3, room_types = $4, active = $5 WHERE id = $6',
      [name, description, defaultCleanMinutes || 35, JSON.stringify(roomTypes || []), active !== false, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/hotels/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM hotels WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  const { hotelId } = req.query;
  try {
    let result;
    if (hotelId) {
      result = await query(`
        SELECT u.*, COALESCE(array_agg(uh.hotel_id) FILTER (WHERE uh.hotel_id IS NOT NULL), '{}') as hotel_ids
        FROM users u
        INNER JOIN user_hotels uh ON u.id = uh.user_id
        WHERE uh.hotel_id = $1
        GROUP BY u.id
        ORDER BY u.name ASC
      `, [hotelId]);
    } else {
      result = await query(`
        SELECT u.*, COALESCE(array_agg(uh.hotel_id) FILTER (WHERE uh.hotel_id IS NOT NULL), '{}') as hotel_ids
        FROM users u
        LEFT JOIN user_hotels uh ON u.id = uh.user_id
        GROUP BY u.id
        ORDER BY u.name ASC
      `);
    }
    res.json(result.rows.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      pin: u.pin,
      name: u.name,
      language: u.language,
      hotelIds: u.hotel_ids,
      status: u.status,
      passwordHash: u.password_hash,
      employeeCode: u.employee_code
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/global', async (req, res) => {
  try {
    const result = await query(`
      SELECT u.*, COALESCE(array_agg(uh.hotel_id) FILTER (WHERE uh.hotel_id IS NOT NULL), '{}') as hotel_ids
      FROM users u
      LEFT JOIN user_hotels uh ON u.id = uh.user_id
      GROUP BY u.id
      ORDER BY u.name ASC
    `);
    res.json(result.rows.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      pin: u.pin,
      name: u.name,
      language: u.language,
      hotelIds: u.hotel_ids,
      status: u.status,
      passwordHash: u.password_hash,
      employeeCode: u.employee_code
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, role, pin, name, language, hotelIds, status, passwordHash, employeeCode } = req.body;
  const id = `u_${Date.now()}`;
  try {
    await query(
      'INSERT INTO users (id, username, role, pin, name, language, status, password_hash, employee_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, username, role, pin, name, language || 'vi', status || 'working', passwordHash || null, employeeCode || null]
    );
    if (hotelIds && hotelIds.length > 0) {
      for (const hId of hotelIds) {
        await query('INSERT INTO user_hotels (user_id, hotel_id) VALUES ($1, $2)', [id, hId]);
      }
    }
    res.json({ id, username, role, pin, name, language, hotelIds, status, passwordHash, employeeCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, role, pin, name, language, hotelIds, status, passwordHash, employeeCode } = req.body;
  try {
    // If it's the admin user, enforce status and hotel list to prevent lockout
    let finalStatus = status || 'working';
    let finalHotelIds = hotelIds || [];
    let finalUsername = username;
    let finalRole = role;
    if (username?.trim().toLowerCase() === 'admin') {
      finalStatus = 'working';
      finalUsername = 'admin';
      finalRole = 'admin';
    }

    await query(
      'UPDATE users SET username = $1, role = $2, pin = $3, name = $4, language = $5, status = $6, password_hash = COALESCE($7, password_hash), employee_code = $8 WHERE id = $9',
      [finalUsername, finalRole, pin, name, language || 'vi', finalStatus, passwordHash || null, employeeCode || null, id]
    );

    // Update user_hotels associations
    await query('DELETE FROM user_hotels WHERE user_id = $1', [id]);
    if (finalHotelIds && finalHotelIds.length > 0) {
      for (const hId of finalHotelIds) {
        await query('INSERT INTO user_hotels (user_id, hotel_id) VALUES ($1, $2)', [id, hId]);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Rooms
app.get('/api/rooms', async (req, res) => {
  const { hotelId, date } = req.query;
  if (!hotelId || !date) {
    return res.status(400).json({ error: 'hotelId and date are required' });
  }
  if (hotelId === 'portal' || hotelId === 'admin') {
    return res.json([]);
  }
  try {
    const rooms = await getOrSeedDailyRooms(hotelId, date);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rooms/status', async (req, res) => {
  const { hotelId, date, roomId, status, updatedBy, assignedTo, cleanerName } = req.body;
  const rId = `${hotelId}_${roomId}_${date}`;
  try {
    // Check lock
    const lockRes = await query('SELECT locked FROM day_locks WHERE hotel_id = $1 AND date = $2', [hotelId, date]);
    if (lockRes.rows[0]?.locked) {
      return res.status(400).json({ error: 'DATE_LOCKED' });
    }

    await query(
      `UPDATE daily_rooms SET 
       status = $1, updated_by = $2, assigned_to = $3, cleaner_name = $4, updated_at = NOW() 
       WHERE id = $5`,
      [status, updatedBy, assignedTo || null, cleanerName || null, rId]
    );

    // Retrieve updated room details
    const rRes = await query('SELECT * FROM daily_rooms WHERE id = $1', [rId]);
    if (rRes.rows[0]) {
      const roomClient = mapRoomDbToClient(rRes.rows[0]);
      // Broadcast update
      io.to(`${hotelId}_${date}`).emit('room_updated', roomClient);
      res.json(roomClient);
    } else {
      res.status(404).json({ error: 'Room not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  const { hotelId, date, roomNumber, floor, type, status, isStay, guestCount, notes, updatedBy } = req.body;
  const rId = `${hotelId}_${roomNumber}_${date}`;
  try {
    await query(
      `INSERT INTO daily_rooms 
       (id, hotel_id, date, room_number, floor, type, status, is_stay, guest_count, notes, updated_by, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [rId, hotelId, date, roomNumber, floor, type, status || 'vacant', isStay || false, guestCount || 0, notes || '', updatedBy]
    );

    const rRes = await query('SELECT * FROM daily_rooms WHERE id = $1', [rId]);
    const roomClient = mapRoomDbToClient(rRes.rows[0]);
    io.to(`${hotelId}_${date}`).emit('room_updated', roomClient);
    res.json(roomClient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rooms', async (req, res) => {
  const { hotelId, date, roomNumber, status, isStay, guestCount, notes, assignedTo, cleanerName, isChecked, checkedBy, checkedAt, priority, photoDefect, checkerNotes, viewedCleanerNotes, updatedBy } = req.body;
  const rId = `${hotelId}_${roomNumber}_${date}`;
  try {
    // Check lock
    const lockRes = await query('SELECT locked FROM day_locks WHERE hotel_id = $1 AND date = $2', [hotelId, date]);
    if (lockRes.rows[0]?.locked) {
      return res.status(400).json({ error: 'DATE_LOCKED' });
    }

    await query(
      `UPDATE daily_rooms SET 
       status = $1, is_stay = $2, guest_count = $3, notes = $4, assigned_to = $5, cleaner_name = $6, 
       is_checked = $7, checked_by = $8, checked_at = $9, priority = $10, photo_defect = $11, 
       checker_notes = $12, viewed_cleaner_notes = $13, updated_by = $14, updated_at = NOW() 
       WHERE id = $15`,
      [
        status, isStay, guestCount, notes || '', assignedTo || null, cleanerName || null,
        isChecked !== undefined ? isChecked : null, checkedBy || null, checkedAt || null, priority || 'normal',
        photoDefect || null, checkerNotes || null, viewedCleanerNotes || false, updatedBy, rId
      ]
    );

    const rRes = await query('SELECT * FROM daily_rooms WHERE id = $1', [rId]);
    if (rRes.rows[0]) {
      const roomClient = mapRoomDbToClient(rRes.rows[0]);
      io.to(`${hotelId}_${date}`).emit('room_updated', roomClient);
      res.json(roomClient);
    } else {
      res.status(404).json({ error: 'Room not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/rooms', async (req, res) => {
  const { hotelId, date, roomNumber } = req.body;
  const rId = `${hotelId}_${roomNumber}_${date}`;
  try {
    await query('DELETE FROM daily_rooms WHERE id = $1', [rId]);
    io.to(`${hotelId}_${date}`).emit('room_deleted', roomNumber);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Cleaning Logs
app.get('/api/logs', async (req, res) => {
  const { hotelId } = req.query;
  if (hotelId === 'portal' || hotelId === 'admin') {
    return res.json([]);
  }
  try {
    const result = await query(
      'SELECT * FROM cleaning_logs WHERE hotel_id = $1 ORDER BY ended_at DESC',
      [hotelId]
    );
    res.json(result.rows.map(mapLogDbToClient));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logs', async (req, res) => {
  const { hotelId, date, roomId, roomNumber, floor, cleanerId, cleanerName, startedAt, endedAt, durationMinutes, photoBefore, photoAfter, notes, errors, checkedBy, checkedAt } = req.body;
  const id = `log_${Date.now()}`;
  try {
    // Check lock
    const lockRes = await query('SELECT locked FROM day_locks WHERE hotel_id = $1 AND date = $2', [hotelId, date]);
    if (lockRes.rows[0]?.locked) {
      return res.status(400).json({ error: 'DATE_LOCKED' });
    }

    await query(
      `INSERT INTO cleaning_logs 
       (id, hotel_id, date, room_id, room_number, floor, cleaner_id, cleaner_name, started_at, ended_at, duration_minutes, photo_before, photo_after, notes, errors, checked_by, checked_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        id, hotelId, date, roomId, roomNumber, floor, cleanerId, cleanerName, startedAt, endedAt, durationMinutes,
        photoBefore || '', photoAfter || '', notes || '', errors || [], checkedBy || null, checkedAt || null
      ]
    );

    const lRes = await query('SELECT * FROM cleaning_logs WHERE id = $1', [id]);
    const logClient = mapLogDbToClient(lRes.rows[0]);
    io.to(`${hotelId}_logs`).emit('log_updated', logClient);
    res.json(logClient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/logs/:id', async (req, res) => {
  const { id } = req.params;
  const { hotelId, date, checkedBy, checkedAt, errors, notes, checkerNotes, viewedCleanerNotes } = req.body;
  try {
    // Check lock
    const lockRes = await query('SELECT locked FROM day_locks WHERE hotel_id = $1 AND date = $2', [hotelId, date]);
    if (lockRes.rows[0]?.locked) {
      return res.status(400).json({ error: 'DATE_LOCKED' });
    }

    await query(
      `UPDATE cleaning_logs SET 
       checked_by = $1, checked_at = $2, errors = $3, notes = $4, checker_notes = $5, viewed_cleaner_notes = $6 
       WHERE id = $7`,
      [checkedBy, checkedAt, errors || [], notes || '', checkerNotes || null, viewedCleanerNotes || false, id]
    );

    const lRes = await query('SELECT * FROM cleaning_logs WHERE id = $1', [id]);
    if (lRes.rows[0]) {
      const logClient = mapLogDbToClient(lRes.rows[0]);
      io.to(`${hotelId}_logs`).emit('log_updated', logClient);
      res.json(logClient);
    } else {
      res.status(404).json({ error: 'Log not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Active Staff
app.get('/api/staff/:date', async (req, res) => {
  const { date } = req.params;
  const { hotelId } = req.query;
  if (hotelId === 'portal' || hotelId === 'admin') {
    return res.json([]);
  }
  try {
    const result = await query(
      'SELECT user_ids FROM active_staff WHERE hotel_id = $1 AND date = $2',
      [hotelId, date]
    );
    res.json(result.rows[0]?.user_ids || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff/:date', async (req, res) => {
  const { date } = req.params;
  const { hotelId, userIds } = req.body;
  try {
    // Check lock
    const lockRes = await query('SELECT locked FROM day_locks WHERE hotel_id = $1 AND date = $2', [hotelId, date]);
    if (lockRes.rows[0]?.locked) {
      return res.status(400).json({ error: 'DATE_LOCKED' });
    }

    await query(
      `INSERT INTO active_staff (hotel_id, date, user_ids) VALUES ($1, $2, $3) 
       ON CONFLICT (hotel_id, date) DO UPDATE SET user_ids = $3`,
      [hotelId, date, userIds]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Day Locks
app.get('/api/locks/:date', async (req, res) => {
  const { date } = req.params;
  const { hotelId } = req.query;
  if (hotelId === 'portal' || hotelId === 'admin') {
    return res.json(false);
  }
  try {
    const result = await query(
      'SELECT locked FROM day_locks WHERE hotel_id = $1 AND date = $2',
      [hotelId, date]
    );
    res.json(result.rows[0]?.locked || false);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/locks/:date', async (req, res) => {
  const { date } = req.params;
  const { hotelId, locked } = req.body;
  try {
    await query(
      `INSERT INTO day_locks (hotel_id, date, locked) VALUES ($1, $2, $3) 
       ON CONFLICT (hotel_id, date) DO UPDATE SET locked = $3`,
      [hotelId, date, locked]
    );
    
    // Notify clients that rooms updated (lock triggers refetch)
    io.to(`${hotelId}_${date}`).emit('lock_changed', { date, locked });

    res.json({ success: true, locked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Finalized Day Reports
app.get('/api/reports', async (req, res) => {
  const { hotelId } = req.query;
  if (hotelId === 'portal' || hotelId === 'admin') {
    return res.json([]);
  }
  try {
    const result = await query(
      'SELECT * FROM finalized_day_reports WHERE hotel_id = $1 ORDER BY date DESC',
      [hotelId]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      hotelId: r.hotel_id,
      hotelName: r.hotel_name,
      date: r.date,
      totalRooms: r.total_rooms,
      totalCleaned: r.total_cleaned,
      staffReport: r.staff_report,
      finalizedAt: r.finalized_at.toISOString(),
      finalizedBy: r.finalized_by
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reports', async (req, res) => {
  const { id, hotelId, hotelName, date, totalRooms, totalCleaned, staffReport, finalizedBy } = req.body;
  try {
    await query(
      `INSERT INTO finalized_day_reports 
       (id, hotel_id, hotel_name, date, total_rooms, total_cleaned, staff_report, finalized_by, finalized_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
       ON CONFLICT (id) DO UPDATE SET total_rooms = $5, total_cleaned = $6, staff_report = $7, finalized_by = $8, finalized_at = NOW()`,
      [id, hotelId, hotelName, date, totalRooms, totalCleaned, JSON.stringify(staffReport), finalizedBy]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reports/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM finalized_day_reports WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/backup', async (req, res) => {
  try {
    const hotels = await query('SELECT * FROM hotels');
    const users = await query('SELECT * FROM users');
    const dailyRooms = await query('SELECT * FROM daily_rooms');
    const cleaningLogs = await query('SELECT * FROM cleaning_logs');
    const activeStaff = await query('SELECT * FROM active_staff');
    const dayLocks = await query('SELECT * FROM day_locks');
    const finalizedDayReports = await query('SELECT * FROM finalized_day_reports');
    
    res.json({
      hotels: hotels.rows,
      users: users.rows,
      dailyRooms: dailyRooms.rows,
      cleaningLogs: cleaningLogs.rows,
      activeStaff: activeStaff.rows,
      dayLocks: dayLocks.rows,
      finalizedDayReports: finalizedDayReports.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/restore', async (req, res) => {
  const { hotels, users, dailyRooms, cleaningLogs, activeStaff, dayLocks, finalizedDayReports } = req.body;
  try {
    // Truncate all tables
    await query('TRUNCATE TABLE hotels, users, daily_rooms, cleaning_logs, active_staff, day_locks, finalized_day_reports CASCADE');
    
    // Restore Hotels
    if (hotels && hotels.length > 0) {
      for (const h of hotels) {
        await query(
          'INSERT INTO hotels (id, name, description, rooms_list, default_clean_minutes, room_types) VALUES ($1, $2, $3, $4, $5, $6)',
          [h.id, h.name, h.description, h.rooms_list, h.default_clean_minutes, JSON.stringify(h.room_types)]
        );
      }
    }
    
    // Restore Users
    if (users && users.length > 0) {
      for (const u of users) {
        await query(
          'INSERT INTO users (id, username, role, pin, name, language, hotel_ids, status, password_hash, employee_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [u.id, u.username, u.role, u.pin, u.name, u.language, u.hotel_ids, u.status, u.password_hash, u.employee_code]
        );
      }
    }
    
    // Restore Daily Rooms
    if (dailyRooms && dailyRooms.length > 0) {
      for (const r of dailyRooms) {
        await query(
          `INSERT INTO daily_rooms 
           (id, hotel_id, date, room_number, floor, type, status, is_stay, guest_count, notes, assigned_to, cleaner_name, is_checked, checked_by, checked_at, priority, photo_defect, updated_at, updated_by) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            r.id, r.hotel_id, r.date, r.room_number, r.floor, r.type, r.status, r.is_stay, r.guest_count, r.notes, 
            r.assigned_to, r.cleaner_name, r.is_checked, r.checked_by, r.checked_at, r.priority, r.photo_defect, r.updated_at, r.updated_by
          ]
        );
      }
    }
    
    // Restore Cleaning Logs
    if (cleaningLogs && cleaningLogs.length > 0) {
      for (const l of cleaningLogs) {
        await query(
          `INSERT INTO cleaning_logs 
           (id, hotel_id, date, room_id, room_number, floor, cleaner_id, cleaner_name, started_at, ended_at, duration_minutes, photo_before, photo_after, notes, errors, checked_by, checked_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            l.id, l.hotel_id, l.date, l.room_id, l.room_number, l.floor, l.cleaner_id, l.cleaner_name, l.started_at, l.ended_at, 
            l.duration_minutes, l.photo_before, l.photo_after, l.notes, l.errors, l.checked_by, l.checked_at
          ]
        );
      }
    }
    
    // Restore Active Staff
    if (activeStaff && activeStaff.length > 0) {
      for (const s of activeStaff) {
        await query(
          'INSERT INTO active_staff (hotel_id, date, user_ids) VALUES ($1, $2, $3)',
          [s.hotel_id, s.date, s.user_ids]
        );
      }
    }
    
    // Restore Day Locks
    if (dayLocks && dayLocks.length > 0) {
      for (const d of dayLocks) {
        await query(
          'INSERT INTO day_locks (hotel_id, date, locked) VALUES ($1, $2, $3)',
          [d.hotel_id, d.date, d.locked]
        );
      }
    }
    
    // Restore Finalized Day Reports
    if (finalizedDayReports && finalizedDayReports.length > 0) {
      for (const rp of finalizedDayReports) {
        await query(
          'INSERT INTO finalized_day_reports (id, hotel_id, hotel_name, date, total_rooms, total_cleaned, staff_report, finalized_at, finalized_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [rp.id, rp.hotel_id, rp.hotel_name, rp.date, rp.total_rooms, rp.total_cleaned, JSON.stringify(rp.staff_report), rp.finalized_at, rp.finalized_by]
        );
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Init database tables & run server
const PORT = process.env.PORT || 4000;
server.listen(PORT, async () => {
  console.log(`Backend server running on port ${PORT}`);
  await initDatabase();
});
