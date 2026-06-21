export interface User {
  id: string;
  username: string;
  role: 'admin' | 'front_desk' | 'housekeeping' | 'checka' | 'kacho';
  pin?: string;
  name: string;
  language: 'ja' | 'vi' | 'en';
  hotelIds?: string[];
  status?: 'working' | 'quit';
}

export interface Room {
  id: string; // Room number like "101"
  roomNumber: string;
  floor: number;
  type: string; // e.g. "SSn", "TWn", "JAPn", "STW"
  status: 'vacant' | 'occupied' | 'dirty' | 'cleaning' | 'clean' | 'maintenance' | 'eco' | 'dnd';
  isStay: boolean; // true = Stay room (displays [S] tag), false = Out/Checkout room
  guestCount: number; // ※予定人数 (Expected number of guests to set)
  notes?: string; // Ghi chú đặc biệt
  assignedTo?: string; // Cleaner ID
  cleanerName?: string; // Cleaner Display Name
  isChecked?: boolean;
  checkedBy?: string;
  checkedAt?: string;
  priority?: 'normal' | 'rush';
  photoDefect?: string;
  updatedAt: string; // ISO String
  updatedBy: string; // User Name or User ID
}

export interface CleaningLog {
  id: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  cleanerId: string;
  cleanerName: string;
  startedAt: string; // ISO String
  endedAt: string; // ISO String
  durationMinutes: number;
  photoBefore?: string; // base64 or placeholder
  photoAfter?: string; // base64 or placeholder
  notes?: string;
  errors?: string[];
  checkedBy?: string;
  checkedAt?: string;
}

export interface RoomTypeConfig {
  id: string;
  name: string;
  cleanMinutes: number;
}

export interface Hotel {
  id: string; // e.g. "ks1", "ks2"
  name: string; // e.g. "Sakura Hotel"
  description?: string;
  roomsList?: string; // Comma-separated room numbers entered during creation
  defaultCleanMinutes?: number; // default average cleaning time per room
  roomTypes?: RoomTypeConfig[]; // custom room types with target cleaning minutes
}

export type RoomSubscriptionCallback = (rooms: Room[]) => void;
export type LogSubscriptionCallback = (logs: CleaningLog[]) => void;

export interface DBInterface {
  // Date management
  setDate(date: string): void;
  getDate(): string;

  // Hotels
  getHotels(): Promise<Hotel[]>;
  createHotel(hotel: Hotel): Promise<Hotel>;
  deleteHotel(hotelId: string): Promise<void>;
  updateHotel(hotel: Hotel): Promise<void>;

  // Auth
  getUsers(): Promise<User[]>;
  getAllGlobalUsers(): Promise<User[]>;
  createUser(user: Omit<User, 'id'>): Promise<User>;
  updateUser(user: User): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  deleteUserCompletely(userId: string): Promise<void>;

  // Rooms
  getRooms(): Promise<Room[]>;
  updateRoomStatus(
    roomId: string, 
    status: Room['status'], 
    updatedBy: string, 
    assignedTo?: string, 
    cleanerName?: string
  ): Promise<void>;
  createRoom(room: Omit<Room, 'updatedAt' | 'updatedBy'>): Promise<Room>;
  updateRoom(room: Room): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  subscribeRooms(callback: RoomSubscriptionCallback): () => void;

  // Logs
  getLogs(): Promise<CleaningLog[]>;
  createLog(log: Omit<CleaningLog, 'id'>): Promise<CleaningLog>;
  updateLog(log: CleaningLog): Promise<void>;
  subscribeLogs(callback: LogSubscriptionCallback): () => void;

  // Staff assignments
  getActiveStaff(date: string): Promise<string[]>;
  setActiveStaff(date: string, userIds: string[]): Promise<void>;
}
