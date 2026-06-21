import type { 
  DBInterface, User, Room, CleaningLog, Hotel, FinalizedDayReport,
  RoomSubscriptionCallback, LogSubscriptionCallback 
} from './dbInterface';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
  (typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.hostname}:4000` 
    : 'http://localhost:4000');
const socket = io(BACKEND_URL);

export class PostgresDB implements DBInterface {
  private hotelId: string;
  private currentDate: string;
  private roomSubscribers: Set<RoomSubscriptionCallback> = new Set();
  private logSubscribers: Set<LogSubscriptionCallback> = new Set();

  constructor(hotelId: string) {
    this.hotelId = hotelId;
    
    // Default date is today's date in local time YYYY-MM-DD
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.currentDate = `${year}-${month}-${day}`;

    // Join WebSocket rooms for realtime updates
    this.joinRooms();

    // Listen to WebSocket events from backend
    socket.on('room_updated', () => this.notifyRoomSubscribers());
    socket.on('room_deleted', () => this.notifyRoomSubscribers());
    socket.on('lock_changed', () => this.notifyRoomSubscribers());
    socket.on('log_updated', () => this.notifyLogSubscribers());
    socket.on('logs_changed', () => this.notifyLogSubscribers());
    socket.on('database_reset', () => {
      window.location.reload();
    });
  }

  private joinRooms() {
    socket.emit('join_hotel_date', { hotelId: this.hotelId, date: this.currentDate });
    socket.emit('join_hotel_logs', { hotelId: this.hotelId });
  }

  setDate(date: string): void {
    if (this.currentDate !== date) {
      this.currentDate = date;
      this.joinRooms();
      this.notifyRoomSubscribers();
    }
  }

  getDate(): string {
    return this.currentDate;
  }

  // --- ROOMS SUBSCRIPTIONS ---
  private async notifyRoomSubscribers() {
    try {
      const rooms = await this.getRooms();
      this.roomSubscribers.forEach(cb => cb(rooms));
    } catch (e) {
      console.error('Error notifying room subscribers:', e);
    }
  }

  subscribeRooms(callback: RoomSubscriptionCallback): () => void {
    this.roomSubscribers.add(callback);
    this.getRooms().then(rooms => callback(rooms)).catch(e => console.error(e));
    return () => {
      this.roomSubscribers.delete(callback);
    };
  }

  // --- LOGS SUBSCRIPTIONS ---
  private async notifyLogSubscribers() {
    try {
      const logs = await this.getLogs();
      this.logSubscribers.forEach(cb => cb(logs));
    } catch (e) {
      console.error('Error notifying log subscribers:', e);
    }
  }

  subscribeLogs(callback: LogSubscriptionCallback): () => void {
    this.logSubscribers.add(callback);
    this.getLogs().then(logs => callback(logs)).catch(e => console.error(e));
    return () => {
      this.logSubscribers.delete(callback);
    };
  }

  // --- HOTELS ---
  async getHotels(): Promise<Hotel[]> {
    const res = await fetch(`${BACKEND_URL}/api/hotels`);
    if (!res.ok) throw new Error('Failed to fetch hotels');
    return res.json();
  }

  async createHotel(hotel: Hotel): Promise<Hotel> {
    const res = await fetch(`${BACKEND_URL}/api/hotels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hotel)
    });
    if (!res.ok) throw new Error('Failed to create hotel');
    return res.json();
  }

  async deleteHotel(hotelId: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/hotels/${hotelId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete hotel');
  }

  async updateHotel(hotel: Hotel): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/hotels/${hotel.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hotel)
    });
    if (!res.ok) throw new Error('Failed to update hotel');
  }

  // --- USERS ---
  async getUsers(): Promise<User[]> {
    const res = await fetch(`${BACKEND_URL}/api/users?hotelId=${this.hotelId}`);
    if (!res.ok) throw new Error('Failed to fetch users');
    const users: User[] = await res.json();
    return users.filter(u => u.role !== 'admin');
  }

  async getAllGlobalUsers(): Promise<User[]> {
    const res = await fetch(`${BACKEND_URL}/api/users/global`);
    if (!res.ok) throw new Error('Failed to fetch global users');
    return res.json();
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const res = await fetch(`${BACKEND_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, hotelIds: user.hotelIds || [this.hotelId] })
    });
    if (!res.ok) throw new Error('Failed to create user');
    return res.json();
  }

  async updateUser(user: User): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error('Failed to update user');
  }

  async deleteUser(userId: string): Promise<void> {
    const allUsers = await this.getAllGlobalUsers();
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      if (user.username?.trim().toLowerCase() === 'admin') {
        throw new Error('Cannot delete or dissociate the main admin user.');
      }
      user.hotelIds = user.hotelIds?.filter(hId => hId !== this.hotelId) || [];
      await this.updateUser(user);
    }
  }

  async deleteUserCompletely(userId: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/users/${userId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete user');
  }

  // --- ROOMS ---
  async getRooms(): Promise<Room[]> {
    if (this.hotelId === 'portal' || this.hotelId === 'admin') {
      return [];
    }
    const res = await fetch(`${BACKEND_URL}/api/rooms?hotelId=${this.hotelId}&date=${this.currentDate}`);
    if (!res.ok) throw new Error('Failed to fetch rooms');
    return res.json();
  }

  async updateRoomStatus(
    roomId: string, 
    status: Room['status'], 
    updatedBy: string, 
    assignedTo?: string, 
    cleanerName?: string
  ): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/rooms/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: this.hotelId,
        date: this.currentDate,
        roomId,
        status,
        updatedBy,
        assignedTo,
        cleanerName
      })
    });
    if (!res.ok) {
      const err = await res.json();
      if (err.error === 'DATE_LOCKED') throw new Error('DATE_LOCKED');
      throw new Error('Failed to update room status');
    }
  }

  async createRoom(room: Omit<Room, 'updatedAt' | 'updatedBy'>): Promise<Room> {
    const res = await fetch(`${BACKEND_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...room,
        hotelId: this.hotelId,
        date: this.currentDate,
        updatedBy: 'system'
      })
    });
    if (!res.ok) throw new Error('Failed to create room');
    return res.json();
  }

  async updateRoom(room: Room): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/rooms`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...room,
        hotelId: this.hotelId,
        date: this.currentDate
      })
    });
    if (!res.ok) {
      const err = await res.json();
      if (err.error === 'DATE_LOCKED') throw new Error('DATE_LOCKED');
      throw new Error('Failed to update room');
    }
  }

  async deleteRoom(roomId: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/rooms`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: this.hotelId,
        date: this.currentDate,
        roomNumber: roomId
      })
    });
    if (!res.ok) throw new Error('Failed to delete room');
  }

  // --- LOGS ---
  async getLogs(): Promise<CleaningLog[]> {
    if (this.hotelId === 'portal' || this.hotelId === 'admin') {
      return [];
    }
    const res = await fetch(`${BACKEND_URL}/api/logs?hotelId=${this.hotelId}`);
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  }

  async createLog(log: Omit<CleaningLog, 'id'>): Promise<CleaningLog> {
    const res = await fetch(`${BACKEND_URL}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...log,
        hotelId: this.hotelId,
        date: this.currentDate
      })
    });
    if (!res.ok) {
      const err = await res.json();
      if (err.error === 'DATE_LOCKED') throw new Error('DATE_LOCKED');
      throw new Error('Failed to create log');
    }
    return res.json();
  }

  async updateLog(log: CleaningLog): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/logs/${log.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...log,
        hotelId: this.hotelId,
        date: this.currentDate
      })
    });
    if (!res.ok) {
      const err = await res.json();
      if (err.error === 'DATE_LOCKED') throw new Error('DATE_LOCKED');
      throw new Error('Failed to update log');
    }
  }

  // --- STAFF ---
  async getActiveStaff(date: string): Promise<string[]> {
    if (this.hotelId === 'portal' || this.hotelId === 'admin') {
      return [];
    }
    const res = await fetch(`${BACKEND_URL}/api/staff/${date}?hotelId=${this.hotelId}`);
    if (!res.ok) throw new Error('Failed to fetch active staff');
    return res.json();
  }

  async setActiveStaff(date: string, userIds: string[]): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/staff/${date}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: this.hotelId,
        userIds
      })
    });
    if (!res.ok) {
      const err = await res.json();
      if (err.error === 'DATE_LOCKED') throw new Error('DATE_LOCKED');
      throw new Error('Failed to set active staff');
    }
  }

  // --- LOCKS ---
  async isDateLocked(date: string): Promise<boolean> {
    if (this.hotelId === 'portal' || this.hotelId === 'admin') {
      return false;
    }
    const res = await fetch(`${BACKEND_URL}/api/locks/${date}?hotelId=${this.hotelId}`);
    if (!res.ok) throw new Error('Failed to check date lock');
    return res.json();
  }

  async setDateLocked(date: string, locked: boolean): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/locks/${date}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: this.hotelId,
        locked
      })
    });
    if (!res.ok) throw new Error('Failed to set date lock');
  }

  // --- REPORTS ---
  async getFinalizedDayReports(): Promise<FinalizedDayReport[]> {
    if (this.hotelId === 'portal' || this.hotelId === 'admin') {
      return [];
    }
    const res = await fetch(`${BACKEND_URL}/api/reports?hotelId=${this.hotelId}`);
    if (!res.ok) throw new Error('Failed to fetch finalized reports');
    return res.json();
  }

  async saveFinalizedDayReport(report: FinalizedDayReport): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    if (!res.ok) throw new Error('Failed to save report');
  }

  async deleteFinalizedDayReport(reportId: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/reports/${reportId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete report');
  }

  // Trigger manual reset of database tables via Backend
  async resetDatabase(): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/reset`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to reset database');
  }

  async backupDatabase(): Promise<any> {
    const res = await fetch(`${BACKEND_URL}/api/system/backup`);
    if (!res.ok) throw new Error('Failed to backup database');
    return res.json();
  }

  async restoreDatabase(data: any): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/system/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to restore database');
  }
}
export default PostgresDB;
