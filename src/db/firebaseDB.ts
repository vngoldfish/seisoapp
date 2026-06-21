import type { DBInterface, User, Room, CleaningLog, RoomSubscriptionCallback, LogSubscriptionCallback, Hotel } from './dbInterface';
import { 
  getLocalDB, 
  getTodayDateString, 
  generateUUID, 
  DEFAULT_HOTELS, 
  USERS_KS1, 
  USERS_KS2, 
  LOGS_KS1, 
  LOGS_KS2, 
  generateRoomsKS1, 
  generateRoomsKS2 
} from './localDB';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy
} from 'firebase/firestore';

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

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
const firestore = app ? getFirestore(app) : null;

// Function to resolve current hotelId from URL path dynamically
export function getActiveHotelId(): string {
  if (typeof window === 'undefined') return 'portal';
  // Example path: "/ks1" or "/ks2" -> resolves to "ks1" or "ks2"
  const segments = window.location.pathname.split('/').filter(Boolean);
  const hotelId = segments[0] || 'portal';
  return hotelId;
}

// Live Firebase DB Implementation
class FirebaseDB implements DBInterface {
  private hotelId: string;
  private currentDate: string;

  constructor(hotelId: string) {
    this.hotelId = hotelId;
    this.currentDate = getTodayDateString();
  }

  setDate(date: string): void {
    this.currentDate = date;
  }

  getDate(): string {
    return this.currentDate;
  }

  // Hotels CRUD
  async getHotels(): Promise<Hotel[]> {
    if (!firestore) return [];
    try {
      const snap = await getDocs(collection(firestore, 'hotels'));
      if (snap.empty) {
        // Seed default hotels
        for (const h of DEFAULT_HOTELS) {
          await setDoc(doc(firestore, 'hotels', h.id), h);
        }
        return DEFAULT_HOTELS;
      }
      return snap.docs.map(doc => doc.data() as Hotel);
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async createHotel(hotel: Hotel): Promise<Hotel> {
    if (!firestore) throw new Error('Firebase not configured');
    await setDoc(doc(firestore, 'hotels', hotel.id), hotel);
    return hotel;
  }

  async deleteHotel(hotelId: string): Promise<void> {
    if (!firestore) throw new Error('Firebase not configured');
    await deleteDoc(doc(firestore, 'hotels', hotelId));
  }

  async updateHotel(hotel: Hotel): Promise<void> {
    if (!firestore) throw new Error('Firebase not configured');
    await setDoc(doc(firestore, 'hotels', hotel.id), hotel, { merge: true });
  }

  // Users Auth / CRUD
  async getUsers(): Promise<User[]> {
    const globalUsers = await this.getAllGlobalUsers();
    // Filter users belonging to this hotel
    return globalUsers.filter(u => u.hotelIds?.includes(this.hotelId) && u.status !== 'quit');
  }

  async getAllGlobalUsers(): Promise<User[]> {
    if (!firestore) return [];
    try {
      const snap = await getDocs(collection(firestore, 'users'));
      if (snap.empty) {
        // Seed initial users from Sakura / Fuji
        const initialUsers = [...USERS_KS1, ...USERS_KS2];
        for (const u of initialUsers) {
          // Add default hotelIds
          const userWithHotels = {
            ...u,
            hotelIds: u.id.startsWith('u20') ? ['ks2'] : ['ks1'],
            status: 'working'
          };
          await setDoc(doc(firestore, 'users', u.id), userWithHotels);
        }
        return initialUsers.map(u => ({
          ...u,
          hotelIds: u.id.startsWith('u20') ? ['ks2'] : ['ks1'],
          status: 'working'
        } as User));
      }
      return snap.docs.map(doc => doc.data() as User);
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    if (!firestore) throw new Error('Firebase not configured');
    const newId = generateUUID('u');
    const newUser: User = { ...user, id: newId };
    await setDoc(doc(firestore, 'users', newId), newUser);
    return newUser;
  }

  async updateUser(user: User): Promise<void> {
    if (!firestore) throw new Error('Firebase not configured');
    await setDoc(doc(firestore, 'users', user.id), user, { merge: true });
  }

  async deleteUser(userId: string): Promise<void> {
    if (!firestore) throw new Error('Firebase not configured');
    // Dissociate or delete
    const allUsers = await this.getAllGlobalUsers();
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      if (user.username?.trim().toLowerCase() === 'admin') {
        throw new Error('Cannot delete or dissociate the main admin user.');
      }
      user.hotelIds = user.hotelIds?.filter(hId => hId !== this.hotelId) || [];
      if (user.hotelIds.length === 0) {
        await deleteDoc(doc(firestore, 'users', userId));
      } else {
        await setDoc(doc(firestore, 'users', userId), user);
      }
    }
  }

  async deleteUserCompletely(userId: string): Promise<void> {
    if (!firestore) throw new Error('Firebase not configured');
    const allUsers = await this.getAllGlobalUsers();
    const user = allUsers.find(u => u.id === userId);
    if (user && user.username?.trim().toLowerCase() === 'admin') {
      throw new Error('Cannot delete the main admin user.');
    }
    await deleteDoc(doc(firestore, 'users', userId));
  }

  // Rooms CRUD
  async getRooms(): Promise<Room[]> {
    if (!firestore) return [];
    try {
      // 1. Check if rooms collection for current date is empty
      const roomsPath = `hotels/${this.hotelId}/dates/${this.currentDate}/rooms`;
      const snap = await getDocs(collection(firestore, roomsPath));
      if (snap.empty) {
        // Seed from master template or generate new rooms
        const masterPath = `hotels/${this.hotelId}/rooms`;
        let masterSnap = await getDocs(collection(firestore, masterPath));
        if (masterSnap.empty) {
          // Create master rooms
          const defaultRooms = this.hotelId === 'ks2' ? generateRoomsKS2() : generateRoomsKS1();
          for (const room of defaultRooms) {
            await setDoc(doc(firestore, masterPath, room.id), room);
          }
          masterSnap = await getDocs(collection(firestore, masterPath));
        }
        
        // Copy master rooms to date rooms
        const roomsToSeed: Room[] = [];
        for (const docObj of masterSnap.docs) {
          const roomData = docObj.data() as Room;
          const seededRoom: Room = {
            ...roomData,
            updatedAt: new Date().toISOString(),
            updatedBy: 'system'
          };
          await setDoc(doc(firestore, roomsPath, roomData.id), seededRoom);
          roomsToSeed.push(seededRoom);
        }
        return roomsToSeed;
      }
      return snap.docs.map(doc => doc.data() as Room);
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async updateRoomStatus(
    roomId: string,
    status: Room['status'],
    updatedBy: string,
    assignedTo?: string,
    cleanerName?: string
  ): Promise<void> {
    if (!firestore) return;
    const roomsPath = `hotels/${this.hotelId}/dates/${this.currentDate}/rooms`;
    const roomDocRef = doc(firestore, roomsPath, roomId);
    const roomSnap = await getDoc(roomDocRef);
    if (!roomSnap.exists()) return;
    const room = roomSnap.data() as Room;

    let extraFields: Partial<Room> = {};
    if (status === 'clean') {
      extraFields = {
        isChecked: false,
        checkedBy: undefined,
        checkedAt: undefined,
        photoDefect: undefined
      };
    } else {
      extraFields = {
        isChecked: undefined,
        checkedBy: undefined,
        checkedAt: undefined
      };
    }

    const isStatusClearingCleaner = status === 'dirty' || status === 'vacant' || status === 'dnd' || status === 'maintenance' || status === 'occupied';
    const finalAssignedTo = isStatusClearingCleaner ? '' : (assignedTo !== undefined ? assignedTo : room.assignedTo);
    const finalCleanerName = isStatusClearingCleaner ? '' : (cleanerName !== undefined ? cleanerName : room.cleanerName);

    await updateDoc(roomDocRef, {
      status,
      assignedTo: finalAssignedTo,
      cleanerName: finalCleanerName,
      ...extraFields,
      updatedAt: new Date().toISOString(),
      updatedBy
    });
  }

  async createRoom(room: Omit<Room, 'updatedAt' | 'updatedBy'>): Promise<Room> {
    if (!firestore) throw new Error('Firebase not configured');
    const newRoom: Room = {
      ...room,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin'
    };

    // 1. Add to master template
    const masterPath = `hotels/${this.hotelId}/rooms`;
    await setDoc(doc(firestore, masterPath, room.id), newRoom);

    // 2. Add to current day's list
    const roomsPath = `hotels/${this.hotelId}/dates/${this.currentDate}/rooms`;
    await setDoc(doc(firestore, roomsPath, room.id), newRoom);

    return newRoom;
  }

  async updateRoom(room: Room): Promise<void> {
    if (!firestore) throw new Error('Firebase not configured');
    
    // Update in current day
    const roomsPath = `hotels/${this.hotelId}/dates/${this.currentDate}/rooms`;
    await setDoc(doc(firestore, roomsPath, room.id), room, { merge: true });

    // Update in master template
    const masterPath = `hotels/${this.hotelId}/rooms`;
    await setDoc(doc(firestore, masterPath, room.id), room, { merge: true });
  }

  async deleteRoom(roomId: string): Promise<void> {
    if (!firestore) throw new Error('Firebase not configured');

    // Delete from current day
    const roomsPath = `hotels/${this.hotelId}/dates/${this.currentDate}/rooms`;
    await deleteDoc(doc(firestore, roomsPath, roomId));

    // Delete from master
    const masterPath = `hotels/${this.hotelId}/rooms`;
    await deleteDoc(doc(firestore, masterPath, roomId));
  }

  subscribeRooms(callback: RoomSubscriptionCallback): () => void {
    if (!firestore) return () => {};
    const roomsPath = `hotels/${this.hotelId}/dates/${this.currentDate}/rooms`;
    const unsubscribe = onSnapshot(collection(firestore, roomsPath), (snap) => {
      const roomsList = snap.docs.map(doc => doc.data() as Room);
      callback(roomsList);
    }, (error) => {
      console.error('Error in subscribeRooms:', error);
    });
    return unsubscribe;
  }

  // Logs CRUD
  async getLogs(): Promise<CleaningLog[]> {
    if (!firestore) return [];
    try {
      const logsPath = `hotels/${this.hotelId}/logs`;
      const snap = await getDocs(query(collection(firestore, logsPath), orderBy('startedAt', 'desc')));
      if (snap.empty) {
        const defaultLogs = this.hotelId === 'ks2' ? LOGS_KS2 : LOGS_KS1;
        for (const log of defaultLogs) {
          await setDoc(doc(firestore, logsPath, log.id), log);
        }
        return defaultLogs;
      }
      return snap.docs.map(doc => doc.data() as CleaningLog);
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async createLog(log: Omit<CleaningLog, 'id'>): Promise<CleaningLog> {
    if (!firestore) throw new Error('Firebase not configured');
    const newId = generateUUID('log');
    const newLog: CleaningLog = { ...log, id: newId };
    const logsPath = `hotels/${this.hotelId}/logs`;
    await setDoc(doc(firestore, logsPath, newId), newLog);
    return newLog;
  }

  async updateLog(log: CleaningLog): Promise<void> {
    if (!firestore) throw new Error('Firebase not configured');
    const logsPath = `hotels/${this.hotelId}/logs`;
    await setDoc(doc(firestore, logsPath, log.id), log, { merge: true });
  }

  subscribeLogs(callback: LogSubscriptionCallback): () => void {
    if (!firestore) return () => {};
    const logsPath = `hotels/${this.hotelId}/logs`;
    const unsubscribe = onSnapshot(query(collection(firestore, logsPath), orderBy('startedAt', 'desc')), (snap) => {
      const logsList = snap.docs.map(doc => doc.data() as CleaningLog);
      callback(logsList);
    }, (error) => {
      console.error('Error in subscribeLogs:', error);
    });
    return unsubscribe;
  }

  async getActiveStaff(date: string): Promise<string[]> {
    if (!firestore) return [];
    try {
      const staffDocPath = `hotels/${this.hotelId}/dates/${date}/activeStaff/list`;
      const docSnap = await getDoc(doc(firestore, staffDocPath));
      if (docSnap.exists()) {
        return docSnap.data().userIds || [];
      }
      return [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async setActiveStaff(date: string, userIds: string[]): Promise<void> {
    if (!firestore) throw new Error('Firebase not configured');
    const staffDocPath = `hotels/${this.hotelId}/dates/${date}/activeStaff/list`;
    await setDoc(doc(firestore, staffDocPath), { userIds });
  }
}

const firebaseDBs: Record<string, FirebaseDB> = {};

function getFirebaseDB(hotelId: string): FirebaseDB {
  if (!firebaseDBs[hotelId]) {
    firebaseDBs[hotelId] = new FirebaseDB(hotelId);
  }
  return firebaseDBs[hotelId];
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
    if (isFirebaseConfigured) {
      return getFirebaseDB(hotelId);
    }
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
