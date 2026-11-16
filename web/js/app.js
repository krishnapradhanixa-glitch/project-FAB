/**
 * PROJECT FAB — Application Logic (app.js)
 * Production UI controller, event listeners, live validation, and data binding.
 */

// ═══════════════════════════════════════════════════════ GLOBAL STATE
let _areas = [];
let _vehicles = [];
let _editingAreaId = null;
let _editingVehicleId = null;
let _editingCollectionId = null;
let _selectedVehicleCapacity = 0;
let _modalCallback = null;

// ═══════════════════════════════════════════════════════ STARTUP & AUTH CHECK
document.addEventListener('DOMContentLoaded', () => {
    // Check if session token exists
    const token = getToken();
    if (token) {
        showApp();
    } else {
        showPage('login');
    }

    // Form submit handlers
    const loginForm = document.getElementById('form-login');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const regForm = document.getElementById('form-register');
    if (regForm) regForm.addEventListener('submit', handleRegister);

    const areaForm = document.getElementById('form-area');
    if (areaForm) areaForm.addEventListener('submit', handleAreaSubmit);

    const vehForm = document.getElementById('form-vehicle');
    if (vehForm) vehForm.addEventListener('submit', handleVehicleSubmit);

    const colForm = document.getElementById('form-collection');
    if (colForm) colForm.addEventListener('submit', handleCollectionSubmit);
});

// ═══════════════════════════════════════════════════════ PAGE & MODULE ROUTING
function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + name);
    if (target) {
        target.classList.add('active');
    }
}

function showApp() {
    showPage('app');
    const userLabel = document.getElementById('sidebar-user-name');
    if (userLabel) userLabel.textContent = localStorage.getItem('fab_name') || 'User';
    // Load dashboard upon entering
    loadDashboard();
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.toggle('open');
}

function switchModule(name, el) {
    // Hide mobile sidebar if open
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('open');

    // Toggle modules
    document.querySelectorAll('.module').forEach(m => m.classList.add('hidden'));
    const activeModule = document.getElementById('module-' + name);
    if (activeModule) activeModule.classList.remove('hidden');

    // Update active nav styling
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');

    // Load data for active module
    if (name === 'dashboard') loadDashboard();
    if (name === 'areas') loadAreas();
    if (name === 'vehicles') loadVehicles();
    if (name === 'collections') {
        populateCollectionDropdowns();
        loadCollections();
    }
    if (name === 'reports') {
        populateReportDropdowns();
        loadAreaReport(); // Auto-load first report tab
    }
}

// ═══════════════════════════════════════════════════════ AUTHENTICATION
async function handleLogin(e) {
    e.preventDefault();
    clearFieldErrors('login');
    const email = val('login-email');
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
        document.getElementById('login-error').textContent = res?.data?.error || 'Invalid email or password.';
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
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { showFieldError('reg-email', 'Valid email address is required'); valid = false; }
    if (password.length < 8) { showFieldError('reg-password', 'Minimum 8 characters'); valid = false; }
    if (!/[A-Z]/.test(password)) { showFieldError('reg-password', 'Must contain at least 1 uppercase letter'); valid = false; }
    if (!/[0-9]/.test(password)) { showFieldError('reg-password', 'Must contain at least 1 digit'); valid = false; }
    if (password !== confirm) { showFieldError('reg-confirm', 'Passwords do not match'); valid = false; }
    if (!valid) return;

    setLoading('btn-register', true);
    const res = await Auth.register(fullName, email, password, confirm);
    setLoading('btn-register', false);

    hide('register-error');
    if (res && res.ok) {
        show('register-success');
        document.getElementById('register-success').textContent = 'Account created successfully! Redirecting to login…';
        document.getElementById('form-register').reset();
        setTimeout(() => {
            hide('register-success');
            showPage('login');
        }, 1500);
    } else {
        show('register-error');
        document.getElementById('register-error').textContent = res?.data?.error || 'Registration failed.';
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
    container.innerHTML = '<div class="loading-state"><span>⏳</span> Loading dashboard metrics…</div>';
    
    const res = await Dashboard.get();
    if (!res || !res.ok) {
        container.innerHTML = '<div class="alert alert-error">Unable to load dashboard. Please verify database connection.</div>';
        return;
    }
    const d = res.data;
    const cats = d.categoryDistribution || {};

    container.innerHTML = `
      <div class="stat-grid">
        ${statCard('🏘️', d.totalAreas || 0, 'Residential Areas')}
        ${statCard('🚛', d.totalVehicles || 0, 'Fleet Vehicles')}
        ${statCard('📦', d.totalActivities || 0, 'Total Trips')}
        ${statCard('⚖️', formatKg(d.totalWasteCollected || 0), 'Total Waste Collected')}
        ${statCard('✅', d.completedActivities || 0, 'Completed Activities')}
        ${statCard('⏳', (d.scheduledActivities || 0) + (d.inProgressActivities || 0), 'Pending / In Progress')}
      </div>

      <div class="insight-grid">
        ${insightCard('📈 Highest Waste Area', d.highestWasteArea || '—', d.highestWasteQty ? formatKg(d.highestWasteQty) + ' recorded' : '')}
        ${insightCard('📉 Lowest Waste Area', d.lowestWasteArea || '—', d.lowestWasteQty ? formatKg(d.lowestWasteQty) + ' recorded' : '')}
        ${insightCard('✔️ Completion Rate', (d.completionRate || 0) + '%', 'Of all non-cancelled activities')}
        ${insightCard('❌ Cancelled Activities', d.cancelledActivities || 0, 'Excluded from waste totals')}
      </div>

      <div class="card">
        <h3 style="margin-bottom:1.25rem;">🗑️ Waste Category Distribution (Completed Collections)</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1.25rem;">
          ${Object.entries(cats).map(([cat, qty]) => `
            <div style="text-align:center; padding:1.25rem; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
              <div style="font-size:1.75rem; font-weight:800; color:var(--dark);">${formatKg(qty)}</div>
              <div style="font-size:0.85rem; color:#64748b; font-weight:600; margin-top:0.25rem;">${cat}</div>
            </div>`).join('') || '<div class="text-muted">No completed collection records found.</div>'}
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:1.25rem;">📊 Activity Status Summary</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:1rem;">
          ${statusBox('Completed', d.completedActivities || 0, '#2ecc71')}
          ${statusBox('Scheduled', d.scheduledActivities || 0, '#3498db')}
          ${statusBox('In Progress', d.inProgressActivities || 0, '#f39c12')}
          ${statusBox('Cancelled', d.cancelledActivities || 0, '#e74c3c')}
        </div>
        <div style="margin-top:1.5rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:0.4rem; font-weight:600;">
            <span>Overall Collection Completion Progress</span>
            <span>${d.completionRate || 0}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${d.completionRate || 0}%"></div></div>
        </div>
      </div>`;
}

function statCard(icon, value, label) {
    return `<div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>`;
}

function insightCard(title, value, sub) {
    return `<div class="insight-card">
      <h4>${title}</h4>
      <div class="insight-value">${value}</div>
      <div class="insight-sub">${sub}</div>
    </div>`;
}

function statusBox(label, count, color) {
    return `<div style="text-align:center; padding:1.25rem 1rem; background:#f8fafc; border-radius:8px; border-top:4px solid ${color}; border:1px solid #e2e8f0;">
      <div style="font-size:1.75rem; font-weight:800; color:var(--dark);">${count}</div>
      <div style="font-size:0.82rem; color:#64748b; font-weight:600; text-transform:uppercase; margin-top:0.25rem;">${label}</div>
    </div>`;
}

// ═══════════════════════════════════════════════════════ RESIDENTIAL AREAS
async function loadAreas(search) {
    const container = document.getElementById('areas-table-container');
    container.innerHTML = '<div class="loading-state"><span>⏳</span> Loading residential areas…</div>';
    
    const res = await Areas.list(search);
    if (!res || !res.ok) {
        container.innerHTML = '<div class="alert alert-error">Failed to load residential areas.</div>';
        return;
    }
    _areas = res.data;
    if (_areas.length === 0) {
        container.innerHTML = '<div class="card"><div class="empty-state">No residential areas found. Click "+ Add New Area" to register one.</div></div>';
        return;
    }
    container.innerHTML = `<div class="card"><div class="table-wrapper"><table>
      <thead>
        <tr><th>Area ID</th><th>Area Name</th><th>Location</th><th>Population</th><th>Actions</th></tr>
      </thead>
      <tbody>${_areas.map(a => `<tr>
        <td><strong>${esc(a.areaId)}</strong></td>
        <td>${esc(a.areaName)}</td>
        <td>${esc(a.location)}</td>
        <td>${(a.population || 0).toLocaleString()}</td>
        <td><div class="action-btns">
          <button class="btn btn-secondary btn-xs" onclick="editArea('${esc(a.areaId)}')">Edit</button>
          <button class="btn btn-danger btn-xs" onclick="confirmDelete('area','${esc(a.areaId)}','Area ${esc(a.areaName)}')">Delete</button>
        </div></td>
      </tr>`).join('')}</tbody></table></div></div>`;
}

function searchAreas(v) {
    clearTimeout(window._areaTimer);
    window._areaTimer = setTimeout(() => loadAreas(v), 300);
}

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
    if (!res || !res.ok) { showToast('Failed to load area details.', 'error'); return; }
    const a = res.data;
    document.getElementById('f-area-id').value = a.areaId;
    document.getElementById('f-area-name').value = a.areaName;
    document.getElementById('f-area-location').value = a.location;
    document.getElementById('f-area-population').value = a.population;
    showAreaForm(id);
}

function hideAreaForm() {
    hide('area-form-container');
    _editingAreaId = null;
}

async function handleAreaSubmit(e) {
    e.preventDefault();
    const data = {
        areaId: val('f-area-id'),
        areaName: val('f-area-name'),
        location: val('f-area-location'),
        population: val('f-area-population')
    };
    const res = _editingAreaId
        ? await Areas.update(_editingAreaId, data)
        : await Areas.create(data);

    if (res && res.ok) {
        showToast(_editingAreaId ? 'Area updated successfully!' : 'Area added successfully!', 'success');
        hideAreaForm();
        loadAreas();
    } else {
        showToast(res?.data?.error || 'Operation failed', 'error');
    }
}

async function deleteArea(id) {
    const res = await Areas.delete(id);
    if (res && res.ok) {
        showToast('Area deleted successfully.', 'success');
        loadAreas();
    } else {
        showToast(res?.data?.error || 'Cannot delete area.', 'error');
    }
}

// ═══════════════════════════════════════════════════════ VEHICLES
async function loadVehicles(search) {
    const container = document.getElementById('vehicles-table-container');
    container.innerHTML = '<div class="loading-state"><span>⏳</span> Loading collection vehicles…</div>';
    
    const res = await Vehicles.list(search);
    if (!res || !res.ok) {
        container.innerHTML = '<div class="alert alert-error">Failed to load vehicles.</div>';
        return;
    }
    _vehicles = res.data;
    if (_vehicles.length === 0) {
        container.innerHTML = '<div class="card"><div class="empty-state">No vehicles found. Click "+ Add New Vehicle" to add one.</div></div>';
        return;
    }
    container.innerHTML = `<div class="card"><div class="table-wrapper"><table>
      <thead>
        <tr><th>Vehicle ID</th><th>Vehicle Type</th><th>Payload Capacity (kg)</th><th>Actions</th></tr>
      </thead>
      <tbody>${_vehicles.map(v => `<tr>
        <td><strong>${esc(v.vehicleId)}</strong></td>
        <td>${esc(v.vehicleType)}</td>
        <td>${(v.capacity || 0).toLocaleString()} kg</td>
        <td><div class="action-btns">
          <button class="btn btn-secondary btn-xs" onclick="editVehicle('${esc(v.vehicleId)}')">Edit</button>
          <button class="btn btn-danger btn-xs" onclick="confirmDelete('vehicle','${esc(v.vehicleId)}','Vehicle ${esc(v.vehicleId)}')">Delete</button>
        </div></td>
      </tr>`).join('')}</tbody></table></div></div>`;
}

function searchVehicles(v) {
    clearTimeout(window._vehTimer);
    window._vehTimer = setTimeout(() => loadVehicles(v), 300);
}

function showVehicleForm(editId) {
    _editingVehicleId = editId || null;
    document.getElementById('vehicle-form-title').textContent = editId ? 'Edit Fleet Vehicle' : 'Add Fleet Vehicle';
    document.getElementById('btn-veh-submit').textContent = editId ? 'Update Vehicle' : 'Save Vehicle';
    const idField = document.getElementById('f-veh-id');
    idField.disabled = !!editId;
    if (!editId) {
        document.getElementById('form-vehicle').reset();
        idField.disabled = false;
    }
    show('vehicle-form-container');
    document.getElementById('f-veh-id').focus();
}

async function editVehicle(id) {
    const res = await Vehicles.get(id);
    if (!res || !res.ok) { showToast('Failed to load vehicle details.', 'error'); return; }
    const v = res.data;
    document.getElementById('f-veh-id').value = v.vehicleId;
    document.getElementById('f-veh-type').value = v.vehicleType;
    document.getElementById('f-veh-capacity').value = v.capacity;
    showVehicleForm(id);
}

function hideVehicleForm() {
    hide('vehicle-form-container');
    _editingVehicleId = null;
}

async function handleVehicleSubmit(e) {
    e.preventDefault();
    const data = {
        vehicleId: val('f-veh-id'),
        vehicleType: val('f-veh-type'),
        capacity: val('f-veh-capacity')
    };
    const res = _editingVehicleId
        ? await Vehicles.update(_editingVehicleId, data)
        : await Vehicles.create(data);

    if (res && res.ok) {
        showToast(_editingVehicleId ? 'Vehicle updated successfully!' : 'Vehicle added successfully!', 'success');
        hideVehicleForm();
        loadVehicles();
    } else {
        showToast(res?.data?.error || 'Operation failed', 'error');
    }
}

async function deleteVehicle(id) {
    const res = await Vehicles.delete(id);
    if (res && res.ok) {
        showToast('Vehicle deleted successfully.', 'success');
        loadVehicles();
    } else {
        showToast(res?.data?.error || 'Cannot delete vehicle.', 'error');
    }
}

// ═══════════════════════════════════════════════════════ COLLECTION RECORDS
async function populateCollectionDropdowns() {
    const [ar, vr] = await Promise.all([Areas.list(), Vehicles.list()]);
    _areas = ar?.ok ? ar.data : [];
    _vehicles = vr?.ok ? vr.data : [];

    ['col-filter-area', 'f-col-area', 'comp-filter-area'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = `<option value="">— All Residential Areas —</option>` +
            _areas.map(a => `<option value="${esc(a.areaId)}">${esc(a.areaId)} — ${esc(a.areaName)}</option>`).join('');
        sel.value = cur;
    });

    ['col-filter-vehicle', 'f-col-vehicle', 'comp-filter-vehicle'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = `<option value="">— All Fleet Vehicles —</option>` +
            _vehicles.map(v => `<option value="${esc(v.vehicleId)}">${esc(v.vehicleId)} — ${esc(v.vehicleType)} (${v.capacity} kg)</option>`).join('');
        sel.value = cur;
    });
}

async function loadCollections() {
    const container = document.getElementById('collections-table-container');
    container.innerHTML = '<div class="loading-state"><span>⏳</span> Loading collection activities…</div>';
    
    const filters = {
        area:     document.getElementById('col-filter-area')?.value || '',
        vehicle:  document.getElementById('col-filter-vehicle')?.value || '',
        status:   document.getElementById('col-filter-status')?.value || '',
        dateFrom: document.getElementById('col-filter-from')?.value || '',
        dateTo:   document.getElementById('col-filter-to')?.value || '',
    };
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });
    
    const res = await Collections.list(filters);
    if (!res || !res.ok) {
        container.innerHTML = '<div class="alert alert-error">Failed to load collection records.</div>';
        return;
    }
    const list = res.data;
    if (!list.length) {
        const filterApplied = Object.keys(filters).length > 0;
        container.innerHTML = `<div class="card"><div class="empty-state">
          ${filterApplied ? 'No collection activities match the selected filter criteria.<br><button class="btn btn-outline btn-sm" style="margin-top:0.75rem;" onclick="clearCollectionFilters()">Clear Filters</button>' : 'No collection activities found. Click "+ New Activity" to record a collection.'}
        </div></div>`;
        return;
    }

    container.innerHTML = `<div class="card"><div class="table-wrapper"><table>
      <thead>
        <tr><th>Collection ID</th><th>Area Name</th><th>Vehicle</th><th>Collection Date</th><th>Status</th><th>Total Waste</th><th>Actions</th></tr>
      </thead>
      <tbody>${list.map(c => `<tr>
        <td><strong>${esc(c.collectionId)}</strong></td>
        <td>${esc(c.areaName)} <span class="text-muted">(${esc(c.areaId)})</span></td>
        <td>${esc(c.vehicleId)}</td>
        <td>${esc(c.collectionDate)}</td>
        <td>${statusBadge(c.status)}</td>
        <td><strong>${formatKg(c.totalWaste)}</strong></td>
        <td><div class="action-btns">
          <button class="btn btn-secondary btn-xs" onclick="editCollection('${esc(c.collectionId)}')">Edit</button>
          <button class="btn btn-danger btn-xs" onclick="confirmDelete('collection','${esc(c.collectionId)}','Activity ${esc(c.collectionId)}')">Delete</button>
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
    document.getElementById('btn-col-submit').textContent = editId ? 'Update Activity' : 'Save Collection Activity';
    const idField = document.getElementById('f-col-id');
    idField.disabled = !!editId;

    if (!editId) {
        document.getElementById('form-collection').reset();
        idField.disabled = false;
        document.getElementById('f-col-date').value = new Date().toISOString().split('T')[0];
        hide('capacity-warning');
        hide('total-waste-display');
        hide('vehicle-capacity-info');
    }
    show('collection-form-container');
    populateCollectionDropdowns();
}

async function editCollection(id) {
    const [actRes, wasteRes] = await Promise.all([Collections.get(id), Collections.getWaste(id)]);
    if (!actRes || !actRes.ok) { showToast('Failed to load collection details.', 'error'); return; }
    const a = actRes.data;
    document.getElementById('f-col-id').value = a.collectionId;
    document.getElementById('f-col-date').value = a.collectionDate;
    document.getElementById('f-col-status').value = a.status;
    showCollectionForm(id);

    setTimeout(() => {
        document.getElementById('f-col-area').value = a.areaId;
        document.getElementById('f-col-vehicle').value = a.vehicleId;
        onVehicleChange();

        if (wasteRes && wasteRes.ok) {
            wasteRes.data.forEach(r => {
                if (r.wasteCategory === 'Biodegradable')  document.getElementById('f-bio').value = r.quantity;
                if (r.wasteCategory === 'Recyclable')     document.getElementById('f-rec').value = r.quantity;
                if (r.wasteCategory === 'Non-recyclable') document.getElementById('f-nonrec').value = r.quantity;
            });
            checkVehicleCapacity();
        }
    }, 300);
}

function hideCollectionForm() {
    hide('collection-form-container');
    _editingCollectionId = null;
}

function onVehicleChange() {
    const selVeh = document.getElementById('f-col-vehicle').value;
    const veh = _vehicles.find(v => v.vehicleId === selVeh);
    _selectedVehicleCapacity = veh ? veh.capacity : 0;
    if (veh) {
        show('vehicle-capacity-info');
        document.getElementById('vehicle-capacity-info').textContent = `Assigned Vehicle Capacity: ${veh.capacity.toLocaleString()} kg (${veh.vehicleType})`;
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
        totalEl.textContent = `Total Entered Waste: ${total.toLocaleString()} kg`;
    } else {
        hide('total-waste-display');
    }

    if (_selectedVehicleCapacity > 0 && total > _selectedVehicleCapacity) {
        show('capacity-warning');
        warn.textContent = `⚠ Overflow Error: Total waste (${total} kg) exceeds vehicle payload capacity (${_selectedVehicleCapacity} kg).`;
    } else {
        hide('capacity-warning');
    }
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
        showToast(_editingCollectionId ? 'Collection activity updated!' : 'Collection activity recorded successfully!', 'success');
        hideCollectionForm();
        loadCollections();
    } else {
        showToast(res?.data?.error || 'Operation failed', 'error');
    }
}

async function deleteCollection(id) {
    const res = await Collections.delete(id);
    if (res && res.ok) {
        showToast('Activity deleted successfully.', 'success');
        loadCollections();
    } else {
        showToast(res?.data?.error || 'Delete failed', 'error');
    }
}

// ═══════════════════════════════════════════════════════ REPORTS
function switchReportTab(name, el) {
    document.querySelectorAll('.report-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById('report-' + name);
    if (panel) panel.classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');

    // Auto load report content for clicked tab
    if (name === 'area') loadAreaReport();
    if (name === 'vehicle') loadVehicleReport();
    if (name === 'completion') loadCompletionReport();
    if (name === 'datewise') loadDateWiseReport();
}

async function populateReportDropdowns() {
    await populateCollectionDropdowns();
}

async function loadAreaReport() {
    const container = document.getElementById('area-report-content');
    container.innerHTML = '<div class="loading-state"><span>⏳</span> Generating area-wise waste collection report…</div>';
    
    const res = await Reports.area();
    if (!res || !res.ok) {
        container.innerHTML = '<div class="alert alert-error">Failed to generate area report.</div>';
        return;
    }
    const rows = res.data;
    if (!rows.length) {
        container.innerHTML = '<div class="empty-state">No recorded collection activities found.</div>';
        return;
    }
    const totalWaste = rows.reduce((s, r) => s + (r.totalWaste || 0), 0);
    container.innerHTML = `
      <p class="text-muted" style="margin-bottom:1.25rem;">Includes all successfully <strong>Completed</strong> activities. Category breakdown in kilograms.</p>
      <div class="table-wrapper"><table>
      <thead>
        <tr><th>Area ID</th><th>Area Name</th><th>Population</th><th>Biodegradable</th><th>Recyclable</th><th>Non-recyclable</th><th>Total Waste</th></tr>
      </thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${esc(r.areaId)}</strong></td>
        <td>${esc(r.areaName)}</td>
        <td>${(r.population || 0).toLocaleString()}</td>
        <td>${formatKg(r.biodegradable)}</td>
        <td>${formatKg(r.recyclable)}</td>
        <td>${formatKg(r.nonRecyclable)}</td>
        <td><strong>${formatKg(r.totalWaste)}</strong></td>
      </tr>`).join('')}
      <tr style="background:#f0fdf4; font-weight:800;">
        <td colspan="6">Grand Total Recorded Waste</td>
        <td>${formatKg(totalWaste)}</td>
      </tr>
      </tbody></table></div>`;
}

async function loadVehicleReport() {
    const container = document.getElementById('vehicle-report-content');
    container.innerHTML = '<div class="loading-state"><span>⏳</span> Generating vehicle utilization report…</div>';
    
    const res = await Reports.vehicle();
    if (!res || !res.ok) {
        container.innerHTML = '<div class="alert alert-error">Failed to generate vehicle report.</div>';
        return;
    }
    const rows = res.data;
    if (!rows.length) {
        container.innerHTML = '<div class="empty-state">No vehicle utilization data available.</div>';
        return;
    }
    container.innerHTML = `
      <p class="text-muted" style="margin-bottom:1.25rem;">
        Formula: <code>Utilization (%) = (Trip Waste Collected / Vehicle Capacity) × 100</code> averaged across all completed trips.
      </p>
      <div class="table-wrapper"><table>
      <thead>
        <tr><th>Vehicle ID</th><th>Vehicle Type</th><th>Payload Capacity</th><th>Completed Trips</th><th>Total Waste</th><th>Avg Utilization (%)</th></tr>
      </thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${esc(r.vehicleId)}</strong></td>
        <td>${esc(r.vehicleType)}</td>
        <td>${(r.capacity || 0).toLocaleString()} kg</td>
        <td>${r.completedTrips || 0}</td>
        <td>${formatKg(r.totalWaste)}</td>
        <td><div style="display:flex; align-items:center; gap:0.65rem;">
          <div class="progress-bar" style="width:100px;">
            <div class="progress-fill" style="width:${Math.min(100, r.avgUtilizationPct || 0)}%;"></div>
          </div>
          <strong>${(r.avgUtilizationPct || 0).toFixed(1)}%</strong>
        </div></td>
      </tr>`).join('')}</tbody></table></div>`;
}

async function loadCompletionReport() {
    const container = document.getElementById('completion-report-content');
    container.innerHTML = '<div class="loading-state"><span>⏳</span> Generating completion status report…</div>';
    
    const filters = {
        area:     document.getElementById('comp-filter-area')?.value || '',
        vehicle:  document.getElementById('comp-filter-vehicle')?.value || '',
        dateFrom: document.getElementById('comp-from')?.value || '',
        dateTo:   document.getElementById('comp-to')?.value || '',
    };
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });
    
    const res = await Reports.completion(filters);
    if (!res || !res.ok) {
        container.innerHTML = '<div class="alert alert-error">Failed to generate completion report.</div>';
        return;
    }
    const { records, summary } = res.data;
    const s = summary;

    container.innerHTML = `
      <div class="summary-boxes">
        ${summaryBox(s.completed || 0, 'Completed', '#2ecc71')}
        ${summaryBox(s.scheduled || 0, 'Scheduled', '#3498db')}
        ${summaryBox(s.inProgress || 0, 'In Progress', '#f39c12')}
        ${summaryBox(s.cancelled || 0, 'Cancelled', '#e74c3c')}
      </div>
      <div style="margin-bottom:1.25rem; font-weight:700;">
        <span>Completion Rate: ${(s.completionPct || 0).toFixed(1)}%</span>
        <span class="text-muted" style="font-weight:normal;"> (${s.completed || 0} of ${(s.completed || 0) + (s.scheduled || 0) + (s.inProgress || 0)} non-cancelled activities)</span>
      </div>
      ${records.length ? `<div class="table-wrapper"><table>
      <thead>
        <tr><th>Collection ID</th><th>Residential Area</th><th>Vehicle ID</th><th>Collection Date</th><th>Status</th></tr>
      </thead>
      <tbody>${records.map(r => `<tr>
        <td><strong>${esc(r.collectionId)}</strong></td>
        <td>${esc(r.areaName)}</td>
        <td>${esc(r.vehicleId)}</td>
        <td>${esc(r.collectionDate)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No matching activities found for the selected criteria.</div>'}`;
}

function clearCompletionFilters() {
    ['comp-filter-area', 'comp-filter-vehicle', 'comp-from', 'comp-to']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadCompletionReport();
}

async function loadDateWiseReport() {
    const container = document.getElementById('datewise-report-content');
    container.innerHTML = '<div class="loading-state"><span>⏳</span> Generating date-wise collection trend report…</div>';
    
    const filters = {
        period:   document.getElementById('dw-period')?.value || 'monthly',
        dateFrom: document.getElementById('dw-from')?.value || '',
        dateTo:   document.getElementById('dw-to')?.value || '',
    };
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });

    const res = await Reports.datewise(filters);
    if (!res || !res.ok) {
        container.innerHTML = '<div class="alert alert-error">Failed to generate date-wise report.</div>';
        return;
    }
    const rows = res.data;
    if (!rows.length) {
        container.innerHTML = '<div class="empty-state">No completed collection records found for the selected timeline.</div>';
        return;
    }
    const totalWaste = rows.reduce((s, r) => s + (r.totalWaste || 0), 0);
    container.innerHTML = `
      <p class="text-muted" style="margin-bottom:1.25rem;">Aggregated by <strong>${filters.period || 'monthly'}</strong> intervals for completed activities.</p>
      <div class="table-wrapper"><table>
      <thead>
        <tr><th>Period</th><th>Activities Count</th><th>Total Waste Collected</th></tr>
      </thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${esc(String(r.period))}</strong></td>
        <td>${r.activities || 0}</td>
        <td><strong>${formatKg(r.totalWaste)}</strong></td>
      </tr>`).join('')}
      <tr style="background:#f0fdf4; font-weight:800;">
        <td>Total</td>
        <td>${rows.reduce((s, r) => s + (r.activities || 0), 0)}</td>
        <td>${formatKg(totalWaste)}</td>
      </tr>
      </tbody></table></div>`;
}

function clearDateWiseFilters() {
    const p = document.getElementById('dw-period');
    if (p) p.value = 'monthly';
    ['dw-from', 'dw-to'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadDateWiseReport();
}

function summaryBox(value, label, color) {
    return `<div class="summary-box">
      <div class="summary-box-value" style="color:${color};">${value}</div>
      <div class="summary-box-label">${label}</div>
    </div>`;
}

// ═══════════════════════════════════════════════════════ DATA ANALYSIS
async function runAnalysis() {
    const status = document.getElementById('analysis-status');
    const content = document.getElementById('analysis-content');
    show('analysis-status');
    content.innerHTML = '';

    const res = await Analysis.run();
    hide('analysis-status');

    if (!res || !res.ok) {
        content.innerHTML = `<div class="alert alert-error">
          Python Analysis Pipeline Encountered an Error: ${esc(res?.data?.error || 'Execution failure')}<br>
          <small>${esc(res?.data?.details || '')}</small>
        </div>`;
        return;
    }

    const d = res.data;
    if (d.status === 'error') {
        content.innerHTML = `<div class="alert alert-error">Python Script Error: ${esc(d.error)}</div>`;
        return;
    }

    const charts = d.charts || {};
    const stats  = d.descriptiveStats || {};
    const cleaning = d.cleaningReport || {};
    const insights = d.insights || [];
    const summary = d.summary || {};

    content.innerHTML = `
      <!-- Summary Metrics -->
      <div class="card">
        <h3>📋 MySQL Operational Dataset Summary</h3>
        <div class="stat-grid" style="margin-top:1.25rem;">
          ${statCard('🏘️', summary.totalAreas || 0, 'Residential Areas')}
          ${statCard('🚛', summary.totalVehicles || 0, 'Fleet Vehicles')}
          ${statCard('📦', summary.totalActivities || 0, 'Collection Trips')}
          ${statCard('📝', summary.totalRecords || 0, 'Itemized Waste Entries')}
        </div>
      </div>

      <!-- Data Cleaning Audit -->
      <div class="card">
        <h3>🧹 Data Cleaning &amp; Quality Audit (Pandas Validation)</h3>
        <p class="text-muted" style="margin-bottom:1.25rem;">Analytical validation run on live MySQL data — operational records are untouched.</p>
        <div class="cleaning-grid">
          ${Object.entries(cleaning).map(([k, v]) => `
            <div class="cleaning-item">
              <div class="cleaning-label">${formatCleanKey(k)}</div>
              <div class="cleaning-value ${v === 0 ? 'ok' : 'warn'}">${v}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Analytical Insights -->
      ${insights.length ? `<div class="card">
        <h3>💡 Analytical Insights &amp; Findings</h3>
        <ul class="insights-list" style="margin-top:1rem;">
          ${insights.map(i => `<li>${esc(i)}</li>`).join('')}
        </ul>
      </div>` : ''}

      <!-- Seven Matplotlib Generated Visualizations -->
      <div class="chart-grid">
        ${chartCard('chart_area_waste.png',  '1. Area-wise Recorded Waste Collection', charts.areaWaste)}
        ${chartCard('chart_category_pie.png','2. Waste Category Distribution',         charts.categoryPie)}
        ${chartCard('chart_vehicle_util.png','3. Vehicle Utilization (%)',              charts.vehicleUtil)}
        ${chartCard('chart_status.png',      '4. Collection Status Distribution',      charts.statusDist)}
        ${chartCard('chart_trend.png',       '5. Monthly Waste Collection Trend',      charts.trend)}
        ${chartCard('chart_scatter.png',     '6. Population vs. Recorded Waste',       charts.scatter)}
        ${chartCard('chart_histogram.png',   '7. Waste Quantity per Trip Distribution', charts.histogram)}
      </div>

      <!-- Descriptive Statistics -->
      ${renderDescStats(stats)}`;
}

function chartCard(file, title, chartData) {
    if (!chartData || !chartData.file) {
        const note = chartData?.data?.note || 'Insufficient data to generate visualization.';
        return `<div class="chart-card"><h3>${esc(title)}</h3><div class="empty-state">${esc(note)}</div></div>`;
    }
    const token = getToken();
    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
    return `<div class="chart-card">
      <h3>${esc(title)}</h3>
      <img src="/api/charts/${esc(file)}?t=${Date.now()}${tokenQuery}" alt="${esc(title)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <div class="empty-state hidden">Chart image could not be loaded.</div>
    </div>`;
}

function renderDescStats(stats) {
    if (!stats || typeof stats !== 'object' || stats.note) return '';
    const overall = stats.overall || {};
    const rows = Object.entries(stats).filter(([k]) => k !== 'overall');
    return `<div class="card">
      <h3>📐 Descriptive Statistics (Completed Activities)</h3>
      <p class="text-muted" style="margin-bottom:1.25rem;">
        Total waste collected: <strong>${formatKg(overall.total_waste_kg || 0)}</strong> across <strong>${overall.total_collections || 0}</strong> trips (average ${formatKg(overall.mean_per_collection || 0)} per trip).
      </p>
      <div class="table-wrapper"><table class="stat-table">
        <thead>
          <tr><th>Category</th><th>Count</th><th>Mean (kg)</th><th>Std Dev</th><th>Min (kg)</th><th>Max (kg)</th></tr>
        </thead>
        <tbody>${rows.map(([cat, s]) => `<tr>
          <td><strong>${esc(cat)}</strong></td>
          <td>${s.count || 0}</td>
          <td>${formatKg(s.mean || 0)}</td>
          <td>${formatKg(s.std || 0)}</td>
          <td>${formatKg(s.min || 0)}</td>
          <td>${formatKg(s.max || 0)}</td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
}

function formatCleanKey(k) {
    return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ═══════════════════════════════════════════════════════ MODAL & CONFIRMATION
function confirmDelete(type, id, label) {
    document.getElementById('modal-title').textContent = 'Confirm Deletion';
    document.getElementById('modal-message').textContent = `Are you sure you want to permanently delete ${label}?`;
    document.getElementById('modal-confirm-btn').onclick = async () => {
        closeModal();
        if (type === 'area') await deleteArea(id);
        else if (type === 'vehicle') await deleteVehicle(id);
        else if (type === 'collection') await deleteCollection(id);
    };
    show('modal-confirm');
}

function closeModal() {
    hide('modal-confirm');
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});

// ═══════════════════════════════════════════════════════ TOAST NOTIFICATIONS
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ═══════════════════════════════════════════════════════ UTILITIES & HELPERS
function val(id) { return (document.getElementById(id)?.value || '').trim(); }
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function formatKg(v) { return (Number(v) || 0).toLocaleString() + ' kg'; }

function statusBadge(s) {
    const cls = {
        'Completed': 'completed',
        'Scheduled': 'scheduled',
        'In Progress': 'inprogress',
        'Cancelled': 'cancelled'
    };
    return `<span class="badge badge-${cls[s] || 'scheduled'}">${esc(s)}</span>`;
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
