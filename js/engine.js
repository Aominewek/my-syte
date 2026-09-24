const app = {
    db: JSON.parse(localStorage.getItem('sng_ctb_db')) || [],
    log: JSON.parse(localStorage.getItem('sng_ctb_log')) || [],
    user: null, searchQuery: '', currentPage: 'active', itemsPerPage: 15, editingId: null,

    login() {
        const l = document.getElementById('login').value;
        const p = document.getElementById('pass').value;
        if (USERS[l] && USERS[l].pass === p) {
            this.user = USERS[l];
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'grid';
            ui.init();
            this.logAction("Вход", "Авторизация успешна");
        } else alert("Ошибка доступа");
    },

    logAction(act, inf) {
        const now = new Date();
        this.log.push({
            dt: now.toLocaleDateString(), tm: now.toLocaleTimeString(),
            usr: this.user ? this.user.name : "Система", act, inf,
            ts: now.getTime(),
            fs: `${now.toLocaleString()} ${this.user?.name} ${act} ${inf}`.toLowerCase()
        });
        if (this.log.length > 2000) this.log = this.log.slice(-2000);
        localStorage.setItem('sng_ctb_log', JSON.stringify(this.log));
    },

    save() { localStorage.setItem('sng_ctb_db', JSON.stringify(this.db)); ui.render(); },

    handleSearch(v) {
        this.searchQuery = v.toLowerCase();
        if (['active', 'journal', 'fleet', 'log', 'boss'].includes(app.currentPage)) {
            ui.currentPageNumber = 1;
            ui.render();
        }
    },

    registerEntry() {
        const truck = document.getElementById('reg-truck').value;
        const driver = document.getElementById('reg-driver').value;
        const entry = {
            id: Date.now(), num: this.db.length + 1, truck, driver,
            status: STATUS.IN, t_in: Date.now(),
            t_s_in: null, t_s_out: null, t_e_in: null, t_e_out: null, t_out: null,
            p_data: null, crane: null, craneStart: null, craneEnd: null, idle: 0
        };
        this.db.push(entry);
        this.logAction("Регистрация", `Талон №${entry.num}`);
        this.save(); ui.setPage('active');
    },

    updateStep(id, field, nextStatus) {
        const i = this.db.find(x => x.id === id);
        if (i) {
            i[field] = Date.now();
            if (nextStatus) i.status = nextStatus;
            this.logAction("Статус", `Талон №${i.num} -> ${i.status}`);
            this.save();
        }
    },

    startCrane(id) {
        const i = this.db.find(x => x.id === id);
        if (i) {
            i.crane = document.getElementById('crane-select') ? document.getElementById('crane-select').value : CRANES[0];
            i.craneStart = Date.now();
            i.craneEnd = null; i.idle = 0;
            i.status = STATUS.LOADING;
            this.logAction("Погрузка начата", `Талон №${i.num}, ${i.crane}`);
            this.save(); ui.closeModal();
        }
    },

    finishCrane(id) {
        const i = this.db.find(x => x.id === id);
        if (i && i.craneStart) {
            const mins = Math.floor((Date.now() - i.craneStart) / 60000);
            i.craneEnd = Date.now();
            i.status = STATUS.LOADED;
            const over = Math.max(0, mins - CRANE_LIMIT_MIN);
            i.idle = over;
            this.logAction(over > 0 ? "ПРОСТОЙ зафиксирован" : "Погрузка завершена",
                `Талон №${i.num}, ${i.crane}, ${mins} мин.` + (over > 0 ? `, простой ${over} мин.` : ''));
            this.save(); ui.closeModal();
        }
    },

    savePermit() {
        const i = this.db.find(x => x.id === this.editingId);
        i.p_data = {
            cust: document.getElementById('p-customer').value,
            eng: document.getElementById('p-eng-name').value,
            crane: document.getElementById('p-crane').value,
            shelf: document.getElementById('p-shelf').value,
            pipe: document.getElementById('p-pipe').value,
            qty: document.getElementById('p-qty').value,
            type1: document.getElementById('p-type-1').checked,
            type2: document.getElementById('p-type-2').checked,
            time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
        };
        i.t_e_out = Date.now();
        i.status = STATUS.READY;
        this.logAction("Маршрутизация", `Талон №${i.num} готов`);
        this.save(); ui.closeModal(); ui.printPermit(i);
    },

    deleteRecord(id) {
        if(confirm("Удалить запись?")) {
            const idx = this.db.findIndex(x => x.id === id);
            this.logAction("Удаление", `Удален талон №${this.db[idx].num}`);
            this.db.splice(idx, 1); this.save();
        }
    },

    exportCSV(rows, filename) {
        if (!rows.length) { alert("Нет данных для выгрузки"); return; }
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