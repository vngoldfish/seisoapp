import type { DBInterface, User, Room, CleaningLog, RoomSubscriptionCallback, LogSubscriptionCallback, Hotel } from './dbInterface';

function generateUUID(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return prefix + crypto.randomUUID();
  }
  return prefix + Math.random().toString(36).substring(2, 11);
}

const DEFAULT_HOTELS: Hotel[] = [
  { id: 'ks1', name: 'Sakura Hotel', description: 'さくらホテル (ks1) - Standard Branch' },
  { id: 'ks2', name: 'Fuji Hotel', description: '富士ホテル (ks2) - Luxury Suite Branch' },
  { id: 'ks3', name: 'Tokyo Inn', description: '東京イン (ks3) - Central Business Branch' },
  { id: 'ks4', name: 'Kyoto Resort', description: '京都リゾート (ks4) - Traditional Spa & Onsen' },
  { id: 'ks5', name: 'Osaka Plaza', description: '大阪プラザ (ks5) - Downtown Commercial' },
  { id: 'ks6', name: 'Sapporo Lodge', description: '札幌ロッジ (ks6) - Northern Ski Resort' },
  { id: 'ks7', name: 'Okinawa Beach', description: '沖縄ビーチ (ks7) - Southern Coast Resort' },
  { id: 'ks8', name: 'Nara Gardens', description: '奈良ガーデン (ks8) - Historic Sanctuary' }
];


// --- MOCK SEED DATA FOR USERS & LOGS ---
const USERS_KS1: User[] = [
  { id: 'u1', username: 'admin', role: 'admin', name: 'NKTN Manager', language: 'ja' },
  { id: 'u2', username: 'front1', role: 'front_desk', name: 'Front Sato', language: 'ja' },
  { id: 'u3', username: 'cleaner1', role: 'housekeeping', pin: '1111', name: 'Nguyen Van A (Anh A)', language: 'vi' },
  { id: 'u4', username: 'cleaner2', role: 'housekeeping', pin: '2222', name: 'Tran Thi B (Chi B)', language: 'vi' },
  { id: 'u_check1', username: 'check1', role: 'checka', name: 'Checker Nguyen', language: 'vi' },
  { id: 'u_kacho1', username: 'kacho1', role: 'kacho', name: 'Kacho Nguyen', language: 'vi' },
];

const LOGS_KS1: CleaningLog[] = [
  {
    id: 'log1',
    roomId: '303',
    roomNumber: '303',
    floor: 3,
    cleanerId: 'u3',
    cleanerName: 'Nguyen Van A (Anh A)',
    startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    endedAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    durationMinutes: 30,
    notes: 'Cleaned, replaced sheets',
  }
];

const USERS_KS2: User[] = [
  { id: 'u201', username: 'admin', role: 'admin', name: 'Fuji Manager', language: 'ja' },
  { id: 'u202', username: 'front2', role: 'front_desk', name: 'Front Suzuki', language: 'en' },
  { id: 'u203', username: 'cleaner3', role: 'housekeeping', pin: '3333', name: 'Saito Tanaka', language: 'ja' },
  { id: 'u204', username: 'cleaner4', role: 'housekeeping', pin: '4444', name: 'Nguyen Thi C (Chi C)', language: 'vi' },
  { id: 'u_check2', username: 'check2', role: 'checka', name: 'Checker Sato', language: 'ja' },
  { id: 'u_kacho2', username: 'kacho2', role: 'kacho', name: 'Kacho Saito', language: 'ja' },
];

const LOGS_KS2: CleaningLog[] = [
  {
    id: 'log201',
    roomId: '503',
    roomNumber: '503',
    floor: 5,
    cleanerId: 'u203',
    cleanerName: 'Saito Tanaka',
    startedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    endedAt: new Date(Date.now() - 3600000 * 2.3).toISOString(),
    durationMinutes: 42,
    notes: 'Everything is in order',
  }
];

// --- AUTO GENERATOR FOR ROOMS ---
const generateRoomsKS1 = (): Room[] => {
  const rooms: Room[] = [];
  const floors = [3, 4, 5, 6, 7, 8, 9];
  const types = ['1 Bed', '2 Beds', '3 Beds', '4 Beds', 'Minpaku', 'Single', 'Double', 'Twin', 'Suite'];
  
  floors.forEach(floor => {
    const startRoom = floor === 9 ? 2 : 1;
    const endRoom = floor === 9 ? 19 : 18;
    
    for (let r = startRoom; r <= endRoom; r++) {
      if (floor === 9 && r === 12) continue; // Skip 912 like in the image
      
      const roomNum = `${floor}${r.toString().padStart(2, '0')}`;
      const type = types[Math.floor(Math.random() * types.length)];
      
      // Determine status simulation to match NKTN photo style
      let status: Room['status'] = 'vacant';
      let isStay = false;
      let guestCount = 0;
      let notes = '';

      const seedRand = Math.random();
      
      if (seedRand < 0.35) {
        // Red room (Stay/Occupied)
        status = 'occupied';
        isStay = Math.random() > 0.3; // most occupied rooms in image have guests staying over
        guestCount = Math.floor(Math.random() * 2) + 1; // 1 or 2 guests
      } else if (seedRand < 0.65) {
        // Yellow room (Dirty/Need clean)
        status = 'dirty';
        isStay = Math.random() > 0.7; // some stay rooms need cleaning
        guestCount = Math.floor(Math.random() * 2) + 1;
      } else if (seedRand < 0.8) {
        // Clean room (Vacant with vạt chéo green)
        status = 'clean';
        isStay = Math.random() > 0.5;
        guestCount = Math.floor(Math.random() * 2) + 1;
      } else if (seedRand < 0.85) {
        // Grey room (Maintenance)
        status = 'maintenance';
        notes = 'Bathroom leak / TV issues';
      } else {
        // White room (Vacant ready)
        status = 'vacant';
      }

      // Special hardcoding for specific room styles seen in image to make it ultra-realistic
      if (roomNum === '304' || roomNum === '317' || roomNum === '403') {
        status = 'dirty';
        isStay = true;
        guestCount = 1;
      } else if (roomNum === '303' || roomNum === '307') {
        status = 'occupied';
        isStay = false;
        guestCount = 1;
      } else if (roomNum === '308' || roomNum === '404' || roomNum === '504') {
        status = 'clean';
        isStay = true;
        guestCount = 1;
      } else if (roomNum === '309' || roomNum === '702') {
        status = 'clean';
        isStay = false;
        guestCount = 1;
      } else if (roomNum === '915' || roomNum === '501') {
        status = 'maintenance';
      }

      rooms.push({
        id: roomNum,
        roomNumber: roomNum,
        floor,
        type,
        status,
        isStay,
        guestCount,
        notes: notes || undefined,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
      });
    }
  });
  return rooms;
};

const generateRoomsKS2 = (): Room[] => {
  const rooms: Room[] = [];
  const floors = [5, 6];
  const types = ['1 Bed', '2 Beds', '3 Beds', '4 Beds', 'Minpaku', 'Single', 'Double', 'Twin', 'Suite'];
  
  floors.forEach(floor => {
    for (let r = 1; r <= 12; r++) {
      const roomNum = `${floor}${r.toString().padStart(2, '0')}`;
      const type = types[Math.floor(Math.random() * types.length)];
      
      let status: Room['status'] = 'vacant';
      let isStay = false;
      let guestCount = 0;

      const seedRand = Math.random();
      if (seedRand < 0.3) {
        status = 'occupied';
        isStay = true;
        guestCount = 2;
      } else if (seedRand < 0.6) {
        status = 'dirty';
        guestCount = 1;
      } else if (seedRand < 0.8) {
        status = 'clean';
        guestCount = 2;
      } else {
        status = 'vacant';
      }

      rooms.push({
        id: roomNum,
        roomNumber: roomNum,
        floor,
        type,
        status,
        isStay,
        guestCount,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
      });
    }
  });
  return rooms;
};

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function seedMockDataForDate(hotelId: string, date: string): void {
  const roomsKey = `${hotelId}_hotel_clean_rooms_${date}`;
  const activeStaffKey = `${hotelId}_active_staff_${date}`;
  const masterRoomsKey = `${hotelId}_hotel_clean_rooms`;
  const logsKey = `${hotelId}_hotel_clean_logs`;

  const hasRooms = !!localStorage.getItem(roomsKey);
  const hasActiveStaff = !!localStorage.getItem(activeStaffKey);

  const todayStr = getTodayDateString();
  const isFuture = date > todayStr;

  // 1. Get or seed master rooms
  let masterRooms: Room[] = [];
  const masterStr = localStorage.getItem(masterRoomsKey);
  if (masterStr) {
    try {
      masterRooms = JSON.parse(masterStr);
    } catch (e) {}
  }
  if (masterRooms.length === 0) {
    masterRooms = hotelId === 'ks2' ? generateRoomsKS2() : generateRoomsKS1();
    localStorage.setItem(masterRoomsKey, JSON.stringify(masterRooms));
  }

  // 2. Setup active staff if not existing
  let allUsers: User[] = [];
  try {
    allUsers = JSON.parse(localStorage.getItem('global_hotel_clean_users') || '[]');
  } catch (e) {}

  let activeStaffIds: string[] = [];
  if (hasActiveStaff) {
    try {
      activeStaffIds = JSON.parse(localStorage.getItem(activeStaffKey) || '[]');
    } catch (e) {}
  }

  const hotelHousekeepers = allUsers.filter(
    u => u.role === 'housekeeping' && u.hotelIds?.includes(hotelId) && u.status !== 'quit'
  );

  if (activeStaffIds.length === 0 && !hasActiveStaff) {
    if (isFuture) {
      // Future date: no active staff by default
      activeStaffIds = [];
    } else {
      // Today or past date: randomly assign staff
      if (hotelHousekeepers.length > 0) {
        const countToPick = Math.min(6, hotelHousekeepers.length);
        const shuffled = [...hotelHousekeepers].sort(() => 0.5 - Math.random());
        activeStaffIds = shuffled.slice(0, countToPick).map(u => u.id);
      } else {
        const names = [
          'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường', 'Phạm Minh Duy', 'Vũ Thị Dung',
          'Hoàng Văn Hải', 'Phan Thị Hoa', 'Đỗ Minh Hùng', 'Bùi Văn Hùng', 'Đặng Thị Hương'
        ];
        const newDemoCleaners: User[] = [];
        for (let i = 0; i < 6; i++) {
          const uId = `cleaner_${hotelId}_demo_${i + 1}`;
          const newUser: User = {
            id: uId,
            username: `cleaner_${hotelId}_demo_${i + 1}`,
            role: 'housekeeping',
            pin: String(7001 + i),
            name: names[i] || `Housekeeper Demo ${i + 1}`,
            language: 'vi',
            hotelIds: [hotelId],
            status: 'working'
          };
          newDemoCleaners.push(newUser);
          allUsers.push(newUser);
        }
        localStorage.setItem('global_hotel_clean_users', JSON.stringify(allUsers));
        activeStaffIds = newDemoCleaners.map(u => u.id);
      }
    }
    localStorage.setItem(activeStaffKey, JSON.stringify(activeStaffIds));
  }

  // Map staff ID to user for easy lookup
  const staffMap = new Map<string, User>();
  allUsers.forEach(u => {
    if (activeStaffIds.includes(u.id)) {
      staffMap.set(u.id, u);
    }
  });

  // 3. Seed rooms for this date if not existing
  let dailyRooms: Room[] = [];
  if (!hasRooms) {
    if (isFuture) {
      // Future dates start all vacant and clean without mock checkins
      dailyRooms = masterRooms.map((room) => ({
        ...room,
        status: 'vacant',
        isStay: false,
        guestCount: 0,
        notes: undefined,
        assignedTo: '',
        cleanerName: '',
        isChecked: undefined,
        checkedBy: undefined,
        checkedAt: undefined,
        updatedAt: new Date(date + 'T12:00:00.000Z').toISOString(),
        updatedBy: 'system'
      }));
    } else {
      dailyRooms = masterRooms.map((room) => {
        let status: Room['status'] = 'vacant';
        let isStay = false;
        let guestCount = 0;
        let notes = '';
        let assignedTo = '';
        let cleanerName = '';
        let isChecked: boolean | undefined = undefined;
        let checkedBy: string | undefined = undefined;
        let checkedAt: string | undefined = undefined;

        const rand = Math.random();
        
        if (rand < 0.25) {
          status = 'occupied';
          isStay = Math.random() > 0.3;
          guestCount = Math.floor(Math.random() * 3) + 1;
        } else if (rand < 0.50) {
          status = 'dirty';
          isStay = Math.random() > 0.4;
          guestCount = Math.floor(Math.random() * 3) + 1;
          if (Math.random() > 0.4 && activeStaffIds.length > 0) {
            const staffId = activeStaffIds[Math.floor(Math.random() * activeStaffIds.length)];
            assignedTo = staffId;
            cleanerName = staffMap.get(staffId)?.name || 'Housekeeper';
          }
        } else if (rand < 0.85) {
          status = 'clean';
          isStay = Math.random() > 0.5;
          guestCount = Math.floor(Math.random() * 3) + 1;
          
          if (activeStaffIds.length > 0) {
            const staffId = activeStaffIds[Math.floor(Math.random() * activeStaffIds.length)];
            assignedTo = staffId;
            cleanerName = staffMap.get(staffId)?.name || 'Housekeeper';
          }

          if (Math.random() > 0.4) {
            isChecked = true;
            checkedBy = 'System Checker';
            checkedAt = `${date}T${13 + Math.floor(Math.random() * 3)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00.000Z`;
          } else {
            isChecked = false;
          }
        } else if (rand < 0.90) {
          status = 'cleaning';
          isStay = Math.random() > 0.5;
          guestCount = Math.floor(Math.random() * 3) + 1;
          if (activeStaffIds.length > 0) {
            const staffId = activeStaffIds[Math.floor(Math.random() * activeStaffIds.length)];
            assignedTo = staffId;
            cleanerName = staffMap.get(staffId)?.name || 'Housekeeper';
          }
        } else if (rand < 0.94) {
          status = 'eco';
          isStay = true;
          guestCount = Math.floor(Math.random() * 2) + 1;
        } else if (rand < 0.97) {
          status = 'dnd';
          isStay = true;
          guestCount = Math.floor(Math.random() * 2) + 1;
        } else {
          status = 'maintenance';
          notes = 'Air conditioner check / Water leak repair';
        }

        if (Math.random() > 0.85 && status !== 'maintenance') {
          const sampleNotes = [
            'Guest requested extra towels',
            'Allergy to feathers - use synthetic pillows',
            'VIP guest - prepare fruit basket',
            'Late check-out requested',
            'Fix window lock before guest returns'
          ];
          notes = sampleNotes[Math.floor(Math.random() * sampleNotes.length)];
        }

        return {
          ...room,
          status,
          isStay,
          guestCount,
          notes: notes || undefined,
          assignedTo,
          cleanerName,
          isChecked,
          checkedBy,
          checkedAt,
          updatedAt: new Date(date + 'T12:00:00.000Z').toISOString(),
          updatedBy: 'system'
        };
      });
    }
    localStorage.setItem(roomsKey, JSON.stringify(dailyRooms));
  }

  // 4. Generate 5-15 logs for this date if none already exist for this date
  let allLogs: CleaningLog[] = [];
  const logsStr = localStorage.getItem(logsKey);
  if (logsStr) {
    try {
      allLogs = JSON.parse(logsStr);
    } catch (e) {}
  }

  const logsForThisDate = allLogs.filter(log => log.endedAt.startsWith(date));
  
  if (logsForThisDate.length === 0 && activeStaffIds.length > 0 && !isFuture) {
    if (dailyRooms.length === 0) {
      try {
        dailyRooms = JSON.parse(localStorage.getItem(roomsKey) || '[]');
      } catch (e) {}
    }

    if (dailyRooms.length > 0) {
      const logCount = 5 + Math.floor(Math.random() * 11);
      const roomsToLog = [...dailyRooms].sort(() => 0.5 - Math.random()).slice(0, logCount);
      
      const newLogs: CleaningLog[] = [];
      roomsToLog.forEach((room, index) => {
        const cleanerId = activeStaffIds[index % activeStaffIds.length];
        const cleanerName = staffMap.get(cleanerId)?.name || 'Housekeeper';
        
        const fraction = index / logCount;
        const hourStart = 8 + Math.floor(fraction * 8);
        const minuteStart = Math.floor(Math.random() * 30);
        
        const duration = 25 + Math.floor(Math.random() * 26);
        
        const startHourStr = String(hourStart).padStart(2, '0');
        const startMinStr = String(minuteStart).padStart(2, '0');
        
        const endHour = hourStart + Math.floor((minuteStart + duration) / 60);
        const endMin = (minuteStart + duration) % 60;
        
        const endHourStr = String(endHour).padStart(2, '0');
        const endMinStr = String(endMin).padStart(2, '0');
        
        const startedAt = `${date}T${startHourStr}:${startMinStr}:00.000Z`;
        const endedAt = `${date}T${endHourStr}:${endMinStr}:00.000Z`;
        
        const errorsList = [
          "Chưa lau sàn / hút bụi",
          "Thiếu khăn / đồ tiêu hao",
          "Bẩn nhà vệ sinh / bồn tắm",
          "Ga giường nhăn / bẩn",
          "Chưa đổ rác",
          "Còn bụi bẩn trên bàn / tủ"
        ];
        
        let logErrors: string[] | undefined = undefined;
        // Seed defects on ~30% of the logs
        if (Math.random() < 0.3) {
          const errorCount = Math.random() < 0.8 ? 1 : 2;
          const shuffledErrors = [...errorsList].sort(() => 0.5 - Math.random());
          logErrors = shuffledErrors.slice(0, errorCount);
        }

        newLogs.push({
          id: `log_${hotelId}_${date}_${index + 1}_${Math.random().toString(36).substring(2, 6)}`,
          roomId: room.id,
          roomNumber: room.roomNumber,
          floor: room.floor,
          cleanerId,
          cleanerName,
          startedAt,
          endedAt,
          durationMinutes: duration,
          notes: Math.random() > 0.8 ? 'Replaced amenities' : 'Everything is in order',
          errors: logErrors
        });
      });
      
      allLogs.push(...newLogs);
      localStorage.setItem(logsKey, JSON.stringify(allLogs));
    }
  }
}

export class LocalDB implements DBInterface {
  private hotelId: string;
  private roomsKey: string;
  private logsKey: string;
  private channelName: string;
  private currentDate: string;

  private broadcastChannel: BroadcastChannel | null = null;
  private roomCallbacks: Set<RoomSubscriptionCallback> = new Set();
  private logCallbacks: Set<LogSubscriptionCallback> = new Set();

  constructor(hotelId: string) {
    this.hotelId = hotelId;
    this.roomsKey = `${hotelId}_hotel_clean_rooms`;
    this.logsKey = `${hotelId}_hotel_clean_logs`;
    this.channelName = `${hotelId}_hotel_clean_realtime`;
    this.currentDate = getTodayDateString();

    this.initializeData();
    this.initializeDataForDate(this.currentDate);
    
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(this.channelName);
      this.broadcastChannel.onmessage = (event) => {
        if (event.data === 'rooms_updated') {
          this.notifyRoomSubscribers();
        } else if (event.data === 'logs_updated') {
          this.notifyLogSubscribers();
        }
      };
    }
  }

  private initializeData() {
    const existingHotelsStr = localStorage.getItem('global_hotels');
    let existingCount = 0;
    if (existingHotelsStr) {
      try {
        existingCount = JSON.parse(existingHotelsStr).length;
      } catch (e) {}
    }
    if (!existingHotelsStr || existingCount < 3) {
      localStorage.setItem('global_hotels', JSON.stringify(DEFAULT_HOTELS));
    }

    // Cleanup any future date data (after today) from localStorage
    try {
      const todayStr = getTodayDateString();
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        // Matches keys like: ks1_hotel_clean_rooms_YYYY-MM-DD or ks1_active_staff_YYYY-MM-DD
        const roomsMatch = key.match(/^([a-zA-Z0-9]+)_hotel_clean_rooms_(\d{4}-\d{2}-\d{2})$/);
        const staffMatch = key.match(/^([a-zA-Z0-9]+)_active_staff_(\d{4}-\d{2}-\d{2})$/);
        
        if (roomsMatch) {
          const dateStr = roomsMatch[2];
          if (dateStr > todayStr) {
            keysToRemove.push(key);
          }
        } else if (staffMatch) {
          const dateStr = staffMatch[2];
          if (dateStr > todayStr) {
            keysToRemove.push(key);
          }
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Also filter out future logs from all hotel logs
      const hotelsStr = localStorage.getItem('global_hotels') || '[]';
      let hotelsList: any[] = [];
      try {
        hotelsList = JSON.parse(hotelsStr);
      } catch (e) {}
      
      const hotelIds = new Set<string>(['ks1', 'ks2']);
      hotelsList.forEach((h: any) => {
        if (h && h.id) hotelIds.add(h.id);
      });
      
      hotelIds.forEach(hId => {
        const logsKey = `${hId}_hotel_clean_logs`;
        const logsStr = localStorage.getItem(logsKey);
        if (logsStr) {
          try {
            const logs: CleaningLog[] = JSON.parse(logsStr);
            const filteredLogs = logs.filter(log => {
              const dateStr = log.endedAt.split('T')[0];
              return dateStr <= todayStr;
            });
            if (filteredLogs.length !== logs.length) {
              localStorage.setItem(logsKey, JSON.stringify(filteredLogs));
            }
          } catch (e) {}
        }
      });
    } catch (e) {
      console.error('Failed to cleanup future mock data:', e);
    }
    
    // Global User initialization and migration
    if (!localStorage.getItem('global_hotel_clean_users')) {
      const mergedUsers: User[] = [];
      const addOrMergeUser = (u: User, hId: string) => {
        const existing = mergedUsers.find(item => item.username?.trim().toLowerCase() === u.username?.trim().toLowerCase());
        if (existing) {
          if (!existing.hotelIds) existing.hotelIds = [];
          if (!existing.hotelIds.includes(hId)) {
            existing.hotelIds.push(hId);
          }
        } else {
          mergedUsers.push({
            ...u,
            hotelIds: [hId],
            status: 'working'
          });
        }
      };

      // 1. Try to read from existing local storage keys if they exist
      const localUsersKS1Str = localStorage.getItem('ks1_hotel_clean_users');
      const localUsersKS2Str = localStorage.getItem('ks2_hotel_clean_users');

      let usersKS1 = USERS_KS1;
      if (localUsersKS1Str) {
        try { usersKS1 = JSON.parse(localUsersKS1Str); } catch (e) {}
      }
      let usersKS2 = USERS_KS2;
      if (localUsersKS2Str) {
        try { usersKS2 = JSON.parse(localUsersKS2Str); } catch (e) {}
      }

      usersKS1.forEach(u => addOrMergeUser(u, 'ks1'));
      usersKS2.forEach(u => addOrMergeUser(u, 'ks2'));

      // 2. Add 30 demo housekeepers to ks1 and ks2
      const demoPrefix = 'cleaner_demo_';
      const names = [
        'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường', 'Phạm Minh Duy', 'Vũ Thị Dung',
        'Hoàng Văn Hải', 'Phan Thị Hoa', 'Đỗ Minh Hùng', 'Bùi Văn Hùng', 'Đặng Thị Hương',
        'Ngô Văn Khánh', 'Dương Thị Lan', 'Lý Văn Minh', 'Đỗ Thị Nam', 'Nguyễn Văn Nam',
        'Trần Thị Oanh', 'Lê Văn Phương', 'Phạm Thị Quỳnh', 'Vũ Văn Sang', 'Hoàng Thị Thảo',
        'Phan Văn Tiến', 'Đỗ Thị Vân', 'Bùi Văn Việt', 'Đặng Thị Xuân', 'Ngô Văn Yên',
        'Dương Thị Yến', 'Lê Văn Anh', 'Nguyễn Thị Mai', 'Trần Văn Quốc', 'Phạm Thị Tuyết'
      ];
      // Seed for ks1
      for (let i = 0; i < 30; i++) {
        addOrMergeUser({
          id: `${demoPrefix}${i + 1}`,
          username: `${demoPrefix}${i + 1}`,
          role: 'housekeeping',
          pin: String(5001 + i),
          name: names[i] || `Nhân Viên Demo ${i + 1}`,
          language: 'vi'
        }, 'ks1');
      }
      // Seed for ks2
      for (let i = 0; i < 30; i++) {
        addOrMergeUser({
          id: `${demoPrefix}${i + 1}`,
          username: `${demoPrefix}${i + 1}`,
          role: 'housekeeping',
          pin: String(6001 + i),
          name: names[i] || `Nhân Viên Demo ${i + 1}`,
          language: 'vi'
        }, 'ks2');
      }

      localStorage.setItem('global_hotel_clean_users', JSON.stringify(mergedUsers));
    } else {
      // Migration check: if we already have global users, but for some reason checker is missing, let's verify
      const globalUsers: User[] = JSON.parse(localStorage.getItem('global_hotel_clean_users') || '[]');
      let migrated = false;
      globalUsers.forEach(u => {
        if (!u.status) {
          u.status = 'working';
          migrated = true;
        }
      });
      // Case-insensitive check and clean up for front1
      const front1Idxs: number[] = [];
      globalUsers.forEach((u, i) => {
        if (u.username?.trim().toLowerCase() === 'front1') {
          front1Idxs.push(i);
        }
      });

      if (front1Idxs.length === 0) {
        globalUsers.push({ id: 'u2', username: 'front1', role: 'front_desk', name: 'Front Sato', language: 'ja', hotelIds: ['ks1'], status: 'working' });
        migrated = true;
      } else {
        const keepIdx = front1Idxs[0];
        const keepUser = globalUsers[keepIdx];
        if (keepUser.username !== 'front1') {
          keepUser.username = 'front1';
          migrated = true;
        }
        if (!keepUser.hotelIds || !keepUser.hotelIds.includes('ks1')) {
          keepUser.hotelIds = ['ks1'];
          migrated = true;
        }
        if (keepUser.status !== 'working') {
          keepUser.status = 'working';
          migrated = true;
        }
        if (front1Idxs.length > 1) {
          for (let d = front1Idxs.length - 1; d > 0; d--) {
            globalUsers.splice(front1Idxs[d], 1);
          }
          migrated = true;
        }
      }

      // Case-insensitive check and clean up for front2
      const front2Idxs: number[] = [];
      globalUsers.forEach((u, i) => {
        if (u.username?.trim().toLowerCase() === 'front2') {
          front2Idxs.push(i);
        }
      });

      if (front2Idxs.length === 0) {
        globalUsers.push({ id: 'u202', username: 'front2', role: 'front_desk', name: 'Front Suzuki', language: 'en', hotelIds: ['ks2'], status: 'working' });
        migrated = true;
      } else {
        const keepIdx = front2Idxs[0];
        const keepUser = globalUsers[keepIdx];
        if (keepUser.username !== 'front2') {
          keepUser.username = 'front2';
          migrated = true;
        }
        if (!keepUser.hotelIds || !keepUser.hotelIds.includes('ks2')) {
          keepUser.hotelIds = ['ks2'];
          migrated = true;
        }
        if (keepUser.status !== 'working') {
          keepUser.status = 'working';
          migrated = true;
        }
        if (front2Idxs.length > 1) {
          for (let d = front2Idxs.length - 1; d > 0; d--) {
            globalUsers.splice(front2Idxs[d], 1);
          }
          migrated = true;
        }
      }

      // Case-insensitive check and clean up for check1
      const check1Idxs: number[] = [];
      globalUsers.forEach((u, i) => {
        if (u.username?.trim().toLowerCase() === 'check1') {
          check1Idxs.push(i);
        }
      });

      if (check1Idxs.length === 0) {
        globalUsers.push({ id: 'u_check1', username: 'check1', role: 'checka', name: 'Checker Nguyen', language: 'vi', hotelIds: ['ks1'], status: 'working' });
        migrated = true;
      } else {
        const keepIdx = check1Idxs[0];
        const keepUser = globalUsers[keepIdx];
        if (keepUser.username !== 'check1') {
          keepUser.username = 'check1';
          migrated = true;
        }
        if (!keepUser.hotelIds || !keepUser.hotelIds.includes('ks1')) {
          keepUser.hotelIds = ['ks1'];
          migrated = true;
        }
        if (keepUser.status !== 'working') {
          keepUser.status = 'working';
          migrated = true;
        }
        if (check1Idxs.length > 1) {
          for (let d = check1Idxs.length - 1; d > 0; d--) {
            globalUsers.splice(check1Idxs[d], 1);
          }
          migrated = true;
        }
      }

      // Case-insensitive check and clean up for check2
      const check2Idxs: number[] = [];
      globalUsers.forEach((u, i) => {
        if (u.username?.trim().toLowerCase() === 'check2') {
          check2Idxs.push(i);
        }
      });

      if (check2Idxs.length === 0) {
        globalUsers.push({ id: 'u_check2', username: 'check2', role: 'checka', name: 'Checker Sato', language: 'ja', hotelIds: ['ks2'], status: 'working' });
        migrated = true;
      } else {
        const keepIdx = check2Idxs[0];
        const keepUser = globalUsers[keepIdx];
        if (keepUser.username !== 'check2') {
          keepUser.username = 'check2';
          migrated = true;
        }
        if (!keepUser.hotelIds || !keepUser.hotelIds.includes('ks2')) {
          keepUser.hotelIds = ['ks2'];
          migrated = true;
        }
        if (keepUser.status !== 'working') {
          keepUser.status = 'working';
          migrated = true;
        }
        if (check2Idxs.length > 1) {
          for (let d = check2Idxs.length - 1; d > 0; d--) {
            globalUsers.splice(check2Idxs[d], 1);
          }
          migrated = true;
        }
      }

      // Case-insensitive check and clean up for kacho1
      const kacho1Idxs: number[] = [];
      globalUsers.forEach((u, i) => {
        if (u.username?.trim().toLowerCase() === 'kacho1') {
          kacho1Idxs.push(i);
        }
      });

      if (kacho1Idxs.length === 0) {
        globalUsers.push({ id: 'u_kacho1', username: 'kacho1', role: 'kacho', name: 'Kacho Nguyen', language: 'vi', hotelIds: ['ks1'], status: 'working' });
        migrated = true;
      } else {
        const keepIdx = kacho1Idxs[0];
        const keepUser = globalUsers[keepIdx];
        if (keepUser.username !== 'kacho1') {
          keepUser.username = 'kacho1';
          migrated = true;
        }
        if (!keepUser.hotelIds || !keepUser.hotelIds.includes('ks1')) {
          keepUser.hotelIds = ['ks1'];
          migrated = true;
        }
        if (keepUser.status !== 'working') {
          keepUser.status = 'working';
          migrated = true;
        }
        if (kacho1Idxs.length > 1) {
          for (let d = kacho1Idxs.length - 1; d > 0; d--) {
            globalUsers.splice(kacho1Idxs[d], 1);
          }
          migrated = true;
        }
      }

      // Case-insensitive check and clean up for kacho2
      const kacho2Idxs: number[] = [];
      globalUsers.forEach((u, i) => {
        if (u.username?.trim().toLowerCase() === 'kacho2') {
          kacho2Idxs.push(i);
        }
      });

      if (kacho2Idxs.length === 0) {
        globalUsers.push({ id: 'u_kacho2', username: 'kacho2', role: 'kacho', name: 'Kacho Saito', language: 'ja', hotelIds: ['ks2'], status: 'working' });
        migrated = true;
      } else {
        const keepIdx = kacho2Idxs[0];
        const keepUser = globalUsers[keepIdx];
        if (keepUser.username !== 'kacho2') {
          keepUser.username = 'kacho2';
          migrated = true;
        }
        if (!keepUser.hotelIds || !keepUser.hotelIds.includes('ks2')) {
          keepUser.hotelIds = ['ks2'];
          migrated = true;
        }
        if (keepUser.status !== 'working') {
          keepUser.status = 'working';
          migrated = true;
        }
        if (kacho2Idxs.length > 1) {
          for (let d = kacho2Idxs.length - 1; d > 0; d--) {
            globalUsers.splice(kacho2Idxs[d], 1);
          }
          migrated = true;
        }
      }
      if (migrated) {
        localStorage.setItem('global_hotel_clean_users', JSON.stringify(globalUsers));
      }
    }

    // Ensure the main 'admin' user is always associated with all hotels, and cannot be deleted
    const currentHotelsStr = localStorage.getItem('global_hotels');
    const currentHotels: Hotel[] = currentHotelsStr ? JSON.parse(currentHotelsStr) : DEFAULT_HOTELS;
    const allHotelIds = currentHotels.map(h => h.id);

    const globalUsersStr = localStorage.getItem('global_hotel_clean_users');
    const globalUsers: User[] = globalUsersStr ? JSON.parse(globalUsersStr) : [];
    let mainAdmin = globalUsers.find(u => u.username?.trim().toLowerCase() === 'admin');

    if (!mainAdmin) {
      mainAdmin = {
        id: 'u1',
        username: 'admin',
        role: 'admin',
        name: 'NKTN Manager',
        language: 'ja',
        hotelIds: allHotelIds,
        status: 'working'
      };
      globalUsers.push(mainAdmin);
    } else {
      mainAdmin.hotelIds = allHotelIds;
      mainAdmin.role = 'admin';
      mainAdmin.status = 'working';
    }
    localStorage.setItem('global_hotel_clean_users', JSON.stringify(globalUsers));

    // Ensure all default hotels have master rooms and logs populated
    const finalHotelsStr = localStorage.getItem('global_hotels');
    const finalHotels: Hotel[] = finalHotelsStr ? JSON.parse(finalHotelsStr) : DEFAULT_HOTELS;

    finalHotels.forEach(hotel => {
      const hRoomsKey = `${hotel.id}_hotel_clean_rooms`;
      const hLogsKey = `${hotel.id}_hotel_clean_logs`;
      
      if (!localStorage.getItem(hRoomsKey)) {
        const seedRooms = hotel.id === 'ks2' ? generateRoomsKS2() : generateRoomsKS1();
        localStorage.setItem(hRoomsKey, JSON.stringify(seedRooms));
      }
      
      if (!localStorage.getItem(hLogsKey)) {
        let seedLogs: CleaningLog[] = [];
        if (hotel.id === 'ks1') {
          seedLogs = LOGS_KS1;
        } else if (hotel.id === 'ks2') {
          seedLogs = LOGS_KS2;
        } else {
          seedLogs = [
            {
              id: `log_${hotel.id}_1`,
              roomId: '303',
              roomNumber: '303',
              floor: 3,
              cleanerId: 'cleaner_demo_1',
              cleanerName: 'Nguyễn Văn An',
              startedAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
              endedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
              durationMinutes: 30,
              notes: 'Everything is in order'
            },
            {
              id: `log_${hotel.id}_2`,
              roomId: '304',
              roomNumber: '304',
              floor: 3,
              cleanerId: 'cleaner_demo_2',
              cleanerName: 'Trần Thị Bình',
              startedAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
              endedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
              durationMinutes: 30,
              notes: 'Phát hiện đồ để quên: Sạc điện thoại'
            }
          ];
        }
        localStorage.setItem(hLogsKey, JSON.stringify(seedLogs));
      }

      // Seed mock data for the last 7 days for this hotel to ensure rich dashboard history
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        seedMockDataForDate(hotel.id, dateStr);
      }
    });
  }

  setDate(date: string): void {
    this.currentDate = date;
    this.initializeDataForDate(date);
    this.notifyRoomSubscribers();
  }

  getDate(): string {
    return this.currentDate;
  }

  private getRoomsKeyForDate(date: string): string {
    return `${this.hotelId}_hotel_clean_rooms_${date}`;
  }

  private initializeDataForDate(date: string): void {
    seedMockDataForDate(this.hotelId, date);
  }

  // --- HOTEL CRUD METHODS ---
  async getHotels(): Promise<Hotel[]> {
    const data = localStorage.getItem('global_hotels');
    if (!data) {
      localStorage.setItem('global_hotels', JSON.stringify(DEFAULT_HOTELS));
      return DEFAULT_HOTELS;
    }
    return JSON.parse(data);
  }

  async createHotel(hotel: Hotel): Promise<Hotel> {
    const hotels = await this.getHotels();
    if (hotels.some(h => h.id.toLowerCase() === hotel.id.toLowerCase())) {
      throw new Error('Hotel ID already exists');
    }
    
    const { roomsList, ...hotelToSave } = hotel;
    hotels.push(hotelToSave);
    localStorage.setItem('global_hotels', JSON.stringify(hotels));
    
    // Seed default users for the new hotel in global namespace
    const globalUsers: User[] = JSON.parse(localStorage.getItem('global_hotel_clean_users') || '[]');
    
    // Find the main admin and add this hotel association
    const mainAdmin = globalUsers.find(u => u.username === 'admin');
    if (mainAdmin) {
      if (!mainAdmin.hotelIds) mainAdmin.hotelIds = [];
      if (!mainAdmin.hotelIds.includes(hotel.id)) {
        mainAdmin.hotelIds.push(hotel.id);
      }
    }

    const newHotelUsers: User[] = [
      { id: generateUUID('u_'), username: 'admin_' + hotel.id, role: 'admin', name: `${hotel.name} Admin`, language: 'ja', hotelIds: [hotel.id], status: 'working' },
      { id: generateUUID('u_'), username: 'front_' + hotel.id, role: 'front_desk', name: `Front Desk Staff`, language: 'ja', hotelIds: [hotel.id], status: 'working' },
      { id: generateUUID('u_'), username: 'cleaner_' + hotel.id, role: 'housekeeping', pin: '1234', name: `Housekeeper A`, language: 'vi', hotelIds: [hotel.id], status: 'working' },
      { id: generateUUID('u_'), username: 'check_' + hotel.id, role: 'checka', name: `Checker A`, language: 'vi', hotelIds: [hotel.id], status: 'working' },
      { id: generateUUID('u_'), username: 'kacho_' + hotel.id, role: 'kacho', name: `Kacho A`, language: 'vi', hotelIds: [hotel.id], status: 'working' }
    ];
    globalUsers.push(...newHotelUsers);
    localStorage.setItem('global_hotel_clean_users', JSON.stringify(globalUsers));
    
    // Parse rooms list entered by user
    const roomsKey = `${hotel.id}_hotel_clean_rooms`;
    const customRooms: Room[] = [];
    
    if (roomsList && roomsList.trim()) {
      const roomEntries = roomsList.split(',').map(r => r.trim()).filter(Boolean);
      roomEntries.forEach(entry => {
        const parts = entry.split(':');
        const roomNum = parts[0].trim();
        const roomType = parts[1] ? parts[1].trim() : '1 Bed';

        // Parse floor from room number
        let floor = 1;
        const match = roomNum.match(/^(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= 100) {
            floor = Math.floor(num / 100);
          }
        }
        
        customRooms.push({
          id: roomNum,
          roomNumber: roomNum,
          floor,
          type: roomType,
          status: 'vacant', // default vacant
          isStay: false,
          guestCount: 1,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system'
        });
      });
    }
    
    localStorage.setItem(roomsKey, JSON.stringify(customRooms));
    
    // Also seed the current date's rooms for this new hotel immediately!
    const today = getTodayDateString();
    const todayRooms = customRooms.map(room => ({
      ...room,
      status: 'vacant', // default vacant (no color)
      isStay: false,
      guestCount: 0,
      assignedTo: '',
      cleanerName: '',
      notes: '',
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    }));
    localStorage.setItem(`${hotel.id}_hotel_clean_rooms_${today}`, JSON.stringify(todayRooms));

    localStorage.setItem(`${hotel.id}_hotel_clean_logs`, JSON.stringify([]));

    return hotelToSave;
  }

  async deleteHotel(hotelId: string): Promise<void> {
    let hotels = await this.getHotels();
    hotels = hotels.filter(h => h.id !== hotelId);
    localStorage.setItem('global_hotels', JSON.stringify(hotels));
    
    // Clean up hotel's main keys
    localStorage.removeItem(`${hotelId}_hotel_clean_users`);
    localStorage.removeItem(`${hotelId}_hotel_clean_rooms`);
    localStorage.removeItem(`${hotelId}_hotel_clean_logs`);
    localStorage.removeItem(`${hotelId}_hotel_clean_curr_user`);

    // Clean up any date-partitioned rooms, active staff, or dynamic hotel keys
    const prefixes = [`${hotelId}_hotel_clean_rooms_`, `${hotelId}_active_staff_`];
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && prefixes.some(pref => key.startsWith(pref))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clean up user hotel associations
    const globalUsersStr = localStorage.getItem('global_hotel_clean_users');
    if (globalUsersStr) {
      try {
        const users: User[] = JSON.parse(globalUsersStr);
        const updatedUsers = users.map(user => {
          if (user.hotelIds) {
            return {
              ...user,
              hotelIds: user.hotelIds.filter(id => id !== hotelId)
            };
          }
          return user;
        });
        localStorage.setItem('global_hotel_clean_users', JSON.stringify(updatedUsers));
      } catch (e) {
        console.error('Error cleaning up user hotel associations:', e);
      }
    }
  }

  async updateHotel(updatedHotel: Hotel): Promise<void> {
    let hotels = await this.getHotels();
    hotels = hotels.map(h => h.id === updatedHotel.id ? updatedHotel : h);
    localStorage.setItem('global_hotels', JSON.stringify(hotels));
  }


  private notifyRoomSubscribers() {
    const dateKey = this.getRoomsKeyForDate(this.currentDate);
    const rooms = JSON.parse(localStorage.getItem(dateKey) || '[]');
    this.roomCallbacks.forEach(cb => cb(rooms));
  }

  private notifyLogSubscribers() {
    const logs = JSON.parse(localStorage.getItem(this.logsKey) || '[]');
    this.logCallbacks.forEach(cb => cb(logs));
  }

  private broadcast(type: 'rooms_updated' | 'logs_updated') {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(type);
    }
    if (type === 'rooms_updated') {
      this.notifyRoomSubscribers();
    } else if (type === 'logs_updated') {
      this.notifyLogSubscribers();
    }
  }

  async getAllGlobalUsers(): Promise<User[]> {
    return JSON.parse(localStorage.getItem('global_hotel_clean_users') || '[]');
  }

  async getUsers(): Promise<User[]> {
    const allUsers = await this.getAllGlobalUsers();
    return allUsers.filter(u => u.hotelIds?.includes(this.hotelId));
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const allUsers = await this.getAllGlobalUsers();
    
    // Check if user with same username already exists
    let existingUser = allUsers.find(u => u.username?.trim().toLowerCase() === user.username.trim().toLowerCase());
    
    if (existingUser) {
      // If they exist, just add the current hotelId to their list of hotels
      if (!existingUser.hotelIds) existingUser.hotelIds = [];
      if (!existingUser.hotelIds.includes(this.hotelId)) {
        existingUser.hotelIds.push(this.hotelId);
      }
      // Update other details
      existingUser.name = user.name;
      existingUser.role = user.role;
      existingUser.language = user.language;
      if (user.pin) existingUser.pin = user.pin;
      existingUser.status = user.status || existingUser.status || 'working';
      
      localStorage.setItem('global_hotel_clean_users', JSON.stringify(allUsers));
      return existingUser;
    } else {
      const newUser: User = {
        ...user,
        id: generateUUID('u_'),
        hotelIds: [this.hotelId],
        status: user.status || 'working'
      };
      allUsers.push(newUser);
      localStorage.setItem('global_hotel_clean_users', JSON.stringify(allUsers));
      return newUser;
    }
  }

  async updateUser(updatedUser: User): Promise<void> {
    const allUsers = await this.getAllGlobalUsers();
    const index = allUsers.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      const prevUser = allUsers[index];
      
      // If updating the main 'admin' user, enforce admin details and hotel associations
      if (prevUser.username?.trim().toLowerCase() === 'admin') {
        const hotels = await this.getHotels();
        const hotelIds = hotels.map(h => h.id);
        
        updatedUser.username = 'admin';
        updatedUser.role = 'admin';
        updatedUser.status = 'working';
        updatedUser.hotelIds = hotelIds;
      }
      
      const mergedUser = {
        ...updatedUser,
        hotelIds: updatedUser.hotelIds || prevUser.hotelIds || [this.hotelId]
      };
      allUsers[index] = mergedUser;
      localStorage.setItem('global_hotel_clean_users', JSON.stringify(allUsers));
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const allUsers = await this.getAllGlobalUsers();
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      if (user.username?.trim().toLowerCase() === 'admin') {
        throw new Error('Cannot delete or dissociate the main admin user.');
      }
      // Remove this hotelId from user's hotel associations
      user.hotelIds = user.hotelIds?.filter(hId => hId !== this.hotelId) || [];
      
      // If they belong to no hotels anymore, delete them entirely
      if (user.hotelIds.length === 0) {
        const remainingUsers = allUsers.filter(u => u.id !== userId);
        localStorage.setItem('global_hotel_clean_users', JSON.stringify(remainingUsers));
      } else {
        localStorage.setItem('global_hotel_clean_users', JSON.stringify(allUsers));
      }
    }
  }

  async deleteUserCompletely(userId: string): Promise<void> {
    const allUsers = await this.getAllGlobalUsers();
    const user = allUsers.find(u => u.id === userId);
    if (user && user.username?.trim().toLowerCase() === 'admin') {
      throw new Error('Cannot delete the main admin user.');
    }
    const remainingUsers = allUsers.filter(u => u.id !== userId);
    localStorage.setItem('global_hotel_clean_users', JSON.stringify(remainingUsers));
  }


  async getRooms(): Promise<Room[]> {
    const dateKey = this.getRoomsKeyForDate(this.currentDate);
    return JSON.parse(localStorage.getItem(dateKey) || '[]');
  }

  async updateRoomStatus(
    roomId: string,
    status: Room['status'],
    updatedBy: string,
    assignedTo?: string,
    cleanerName?: string
  ): Promise<void> {
    const rooms = await this.getRooms();
    const updatedRooms = rooms.map(room => {
      if (room.id === roomId) {
        // Determine check status based on room status
        let extraFields: Partial<Room> = {};
        if (status === 'clean') {
          extraFields = {
            isChecked: false,
            checkedBy: undefined,
            checkedAt: undefined
          };
        } else {
          extraFields = {
            isChecked: undefined,
            checkedBy: undefined,
            checkedAt: undefined
          };
        }

        // Auto clear assignment if status is reset to dirty/vacant/etc
        const isStatusClearingCleaner = status === 'dirty' || status === 'vacant' || status === 'dnd' || status === 'maintenance' || status === 'occupied';
        const finalAssignedTo = isStatusClearingCleaner ? '' : (assignedTo !== undefined ? assignedTo : room.assignedTo);
        const finalCleanerName = isStatusClearingCleaner ? '' : (cleanerName !== undefined ? cleanerName : room.cleanerName);

        return {
          ...room,
          status,
          assignedTo: finalAssignedTo,
          cleanerName: finalCleanerName,
          ...extraFields,
          updatedAt: new Date().toISOString(),
          updatedBy,
        };
      }
      return room;
    });
    const dateKey = this.getRoomsKeyForDate(this.currentDate);
    localStorage.setItem(dateKey, JSON.stringify(updatedRooms));
    this.broadcast('rooms_updated');
  }

  async createRoom(room: Omit<Room, 'updatedAt' | 'updatedBy'>): Promise<Room> {
    // 1. Add to master template
    const masterRooms = JSON.parse(localStorage.getItem(this.roomsKey) || '[]');
    const newRoomMaster: Room = {
      ...room,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };
    masterRooms.push(newRoomMaster);
    localStorage.setItem(this.roomsKey, JSON.stringify(masterRooms));

    // 2. Add to current day's list
    const rooms = await this.getRooms();
    const newRoomDaily: Room = {
      ...room,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };
    rooms.push(newRoomDaily);
    const dateKey = this.getRoomsKeyForDate(this.currentDate);
    localStorage.setItem(dateKey, JSON.stringify(rooms));

    this.broadcast('rooms_updated');
    return newRoomDaily;
  }

  async updateRoom(updatedRoom: Room): Promise<void> {
    // 1. Update in master template
    let masterRooms: Room[] = JSON.parse(localStorage.getItem(this.roomsKey) || '[]');
    masterRooms = masterRooms.map(r => r.id === updatedRoom.id ? { ...updatedRoom, updatedAt: new Date().toISOString() } : r);
    localStorage.setItem(this.roomsKey, JSON.stringify(masterRooms));

    // 2. Update in current day's list
    let rooms = await this.getRooms();
    rooms = rooms.map(r => r.id === updatedRoom.id ? { ...updatedRoom, updatedAt: new Date().toISOString() } : r);
    const dateKey = this.getRoomsKeyForDate(this.currentDate);
    localStorage.setItem(dateKey, JSON.stringify(rooms));

    this.broadcast('rooms_updated');
  }

  async deleteRoom(roomId: string): Promise<void> {
    // 1. Delete from master template
    let masterRooms: Room[] = JSON.parse(localStorage.getItem(this.roomsKey) || '[]');
    masterRooms = masterRooms.filter(r => r.id !== roomId);
    localStorage.setItem(this.roomsKey, JSON.stringify(masterRooms));

    // 2. Delete from current day's list
    let rooms = await this.getRooms();
    rooms = rooms.filter(r => r.id !== roomId);
    const dateKey = this.getRoomsKeyForDate(this.currentDate);
    localStorage.setItem(dateKey, JSON.stringify(rooms));

    this.broadcast('rooms_updated');
  }

  subscribeRooms(callback: RoomSubscriptionCallback): () => void {
    this.roomCallbacks.add(callback);
    const dateKey = this.getRoomsKeyForDate(this.currentDate);
    const rooms = JSON.parse(localStorage.getItem(dateKey) || '[]');
    callback(rooms);

    return () => {
      this.roomCallbacks.delete(callback);
    };
  }

  async getLogs(): Promise<CleaningLog[]> {
    return JSON.parse(localStorage.getItem(this.logsKey) || '[]');
  }

  async createLog(log: Omit<CleaningLog, 'id'>): Promise<CleaningLog> {
    const logs = await this.getLogs();
    const newLog: CleaningLog = {
      ...log,
      id: generateUUID('log_'),
    };
    logs.push(newLog);
    localStorage.setItem(this.logsKey, JSON.stringify(logs));
    this.broadcast('logs_updated');
    return newLog;
  }

  async updateLog(updatedLog: CleaningLog): Promise<void> {
    const logs = await this.getLogs();
    const idx = logs.findIndex(l => l.id === updatedLog.id);
    if (idx !== -1) {
      logs[idx] = updatedLog;
      localStorage.setItem(this.logsKey, JSON.stringify(logs));
      this.broadcast('logs_updated');
    }
  }

  subscribeLogs(callback: LogSubscriptionCallback): () => void {
    this.logCallbacks.add(callback);
    const logs = JSON.parse(localStorage.getItem(this.logsKey) || '[]');
    callback(logs);

    return () => {
      this.logCallbacks.delete(callback);
    };
  }

  async getActiveStaff(date: string): Promise<string[]> {
    const key = `${this.hotelId}_active_staff_${date}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  async setActiveStaff(date: string, userIds: string[]): Promise<void> {
    const key = `${this.hotelId}_active_staff_${date}`;
    localStorage.setItem(key, JSON.stringify(userIds));
  }
}

const dbInstances: Record<string, LocalDB> = {};

export function getLocalDB(hotelId: string): LocalDB {
  const normalizedId = hotelId || 'ks1';
  if (!dbInstances[normalizedId]) {
    dbInstances[normalizedId] = new LocalDB(normalizedId);
  }
  return dbInstances[normalizedId];
}

export const localDBInstance = getLocalDB('ks1');
export default localDBInstance;
