import type { DBInterface, User, Room, CleaningLog, RoomSubscriptionCallback, LogSubscriptionCallback, Hotel } from './dbInterface';
import { getLocalDB } from './localDB';

export let isFirebaseConfigured = false;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.authDomain
) {
  isFirebaseConfigured = true;
}



// Function to resolve current hotelId from URL path dynamically
export function getActiveHotelId(): string {
  if (typeof window === 'undefined') return 'portal';
  // Example path: "/ks1" or "/ks2" -> resolves to "ks1" or "ks2"
  const segments = window.location.pathname.split('/').filter(Boolean);
  const hotelId = segments[0] || 'portal';
  return hotelId;
}

// Proxy database provider that routes all queries to the correct hotel partition automatically
class DatabaseProxy implements DBInterface {
  
  // Date management
  setDate(date: string): void {
    this.activeDB.setDate(date);
  }

  getDate(): string {
    return this.activeDB.getDate();
  }
  
  // Resolve current active DB instance
  private get activeDB(): DBInterface {
    const hotelId = getActiveHotelId();
    // In live Firebase mode, you would return a FirebaseDB instance configured with hotelId.
    // For now we resolve the partition in LocalDB.
    return getLocalDB(hotelId);
  }

  // Hotels CRUD
  async getHotels(): Promise<Hotel[]> {
    return this.activeDB.getHotels();
  }

  async createHotel(hotel: Hotel): Promise<Hotel> {
    return this.activeDB.createHotel(hotel);
  }

  async deleteHotel(hotelId: string): Promise<void> {
    return this.activeDB.deleteHotel(hotelId);
  }

  async updateHotel(hotel: Hotel): Promise<void> {
    return this.activeDB.updateHotel(hotel);
  }

  // Users Auth / CRUD
  async getUsers(): Promise<User[]> {
    return this.activeDB.getUsers();
  }

  async getAllGlobalUsers(): Promise<User[]> {
    return this.activeDB.getAllGlobalUsers();
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    return this.activeDB.createUser(user);
  }

  async updateUser(user: User): Promise<void> {
    return this.activeDB.updateUser(user);
  }

  async deleteUser(userId: string): Promise<void> {
    return this.activeDB.deleteUser(userId);
  }

  async deleteUserCompletely(userId: string): Promise<void> {
    return this.activeDB.deleteUserCompletely(userId);
  }

  // Rooms CRUD
  async getRooms(): Promise<Room[]> {
    return this.activeDB.getRooms();
  }

  async updateRoomStatus(
    roomId: string,
    status: Room['status'],
    updatedBy: string,
    assignedTo?: string,
    cleanerName?: string
  ): Promise<void> {
    return this.activeDB.updateRoomStatus(roomId, status, updatedBy, assignedTo, cleanerName);
  }

  async createRoom(room: Omit<Room, 'updatedAt' | 'updatedBy'>): Promise<Room> {
    return this.activeDB.createRoom(room);
  }

  async updateRoom(room: Room): Promise<void> {
    return this.activeDB.updateRoom(room);
  }

  async deleteRoom(roomId: string): Promise<void> {
    return this.activeDB.deleteRoom(roomId);
  }

  subscribeRooms(callback: RoomSubscriptionCallback): () => void {
    return this.activeDB.subscribeRooms(callback);
  }

  // Logs CRUD
  async getLogs(): Promise<CleaningLog[]> {
    return this.activeDB.getLogs();
  }

  async createLog(log: Omit<CleaningLog, 'id'>): Promise<CleaningLog> {
    return this.activeDB.createLog(log);
  }

  async updateLog(log: CleaningLog): Promise<void> {
    return this.activeDB.updateLog(log);
  }

  subscribeLogs(callback: LogSubscriptionCallback): () => void {
    return this.activeDB.subscribeLogs(callback);
  }

  async getActiveStaff(date: string): Promise<string[]> {
    return this.activeDB.getActiveStaff(date);
  }

  async setActiveStaff(date: string, userIds: string[]): Promise<void> {
    return this.activeDB.setActiveStaff(date, userIds);
  }
}

// Export a proxy DB singleton
export const db: DBInterface = new DatabaseProxy();

export default db;
