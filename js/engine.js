const app = {
    db: [], log: [], users: [], trucks: [], drivers: [], msgs: [],
    user: null, searchQuery: '', currentPage: 'dash', itemsPerPage: 15, editingId: null,
    SALT: 'ctb-2026-',
    storageMode: 'local',
    _hb: null,

    /* ================= ХРАНИЛИЩЕ ================= */
    load(key, fb) {
        try { const v = JSON.parse(localStorage.getItem(key)); return (v !== null && v !== undefined) ? v : fb; }
        catch (e) { return fb; }
    },
    persistLocal(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} },
    persist(key, val) {
        this.persistLocal(key, val);
        if (typeof dbstore !== 'undefined' && dbstore.isSqlite) {
            try { dbstore.saveTable(key, val); } catch (e) { console.warn('[БД] запись не удалась:', e && e.message); }
        }
    },

    hash(s) {
        let h = 0x811c9dc5;
        const str = this.SALT + String(s);
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16);
    },

    repairMojibake(s) {
        if (typeof s !== 'string' || !s) return s;
        if (!/[А-Яа-яЁёРЎР’Р С…]/.test(s)) return s;
        try {
            const enc = new TextEncoder();
            const bytes = enc.encode(s);
            const dec = new TextDecoder('utf-8');
            const out = dec.decode(bytes);
            if (out.includes('\uFFFD')) return s;
            if (/[А-Яа-яЁё]{2,}/.test(out) && out.length >= 2) return out;
        } catch (e) {}
        return s;
    },

    _normTrucks(list) {
        return (list || []).map((t, i) => {
            if (typeof t === 'string') {
                return { id: 't' + i, plate: t, brand: '', group: '', owner: '', customer: '', driverId: '', status: 'free', note: '', created: '' };
            }
            return {
                id: t.id || 't' + i,
                plate: this.repairMojibake(t.plate || ''),
                brand: this.repairMojibake(t.brand || ''),
                group: this.repairMojibake(t.group || ''),
                owner: this.repairMojibake(t.owner || ''),
                customer: this.repairMojibake(t.customer || ''),
                driverId: t.driverId || '',
                status: t.status || 'free',
                note: t.note || '',
                created: t.created || ''
            };
        });
    },

    _normDrivers(list) {
        return (list || []).map((d, i) => typeof d === 'string'
            ? { id: 'd' + i, fio: this.repairMojibake(d) }
            : { id: d.id || 'd' + i, fio: this.repairMojibake(d.fio || '') });
    },

    async init() {
        this.storageMode = await dbstore.init();

        if (dbstore.isSqlite) {
            const s = dbstore.readState();
            this.db = s.entries;
            this.log = s.log;
            this.users = s.users;
            this.trucks = s.trucks;
            this.drivers = s.drivers;
            this.msgs = s.msgs;
        } else {
            this.db = this.load(STORAGE_KEYS.db, []).map(e => {
                e.truck = this.repairMojibake(e.truck);
                e.driver = this.repairMojibake(e.driver);
                e.status = this.repairMojibake(e.status);
                e.crane = this.repairMojibake(e.crane);
                return e;
            });
            this.log = this.load(STORAGE_KEYS.log, []).map(l => {
                l.act = this.repairMojibake(l.act);
                l.inf = this.repairMojibake(l.inf);
                l.usr = this.repairMojibake(l.usr);
                l.fs = this.repairMojibake(l.fs);
                return l;
            });
            this.trucks = this._normTrucks(this.load(STORAGE_KEYS.trucks, DEFAULT_TRUCKS));
            this.drivers = this._normDrivers(this.load(STORAGE_KEYS.drivers, DEFAULT_DRIVERS));
            this.msgs = this.load('sng_ctb_msgs', []);
            this.users = this.load(STORAGE_KEYS.users, null);
        }

        if (!Array.isArray(this.users) || !this.users.length) this.seedUsers();
        this.restoreSession();
        return this.storageMode;
    },

    async boot() {
        await this.init();
        if (this.user) {
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'grid';
            ui.init();
            ui.authMode();
            this.startHeartbeat();
        }
        if (typeof ui.dbStatus === 'function') ui.dbStatus();
    },

    seedUsers() {
        this.users = DEFAULT_USERS.map(u => ({
            id: u.login,
            login: u.login,
            name: u.name,
            tab: '',
            pass: this.hash(u.pass),
            role: u.role,
            phone: '',
            created: Date.now(),
            lastLogin: null,
            lastSeen: null
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
        this.persistLocal(STORAGE_KEYS.session, this.user ? { login: this.user.login } : null);
    },

    startHeartbeat() {
        if (this._hb) clearInterval(this._hb);
        this._hb = setInterval(() => {
            if (!this.user) return;
            this.user.lastSeen = Date.now();
            this.persist(STORAGE_KEYS.users, this.users);
        }, 60000);
    },

    isOnline(u) {
        return !!(u && u.lastSeen && (Date.now() - Number(u.lastSeen) < 120000));
    },

    /* ================= ВХОД ================= */
    login() {
        const ident = document.getElementById('login').value.trim();
        const pass = document.getElementById('pass').value;
        const err = document.getElementById('auth-error');
        if (err) { err.textContent = ''; err.classList.remove('show'); }
        const low = ident.toLowerCase();

        const isAdminIdent = this.users.some(x => x.role === 'admin' && x.login.toLowerCase() === low);
        let u = null;

        if (isAdminIdent) {
            u = this.users.find(x => x.role === 'admin' && x.login.toLowerCase() === low);
            if (!u || this.hash(pass) !== u.pass) {
                if (err) { err.textContent = 'Неверный пароль администратора'; err.classList.add('show'); }
                return;
            }
        } else {
            const words = ident.split(/\s+/).filter(w => w.length > 0);
            const hasShort = /\./.test(ident) || /^\S+\s+\S+$/.test(ident) || /\d/.test(ident);
            if (words.length < 3 || hasShort) {
                if (err) { err.textContent = 'Укажите полное ФИО: Фамилия Имя Отчество, без сокращений'; err.classList.add('show'); }
                return;
            }
            u = this.users.find(x => x.name.toLowerCase() === low);
            if (!u) {
                if (err) { err.textContent = 'Пользователь не найден. Обратитесь к администратору.'; err.classList.add('show'); }
                return;
            }
            if (this.hash(pass) !== u.pass) {
                if (err) { err.textContent = 'Неверный табельный номер'; err.classList.add('show'); }
                return;
            }
        }

        this.user = u;
        u.lastLogin = Date.now();
        u.lastSeen = Date.now();
        this.persist(STORAGE_KEYS.users, this.users);
        this.saveSession();
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'grid';
        ui.init();
        this.startHeartbeat();
        this.logAction('Вход', `Авторизация: ${u.name} (${ROLES[u.role]})`, 'user', u.id);
    },

    logout() {
        if (this.user) {
            this.logAction('Выход', `Завершил сеанс: ${this.user.name}`, 'user', this.user.id);
            this.user.lastSeen = null;
            this.persist(STORAGE_KEYS.users, this.users);
        }
        this.user = null;
        this.persistLocal(STORAGE_KEYS.session, null);
        location.reload();
    },

    /* ================= ЖУРНАЛ ================= */
    logAction(act, inf, entity, entityId) {
        const now = new Date();
        const u = this.user;
        const rec = {
            ts: now.getTime(),
            dt: now.toLocaleDateString(), tm: now.toLocaleTimeString(),
            usr: u ? u.name : 'Система',
            uid: u ? u.id : '', login: u ? u.login : '', role: u ? u.role : '',
            act, inf: inf || '',
            entity: entity || '', entityId: entityId != null ? entityId : '',
            device: (typeof dbstore !== 'undefined' && dbstore.device) ? dbstore.device() : '',
            fs: `${now.toLocaleString()} ${u ? u.name : ''} ${act} ${inf || ''}`.toLowerCase()
        };
        this.log.push(rec);
        if (this.log.length > 3000) this.log = this.log.slice(-3000);
        this.persistLocal(STORAGE_KEYS.log, this.log);
        if (typeof dbstore !== 'undefined' && dbstore.isSqlite) {
            try { dbstore.insertLog(rec); } catch (e) { console.warn('[БД] лог не записан:', e && e.message); }
        }
    },

    save() {
        this.persist(STORAGE_KEYS.db, this.db);
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

    /* ================= СПРАВОЧНИК: ПОИСК ================= */
    normPlate(s) {
        return String(s || '').toUpperCase().replace(/[\s\-]/g, '');
    },

    truckByPlate(plate) {
        const p = this.normPlate(plate);
        if (!p) return null;
        return this.trucks.find(t => this.normPlate(t.plate) === p) || null;
    },

    truckById(id) {
        return this.trucks.find(t => t.id === id) || null;
    },

    freeTrucks() {
        return this.trucks.filter(t => (t.status || 'free') === 'free');
    },

    driverById(id) {
        return this.drivers.find(d => d.id === id) || null;
    },

    driverForTruck(truck) {
        if (!truck) return null;
        return this.driverById(truck.driverId);
    },

    /* ================= РЕГИСТРАЦИЯ ================= */
    registerEntry() {
        const plateRaw = (document.getElementById('reg-truck') || {}).value || '';
        const driverRaw = (document.getElementById('reg-driver') || {}).value || '';
        const plate = plateRaw.trim();
        if (!plate) { ui.toast('Укажите гос. номер транспортного средства', 'err'); return; }

        const truck = this.truckByPlate(plate);
        if (!truck) {
            ui.toast('Такого ТС нет в справочнике — проверьте номер', 'err');
            return;
        }
        if ((truck.status || 'free') !== 'free') {
            ui.toast('Это ТС уже на территории', 'err');
            return;
        }

        let driver = null;
        if (driverRaw.trim()) {
            driver = this.drivers.find(d => d.fio.toLowerCase() === driverRaw.trim().toLowerCase()) || null;
        }
        if (!driver) driver = this.driverForTruck(truck);

        const num = this.db.reduce((m, e) => Math.max(m, e.num || 0), 0) + 1;
        const entry = {
            id: Date.now(),
            num,
            truck: truck.plate,
            brand: truck.brand || '',
            driver: driver ? driver.fio : '',
            truckId: truck.id,
            driverId: driver ? driver.id : '',
            org: truck.owner || '',
            cargo: '',
            note: '',
            status: STATUS.IN,
            t_in: Date.now(),
            t_s_in: null, t_s_out: null, t_e_in: null, t_e_out: null, t_out: null,
            p_data: null, crane: null, craneStart: null, craneEnd: null, idle: 0
        };

        this.db.push(entry);
        truck.status = 'on_site';
        this.persist(STORAGE_KEYS.trucks, this.trucks);
        this.logAction('Регистрация', `Талон №${num} — ${truck.plate} ${truck.brand || ''} / ${entry.driver || 'без водителя'}`, 'entry', entry.id);
        this.save();
        ui.setPage('active');
        ui.toast(`Талон №${num} зарегистрирован`, 'ok');
    },

    setTruckStatus(truckId, status) {
        const t = this.truckById(truckId);
        if (!t) return;
        t.status = status;
        this.persist(STORAGE_KEYS.trucks, this.trucks);
    },

    updateStep(id, field, nextStatus) {
        const i = this.db.find(x => x.id === id);
        if (!i) return;
        if (field === 't_out' && !this.can('admin', 'kpp')) return;
        if ((field === 't_s_in' || field === 't_s_out') && !this.can('admin', 'store')) return;
        if (field === 't_e_in' && !this.can('admin', 'eng')) return;
        i[field] = Date.now();
        if (nextStatus) i.status = nextStatus;
        if (field === 't_out') this.setTruckStatus(i.truckId, 'free');
        this.logAction('Статус', `Талон №${i.num} — ${i.status}`, 'entry', i.id);
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
            this.logAction('Погрузка начата', `Талон №${i.num} — ${i.crane}`, 'entry', i.id);
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
            this.logAction(over > 0 ? 'ПРОСТОЙ зафиксирован' : 'Погрузка завершена',
                `Талон №${i.num} — ${i.crane}, ${mins} мин.` + (over > 0 ? `, простой ${over} мин.` : ''), 'entry', i.id);
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
        this.logAction('Маршрутизация', `Талон №${i.num} готов — ${i.truck}`, 'entry', i.id);
        this.save(); ui.closeModal(); ui.printPermit(i);
    },

    deleteRecord(id) {
        if (!this.can('admin')) return;
        const rec = this.db.find(x => x.id === id);
        if (!rec) return;
        if (confirm('Удалить запись №' + rec.num + '?')) {
            if (!rec.t_out && rec.truckId) this.setTruckStatus(rec.truckId, 'free');
            this.logAction('Удаление', `Удалён талон №${rec.num} — ${rec.truck}`, 'entry', rec.id);
            this.db = this.db.filter(x => x.id !== id);
            this.save();
        }
    },

    /* ================= ПОЛЬЗОВАТЕЛИ ================= */
    addUser() {
        if (!this.can('admin')) return;
        const name = document.getElementById('u-name').value.trim();
        const login = document.getElementById('u-login').value.trim();
        const tab = document.getElementById('u-tab').value.trim();
        const role = document.getElementById('u-role').value;
        if (!name || !tab) { ui.toast('Заполните ФИО и табельный номер', 'err'); return; }
        const words = name.split(/\s+/).filter(w => w.length > 0);
        if (words.length < 3 || /\./.test(name)) { ui.toast('Укажите полное ФИО без сокращений', 'err'); return; }
        if (!/^\d{1,10}$/.test(tab)) { ui.toast('Табельный номер — только цифры', 'err'); return; }
        if (this.users.some(x => x.name.toLowerCase() === name.toLowerCase())) {
            ui.toast('Пользователь с таким ФИО уже существует', 'err'); return;
        }
        this.users.push({
            id: 'u' + Date.now(),
            login: (login || name),
            name,
            tab,
            pass: this.hash(tab),
            role,
            phone: '',
            created: Date.now(),
            lastLogin: null,
            lastSeen: null
        });
        this.persist(STORAGE_KEYS.users, this.users);
        this.logAction('Пользователь создан', `${name} (${ROLES[role]})`, 'user', name);
        ui.render(); ui.toast('Пользователь добавлен', 'ok');
    },

    updateUserRole(id, role) {
        if (!this.can('admin')) return;
        const u = this.users.find(x => x.id === id);
        if (!u || !ROLES[role]) return;
        const was = u.role;
        u.role = role;
        this.persist(STORAGE_KEYS.users, this.users);
        this.logAction('Роль изменена', `${u.name}: ${ROLES[was]} → ${ROLES[role]}`, 'user', u.id);
        ui.render();
    },

    resetUserPass(id) {
        if (!this.can('admin')) return;
        const u = this.users.find(x => x.id === id);
        if (!u) return;
        const np = prompt(`Новый табельный номер (пароль) для «${u.name}»:`, u.tab || '');
        if (np === null || np === '') return;
        if (!/^\d{1,10}$/.test(np)) { ui.toast('Табельный номер — только цифры', 'err'); return; }
        u.tab = np; u.pass = this.hash(np);
        this.persist(STORAGE_KEYS.users, this.users);
        this.logAction('Пароль сброшен', u.name, 'user', u.id);
        ui.render(); ui.toast('Пароль обновлён', 'ok');
    },

    deleteUser(id) {
        if (!this.can('admin')) return;
        const u = this.users.find(x => x.id === id);
        if (!u) return;
        if (u.id === this.user.id) { ui.toast('Нельзя удалить свой аккаунт', 'err'); return; }
        if (u.role === 'admin' && this.users.filter(x => x.role === 'admin').length <= 1) {
            ui.toast('Нельзя удалить последнего администратора', 'err'); return;
        }
        if (confirm(`Удалить пользователя «${u.name}»?`)) {
            this.users = this.users.filter(x => x.id !== id);
            this.persist(STORAGE_KEYS.users, this.users);
            this.logAction('Пользователь удалён', u.name, 'user', id);
            ui.render(); ui.toast('Пользователь удалён', 'ok');
        }
    },

    /* ================= СПРАВОЧНИК ================= */
    addTruck() {
        if (!this.can('admin')) return;
        const plateEl = document.getElementById('fleet-plate');
        const brandEl = document.getElementById('fleet-brand');
        const groupEl = document.getElementById('fleet-group');
        const plate = (plateEl ? plateEl.value : '').trim().toUpperCase();
        const brand = (brandEl ? brandEl.value : '').trim();
        const group = (groupEl ? groupEl.value : '').trim();
        if (!plate) { ui.toast('Укажите гос. номер', 'err'); return; }
        if (!brand) { ui.toast('Укажите марку ТС', 'err'); return; }
        if (this.truckByPlate(plate)) { ui.toast('Такое ТС уже есть в базе', 'err'); return; }
        const sample = this.trucks[0] || {};
        this.trucks.push({
            id: 't' + Date.now(),
            plate, brand, group,
            owner: sample.owner || '',
            customer: sample.customer || '',
            driverId: '',
            status: 'free',
            note: '',
            created: Date.now()
        });
        this.persist(STORAGE_KEYS.trucks, this.trucks);
        this.logAction('Справочник ТС', `Добавлено: ${plate} ${brand}`, 'truck', plate);
        ui.renderFleetLocal();
        if (plateEl) plateEl.value = '';
        if (brandEl) brandEl.value = '';
    },

    removeTruck(id) {
        if (!this.can('admin')) return;
        const t = this.truckById(id);
        if (!t) return;
        if ((t.status || 'free') !== 'free') { ui.toast('ТС сейчас на территории — сначала оформите выезд', 'err'); return; }
        if (confirm(`Удалить ТС «${t.plate} ${t.brand}»?`)) {
            this.trucks = this.trucks.filter(x => x.id !== id);
            this.persist(STORAGE_KEYS.trucks, this.trucks);
            this.logAction('Справочник ТС', `Удалено: ${t.plate}`, 'truck', id);
            ui.renderFleetLocal();
        }
    },

    addDriver() {
        if (!this.can('admin')) return;
        const el = document.getElementById('fleet-driver');
        const name = (el ? el.value : '').trim();
        if (!name || name.split(/\s+/).filter(Boolean).length < 3 || /\./.test(name)) {
            ui.toast('Введите полное ФИО без сокращений', 'err'); return;
        }
        if (this.drivers.some(d => d.fio.toLowerCase() === name.toLowerCase())) {
            ui.toast('Такой водитель уже есть', 'err'); return;
        }
        this.drivers.push({ id: 'd' + Date.now(), fio: name });
        this.persist(STORAGE_KEYS.drivers, this.drivers);
        this.logAction('Справочник водителей', `Добавлен: ${name}`, 'driver', name);
        ui.renderFleetLocal();
        if (el) el.value = '';
    },

    removeDriver(id) {
        if (!this.can('admin')) return;
        const d = this.driverById(id);
        if (!d) return;
        if (confirm(`Удалить водителя «${d.fio}»?`)) {
            this.drivers = this.drivers.filter(x => x.id !== id);
            this.trucks.forEach(t => { if (t.driverId === id) t.driverId = ''; });
            this.persist(STORAGE_KEYS.drivers, this.drivers);
            this.persist(STORAGE_KEYS.trucks, this.trucks);
            this.logAction('Справочник водителей', `Удалён: ${d.fio}`, 'driver', id);
            ui.renderFleetLocal();
        }
    },

    /* ================= ПОДДЕРЖКА ================= */
    saveMsgs() { this.persist('sng_ctb_msgs', this.msgs); },

    sendSupport(text) {
        if (!this.user || !text.trim()) return;
        this.msgs.push({
            id: Date.now(),
            from: this.user.id,
            fromName: this.user.name,
            role: this.user.role,
            text: text.trim(),
            date: Date.now(),
            answer: '',
            answeredBy: ''
        });
        this.saveMsgs();
        this.logAction('Поддержка', `Обращение: ${this.user.name}`, 'msg', this.user.id);
        ui.renderMsgs();
    },

    replySupport(id, text) {
        if (!this.can('admin') || !text.trim()) return;
        const m = this.msgs.find(x => x.id === id);
        if (!m) return;
        m.answer = text.trim();
        m.answeredBy = this.user.name;
        this.saveMsgs();
        this.logAction('Поддержка', `Ответ для ${m.fromName}`, 'msg', id);
        ui.renderMsgs();
    },

    /* ================= БАЗА ДАННЫХ ================= */
    downloadDb() {
        if (!dbstore.isSqlite) { ui.toast('База работает в локальном режиме', 'err'); return; }
        dbstore.flush();
        dbstore.download();
        this.logAction('База данных', 'Выгружен файл .sqlite');
        ui.toast('Файл базы скачан', 'ok');
    },

    async resetDb() {
        if (!this.can('admin')) return;
        if (!confirm('Вернуть базу к исходной? Все талоны и ваши правки справочника будут удалены.')) return;
        await dbstore.resetToSeed();
        location.reload();
    },

    /* ================= РЕЗЕРВНАЯ КОПИЯ ================= */
    backup() {
        const data = {
            exported: new Date().toISOString(),
            format: 2,
            db: this.db, log: this.log, users: this.users,
            trucks: this.trucks, drivers: this.drivers, msgs: this.msgs
        };
        const blob = new Blob(['\ufeff' + JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ctb_backup_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        this.logAction('Резервная копия', 'Создана и скачана');
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
                this.trucks = this._normTrucks(d.trucks || this.trucks);
                this.drivers = this._normDrivers(d.drivers || this.drivers);
                this.msgs = d.msgs || [];
                this.persist(STORAGE_KEYS.db, this.db);
                this.persistLocal(STORAGE_KEYS.log, this.log);
                this.persist(STORAGE_KEYS.users, this.users);
                this.persist(STORAGE_KEYS.trucks, this.trucks);
                this.persist(STORAGE_KEYS.drivers, this.drivers);
                this.persist('sng_ctb_msgs', this.msgs);
                this.logAction('Восстановление', 'База восстановлена из файла');
                input.value = '';
                location.reload();
            } catch (e) {
                ui.toast('Ошибка: файл повреждён или неверный формат', 'err');
            }
        };
        rd.readAsText(f);
    },

    /* ================= ЭКСПОРТ CSV ================= */
    exportCSV(rows, filename) {
        if (!rows || !rows.length) { ui.toast('Нет данных для выгрузки', 'err'); return; }
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
