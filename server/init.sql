-- Drop tables if exist
DROP TABLE IF EXISTS finalized_day_reports CASCADE;
DROP TABLE IF EXISTS day_locks CASCADE;
DROP TABLE IF EXISTS active_staff CASCADE;
DROP TABLE IF EXISTS cleaning_logs CASCADE;
DROP TABLE IF EXISTS daily_rooms CASCADE;
DROP TABLE IF EXISTS user_hotels CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS hotels CASCADE;

-- 1. Hotels Table
CREATE TABLE hotels (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    rooms_list TEXT,
    default_clean_minutes INT DEFAULT 35,
    room_types JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT TRUE
);

-- 2. Users Table
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'front_desk', 'housekeeping', 'checka', 'kacho')),
    pin VARCHAR(10),
    name VARCHAR(100) NOT NULL,
    language VARCHAR(10) DEFAULT 'vi',
    status VARCHAR(20) DEFAULT 'working' CHECK (status IN ('working', 'quit')),
    password_hash VARCHAR(255),
    employee_code VARCHAR(50) UNIQUE
);

-- 2.5 User Hotels Junction Table
CREATE TABLE user_hotels (
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    hotel_id VARCHAR(50) REFERENCES hotels(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, hotel_id)
);

-- 3. Daily Rooms Table
CREATE TABLE daily_rooms (
    id VARCHAR(100) PRIMARY KEY, -- {hotel_id}_{room_number}_{date}
    hotel_id VARCHAR(50) REFERENCES hotels(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL, -- YYYY-MM-DD
    room_number VARCHAR(10) NOT NULL,
    floor INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('vacant', 'occupied', 'dirty', 'cleaning', 'clean', 'maintenance', 'eco', 'dnd')),
    is_stay BOOLEAN DEFAULT FALSE,
    guest_count INT DEFAULT 0,
    notes TEXT,
    assigned_to VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    cleaner_name VARCHAR(100),
    is_checked BOOLEAN,
    checked_by VARCHAR(100),
    checked_at TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(20) DEFAULT 'normal',
    photo_defect TEXT,
    checker_notes TEXT,
    viewed_cleaner_notes BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100) NOT NULL,
    CONSTRAINT unique_hotel_date_room UNIQUE(hotel_id, date, room_number)
);

-- 4. Cleaning Logs Table
CREATE TABLE cleaning_logs (
    id VARCHAR(50) PRIMARY KEY,
    hotel_id VARCHAR(50) REFERENCES hotels(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL, -- YYYY-MM-DD
    room_id VARCHAR(10) NOT NULL,
    room_number VARCHAR(10) NOT NULL,
    floor INT NOT NULL,
    cleaner_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    cleaner_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INT NOT NULL,
    photo_before TEXT,
    photo_after TEXT,
    notes TEXT,
    errors TEXT[] DEFAULT '{}'::text[],
    checked_by VARCHAR(100),
    checked_at TIMESTAMP WITH TIME ZONE,
    checker_notes TEXT,
    viewed_cleaner_notes BOOLEAN DEFAULT FALSE
);

-- 5. Active Staff Table
CREATE TABLE active_staff (
    hotel_id VARCHAR(50) REFERENCES hotels(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL,
    user_ids TEXT[] DEFAULT '{}'::text[],
    PRIMARY KEY (hotel_id, date)
);

-- 6. Day Locks Table
CREATE TABLE day_locks (
    hotel_id VARCHAR(50) REFERENCES hotels(id) ON DELETE CASCADE,
    date VARCHAR(10) NOT NULL,
    locked BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (hotel_id, date)
);

-- 7. Finalized Day Reports Table
CREATE TABLE finalized_day_reports (
    id VARCHAR(100) PRIMARY KEY, -- {hotel_id}_{date}
    hotel_id VARCHAR(50) REFERENCES hotels(id) ON DELETE CASCADE,
    hotel_name VARCHAR(100) NOT NULL,
    date VARCHAR(10) NOT NULL,
    total_rooms INT NOT NULL,
    total_cleaned INT NOT NULL,
    staff_report JSONB NOT NULL,
    finalized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    finalized_by VARCHAR(100) NOT NULL
);

-- Seed Users
INSERT INTO users (id, username, role, pin, name, language, status, password_hash, employee_code) VALUES
('u1', 'admin', 'admin', NULL, 'NKTN Manager', 'vi', 'working', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'ADMIN001')
ON CONFLICT (id) DO NOTHING;


