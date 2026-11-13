const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const dataPath = path.join(__dirname, 'data');
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

const storeFile = path.join(dataPath, 'app-data.json');

function readStore() {
  if (!fs.existsSync(storeFile)) {
    const seed = {
      wards: [
        { id: 'W-101', name: 'Ward 1', officerId: 'OFF-1' },
        { id: 'W-102', name: 'Ward 2', officerId: 'OFF-2' },
        { id: 'W-103', name: 'Ward 3', officerId: 'OFF-3' }
      ],
      users: [
        { id: 'RES-1', role: 'resident', name: 'Asha Kumar', phone: '+91 90000 11111', wardId: 'W-101', address: '12, Green Park, Ward 1', status: 'verified', qrCode: 'QR-RES-1', schedule: 'Mon, Wed, Fri' },
        { id: 'RES-2', role: 'resident', name: 'Ravi Sharma', phone: '+91 90000 22222', wardId: 'W-101', address: '18, Green Park, Ward 1', status: 'verified', qrCode: 'QR-RES-2', schedule: 'Tue, Thu, Sat' },
        { id: 'RES-3', role: 'resident', name: 'Meena Iyer', phone: '+91 90000 33333', wardId: 'W-102', address: '9, Lakshmi Nagar, Ward 2', status: 'pending', qrCode: 'QR-RES-3', schedule: 'Daily' },
        { id: 'OFF-1', role: 'ward_officer', name: 'Suresh Nair', phone: '+91 91111 11111', wardId: 'W-101' },
        { id: 'OFF-2', role: 'ward_officer', name: 'Priya Das', phone: '+91 91111 22222', wardId: 'W-102' },
        { id: 'OFF-3', role: 'ward_officer', name: 'Arun Reddy', phone: '+91 91111 33333', wardId: 'W-103' },
        { id: 'ADM-1', role: 'admin', name: 'Municipal Admin', phone: '+91 92222 44444', wardId: null },
        { id: 'WORK-1', role: 'worker', name: 'Kiran', phone: '+91 93333 11111', wardId: 'W-101', vehicleId: 'V-101', routeId: 'R-101' },
        { id: 'WORK-2', role: 'worker', name: 'Ramesh', phone: '+91 93333 22222', wardId: 'W-102', vehicleId: 'V-201', routeId: 'R-201' }
      ],
      vehicles: [
        { id: 'V-101', type: 'Auto', status: 'active', lastKnownLocation: { lat: 12.9716, lng: 77.5946 } },
        { id: 'V-201', type: 'Truck', status: 'active', lastKnownLocation: { lat: 12.9352, lng: 77.6245 } }
      ],
      routes: [
        { id: 'R-101', wardId: 'W-101', workerId: 'WORK-1', vehicleId: 'V-101', window: '07:00-11:00', households: ['RES-1', 'RES-2'], status: 'assigned' },
        { id: 'R-201', wardId: 'W-102', workerId: 'WORK-2', vehicleId: 'V-201', window: '08:00-12:00', households: ['RES-3'], status: 'assigned' }
      ],
      pickups: [
        { id: 'P-1', householdId: 'RES-1', workerId: 'WORK-1', routeId: 'R-101', status: 'confirmed', timestamp: '2026-11-01T07:30:00Z', gps: { lat: 12.9716, lng: 77.5946 }, qrCode: 'QR-RES-1' },
        { id: 'P-2', householdId: 'RES-2', workerId: 'WORK-1', routeId: 'R-101', status: 'missed', timestamp: '2026-11-01T08:10:00Z', gps: { lat: 12.9716, lng: 77.5946 }, reason: 'Resident not available' }
      ],
      complaints: [
        { id: 'C-1', residentId: 'RES-2', title: 'Missed pickup', description: 'Waste was not collected on the assigned day', status: 'in_review', photos: [], createdAt: '2026-11-01T09:12:00Z', wardId: 'W-101' }
      ],
      notifications: [
        { id: 'N-1', userId: 'RES-2', type: 'missed_pickup', message: 'Your household was marked missed. The ward officer has been notified.', sentAt: '2026-11-01T09:00:00Z' }
      ],
      attendance: [
        { id: 'A-1', workerId: 'WORK-1', routeId: 'R-101', checkIn: '2026-11-01T06:45:00Z', checkOut: '2026-11-01T12:05:00Z', gps: { lat: 12.9716, lng: 77.5946 } }
      ],
      disruptions: [
        { id: 'D-1', wardId: 'W-101', reason: 'Heavy rain', status: 'approved', affectedHouseholds: ['RES-1', 'RES-2'], rescheduledDate: '2026-11-02' }
      ],
      reports: [
        { id: 'REP-1', wardId: 'W-101', month: '2026-11', totalHouseholds: 2, collected: 1, missed: 1, generatedAt: '2026-11-01T12:00:00Z' }
      ]
    };
    fs.writeFileSync(storeFile, JSON.stringify(seed, null, 2));
    return seed;
  }

  const raw = fs.readFileSync(storeFile, 'utf8');
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    return { wards: [], users: [], vehicles: [], routes: [], pickups: [], complaints: [], notifications: [], attendance: [], disruptions: [], reports: [] };
  }
}

function saveStore(data) {
  fs.writeFileSync(storeFile, JSON.stringify(data, null, 2));
}

function getUserByRole(role) {
  const data = readStore();
  return data.users.filter((user) => user.role === role);
}

function removePasswordHash(user) {
  const publicUser = { ...user };
  delete publicUser.passwordHash;
  return publicUser;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function passwordMatches(password, storedHash) {
  const [salt, expectedHash] = String(storedHash || '').split(':');
  if (!salt || !expectedHash) return false;

  const actualHash = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  return actualHash.length === expectedBuffer.length && crypto.timingSafeEqual(actualHash, expectedBuffer);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Waste collection system API running', timestamp: new Date().toISOString() });
});

app.get('/api/wards', (req, res) => {
  const { wards } = readStore();
  res.json(wards.map(({ id, name }) => ({ id, name })));
});

app.post('/api/login', (req, res) => {
  const { phone, role, password } = req.body;

  if (!phone || !role || !password) {
    return res.status(400).json({ error: 'Phone, role, and password are required.' });
  }

  const normalizedPhone = String(phone).replace(/\D/g, '');
  const user = readStore().users.find((account) =>
    account.role === role && String(account.phone).replace(/\D/g, '') === normalizedPhone
  );

  const validPassword = user?.passwordHash
    ? passwordMatches(password, user.passwordHash)
    : password === (process.env.DEMO_PASSWORD || 'waste123');

  if (!user || !validPassword) {
    return res.status(401).json({ error: 'Incorrect phone number, role, or password.' });
  }

  res.json({
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone,
      wardId: user.wardId,
      status: user.status || null
    }
  });
});

app.get('/api/dashboard', (req, res) => {
  const data = readStore();
  const dashboard = {
    summary: {
      wards: data.wards.length,
      households: data.users.filter((u) => u.role === 'resident').length,
      workers: data.users.filter((u) => u.role === 'worker').length,
      routes: data.routes.length,
      pickups: data.pickups.length,
      complaints: data.complaints.length
    },
    wards: data.wards,
    residentRegistrations: data.users.filter((u) => u.role === 'resident').map(removePasswordHash),
    workers: getUserByRole('worker').map(removePasswordHash),
    routes: data.routes,
    complaints: data.complaints,
    notifications: data.notifications,
    monthlyReports: data.reports
  };
  res.json(dashboard);
});

app.get('/api/users', (req, res) => {
  const data = readStore();
  res.json(data.users.map(removePasswordHash));
});

app.get('/api/routes', (req, res) => {
  const data = readStore();
  res.json(data.routes);
});

app.get('/api/complaints', (req, res) => {
  const data = readStore();
  res.json(data.complaints);
});

app.get('/api/reports', (req, res) => {
  const data = readStore();
  res.json(data.reports);
});

app.post('/api/register-household', (req, res) => {
  const data = readStore();
  const { name, phone, address, wardId } = req.body;

  if (!name || !phone || !address || !wardId) {
    return res.status(400).json({ error: 'All fields are required to register a household.' });
  }

  const duplicate = data.users.find((u) => u.role === 'resident' && u.address.toLowerCase() === address.toLowerCase());
  if (duplicate) {
    return res.status(409).json({ error: 'A household with this address already exists.' });
  }

  const household = {
    id: `RES-${Date.now()}`,
    role: 'resident',
    name,
    phone,
    address,
    wardId,
    status: 'pending',
    qrCode: `QR-${Date.now()}`,
    schedule: 'Not assigned yet'
  };

  data.users.push(household);
  saveStore(data);

  res.status(201).json({
    message: 'Household registered successfully. Awaiting ward officer verification.',
    household
  });
});

app.post('/api/signup', (req, res) => {
  const { name, phone, address, wardId, password } = req.body;
  if (!name || !String(name).trim() || !phone || !String(phone).trim() ||
      !address || !String(address).trim() || !wardId || !password) {
    return res.status(400).json({ error: 'Name, phone, address, ward, and password are required.' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const data = readStore();
  if (!data.wards.some((ward) => ward.id === wardId)) {
    return res.status(400).json({ error: 'Please select a valid ward.' });
  }

  const normalizedPhone = String(phone).replace(/\D/g, '');
  if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
    return res.status(400).json({ error: 'Enter a valid phone number with 10 to 15 digits.' });
  }

  const duplicatePhone = data.users.some((user) =>
    String(user.phone).replace(/\D/g, '') === normalizedPhone
  );
  if (duplicatePhone) {
    return res.status(409).json({ error: 'An account with this phone number already exists.' });
  }

  const normalizedAddress = String(address).trim().toLowerCase();
  const duplicateAddress = data.users.some((user) =>
    user.role === 'resident' && String(user.address).trim().toLowerCase() === normalizedAddress
  );
  if (duplicateAddress) {
    return res.status(409).json({ error: 'A household with this address already exists.' });
  }

  const household = {
    id: `RES-${Date.now()}`,
    role: 'resident',
    name: String(name).trim(),
    phone: String(phone).trim(),
    address: String(address).trim(),
    wardId,
    status: 'pending',
    qrCode: null,
    schedule: 'Not assigned yet',
    passwordHash: hashPassword(password)
  };

  data.users.push(household);
  saveStore(data);

  res.status(201).json({
    message: 'Account created. Your household is pending ward officer verification.',
    user: {
      id: household.id,
      role: household.role,
      name: household.name,
      phone: household.phone,
      wardId: household.wardId,
      status: household.status
    }
  });
});

app.post('/api/verify-household/:id', (req, res) => {
  const data = readStore();
  const household = data.users.find((u) => u.id === req.params.id && u.role === 'resident');

  if (!household) {
    return res.status(404).json({ error: 'Household not found.' });
  }

  household.status = 'verified';
  household.qrCode = household.qrCode || `QR-${Date.now()}`;
  household.schedule = 'Mon, Wed, Fri';

  data.notifications.push({
    id: `N-${Date.now()}`,
    userId: household.id,
    type: 'verification',
    message: `Your household ${household.address} has been verified and assigned a QR code.`,
    sentAt: new Date().toISOString()
  });

  saveStore(data);
  res.json({ message: 'Household verified successfully', household });
});

app.post('/api/route/create', (req, res) => {
  const data = readStore();
  const { wardId, workerId, vehicleId, window, households } = req.body;

  if (!wardId || !workerId || !vehicleId || !window || !Array.isArray(households)) {
    return res.status(400).json({ error: 'Route details are incomplete.' });
  }

  const route = {
    id: `R-${Date.now()}`,
    wardId,
    workerId,
    vehicleId,
    window,
    households,
    status: 'assigned'
  };

  data.routes.push(route);
  saveStore(data);
  res.status(201).json({ message: 'Route created successfully', route });
});

app.post('/api/pickup/confirm', (req, res) => {
  const data = readStore();
  const { householdId, workerId, routeId, qrCode, gps } = req.body;

  if (!householdId || !workerId || !routeId || !qrCode || !gps) {
    return res.status(400).json({ error: 'Pickup confirmation requires house QR, worker, route and GPS data.' });
  }

  const household = data.users.find((u) => u.id === householdId && u.role === 'resident');
  if (!household) {
    return res.status(404).json({ error: 'Invalid household for pickup confirmation.' });
  }

  const pickup = {
    id: `P-${Date.now()}`,
    householdId,
    workerId,
    routeId,
    status: 'confirmed',
    timestamp: new Date().toISOString(),
    gps,
    qrCode
  };

  data.pickups.push(pickup);
  data.notifications.push({
    id: `N-${Date.now()}`,
    userId: householdId,
    type: 'pickup_confirmed',
    message: `Waste collection confirmed for ${household.address}.`,
    sentAt: new Date().toISOString()
  });

  saveStore(data);
  res.status(201).json({ message: 'Pickup confirmed successfully', pickup });
});

app.post('/api/miss/report', (req, res) => {
  const data = readStore();
  const { residentId, reason } = req.body;

  if (!residentId || !reason) {
    return res.status(400).json({ error: 'Resident and reason are required.' });
  }

  const complaint = {
    id: `C-${Date.now()}`,
    residentId,
    title: 'Missed pickup report',
    description: reason,
    status: 'open',
    photos: [],
    createdAt: new Date().toISOString(),
    wardId: data.users.find((u) => u.id === residentId)?.wardId || null
  };

  data.complaints.push(complaint);
  data.notifications.push({
    id: `N-${Date.now()}`,
    userId: residentId,
    type: 'missed_report',
    message: 'Your missed pickup report has been submitted and assigned to the ward officer.',
    sentAt: new Date().toISOString()
  });

  saveStore(data);
  res.status(201).json({ message: 'Missed pickup reported successfully', complaint });
});

app.post('/api/complaint/create', (req, res) => {
  const data = readStore();
  const { residentId, title, description, photos = [] } = req.body;

  if (!residentId || !title || !description) {
    return res.status(400).json({ error: 'Resident, title and description are required.' });
  }

  const complaint = {
    id: `C-${Date.now()}`,
    residentId,
    title,
    description,
    status: 'open',
    photos,
    createdAt: new Date().toISOString(),
    wardId: data.users.find((u) => u.id === residentId)?.wardId || null
  };

  data.complaints.push(complaint);
  saveStore(data);

  res.status(201).json({ message: 'Complaint recorded successfully', complaint });
});

app.post('/api/worker/attendance', (req, res) => {
  const data = readStore();
  const { workerId, routeId, checkIn, checkOut, gps } = req.body;

  if (!workerId || !routeId || !checkIn || !gps) {
    return res.status(400).json({ error: 'Worker attendance details are incomplete.' });
  }

  const record = {
    id: `A-${Date.now()}`,
    workerId,
    routeId,
    checkIn,
    checkOut: checkOut || null,
    gps
  };

  data.attendance.push(record);
  saveStore(data);
  res.status(201).json({ message: 'Attendance recorded successfully', record });
});

app.post('/api/disruption/create', (req, res) => {
  const data = readStore();
  const { wardId, reason, affectedHouseholds, rescheduledDate } = req.body;

  if (!wardId || !reason || !Array.isArray(affectedHouseholds) || !rescheduledDate) {
    return res.status(400).json({ error: 'Disruption record requires ward, reason, affected households, and rescheduled date.' });
  }

  const disruption = {
    id: `D-${Date.now()}`,
    wardId,
    reason,
    status: 'approved',
    affectedHouseholds,
    rescheduledDate
  };

  data.disruptions.push(disruption);
  saveStore(data);
  res.status(201).json({ message: 'Disruption approved and households rescheduled', disruption });
});

app.get('/api/monthly-report/:wardId', (req, res) => {
  const data = readStore();
  const wardId = req.params.wardId;
  const wardResidents = data.users.filter((u) => u.role === 'resident' && u.wardId === wardId);
  const wardPickups = data.pickups.filter((p) => {
    const household = data.users.find((u) => u.id === p.householdId);
    return household && household.wardId === wardId;
  });

  const report = {
    wardId,
    month: '2026-11',
    totalHouseholds: wardResidents.length,
    collected: wardPickups.length,
    missed: Math.max(0, wardResidents.length - wardPickups.length),
    generatedAt: new Date().toISOString(),
    coverage: wardResidents.length === 0 ? 0 : ((wardPickups.length / wardResidents.length) * 100).toFixed(2)
  };

  res.json(report);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Smart Waste Collection System running on http://localhost:${PORT}`);
});
