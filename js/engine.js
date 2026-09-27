const app = {
    db: [], log: [], users: [], trucks: [], drivers: [], msgs: [],
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

    init() {
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
        this.trucks = this.load(STORAGE_KEYS.trucks, DEFAULT_TRUCKS);
        this.drivers = this.load(STORAGE_KEYS.drivers, DEFAULT_DRIVERS);
        this.msgs = this.load('sng_ctb_msgs', []);
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
        this.saveSession();
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'grid';
        ui.init();
        this.logAction('Вход', `Авторизация: ${u.name} (${ROLES[u.role]})`);
    },

    logout() {
        if (this.user) this.logAction('Выход', `Завершил сеанс: ${this.user.name}`);
        this.user = null;
        this.persist(STORAGE_KEYS.session, null);
        location.reload();
    },

    logAction(act, inf) {
        const now = new Date();
        this.log.push({
            dt: now.toLocaleDateString(), tm: now.toLocaleTimeString(),
            usr: this.user ? this.user.name : 'Система', act, inf,
            ts: now.getTime(),
            fs: `${now.toLocaleString()} ${this.user?.name} ${act} ${inf}`.toLowerCase()
        });
        if (this.log.length > 3000) this.log = this.log.slice(-3000);
        this.persist(STORAGE_KEYS.log, this.log);
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

    registerEntry() {
        const truck = document.getElementById('reg-truck').value.trim();
        const driver = document.getElementById('reg-driver').value.trim();
        if (!truck || !driver) { ui.toast('Укажите ТС и водителя', 'err'); return; }
        const entry = {
            id: Date.now(), num: this.db.length + 1, truck, driver,
            status: STATUS.IN, t_in: Date.now(),
            t_s_in: null, t_s_out: null, t_e_in: null, t_e_out: null, t_out: null,
            p_data: null, crane: null, craneStart: null, craneEnd: null, idle: 0
        };
        this.db.push(entry);
        this.logAction('Регистрация', `Талон №${entry.num} — ${truck} / ${driver}`);
        this.save(); ui.setPage('active');
        ui.toast(`Талон №${entry.num} зарегистрирован`, 'ok');
    },

    updateStep(id, field, nextStatus) {
        const i = this.db.find(x => x.id === id);
        if (!i) return;
        if (field === 't_out' && !this.can('admin', 'kpp')) return;
        if ((field === 't_s_in' || field === 't_s_out') && !this.can('admin', 'store')) return;
        if (field === 't_e_in' && !this.can('admin', 'eng')) return;
        i[field] = Date.now();
        if (nextStatus) i.status = nextStatus;
        this.logAction('Статус', `Талон №${i.num} — ${i.status}`);
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
            this.logAction('Погрузка начата', `Талон №${i.num} — ${i.crane}`);
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
                `Талон №${i.num} — ${i.crane}, ${mins} мин.` + (over > 0 ? `, простой ${over} мин.` : ''));
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
        this.logAction('Маршрутизация', `Талон №${i.num} готов`);
        this.save(); ui.closeModal(); ui.printPermit(i);
    },

    deleteRecord(id) {
        if (!this.can('admin')) return;
        const rec = this.db.find(x => x.id === id);
        if (!rec) return;
        if (confirm('Удалить запись №' + rec.num + '?')) {
            this.logAction('Удаление', `Удалён талон №${rec.num}`);
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
            role
        });
        this.persist(STORAGE_KEYS.users, this.users);
        this.logAction('Пользователь создан', `${name} (${ROLES[role]})`);
        ui.render(); ui.toast('Пользователь добавлен', 'ok');
    },

    updateUserRole(id, role) {
        if (!this.can('admin')) return;
        const u = this.users.find(x => x.id === id);
        if (!u || !ROLES[role]) return;
        u.role = role;
        this.persist(STORAGE_KEYS.users, this.users);
        this.logAction('Роль изменена', `${u.name} → ${ROLES[role]}`);
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
        this.logAction('Пароль сброшен', u.name);
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
            this.logAction('Пользователь удалён', u.name);
            ui.render(); ui.toast('Пользователь удалён', 'ok');
        }
    },

    /* ================= СПРАВОЧНИКИ ================= */
    addTruck() {
        if (!this.can('admin')) return;
        const plate = document.getElementById('fleet-plate').value.trim().toUpperCase();
        if (!plate) return;
        if (this.trucks.includes(plate)) { ui.toast('Такое ТС уже есть', 'err'); return; }
        this.trucks.push(plate);
        this.persist(STORAGE_KEYS.trucks, this.trucks);
        this.logAction('Справочник ТС', `Добавлено: ${plate}`);
        ui.renderFleetLocal();
    },
    removeTruck(i) {
        if (!this.can('admin')) return;
        if (confirm(`Удалить ТС «${this.trucks[i]}»?`)) {
            this.logAction('Справочник ТС', `Удалено: ${this.trucks[i]}`);
            this.trucks.splice(i, 1);
            this.persist(STORAGE_KEYS.trucks, this.trucks);
            ui.renderFleetLocal();
        }
    },
    addDriver() {
        if (!this.can('admin')) return;
        const name = document.getElementById('fleet-driver').value.trim();
        if (!name || name.split(/\s+/).filter(Boolean).length < 3 || /\./.test(name)) {
            ui.toast('Введите полное ФИО без сокращений', 'err'); return;
        }
        if (this.drivers.includes(name)) { ui.toast('Такой водитель уже есть', 'err'); return; }
        this.drivers.push(name);
        this.persist(STORAGE_KEYS.drivers, this.drivers);
        this.logAction('Справочник водителей', `Добавлен: ${name}`);
        ui.renderFleetLocal();
    },
    removeDriver(i) {
        if (!this.can('admin')) return;
        if (confirm(`Удалить водителя «${this.drivers[i]}»?`)) {
            this.logAction('Справочник водителей', `Удалён: ${this.drivers[i]}`);
            this.drivers.splice(i, 1);
            this.persist(STORAGE_KEYS.drivers, this.drivers);
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
        this.logAction('Поддержка', `Обращение: ${this.user.name}`);
        ui.renderMsgs();
    },

    replySupport(id, text) {
        if (!this.can('admin') || !text.trim()) return;
        const m = this.msgs.find(x => x.id === id);
        if (!m) return;
        m.answer = text.trim();
        m.answeredBy = this.user.name;
        this.saveMsgs();
        this.logAction('Поддержка', `Ответ для ${m.fromName}`);
        ui.renderMsgs();
    },

    /* ================= РЕЗЕРВНАЯ КОПИЯ ================= */
    backup() {
        const data = {
            exported: new Date().toISOString(),
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
                this.trucks = d.trucks || this.trucks;
                this.drivers = d.drivers || this.drivers;
                this.msgs = d.msgs || [];
                this.persist(STORAGE_KEYS.db, this.db);
                this.persist(STORAGE_KEYS.log, this.log);
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