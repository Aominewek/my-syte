const app = {
    db: [], log: [], users: [], trucks: [], drivers: [],
    user: null, searchQuery: '', currentPage: 'dash', itemsPerPage: 15, editingId: null,
    SALT: 'ctb-2026-',

    load(key, fb) {
        try { const v = JSON.parse(localStorage.getItem(key)); return (v !== null && v !== undefined) ? v : fb; }
        catch (e) { return fb; }
    },
    persist(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} },

    hash(s) {
        let h = 0x811c9dc5;
        const str = this.SALT + String(s);
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16);
    },

    init() {
        this.db = this.load(STORAGE_KEYS.db, []);
        this.log = this.load(STORAGE_KEYS.log, []);
        this.trucks = this.load(STORAGE_KEYS.trucks, DEFAULT_TRUCKS.filter((_, i) => i < 12));
        this.drivers = this.load(STORAGE_KEYS.drivers, DEFAULT_DRIVERS);
        this.users = this.load(STORAGE_KEYS.users, null);
        if (!Array.isArray(this.users) || !this.users.length) this.seedUsers();
        this.restoreSession();
    },

    seedUsers() {
        this.users = DEFAULT_USERS.map(u => ({
            id: u.login,
            login: u.login,
            name: u.name,
            tab: u.role === 'admin' ? '' : '',
            pass: this.hash(u.pass),
            role: u.role
        }));
        this.persist(STORAGE_KEYS.users, this.users);
    },

    restoreSession() {
        const s = this.load(STORAGE_KEYS.session, null);
        if (s && s.login) {
            const u = this.users.find(x => x.login === s.login);
            if (u) { this.user = u; return true; }
        }
        return false;
    },
    saveSession() {
        this.persist(STORAGE_KEYS.session, this.user ? { login: this.user.login } : null);
    },

    login() {
        const ident = document.getElementById('login').value.trim();
        const pass = document.getElementById('pass').value;
        const err = document.getElementById('auth-error');
        if (err) err.textContent = '';
        const u = this.users.find(x =>
            x.login.toLowerCase() === ident.toLowerCase() || x.name.toLowerCase() === ident.toLowerCase());
        if (u && this.hash(pass) === u.pass) {
            this.user = u;
            this.saveSession();
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'grid';
            ui.init();
            this.logAction('Р’С…РѕРґ', `РђРІС‚РѕСЂРёР·Р°С†РёСЏ: ${u.name} (${ROLES[u.role]})`);
        } else if (err) {
            err.textContent = 'РќРµРІРµСЂРЅС‹Рµ СѓС‡С‘С‚РЅС‹Рµ РґР°РЅРЅС‹Рµ. РџСЂРѕРІРµСЂСЊС‚Рµ Р»РѕРіРёРЅ Рё РїР°СЂРѕР»СЊ.';
        }
    },

    logout() {
        if (this.user) this.logAction('Р’С‹С…РѕРґ', `Р—Р°РІРµСЂС€РёР» СЃРµР°РЅСЃ: ${this.user.name}`);
        this.user = null;
        this.persist(STORAGE_KEYS.session, null);
        location.reload();
    },

    logAction(act, inf) {
        const now = new Date();
        this.log.push({
            dt: now.toLocaleDateString(), tm: now.toLocaleTimeString(),
            usr: this.user ? this.user.name : 'РЎРёСЃС‚РµРјР°', act, inf,
            ts: now.getTime(),
            fs: `${now.toLocaleString()} ${this.user?.name} ${act} ${inf}`.toLowerCase()
        });
        if (this.log.length > 3000) this.log = this.log.slice(-3000);
        localStorage.setItem(STORAGE_KEYS.log, JSON.stringify(this.log));
    },

    save() {
        localStorage.setItem(STORAGE_KEYS.db, JSON.stringify(this.db));
        ui.render();
    },

    can(...roles) {
        return this.user && roles.includes(this.user.role);
    },

    handleSearch(v) {
        this.searchQuery = v.toLowerCase();
        if (['active', 'journal', 'fleet', 'log', 'boss'].includes(app.currentPage)) {
            ui.currentPageNumber = 1;
            ui.render();
        }
    },

    registerEntry() {
        const truck = document.getElementById('reg-truck').value.trim();
        const driver = document.getElementById('reg-driver').value.trim();
        if (!truck || !driver) { ui.toast('РЈРєР°Р¶РёС‚Рµ РўРЎ Рё РІРѕРґРёС‚РµР»СЏ', 'err'); return; }
        const entry = {
            id: Date.now(), num: this.db.length + 1, truck, driver,
            status: STATUS.IN, t_in: Date.now(),
            t_s_in: null, t_s_out: null, t_e_in: null, t_e_out: null, t_out: null,
            p_data: null, crane: null, craneStart: null, craneEnd: null, idle: 0
        };
        this.db.push(entry);
        this.logAction('Р РµРіРёСЃС‚СЂР°С†РёСЏ', `РўР°Р»РѕРЅ в„–${entry.num} вЂ” ${truck} / ${driver}`);
        this.save(); ui.setPage('active');
        ui.toast(`РўР°Р»РѕРЅ в„–${entry.num} Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ`, 'ok');
    },

    updateStep(id, field, nextStatus) {
        const i = this.db.find(x => x.id === id);
        if (!i) return;
        if (field === 't_out' && !this.can('admin', 'kpp')) return;
        if ((field === 't_s_in' || field === 't_s_out') && !this.can('admin', 'store')) return;
        if (field === 't_e_in' && !this.can('admin', 'eng')) return;
        i[field] = Date.now();
        if (nextStatus) i.status = nextStatus;
        this.logAction('РЎС‚Р°С‚СѓСЃ', `РўР°Р»РѕРЅ в„–${i.num} вЂ” ${i.status}`);
        this.save();
    },

    startCrane(id) {
        if (!this.can('admin', 'store', 'eng')) return;
        const i = this.db.find(x => x.id === id);
        if (i) {
            i.crane = document.getElementById('crane-select') ? document.getElementById('crane-select').value : CRANES[0];
            i.craneStart = Date.now();
            i.craneEnd = null; i.idle = 0;
            i.status = STATUS.LOADING;
            this.logAction('РџРѕРіСЂСѓР·РєР° РЅР°С‡Р°С‚Р°', `РўР°Р»РѕРЅ в„–${i.num} вЂ” ${i.crane}`);
            this.save(); ui.closeModal();
        }
    },

    finishCrane(id) {
        if (!this.can('admin', 'store', 'eng')) return;
        const i = this.db.find(x => x.id === id);
        if (i && i.craneStart) {
            const mins = Math.floor((Date.now() - i.craneStart) / 60000);
            i.craneEnd = Date.now();
            i.status = STATUS.LOADED;
            const over = Math.max(0, mins - CRANE_LIMIT_MIN);
            i.idle = over;
            this.logAction(over > 0 ? 'РџР РћРЎРўРћР™ Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅ' : 'РџРѕРіСЂСѓР·РєР° Р·Р°РІРµСЂС€РµРЅР°',
                `РўР°Р»РѕРЅ в„–${i.num} вЂ” ${i.crane}, ${mins} РјРёРЅ.` + (over > 0 ? `, РїСЂРѕСЃС‚РѕР№ ${over} РјРёРЅ.` : ''));
            this.save(); ui.closeModal();
        }
    },

    savePermit() {
        if (!this.can('admin', 'eng')) return;
        const i = this.db.find(x => x.id === this.editingId);
        if (!i) return;
        i.p_data = {
            cust: document.getElementById('p-customer').value.trim(),
            eng: document.getElementById('p-eng-name').value.trim(),
            crane: document.getElementById('p-crane').value.trim(),
            shelf: document.getElementById('p-shelf').value.trim(),
            pipe: document.getElementById('p-pipe').value.trim(),
            qty: document.getElementById('p-qty').value.trim(),
            type1: document.getElementById('p-type-1').checked,
            type2: document.getElementById('p-type-2').checked,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        i.t_e_out = Date.now();
        i.status = STATUS.READY;
        this.logAction('РњР°СЂС€СЂСѓС‚РёР·Р°С†РёСЏ', `РўР°Р»РѕРЅ в„–${i.num} РіРѕС‚РѕРІ`);
        this.save(); ui.closeModal(); ui.printPermit(i);
    },

    deleteRecord(id) {
        if (!this.can('admin')) return;
        if (confirm('РЈРґР°Р»РёС‚СЊ Р·Р°РїРёСЃСЊ в„–' + (this.db.find(x => x.id === id)?.num || id) + '?')) {
            const idx = this.db.findIndex(x => x.id === id);
            if (idx >= 0) {
                this.logAction('РЈРґР°Р»РµРЅРёРµ', `РЈРґР°Р»С‘РЅ С‚Р°Р»РѕРЅ в„–${this.db[idx].num}`);
                this.db.splice(idx, 1); this.save();
            }
        }
    },

    /* ================= РђР”РњРРќРРЎРўР РР РћР’РђРќРР• РџРћР›Р¬Р—РћР’РђРўР•Р›Р•Р™ ================= */
    addUser() {
        if (!this.can('admin')) return;
        const name = document.getElementById('u-name').value.trim();
        const login = document.getElementById('u-login').value.trim();
        const tab = document.getElementById('u-tab').value.trim();
        const role = document.getElementById('u-role').value;
        if (!name || !tab) { ui.toast('Р—Р°РїРѕР»РЅРёС‚Рµ Р¤РРћ Рё С‚Р°Р±РµР»СЊРЅС‹Р№ РЅРѕРјРµСЂ', 'err'); return; }
        if (!/^\d{1,10}$/.test(tab)) { ui.toast('РўР°Р±РµР»СЊРЅС‹Р№ РЅРѕРјРµСЂ вЂ” С‚РѕР»СЊРєРѕ С†РёС„СЂС‹', 'err'); return; }
        if (this.users.some(x => x.login.toLowerCase() === (login || name).toLowerCase())) {
            ui.toast('РўР°РєРѕР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚', 'err'); return;
        }
        this.users.push({
            id: 'u' + Date.now(),
            login: (login || name),
            name,
            tab,
            pass: this.hash(tab),
            role
        });
        this.persist(STORAGE_KEYS.users, this.users);
        this.logAction('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃРѕР·РґР°РЅ', `${name} (${ROLES[role]})`);
        ui.render(); ui.toast('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РґРѕР±Р°РІР»РµРЅ', 'ok');
    },

    updateUserRole(id, role) {
        if (!this.can('admin')) return;
        const u = this.users.find(x => x.id === id);
        if (!u || !ROLES[role]) return;
        u.role = role;
        this.persist(STORAGE_KEYS.users, this.users);
        this.logAction('Р РѕР»СЊ РёР·РјРµРЅРµРЅР°', `${u.name} в†’ ${ROLES[role]}`);
        ui.render();
    },

    resetUserPass(id) {
        if (!this.can('admin')) return;
        const u = this.users.find(x => x.id === id);
        if (!u) return;
        const np = prompt(`РќРѕРІС‹Р№ С‚Р°Р±РµР»СЊРЅС‹Р№ РЅРѕРјРµСЂ (РїР°СЂРѕР»СЊ) РґР»СЏ В«${u.name}В»:`, u.tab || '');
        if (np === null || np === '') return;
        if (!/^\d{1,10}$/.test(np)) { ui.toast('РўР°Р±РµР»СЊРЅС‹Р№ РЅРѕРјРµСЂ вЂ” С‚РѕР»СЊРєРѕ С†РёС„СЂС‹', 'err'); return; }
        u.tab = np; u.pass = this.hash(np);
        this.persist(STORAGE_KEYS.users, this.users);
        this.logAction('РџР°СЂРѕР»СЊ СЃР±СЂРѕС€РµРЅ', u.name);
        ui.render(); ui.toast('РџР°СЂРѕР»СЊ РѕР±РЅРѕРІР»С‘РЅ', 'ok');
    },

    deleteUser(id) {
        if (!this.can('admin')) return;
        const u = this.users.find(x => x.id === id);
        if (!u) return;
        if (u.id === this.user.id) { ui.toast('РќРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ СЃРІРѕР№ Р°РєРєР°СѓРЅС‚', 'err'); return; }
        if (u.role === 'admin' && this.users.filter(x => x.role === 'admin').length <= 1) {
            ui.toast('РќРµР»СЊР·СЏ СѓРґР°Р»РёС‚СЊ РїРѕСЃР»РµРґРЅРµРіРѕ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°', 'err'); return;
        }
        if (confirm(`РЈРґР°Р»РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ В«${u.name}В»?`)) {
            this.users = this.users.filter(x => x.id !== id);
            this.persist(STORAGE_KEYS.users, this.users);
            this.logAction('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓРґР°Р»С‘РЅ', u.name);
            ui.render(); ui.toast('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓРґР°Р»С‘РЅ', 'ok');
        }
    },

    /* ================= РЎРџР РђР’РћР§РќРРљР ================= */
    addTruck() {
        if (!this.can('admin')) return;
        const plate = document.getElementById('fleet-plate').value.trim().toUpperCase();
        if (!plate) return;
        if (this.trucks.includes(plate)) { ui.toast('РўР°РєРѕРµ РўРЎ СѓР¶Рµ РµСЃС‚СЊ', 'err'); return; }
        this.trucks.push(plate);
        this.persist(STORAGE_KEYS.trucks, this.trucks);
        this.logAction('РЎРїСЂР°РІРѕС‡РЅРёРє РўРЎ', `Р”РѕР±Р°РІР»РµРЅРѕ: ${plate}`);
        ui.render();
    },
    removeTruck(i) {
        if (!this.can('admin')) return;
        if (confirm(`РЈРґР°Р»РёС‚СЊ РўРЎ В«${this.trucks[i]}В»?`)) {
            this.logAction('РЎРїСЂР°РІРѕС‡РЅРёРє РўРЎ', `РЈРґР°Р»РµРЅРѕ: ${this.trucks[i]}`);
            this.trucks.splice(i, 1);
            this.persist(STORAGE_KEYS.trucks, this.trucks);
            ui.render();
        }
    },
    addDriver() {
        if (!this.can('admin')) return;
        const name = document.getElementById('fleet-driver').value.trim();
        if (!name || name.indexOf(' ') < 0) { ui.toast('Р’РІРµРґРёС‚Рµ РїРѕР»РЅРѕРµ Р¤РРћ (Р¤Р°РјРёР»РёСЏ РРјСЏ РћС‚С‡РµСЃС‚РІРѕ)', 'err'); return; }
        if (this.drivers.includes(name)) { ui.toast('РўР°РєРѕР№ РІРѕРґРёС‚РµР»СЊ СѓР¶Рµ РµСЃС‚СЊ', 'err'); return; }
        this.drivers.push(name);
        this.persist(STORAGE_KEYS.drivers, this.drivers);
        this.logAction('РЎРїСЂР°РІРѕС‡РЅРёРє РІРѕРґРёС‚РµР»РµР№', `Р”РѕР±Р°РІР»РµРЅ: ${name}`);
        ui.render();
    },
    removeDriver(i) {
        if (!this.can('admin')) return;
        if (confirm(`РЈРґР°Р»РёС‚СЊ РІРѕРґРёС‚РµР»СЏ В«${this.drivers[i]}В»?`)) {
            this.logAction('РЎРїСЂР°РІРѕС‡РЅРёРє РІРѕРґРёС‚РµР»РµР№', `РЈРґР°Р»С‘РЅ: ${this.drivers[i]}`);
            this.drivers.splice(i, 1);
            this.persist(STORAGE_KEYS.drivers, this.drivers);
            ui.render();
        }
    },

    /* ================= Р Р•Р—Р•Р Р’РќРђРЇ РљРћРџРРЇ ================= */
    backup() {
        const data = {
            exported: new Date().toISOString(),
            db: this.db, log: this.log, users: this.users,
            trucks: this.trucks, drivers: this.drivers
        };
        const blob = new Blob(['\ufeff' + JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ctb_backup_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        this.logAction('Р РµР·РµСЂРІРЅР°СЏ РєРѕРїРёСЏ', 'РЎРѕР·РґР°РЅР° Рё СЃРєР°С‡Р°РЅР°');
    },

    restoreFromFile(input) {
        if (!input.files || !input.files[0]) return;
        const f = input.files[0];
        const rd = new FileReader();
        rd.onload = () => {
            try {
                const d = JSON.parse(rd.result);
                if (!d || !Array.isArray(d.db)) throw new Error('bad');
                this.db = d.db || [];
                this.log = d.log || [];
                this.users = d.users && d.users.length ? d.users : this.users;
                this.trucks = d.trucks || this.trucks;
                this.drivers = d.drivers || this.drivers;
                this.persist(STORAGE_KEYS.db, this.db);
                this.persist(STORAGE_KEYS.log, this.log);
                this.persist(STORAGE_KEYS.users, this.users);
                this.persist(STORAGE_KEYS.trucks, this.trucks);
                this.persist(STORAGE_KEYS.drivers, this.drivers);
                this.logAction('Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ', 'Р‘Р°Р·Р° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР° РёР· С„Р°Р№Р»Р°');
                input.value = '';
                location.reload();
            } catch (e) {
                ui.toast('РћС€РёР±РєР°: С„Р°Р№Р» РїРѕРІСЂРµР¶РґС‘РЅ РёР»Рё РЅРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚', 'err');
            }
        };
        rd.readAsText(f);
    },

    /* ================= Р­РљРЎРџРћР Рў CSV ================= */
    exportCSV(rows, filename) {
        if (!rows || !rows.length) { ui.toast('РќРµС‚ РґР°РЅРЅС‹С… РґР»СЏ РІС‹РіСЂСѓР·РєРё', 'err'); return; }
        const headers = Object.keys(rows[0]);
        const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [headers.join(';'), ...rows.map(r => headers.map(h => esc(r[h])).join(';'))].join('\r\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename || 'report.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    }
};