/**
 * PROJECT FAB — Application Logic (app.js)
 * Handles UI interactions, rendering, and state management.
 */

// ═══════════════════════════════════════════════════════ GLOBAL STATE
let _areas = [];
let _vehicles = [];
let _editingAreaId = null;
let _editingVehicleId = null;
let _editingCollectionId = null;
let _selectedVehicleCapacity = 0;
let _modalCallback = null;

// ═══════════════════════════════════════════════════════ STARTUP
document.addEventListener('DOMContentLoaded', () => {
    if (getToken()) {
        showApp();
    } else {
        showPage('login');
    }

    // Form submit handlers
    document.getElementById('form-login').addEventListener('submit', handleLogin);
    document.getElementById('form-register').addEventListener('submit', handleRegister);
    document.getElementById('form-area').addEventListener('submit', handleAreaSubmit);
    document.getElementById('form-vehicle').addEventListener('submit', handleVehicleSubmit);
    document.getElementById('form-collection').addEventListener('submit', handleCollectionSubmit);
});

// ═══════════════════════════════════════════════════════ PAGE ROUTING
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
}

function showApp() {
    showPage('app');
    document.getElementById('sidebar-user-name').textContent = localStorage.getItem('fab_name') || 'User';
    loadDashboard();
}

function switchModule(name, el) {
    document.querySelectorAll('.module').forEach(m => m.classList.add('hidden'));
    document.getElementById('module-' + name).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');

    // Lazy load data
    if (name === 'dashboard') loadDashboard();
    if (name === 'areas')     loadAreas();
    if (name === 'vehicles')  loadVehicles();
    if (name === 'collections') { populateCollectionDropdowns(); loadCollections(); }
    if (name === 'reports')   populateReportDropdowns();
}

// ═══════════════════════════════════════════════════════ AUTH
async function handleLogin(e) {
    e.preventDefault();
    clearFieldErrors('login');
    const email    = val('login-email');
    const password = val('login-password');
    let valid = true;
    if (!email) { showFieldError('login-email', 'Email is required'); valid = false; }
    if (!password) { showFieldError('login-password', 'Password is required'); valid = false; }
    if (!valid) return;

    setLoading('btn-login', true);
    const res = await Auth.login(email, password);
    setLoading('btn-login', false);

    if (res && res.ok) {
        setToken(res.data.token, res.data.fullName);
        hide('login-error');
        showApp();
    } else {
        show('login-error');
        document.getElementById('login-error').textContent = res?.data?.error || 'Login failed';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    clearFieldErrors('reg');
    const fullName = val('reg-name');
    const email    = val('reg-email');
    const password = val('reg-password');
    const confirm  = val('reg-confirm');
    let valid = true;

    if (!fullName) { showFieldError('reg-name', 'Full name is required'); valid = false; }
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { showFieldError('reg-email', 'Valid email is required'); valid = false; }
    if (password.length < 8) { showFieldError('reg-password', 'Min 8 characters'); valid = false; }
    if (!/[A-Z]/.test(password)) { showFieldError('reg-password', 'Must contain an uppercase letter'); valid = false; }
    if (!/[0-9]/.test(password)) { showFieldError('reg-password', 'Must contain a digit'); valid = false; }
    if (password !== confirm) { showFieldError('reg-confirm', 'Passwords do not match'); valid = false; }
    if (!valid) return;

    setLoading('btn-register', true);
    const res = await Auth.register(fullName, email, password, confirm);
    setLoading('btn-register', false);

    hide('register-error');
    if (res && res.ok) {
        show('register-success');
        document.getElementById('register-success').textContent = 'Account created! Redirecting to login…';
        document.getElementById('form-register').reset();
        setTimeout(() => { hide('register-success'); showPage('login'); }, 1800);
    } else {
        show('register-error');
        document.getElementById('register-error').textContent = res?.data?.error || 'Registration failed';
    }
}

async function logout() {
    await Auth.logout();
    clearToken();
    showPage('login');
}

// ═══════════════════════════════════════════════════════ DASHBOARD
async function loadDashboard() {
    const container = document.getElementById('dashboard-content');
    container.innerHTML = '<div class="loading-state">Loading dashboard…</div>';
    const res = await Dashboard.get();
    if (!res || !res.ok) { container.innerHTML = '<div class="alert alert-error">Failed to load dashboard.</div>'; return; }
    const d = res.data;
    const cats = d.categoryDistribution || {};

    container.innerHTML = `
      <div class="stat-grid">
        ${statCard('🏘️', d.totalAreas || 0, 'Residential Areas')}
        ${statCard('🚛', d.totalVehicles || 0, 'Registered Vehicles')}
        ${statCard('📦', d.totalActivities || 0, 'Total Activities')}
        ${statCard('⚖️', formatKg(d.totalWasteCollected || 0), 'Total Waste Collected')}
        ${statCard('✅', d.completedActivities || 0, 'Completed Activities')}
        ${statCard('⏳', (d.scheduledActivities||0)+(d.inProgressActivities||0), 'Scheduled / In Progress')}
      </div>

      <div class="insight-grid">
        ${insightCard('📈 Highest Waste Area', d.highestWasteArea || '—', d.highestWasteQty ? formatKg(d.highestWasteQty) : '')}
        ${insightCard('📉 Lowest Waste Area', d.lowestWasteArea || '—', d.lowestWasteQty ? formatKg(d.lowestWasteQty) : '')}
        ${insightCard('✔️ Completion Rate', (d.completionRate || 0) + '%', 'Of non-cancelled activities')}
        ${insightCard('❌ Cancelled', d.cancelledActivities || 0, 'Cancelled activities')}
      </div>

      <div class="card">
        <h3 style="margin-bottom:1rem">🗑️ Waste Category Distribution (Completed)</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem">
          ${Object.entries(cats).map(([cat, qty]) => `
            <div style="text-align:center;padding:1rem;background:#f8f9fa;border-radius:8px">
              <div style="font-size:1.5rem;font-weight:700">${formatKg(qty)}</div>
              <div style="font-size:0.8rem;color:#6c757d">${cat}</div>
            </div>`).join('') || '<div class="text-muted">No data</div>'}
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:1rem">📊 Activity Status Overview</h3>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem">
          ${statusBox('Completed', d.completedActivities||0, '#2ecc71')}
          ${statusBox('Scheduled', d.scheduledActivities||0, '#3498db')}
          ${statusBox('In Progress', d.inProgressActivities||0, '#f39c12')}
          ${statusBox('Cancelled', d.cancelledActivities||0, '#e74c3c')}
        </div>
        <div style="margin-top:1rem">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:0.3rem">
            <span>Collection Completion Rate</span><span>${d.completionRate||0}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${d.completionRate||0}%"></div></div>
        </div>
      </div>`;
}

function statCard(icon, value, label) {
    return `<div class="stat-card"><div class="stat-icon">${icon}</div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}
function insightCard(title, value, sub) {
    return `<div class="insight-card"><h4>${title}</h4><div class="insight-value">${value}</div><div class="insight-sub">${sub}</div></div>`;
}
function statusBox(label, count, color) {
    return `<div style="text-align:center;padding:1rem;background:#f8f9fa;border-radius:8px;border-top:4px solid ${color}">
      <div style="font-size:1.5rem;font-weight:700">${count}</div>
      <div style="font-size:0.8rem;color:#6c757d">${label}</div></div>`;
}

// ═══════════════════════════════════════════════════════ AREAS
async function loadAreas(search) {
    const container = document.getElementById('areas-table-container');
    container.innerHTML = '<div class="loading-state">Loading…</div>';
    const res = await Areas.list(search);
    if (!res || !res.ok) { container.innerHTML = '<div class="alert alert-error">Failed to load areas.</div>'; return; }
    _areas = res.data;
    if (_areas.length === 0) { container.innerHTML = '<div class="card"><div class="empty-state">No residential areas found. Click "+ Add Area" to add one.</div></div>'; return; }
    container.innerHTML = `<div class="card"><div class="table-wrapper"><table>
      <thead><tr><th>Area ID</th><th>Area Name</th><th>Location</th><th>Population</th><th>Actions</th></tr></thead>
      <tbody>${_areas.map(a => `<tr>
        <td><strong>${esc(a.areaId)}</strong></td>
        <td>${esc(a.areaName)}</td>
        <td>${esc(a.location)}</td>
        <td>${(a.population||0).toLocaleString()}</td>
        <td><div class="action-btns">
          <button class="btn btn-secondary btn-xs" onclick="editArea('${esc(a.areaId)}')">Edit</button>
          <button class="btn btn-danger btn-xs" onclick="confirmDelete('area','${esc(a.areaId)}','area ${esc(a.areaName)}')">Delete</button>
        </div></td>
      </tr>`).join('')}</tbody></table></div></div>`;
}

function searchAreas(v) { clearTimeout(window._areaTimer); window._areaTimer = setTimeout(() => loadAreas(v), 350); }

function showAreaForm(editId) {
    _editingAreaId = editId || null;
    document.getElementById('area-form-title').textContent = editId ? 'Edit Residential Area' : 'Add Residential Area';
    document.getElementById('btn-area-submit').textContent = editId ? 'Update Area' : 'Save Area';
    const idField = document.getElementById('f-area-id');
    idField.disabled = !!editId;
    if (!editId) {
        document.getElementById('form-area').reset();
        idField.disabled = false;
    }
    show('area-form-container');
    document.getElementById('f-area-id').focus();
}

async function editArea(id) {
    const res = await Areas.get(id);
    if (!res || !res.ok) { showToast('Failed to load area.', 'error'); return; }
    const a = res.data;
    document.getElementById('f-area-id').value = a.areaId;
    document.getElementById('f-area-name').value = a.areaName;
    document.getElementById('f-area-location').value = a.location;
    document.getElementById('f-area-population').value = a.population;
    showAreaForm(id);
}

function hideAreaForm() { hide('area-form-container'); _editingAreaId = null; }

async function handleAreaSubmit(e) {
    e.preventDefault();
    const data = {
        areaId: val('f-area-id'), areaName: val('f-area-name'),
        location: val('f-area-location'), population: val('f-area-population')
    };
    const res = _editingAreaId
        ? await Areas.update(_editingAreaId, data)
        : await Areas.create(data);
    if (res && res.ok) {
        showToast(_editingAreaId ? 'Area updated!' : 'Area added!', 'success');
        hideAreaForm();
        loadAreas();
    } else {
        showToast(res?.data?.error || 'Operation failed', 'error');
    }
}

async function deleteArea(id) {
    const res = await Areas.delete(id);
    if (res && res.ok) { showToast('Area deleted.', 'success'); loadAreas(); }
    else showToast(res?.data?.error || 'Delete failed', 'error');
}

// ═══════════════════════════════════════════════════════ VEHICLES
async function loadVehicles(search) {
    const container = document.getElementById('vehicles-table-container');
    container.innerHTML = '<div class="loading-state">Loading…</div>';
    const res = await Vehicles.list(search);
    if (!res || !res.ok) { container.innerHTML = '<div class="alert alert-error">Failed to load vehicles.</div>'; return; }
    _vehicles = res.data;
    if (_vehicles.length === 0) { container.innerHTML = '<div class="card"><div class="empty-state">No vehicles registered.</div></div>'; return; }
    container.innerHTML = `<div class="card"><div class="table-wrapper"><table>
      <thead><tr><th>Vehicle ID</th><th>Vehicle Type</th><th>Capacity (kg)</th><th>Actions</th></tr></thead>
      <tbody>${_vehicles.map(v => `<tr>
        <td><strong>${esc(v.vehicleId)}</strong></td>
        <td>${esc(v.vehicleType)}</td>
        <td>${(v.capacity||0).toLocaleString()} kg</td>
        <td><div class="action-btns">
          <button class="btn btn-secondary btn-xs" onclick="editVehicle('${esc(v.vehicleId)}')">Edit</button>
          <button class="btn btn-danger btn-xs" onclick="confirmDelete('vehicle','${esc(v.vehicleId)}','vehicle ${esc(v.vehicleId)}')">Delete</button>
        </div></td>
      </tr>`).join('')}</tbody></table></div></div>`;
}

function searchVehicles(v) { clearTimeout(window._vehTimer); window._vehTimer = setTimeout(() => loadVehicles(v), 350); }

function showVehicleForm(editId) {
    _editingVehicleId = editId || null;
    document.getElementById('vehicle-form-title').textContent = editId ? 'Edit Vehicle' : 'Add Vehicle';
    document.getElementById('btn-veh-submit').textContent = editId ? 'Update Vehicle' : 'Save Vehicle';
    const idField = document.getElementById('f-veh-id');
    idField.disabled = !!editId;
    if (!editId) { document.getElementById('form-vehicle').reset(); idField.disabled = false; }
    show('vehicle-form-container');
}

async function editVehicle(id) {
    const res = await Vehicles.get(id);
    if (!res || !res.ok) { showToast('Failed to load vehicle.', 'error'); return; }
    const v = res.data;
    document.getElementById('f-veh-id').value = v.vehicleId;
    document.getElementById('f-veh-type').value = v.vehicleType;
    document.getElementById('f-veh-capacity').value = v.capacity;
    showVehicleForm(id);
}

function hideVehicleForm() { hide('vehicle-form-container'); _editingVehicleId = null; }

async function handleVehicleSubmit(e) {
    e.preventDefault();
    const data = { vehicleId: val('f-veh-id'), vehicleType: val('f-veh-type'), capacity: val('f-veh-capacity') };
    const res = _editingVehicleId
        ? await Vehicles.update(_editingVehicleId, data)
        : await Vehicles.create(data);
    if (res && res.ok) {
        showToast(_editingVehicleId ? 'Vehicle updated!' : 'Vehicle added!', 'success');
        hideVehicleForm();
        loadVehicles();
    } else {
        showToast(res?.data?.error || 'Operation failed', 'error');
    }
}

async function deleteVehicle(id) {
    const res = await Vehicles.delete(id);
    if (res && res.ok) { showToast('Vehicle deleted.', 'success'); loadVehicles(); }
    else showToast(res?.data?.error || 'Delete failed', 'error');
}

// ═══════════════════════════════════════════════════════ COLLECTIONS
async function populateCollectionDropdowns() {
    const [ar, vr] = await Promise.all([Areas.list(), Vehicles.list()]);
    _areas = ar?.ok ? ar.data : [];
    _vehicles = vr?.ok ? vr.data : [];

    ['col-filter-area', 'f-col-area', 'comp-filter-area'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = `<option value="">— All Areas —</option>` +
            _areas.map(a => `<option value="${esc(a.areaId)}">${esc(a.areaId)} — ${esc(a.areaName)}</option>`).join('');
        sel.value = cur;
    });
    ['col-filter-vehicle', 'f-col-vehicle', 'comp-filter-vehicle'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = `<option value="">— All Vehicles —</option>` +
            _vehicles.map(v => `<option value="${esc(v.vehicleId)}">${esc(v.vehicleId)} — ${esc(v.vehicleType)} (${v.capacity} kg)</option>`).join('');
        sel.value = cur;
    });
}

async function loadCollections() {
    const container = document.getElementById('collections-table-container');
    container.innerHTML = '<div class="loading-state">Loading…</div>';
    const filters = {
        area:     document.getElementById('col-filter-area')?.value || '',
        vehicle:  document.getElementById('col-filter-vehicle')?.value || '',
        status:   document.getElementById('col-filter-status')?.value || '',
        dateFrom: document.getElementById('col-filter-from')?.value || '',
        dateTo:   document.getElementById('col-filter-to')?.value || '',
    };
    // Remove empty
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });
    const res = await Collections.list(filters);
    if (!res || !res.ok) { container.innerHTML = '<div class="alert alert-error">Failed to load collection records.</div>'; return; }
    const list = res.data;
    if (!list.length) { container.innerHTML = '<div class="card"><div class="empty-state">No collection activities found.</div></div>'; return; }
    container.innerHTML = `<div class="card"><div class="table-wrapper"><table>
      <thead><tr><th>Collection ID</th><th>Area</th><th>Vehicle</th><th>Date</th><th>Status</th><th>Total Waste</th><th>Actions</th></tr></thead>
      <tbody>${list.map(c => `<tr>
        <td><strong>${esc(c.collectionId)}</strong></td>
        <td>${esc(c.areaName)} <small class="text-muted">(${esc(c.areaId)})</small></td>
        <td>${esc(c.vehicleId)}</td>
        <td>${esc(c.collectionDate)}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${formatKg(c.totalWaste)}</td>
        <td><div class="action-btns">
          <button class="btn btn-secondary btn-xs" onclick="editCollection('${esc(c.collectionId)}')">Edit</button>
          <button class="btn btn-danger btn-xs" onclick="confirmDelete('collection','${esc(c.collectionId)}','activity ${esc(c.collectionId)}')">Delete</button>
        </div></td>
      </tr>`).join('')}</tbody></table></div></div>`;
}

function clearCollectionFilters() {
    ['col-filter-area','col-filter-vehicle','col-filter-status','col-filter-from','col-filter-to']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadCollections();
}

function showCollectionForm(editId) {
    _editingCollectionId = editId || null;
    document.getElementById('collection-form-title').textContent = editId ? 'Edit Collection Activity' : 'New Collection Activity';
    document.getElementById('btn-col-submit').textContent = editId ? 'Update Activity' : 'Save Activity';
    const idField = document.getElementById('f-col-id');
    idField.disabled = !!editId;
    if (!editId) {
        document.getElementById('form-collection').reset();
        idField.disabled = false;
        document.getElementById('f-col-date').value = new Date().toISOString().split('T')[0];
        hide('capacity-warning'); hide('total-waste-display');
        hide('vehicle-capacity-info');
    }
    show('collection-form-container');
    populateCollectionDropdowns();
}

async function editCollection(id) {
    const [actRes, wasteRes] = await Promise.all([Collections.get(id), Collections.getWaste(id)]);
    if (!actRes || !actRes.ok) { showToast('Failed to load collection.', 'error'); return; }
    const a = actRes.data;
    document.getElementById('f-col-id').value = a.collectionId;
    document.getElementById('f-col-date').value = a.collectionDate;
    document.getElementById('f-col-status').value = a.status;
    showCollectionForm(id);
    // Set area/vehicle after dropdowns populate
    setTimeout(() => {
        document.getElementById('f-col-area').value = a.areaId;
        document.getElementById('f-col-vehicle').value = a.vehicleId;
        onVehicleChange();
        // Populate waste fields
        if (wasteRes && wasteRes.ok) {
            wasteRes.data.forEach(r => {
                if (r.wasteCategory === 'Biodegradable')  document.getElementById('f-bio').value = r.quantity;
                if (r.wasteCategory === 'Recyclable')     document.getElementById('f-rec').value = r.quantity;
                if (r.wasteCategory === 'Non-recyclable') document.getElementById('f-nonrec').value = r.quantity;
            });
            checkVehicleCapacity();
        }
    }, 400);
}

function hideCollectionForm() { hide('collection-form-container'); _editingCollectionId = null; }

function onVehicleChange() {
    const selVeh = document.getElementById('f-col-vehicle').value;
    const veh = _vehicles.find(v => v.vehicleId === selVeh);
    _selectedVehicleCapacity = veh ? veh.capacity : 0;
    if (veh) {
        show('vehicle-capacity-info');
        document.getElementById('vehicle-capacity-info').textContent = `Vehicle capacity: ${veh.capacity.toLocaleString()} kg`;
    } else {
        hide('vehicle-capacity-info');
    }
    checkVehicleCapacity();
}

function checkVehicleCapacity() {
    const bio    = parseFloat(document.getElementById('f-bio').value) || 0;
    const rec    = parseFloat(document.getElementById('f-rec').value) || 0;
    const nonrec = parseFloat(document.getElementById('f-nonrec').value) || 0;
    const total  = bio + rec + nonrec;
    const warn   = document.getElementById('capacity-warning');
    const totalEl = document.getElementById('total-waste-display');
    if (total > 0) {
        show('total-waste-display');
        totalEl.textContent = `Total waste: ${total.toLocaleString()} kg`;
    } else { hide('total-waste-display'); }
    if (_selectedVehicleCapacity > 0 && total > _selectedVehicleCapacity) {
        show('capacity-warning');
        warn.textContent = `⚠ Total (${total} kg) exceeds vehicle capacity (${_selectedVehicleCapacity} kg)`;
    } else { hide('capacity-warning'); }
}

async function handleCollectionSubmit(e) {
    e.preventDefault();
    const bio    = parseFloat(document.getElementById('f-bio').value) || 0;
    const rec    = parseFloat(document.getElementById('f-rec').value) || 0;
    const nonrec = parseFloat(document.getElementById('f-nonrec').value) || 0;
    const wasteRecords = [];
    if (bio > 0)    wasteRecords.push({ wasteCategory: 'Biodegradable',  quantity: bio });
    if (rec > 0)    wasteRecords.push({ wasteCategory: 'Recyclable',     quantity: rec });
    if (nonrec > 0) wasteRecords.push({ wasteCategory: 'Non-recyclable', quantity: nonrec });

    const data = {
        collectionId:   val('f-col-id'),
        areaId:         val('f-col-area'),
        vehicleId:      val('f-col-vehicle'),
        collectionDate: val('f-col-date'),
        status:         val('f-col-status'),
        wasteRecords
    };

    const res = _editingCollectionId
        ? await Collections.update(_editingCollectionId, data)
        : await Collections.create(data);

    if (res && res.ok) {
        showToast(_editingCollectionId ? 'Activity updated!' : 'Activity created!', 'success');
        hideCollectionForm();
        loadCollections();
        // Refresh dashboard stats
    } else {
        showToast(res?.data?.error || 'Operation failed', 'error');
    }
}

async function deleteCollection(id) {
    const res = await Collections.delete(id);
    if (res && res.ok) { showToast('Activity deleted.', 'success'); loadCollections(); }
    else showToast(res?.data?.error || 'Delete failed', 'error');
}

// ═══════════════════════════════════════════════════════ REPORTS
function switchReportTab(name, el) {
    document.querySelectorAll('.report-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('report-' + name).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
}

async function populateReportDropdowns() {
    await populateCollectionDropdowns();
}

async function loadAreaReport() {
    const container = document.getElementById('area-report-content');
    container.innerHTML = '<div class="loading-state">Generating…</div>';
    const res = await Reports.area();
    if (!res || !res.ok) { container.innerHTML = '<div class="alert alert-error">Failed.</div>'; return; }
    const rows = res.data;
    if (!rows.length) { container.innerHTML = '<div class="empty-state">No data available.</div>'; return; }
    const totalWaste = rows.reduce((s,r) => s + (r.totalWaste||0), 0);
    container.innerHTML = `
      <p class="text-muted" style="margin-bottom:1rem">Only <strong>Completed</strong> activities are included in waste totals.</p>
      <div class="table-wrapper"><table>
      <thead><tr><th>Area ID</th><th>Area Name</th><th>Population</th><th>Biodegradable</th><th>Recyclable</th><th>Non-recyclable</th><th>Total Waste</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${esc(r.areaId)}</td><td>${esc(r.areaName)}</td><td>${(r.population||0).toLocaleString()}</td>
        <td>${formatKg(r.biodegradable)}</td><td>${formatKg(r.recyclable)}</td><td>${formatKg(r.nonRecyclable)}</td>
        <td><strong>${formatKg(r.totalWaste)}</strong></td>
      </tr>`).join('')}
      <tr style="background:#f0fdf4;font-weight:700"><td colspan="6">Grand Total</td><td>${formatKg(totalWaste)}</td></tr>
      </tbody></table></div>`;
}

async function loadVehicleReport() {
    const container = document.getElementById('vehicle-report-content');
    container.innerHTML = '<div class="loading-state">Generating…</div>';
    const res = await Reports.vehicle();
    if (!res || !res.ok) { container.innerHTML = '<div class="alert alert-error">Failed.</div>'; return; }
    const rows = res.data;
    if (!rows.length) { container.innerHTML = '<div class="empty-state">No data available.</div>'; return; }
    container.innerHTML = `
      <p class="text-muted" style="margin-bottom:1rem">Utilization = (Waste Collected / Vehicle Capacity) × 100. Only Completed activities.</p>
      <div class="table-wrapper"><table>
      <thead><tr><th>Vehicle ID</th><th>Type</th><th>Capacity (kg)</th><th>Completed Trips</th><th>Total Waste</th><th>Avg Utilization</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${esc(r.vehicleId)}</td><td>${esc(r.vehicleType)}</td>
        <td>${(r.capacity||0).toLocaleString()} kg</td>
        <td>${r.completedTrips||0}</td>
        <td>${formatKg(r.totalWaste)}</td>
        <td><div style="display:flex;align-items:center;gap:0.5rem">
          <div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:${Math.min(100,r.avgUtilizationPct||0)}%"></div></div>
          ${(r.avgUtilizationPct||0).toFixed(1)}%
        </div></td>
      </tr>`).join('')}</tbody></table></div>`;
}

async function loadCompletionReport() {
    const container = document.getElementById('completion-report-content');
    container.innerHTML = '<div class="loading-state">Generating…</div>';
    const filters = {
        area:     document.getElementById('comp-filter-area')?.value || '',
        vehicle:  document.getElementById('comp-filter-vehicle')?.value || '',
        dateFrom: document.getElementById('comp-from')?.value || '',
        dateTo:   document.getElementById('comp-to')?.value || '',
    };
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });
    const res = await Reports.completion(filters);
    if (!res || !res.ok) { container.innerHTML = '<div class="alert alert-error">Failed.</div>'; return; }
    const { records, summary } = res.data;
    const s = summary;
    container.innerHTML = `
      <div class="summary-boxes">
        ${summaryBox(s.completed||0, 'Completed', '#2ecc71')}
        ${summaryBox(s.scheduled||0, 'Scheduled', '#3498db')}
        ${summaryBox(s.inProgress||0, 'In Progress', '#f39c12')}
        ${summaryBox(s.cancelled||0, 'Cancelled', '#e74c3c')}
      </div>
      <div style="margin-bottom:1rem">
        <strong>Completion Rate: ${(s.completionPct||0).toFixed(1)}%</strong>
        <small class="text-muted"> (${s.completed||0} of ${s.completed+s.scheduled+s.inProgress||0} non-cancelled activities)</small>
      </div>
      ${records.length ? `<div class="table-wrapper"><table>
      <thead><tr><th>Collection ID</th><th>Area</th><th>Vehicle</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>${records.map(r => `<tr>
        <td>${esc(r.collectionId)}</td><td>${esc(r.areaName)}</td>
        <td>${esc(r.vehicleId)}</td><td>${esc(r.collectionDate)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No matching records.</div>'}`;
}

async function loadDateWiseReport() {
    const container = document.getElementById('datewise-report-content');
    container.innerHTML = '<div class="loading-state">Generating…</div>';
    const filters = {
        period:   document.getElementById('dw-period')?.value || 'monthly',
        dateFrom: document.getElementById('dw-from')?.value || '',
        dateTo:   document.getElementById('dw-to')?.value || '',
    };
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });
    const res = await Reports.datewise(filters);
    if (!res || !res.ok) { container.innerHTML = '<div class="alert alert-error">Failed.</div>'; return; }
    const rows = res.data;
    if (!rows.length) { container.innerHTML = '<div class="empty-state">No completed collection data for the selected period.</div>'; return; }
    const totalWaste = rows.reduce((s,r) => s + (r.totalWaste||0), 0);
    container.innerHTML = `
      <p class="text-muted" style="margin-bottom:1rem">Only Completed activities. Period: <strong>${filters.period||'monthly'}</strong></p>
      <div class="table-wrapper"><table>
      <thead><tr><th>Period</th><th>Activities</th><th>Total Waste Collected</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${esc(String(r.period))}</td><td>${r.activities||0}</td><td>${formatKg(r.totalWaste)}</td>
      </tr>`).join('')}
      <tr style="background:#f0fdf4;font-weight:700"><td colspan="2">Total</td><td>${formatKg(totalWaste)}</td></tr>
      </tbody></table></div>`;
}

function summaryBox(value, label, color) {
    return `<div class="summary-box"><div class="summary-box-value" style="color:${color}">${value}</div><div class="summary-box-label">${label}</div></div>`;
}

// ═══════════════════════════════════════════════════════ ANALYSIS
async function runAnalysis() {
    const status = document.getElementById('analysis-status');
    const content = document.getElementById('analysis-content');
    show('analysis-status');
    status.className = 'alert alert-info';
    status.textContent = '⏳ Running Python analysis… retrieving database records, cleaning data, generating charts. Please wait.';
    content.innerHTML = '';

    const res = await Analysis.run();
    hide('analysis-status');

    if (!res || !res.ok) {
        content.innerHTML = `<div class="alert alert-error">Analysis failed: ${esc(res?.data?.error || 'Unknown error')}<br><small>${esc(res?.data?.details || '')}</small></div>`;
        return;
    }

    const d = res.data;
    if (d.status === 'error') {
        content.innerHTML = `<div class="alert alert-error">Python error: ${esc(d.error)}</div>`;
        return;
    }

    const charts = d.charts || {};
    const stats  = d.descriptiveStats || {};
    const cleaning = d.cleaningReport || {};
    const insights = d.insights || [];
    const summary = d.summary || {};

    content.innerHTML = `
      <!-- Summary -->
      <div class="card">
        <h3>📋 Data Summary</h3>
        <div class="stat-grid" style="margin-top:1rem">
          ${statCard('🏘️', summary.totalAreas||0, 'Areas')}
          ${statCard('🚛', summary.totalVehicles||0, 'Vehicles')}
          ${statCard('📦', summary.totalActivities||0, 'Activities')}
          ${statCard('📝', summary.totalRecords||0, 'Waste Records')}
        </div>
      </div>

      <!-- Data Quality -->
      <div class="card">
        <h3>🧹 Data Cleaning Report</h3>
        <p class="text-muted" style="margin-bottom:1rem">Analysis only — original records not modified.</p>
        <div class="cleaning-grid">
          ${Object.entries(cleaning).map(([k, v]) => `
            <div class="cleaning-item">
              <div class="cleaning-label">${formatCleanKey(k)}</div>
              <div class="cleaning-value ${v===0?'ok':'warn'}">${v}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Insights -->
      ${insights.length ? `<div class="card"><h3>💡 Analytical Insights</h3><ul class="insights-list">${insights.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>` : ''}

      <!-- Charts -->
      <div class="chart-grid">
        ${chartCard('chart_area_waste.png',  '1. Area-wise Recorded Waste Collection', charts.areaWaste)}
        ${chartCard('chart_category_pie.png','2. Waste Category Distribution',         charts.categoryPie)}
        ${chartCard('chart_vehicle_util.png','3. Vehicle Utilization (%)',              charts.vehicleUtil)}
        ${chartCard('chart_status.png',      '4. Collection Status Distribution',      charts.statusDist)}
        ${chartCard('chart_trend.png',       '5. Monthly Waste Collection Trend',      charts.trend)}
        ${chartCard('chart_scatter.png',     '6. Population vs Recorded Waste',        charts.scatter)}
        ${chartCard('chart_histogram.png',   '7. Waste Quantity Distribution',         charts.histogram)}
      </div>

      <!-- Descriptive Stats -->
      ${renderDescStats(stats)}`;
}

function chartCard(file, title, chartData) {
    if (!chartData || !chartData.file) {
        const note = chartData?.data?.note || 'Insufficient data';
        return `<div class="chart-card"><h3>${esc(title)}</h3><div class="empty-state">${esc(note)}</div></div>`;
    }
    const token = getToken();
    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
    return `<div class="chart-card"><h3>${esc(title)}</h3>
      <img src="/api/charts/${esc(file)}?t=${Date.now()}${tokenQuery}" alt="${esc(title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <div class="empty-state hidden">Chart image not available.</div>
    </div>`;
}

function renderDescStats(stats) {
    if (!stats || typeof stats !== 'object' || stats.note) return '';
    const overall = stats.overall || {};
    const rows = Object.entries(stats).filter(([k]) => k !== 'overall');
    return `<div class="card"><h3>📐 Descriptive Statistics (Completed Activities)</h3>
      <p class="text-muted" style="margin-bottom:1rem">Total waste collected: <strong>${formatKg(overall.total_waste_kg||0)}</strong> across <strong>${overall.total_collections||0}</strong> trips (avg ${formatKg(overall.mean_per_collection||0)}/trip)</p>
      <div class="table-wrapper"><table class="stat-table">
        <thead><tr><th>Category</th><th>Count</th><th>Mean</th><th>Std Dev</th><th>Min</th><th>Max</th></tr></thead>
        <tbody>${rows.map(([cat, s]) => `<tr>
          <td>${esc(cat)}</td><td>${s.count||0}</td>
          <td>${formatKg(s.mean||0)}</td><td>${formatKg(s.std||0)}</td>
          <td>${formatKg(s.min||0)}</td><td>${formatKg(s.max||0)}</td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
}

function formatCleanKey(k) {
    return k.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ═══════════════════════════════════════════════════════ MODAL / DELETE
function confirmDelete(type, id, label) {
    document.getElementById('modal-title').textContent = 'Confirm Delete';
    document.getElementById('modal-message').textContent = `Delete ${label}? This cannot be undone.`;
    document.getElementById('modal-confirm-btn').onclick = async () => {
        closeModal();
        if (type === 'area') await deleteArea(id);
        else if (type === 'vehicle') await deleteVehicle(id);
        else if (type === 'collection') await deleteCollection(id);
    };
    show('modal-confirm');
}

function closeModal() { hide('modal-confirm'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ═══════════════════════════════════════════════════════ TOAST
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// ═══════════════════════════════════════════════════════ HELPERS
function val(id) { return (document.getElementById(id)?.value || '').trim(); }
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatKg(v) { return (Number(v)||0).toLocaleString() + ' kg'; }
function statusBadge(s) {
    const cls = { 'Completed':'completed','Scheduled':'scheduled','In Progress':'inprogress','Cancelled':'cancelled' };
    return `<span class="badge badge-${cls[s]||'scheduled'}">${esc(s)}</span>`;
}
function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.querySelector('.btn-text')?.classList.toggle('hidden', loading);
    btn.querySelector('.btn-loader')?.classList.toggle('hidden', !loading);
}
function showFieldError(id, msg) {
    document.getElementById(id)?.classList.add('error');
    const err = document.getElementById('err-' + id);
    if (err) err.textContent = msg;
}
function clearFieldErrors(prefix) {
    document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
    document.querySelectorAll('input.error').forEach(e => e.classList.remove('error'));
}
