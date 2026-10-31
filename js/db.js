/* ============================================================
   ЦТБ — слой хранения.
   Основной режим: SQLite (файл data/ctb.sqlite + sql.js), изменения
   сохраняются обратно в браузер (IndexedDB) и могут быть выгружены
   файлом .sqlite для просмотра в SQLiteStudio.
   Резервный режим: localStorage, если WASM-база недоступна.
   ============================================================ */

const DB_SCHEMA_VERSION = 1;
const DB_SEED_URL = 'data/ctb.sqlite';
const DB_SEED_SOURCE = 'Список транспорта (1).xls';

const idbStore = {
    _p: null,
    open() {
        if (this._p) return this._p;
        this._p = new Promise((resolve, reject) => {
            if (!window.indexedDB) { reject(new Error('IndexedDB недоступна')); return; }
            const rq = indexedDB.open('ctb-store', 1);
            rq.onupgradeneeded = () => {
                const db = rq.result;
                if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
            };
            rq.onsuccess = () => resolve(rq.result);
            rq.onerror = () => reject(rq.error || new Error('IndexedDB: ошибка открытия'));
        });
        return this._p;
    },
    async get(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const rq = db.transaction('kv', 'readonly').objectStore('kv').get(key);
            rq.onsuccess = () => resolve(rq.result);
            rq.onerror = () => reject(rq.error);
        });
    },
    async set(key, value) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readwrite');
            tx.objectStore('kv').put(value, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },
    async del(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readwrite');
            tx.objectStore('kv').delete(key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }
};

const dbstore = {
    SCHEMA: DB_SCHEMA_VERSION,
    mode: 'local',
    raw: null,
    _logMaxTs: 0,
    _timer: null,

    get isSqlite() { return this.mode === 'sqlite' && !!this.raw; },

    device() {
        const ua = navigator.userAgent || '';
        const m = ua.match(/\(([^)]+)\)/);
        return (m ? m[1] : ua).slice(0, 90);
    },

    async init() {
        try {
            if (typeof initSqlJs !== 'function') throw new Error('модуль sql.js не загружен');
            const SQL = await initSqlJs({ locateFile: f => 'vendor/sql.js/' + f });
            const bytes = await this._loadBytes();
            this.raw = new SQL.Database(bytes);
            this._ensureSchema();
            this.mode = 'sqlite';
        } catch (e) {
            console.warn('[БД] SQLite недоступна, работаем в локальном режиме:', e && e.message);
            this.raw = null;
            this.mode = 'local';
        }
        return this.mode;
    },

    async _loadBytes() {
        try {
            const saved = await idbStore.get('db');
            if (saved && saved.version === this.SCHEMA && saved.bytes) {
                const b = saved.bytes;
                return b instanceof Uint8Array ? b : new Uint8Array(b);
            }
        } catch (e) {
            console.warn('[БД] нет сохранённой копии в браузере:', e && e.message);
        }
        const res = await fetch(DB_SEED_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('не удалось загрузить ' + DB_SEED_URL + ' (' + res.status + ')');
        return new Uint8Array(await res.arrayBuffer());
    },

    _ensureSchema() {
        this.run('PRAGMA foreign_keys = OFF');
        this.run('PRAGMA user_version = ' + this.SCHEMA);
    },

    all(sql, params) {
        const stmt = this.raw.prepare(sql);
        try {
            if (params) stmt.bind(params);
            const out = [];
            while (stmt.step()) out.push(stmt.getAsObject());
            return out;
        } finally {
            stmt.free();
        }
    },

    run(sql, params) {
        if (!this.raw) return;
        this.raw.run(sql, params || []);
    },

    _tx(fn) {
        this.run('BEGIN');
        try {
            fn();
            this.run('COMMIT');
        } catch (e) {
            try { this.run('ROLLBACK'); } catch (_) {}
            throw e;
        }
        this._touch();
    },

    /* ---------- чтение ---------- */
    readState() {
        const users = this.all('SELECT * FROM users ORDER BY fio').map(r => ({
            id: r.id, login: r.login, name: r.fio, role: r.role,
            tab: r.tab || '', pass: r.pass_hash || '', phone: r.phone || '',
            created: r.created_at || '', lastLogin: r.last_login || '', lastSeen: r.last_seen || ''
        }));

        const drivers = this.all('SELECT * FROM drivers ORDER BY fio').map(r => ({ id: r.id, fio: r.fio }));

        const trucks = this.all('SELECT * FROM trucks ORDER BY plate').map(r => ({
            id: r.id, plate: r.plate, brand: r.brand || '', group: r.model_group || '',
            owner: r.owner || '', customer: r.customer || '', driverId: r.driver_id || '',
            status: r.status || 'free', note: r.note || ''
        }));

        const entries = this.all('SELECT * FROM entries ORDER BY t_in DESC').map(r => this._mapEntry(r));

        const log = this.all('SELECT * FROM audit_log ORDER BY ts ASC, seq ASC').map(r => ({
            ts: r.ts, dt: r.dt || '', tm: r.tm || '',
            usr: r.user_fio || 'Система', act: r.action || '', inf: r.detail || '',
            uid: r.user_id || '', login: r.user_login || '', role: r.user_role || '',
            device: r.device || '',
            fs: `${r.dt || ''} ${r.tm || ''} ${r.user_fio || ''} ${r.action || ''} ${r.detail || ''}`.toLowerCase()
        }));

        const msgs = this.all('SELECT * FROM msgs ORDER BY ts ASC').map(r => ({
            id: Number(r.id) || r.id, from: r.user_id || '', fromName: r.fio || '',
            role: r.role || '', text: r.text || '', date: r.ts || 0,
            answer: r.answer || '', answeredBy: r.answered_by || ''
        }));

        this._logMaxTs = log.length ? log[log.length - 1].ts : 0;
        return { users, drivers, trucks, entries, log, msgs };
    },

    _mapEntry(r) {
        let permit = null;
        if (r.permit_json) {
            try { permit = JSON.parse(r.permit_json); } catch (e) { permit = null; }
        }
        const asNum = Number(r.id);
        const id = String(asNum) === String(r.id) ? asNum : r.id;
        return {
            id, num: r.num || 0,
            truck: r.plate || '', driver: r.fio || '',
            brand: r.brand || '', truckId: r.truck_id || '', driverId: r.driver_id || '',
            org: r.org || '', cargo: r.cargo || '', note: r.note || '',
            status: r.status, t_in: r.t_in, t_s_in: r.t_s_in, t_s_out: r.t_s_out,
            t_e_in: r.t_e_in, t_e_out: r.t_e_out, t_out: r.t_out,
            crane: r.crane, craneStart: r.crane_start, craneEnd: r.crane_end,
            idle: r.idle_min || 0, p_data: permit
        };
    },

    stats() {
        if (!this.isSqlite) return { trucks: 0, drivers: 0, entries: 0, log: 0 };
        const one = sql => (this.all(sql)[0] || {})['COUNT(*)'] || 0;
        return {
            trucks: one('SELECT COUNT(*) FROM trucks'),
            drivers: one('SELECT COUNT(*) FROM drivers'),
            entries: one('SELECT COUNT(*) FROM entries'),
            log: one('SELECT COUNT(*) FROM audit_log')
        };
    },

    /* ---------- запись ---------- */
    saveTable(key, value) {
        if (!this.isSqlite) return;
        switch (key) {
            case STORAGE_KEYS.db: return this.saveEntries(value);
            case STORAGE_KEYS.users: return this.saveUsers(value);
            case STORAGE_KEYS.trucks: return this.saveTrucks(value);
            case STORAGE_KEYS.drivers: return this.saveDrivers(value);
            case STORAGE_KEYS.log: return this.appendLog(value);
            case 'sng_ctb_msgs': return this.saveMsgs(value);
            default: return;
        }
    },

    saveEntries(list) {
        if (!this.isSqlite) return;
        const rows = list || [];
        this._tx(() => {
            this.run('DELETE FROM entries');
            const sql = `INSERT INTO entries
                (id,num,truck_id,driver_id,plate,brand,fio,org,cargo,note,status,
                 t_in,t_s_in,t_s_out,t_e_in,t_e_out,t_out,crane,crane_start,crane_end,
                 idle_min,permit_json,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
            for (const e of rows) {
                this.run(sql, [
                    String(e.id), e.num ?? null, e.truckId || null, e.driverId || null,
                    e.truck || null, e.brand || null, e.driver || null,
                    e.org || null, e.cargo || null, e.note || null, e.status || 'IN',
                    e.t_in || null, e.t_s_in || null, e.t_s_out || null,
                    e.t_e_in || null, e.t_e_out || null, e.t_out || null,
                    e.crane || null, e.craneStart || null, e.craneEnd || null,
                    e.idle || 0, e.p_data ? JSON.stringify(e.p_data) : null,
                    new Date().toISOString()
                ]);
            }
        });
    },

    saveUsers(list) {
        if (!this.isSqlite) return;
        const rows = list || [];
        this._tx(() => {
            const ids = rows.map(u => String(u.id));
            if (ids.length) this.run(`DELETE FROM users WHERE id NOT IN (${ids.map(() => '?').join(',')})`, ids);
            else this.run('DELETE FROM users');
            const sql = `INSERT INTO users
                (id,login,fio,role,tab,pass_hash,phone,created_at,last_login,last_seen,active)
                VALUES (?,?,?,?,?,?,?,?,?,?,1)
                ON CONFLICT(id) DO UPDATE SET
                    login=excluded.login, fio=excluded.fio, role=excluded.role,
                    tab=excluded.tab, pass_hash=excluded.pass_hash, phone=excluded.phone,
                    last_login=excluded.last_login, last_seen=excluded.last_seen`;
            for (const u of rows) {
                this.run(sql, [
                    String(u.id), u.login || u.name, u.name, u.role, u.tab || '',
                    u.pass || '', u.phone || '', u.created || new Date().toISOString(),
                    u.lastLogin || null, u.lastSeen || null
                ]);
            }
        });
    },

    saveTrucks(list) {
        if (!this.isSqlite) return;
        const rows = list || [];
        this._tx(() => {
            this.run('DELETE FROM trucks');
            const sql = `INSERT INTO trucks
                (id,plate,brand,model_group,owner,customer,driver_id,status,note,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)`;
            for (const t of rows) {
                this.run(sql, [
                    String(t.id), t.plate, t.brand || '', t.group || '', t.owner || '',
                    t.customer || '', t.driverId || null, t.status || 'free',
                    t.note || null, t.created || new Date().toISOString()
                ]);
            }
        });
    },

    saveDrivers(list) {
        if (!this.isSqlite) return;
        const rows = list || [];
        this._tx(() => {
            this.run('DELETE FROM drivers');
            for (const d of rows) {
                this.run('INSERT INTO drivers (id, fio) VALUES (?, ?)', [String(d.id), d.fio]);
            }
        });
    },

    saveMsgs(list) {
        if (!this.isSqlite) return;
        const rows = list || [];
        this._tx(() => {
            this.run('DELETE FROM msgs');
            for (const m of rows) {
                this.run(`INSERT INTO msgs (id,user_id,fio,role,text,ts,answer,answered_by,status)
                          VALUES (?,?,?,?,?,?,?,?,?)`, [
                    String(m.id), m.from || null, m.fromName || null, m.role || null,
                    m.text || '', m.date || Date.now(), m.answer || null,
                    m.answeredBy || null, m.answer ? 'answered' : 'new'
                ]);
            }
        });
    },

    insertLog(l) {
        if (!this.isSqlite || !l) return;
        this.run(`INSERT INTO audit_log
            (ts,dt,tm,user_id,user_login,user_fio,user_role,action,entity,entity_id,detail,device)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [
            l.ts || Date.now(), l.dt || '', l.tm || '',
            l.uid || null, l.login || null, l.usr || null, l.role || null,
            l.act || '', l.entity || null,
            l.entityId != null ? String(l.entityId) : null,
            l.inf || '', l.device || this.device()
        ]);
        this._logMaxTs = Math.max(this._logMaxTs, l.ts || 0);
        this._touch();
    },

    appendLog(list) {
        if (!this.isSqlite) return;
        const fresh = (list || []).filter(l => (l.ts || 0) > this._logMaxTs);
        if (!fresh.length) return;
        this._tx(() => {
            for (const l of fresh) {
                this.run(`INSERT INTO audit_log
                    (ts,dt,tm,user_id,user_login,user_fio,user_role,action,entity,entity_id,detail,device)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [
                    l.ts || Date.now(), l.dt || '', l.tm || '',
                    l.uid || null, l.login || null, l.usr || null, l.role || null,
                    l.act || '', l.entity || null,
                    l.entityId != null ? String(l.entityId) : null,
                    l.inf || '', l.device || this.device()
                ]);
            }
        });
        this._logMaxTs = fresh.reduce((m, l) => Math.max(m, l.ts || 0), this._logMaxTs);
    },

    /* ---------- сохранение файла базы в браузере ---------- */
    _touch() {
        if (!this.isSqlite) return;
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this.flush(), 500);
    },

    async flush() {
        if (!this.isSqlite) return;
        try {
            const bytes = this.raw.export();
            await idbStore.set('db', { version: this.SCHEMA, bytes, savedAt: new Date().toISOString() });
        } catch (e) {
            console.warn('[БД] не удалось сохранить копию в браузере:', e && e.message);
        }
    },

    download() {
        if (!this.isSqlite) return false;
        const blob = new Blob([this.raw.export()], { type: 'application/vnd.sqlite3' });
        const a = document.createElement('a');
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        a.href = URL.createObjectURL(blob);
        a.download = `ctb_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.sqlite`;
        a.click();
        URL.revokeObjectURL(a.href);
        return true;
    },

    async resetToSeed() {
        await idbStore.del('db');
        return this.init();
    }
};
