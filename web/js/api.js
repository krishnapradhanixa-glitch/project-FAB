/**
 * PROJECT FAB — API Client (api.js)
 * Handles all HTTP requests to the Java backend.
 */

const BASE = '';  // Same origin
let _token = localStorage.getItem('fab_token') || '';
let _userName = localStorage.getItem('fab_name') || '';

function getToken() { return _token; }
function setToken(t, name) {
    _token = t || '';
    _userName = name || '';
    localStorage.setItem('fab_token', _token);
    localStorage.setItem('fab_name', _userName);
}
function clearToken() { setToken('', ''); }

async function api(method, path, body) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': _token }
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    try {
        const res = await fetch(BASE + path, opts);
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (res.status === 401) {
            // Session expired
            clearToken();
            showPage('login');
            showToast('Session expired. Please sign in again.', 'error');
            return null;
        }
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        return { ok: false, status: 0, data: { error: 'Network error: ' + err.message } };
    }
}

// Auth
const Auth = {
    login:    (email, password)              => api('POST', '/api/auth/login',    { email, password }),
    register: (fullName, email, password, confirmPassword) =>
                                               api('POST', '/api/auth/register',  { fullName, email, password, confirmPassword }),
    logout:   ()                             => api('POST', '/api/auth/logout'),
    me:       ()                             => api('GET',  '/api/auth/me'),
};

// Areas
const Areas = {
    list:   (search)  => api('GET',    `/api/areas${search ? '?search='+encodeURIComponent(search) : ''}`),
    get:    (id)      => api('GET',    `/api/areas/${encodeURIComponent(id)}`),
    create: (data)    => api('POST',   '/api/areas', data),
    update: (id, data)=> api('PUT',    `/api/areas/${encodeURIComponent(id)}`, data),
    delete: (id)      => api('DELETE', `/api/areas/${encodeURIComponent(id)}`),
};

// Vehicles
const Vehicles = {
    list:   (search)  => api('GET',    `/api/vehicles${search ? '?search='+encodeURIComponent(search) : ''}`),
    get:    (id)      => api('GET',    `/api/vehicles/${encodeURIComponent(id)}`),
    create: (data)    => api('POST',   '/api/vehicles', data),
    update: (id, data)=> api('PUT',    `/api/vehicles/${encodeURIComponent(id)}`, data),
    delete: (id)      => api('DELETE', `/api/vehicles/${encodeURIComponent(id)}`),
};

// Collections
const Collections = {
    list:   (filters) => {
        const qs = new URLSearchParams(filters || {}).toString();
        return api('GET', `/api/collections${qs ? '?'+qs : ''}`);
    },
    get:    (id)      => api('GET',    `/api/collections/${encodeURIComponent(id)}`),
    getWaste: (id)    => api('GET',    `/api/collections/${encodeURIComponent(id)}/waste`),
    create: (data)    => api('POST',   '/api/collections', data),
    update: (id, data)=> api('PUT',    `/api/collections/${encodeURIComponent(id)}`, data),
    delete: (id)      => api('DELETE', `/api/collections/${encodeURIComponent(id)}`),
};

// Dashboard
const Dashboard = { get: () => api('GET', '/api/dashboard') };

// Reports
const Reports = {
    area:       ()        => api('GET', '/api/reports/area'),
    vehicle:    ()        => api('GET', '/api/reports/vehicle'),
    completion: (filters) => {
        const qs = new URLSearchParams(filters || {}).toString();
        return api('GET', `/api/reports/completion${qs ? '?'+qs : ''}`);
    },
    datewise:   (filters) => {
        const qs = new URLSearchParams(filters || {}).toString();
        return api('GET', `/api/reports/datewise${qs ? '?'+qs : ''}`);
    },
};

// Analysis
const Analysis = { run: () => api('POST', '/api/analysis') };
