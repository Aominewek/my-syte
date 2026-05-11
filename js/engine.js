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
            fs: `${now.toLocaleString()} ${this.user?.name} ${act} ${inf}`.toLowerCase()
        });
        localStorage.setItem('sng_ctb_log', JSON.stringify(this.log));
    },

    save() { localStorage.setItem('sng_ctb_db', JSON.stringify(this.db)); ui.render(); },

    handleSearch(v) {
        this.searchQuery = v.toLowerCase();
        if (app.currentPage === 'active' || app.currentPage === 'journal' || app.currentPage === 'fleet' || app.currentPage === 'log') {
            ui.currentPageNumber = 1; // Сбрасываем на первую страницу при новом поиске
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
            p_data: null
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
    }
};