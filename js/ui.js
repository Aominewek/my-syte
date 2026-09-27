const ui = {
    currentPageNumber: 1,
    selTruck: '',
    selDriver: '',

    ico: {
        dash: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
        log: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        reg: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M3 10h18M7 14h3"/></svg>',
        active: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="20" cy="18" r="1.5"/></svg>',
        boss: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>',
        journal: '<svg viewBox="0 0 24 24"><path d="M5 4h13a1 1 0 0 1 1 1v14H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z"/><path d="M9 8h7M9 12h7M9 16h4"/></svg>',
        ana: '<svg viewBox="0 0 24 24"><path d="M4 20h16"/><rect x="6" y="11" width="3" height="6"/><rect x="11" y="7" width="3" height="10"/><rect x="16" y="4" width="3" height="13"/></svg>',
        fleet: '<svg viewBox="0 0 24 24"><path d="M3 13l1.5-5h9l5 5M13 8v5"/><circle cx="7" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/><path d="M9 17h6"/></svg>',
        users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M18 14c2.8.5 4 2.6 4 4.6"/></svg>'
    },

    esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    },

    /* ---------- Авторизация: переключение режима админ/сотрудник ---------- */
    authMode() {
        const v = (document.getElementById('login').value || '').trim().toLowerCase();
        const isAdmin = v && app.users && app.users.some(u => u.role === 'admin' && u.login.toLowerCase() === v);
        const l1 = document.getElementById('auth-login-label');
        const l2 = document.getElementById('auth-pass-label');
        const p2 = document.getElementById('pass');
        if (!l1 || !l2 || !p2) return;
        if (isAdmin) {
            l1.textContent = 'Логин администратора';
            l2.textContent = 'Пароль';
            p2.placeholder = 'Пароль';
        } else {
            l1.textContent = 'ФИО сотрудника';
            l2.textContent = 'Табельный номер';
            p2.placeholder = 'Табельный номер';
        }
    },

    init() {
        const u = app.user;
        document.getElementById('user-info').innerHTML = `<b>${this.esc(u.name)}</b><br><small>${ROLES[u.role]}</small>`;
        let menu = [
            { id: 'dash', n: 'Сводка', roles: ['admin', 'kpp', 'store', 'eng'] },
            { id: 'reg', n: 'Регистрация транспорта', roles: ['admin', 'kpp'] },
            { id: 'active', n: 'Список на территории', roles: ['admin', 'kpp', 'store', 'eng'] },
            { id: 'boss', n: 'LIVE Мониторинг', roles: ['admin', 'boss'] },
            { id: 'ana', n: 'Аналитика', roles: ['admin', 'boss'] },
            { id: 'journal', n: 'Журнал записей', roles: ['admin', 'boss'] },
            { id: 'fleet', n: 'Справочник', roles: ['admin', 'boss', 'kpp', 'store', 'eng'] },
            { id: 'users', n: 'Пользователи', roles: ['admin'] },
            { id: 'log', n: 'Журнал событий', roles: ['admin'] }
        ];
        if (u.role === 'boss') menu = [{ id: 'boss', n: 'LIVE Мониторинг', roles: ['boss'] }];
        document.getElementById('menu-container').innerHTML = menu
            .filter(m => m.roles.includes(u.role))
            .map(m => `<div class="menu-item" onclick="ui.setPage('${m.id}')" id="m-${m.id}">
                <span class="mi-ico">${this.ico[m.id] || ''}</span>${m.n}</div>`).join('');
        document.getElementById('main-app').classList.add('visible');
        const tools = document.getElementById('top-tools');
        tools.style.display = (u.role === 'boss') ? 'none' : 'inline-flex';
        this.setPage(menu[0].id);
        setInterval(() => {
            if (document.hidden) return;
            if (['dash', 'active', 'boss'].includes(app.currentPage)) this.render();
            this.refreshBell();
        }, 30000);
    },

    setPage(id) {
        app.currentPage = id;
        this.currentPageNumber = 1;
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        const mi = document.getElementById(`m-${id}`);
        if (mi) mi.classList.add('active');
        document.getElementById('page-title').innerText = mi ? mi.innerText : 'Раздел';
        document.getElementById('search-wrapper').style.display = (['reg', 'dash', 'ana', 'users', 'fleet'].includes(id)) ? 'none' : 'block';
        const actions = document.getElementById('page-actions');
        actions.innerHTML = '';
        if (id === 'ana') {
            actions.innerHTML = `
                <button class="btn btn-outline btn-sm" onclick="ui.exportAnalyticsCSV()">CSV</button>
                <button class="btn btn-primary btn-sm" onclick="ui.printReport()">ОТЧЁТ</button>`;
        }
        if (id === 'journal') actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="ui.exportJournalCSV()">ВЫГРУЗИТЬ</button>`;
        if (id === 'log') actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="ui.exportLogCSV()">ВЫГРУЗИТЬ</button>`;
        const cont = document.getElementById('data-container');
        cont.classList.remove('page-enter');
        void cont.offsetWidth;
        cont.classList.add('page-enter');
        this.render();
        this.closePopovers();
    },

    fTime(ts) { return ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'; },
    fFull(ts) { return ts ? new Date(ts).toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; },
    fDate(ts) { return ts ? new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; },
    mins(ts) { return ts ? Math.floor((Date.now() - ts) / 60000) : 0; },
    dur(ms) {
        if (!ms) return '0 мин.';
        const m = Math.round(ms / 60000);
        if (m < 60) return `${m} мин.`;
        const h = Math.floor(m / 60), mm = m % 60;
        return `${h} ч ${mm} мин.`;
    },

    statusBadge(st) {
        const map = {
            [STATUS.IN]: 'badge-blue',
            [STATUS.STORE_IN]: 'badge-blue',
            [STATUS.STORE_OUT]: 'badge-gold',
            [STATUS.ENG_IN]: 'badge-gold',
            [STATUS.READY]: 'badge-gold',
            [STATUS.LOADING]: 'badge-gold',
            [STATUS.LOADED]: 'badge-green',
            [STATUS.EXITED]: 'badge-gray'
        };
        return `<span class="badge ${map[st] || 'badge-gray'}">${this.esc(st)}</span>`;
    },

    render() {
        const cont = document.getElementById('data-container');
        const p = app.currentPage;
        const q = app.searchQuery.toLowerCase();
        cont.innerHTML = '';

        if (p === 'dash') this.renderDash(cont);
        else if (p === 'reg') this.renderReg(cont);
        else if (p === 'active') this.renderActive(cont, q);
        else if (p === 'boss') this.renderLive(cont, q);
        else if (p === 'journal') this.renderJournal(cont, q);
        else if (p === 'fleet') this.renderFleet(cont);
        else if (p === 'users') this.renderUsers(cont);
        else if (p === 'log') this.renderLog(cont, q);
        else if (p === 'ana') this.renderAnalytics(cont);
    },

    /* ================= СВОДКА ================= */
    renderDash(cont) {
        const onSite = app.db.filter(x => !x.t_out);
        const loading = onSite.filter(x => x.status === STATUS.LOADING);
        const over = onSite.filter(x => this.mins(x.t_in) > 90);
        const todayCount = app.db.filter(x => new Date(x.t_in).toDateString() === new Date().toDateString()).length;
        const ex = app.db.filter(x => x.t_out);
        const avgStay = ex.length ? ex.reduce((s, x) => s + (x.t_out - x.t_in), 0) / ex.length : 0;

        cont.innerHTML = `
        <div class="stats-row">
            <div class="stat-card"><div class="stat-label">Заездов сегодня</div><div class="stat-value">${todayCount}</div><div class="stat-sub">Всего за всё время: ${app.db.length}</div></div>
            <div class="stat-card gold"><div class="stat-label">Сейчас на территории</div><div class="stat-value">${onSite.length}</div><div class="stat-sub">На погрузке: ${loading.length}</div></div>
            <div class="stat-card"><div class="stat-label">Среднее время на базе</div><div class="stat-value">${this.dur(avgStay)}</div><div class="stat-sub">По завершённым визитам</div></div>
            <div class="stat-card red"><div class="stat-label">Превышение 90 мин.</div><div class="stat-value">${over.length}</div><div class="stat-sub">Требует внимания</div></div>
        </div>
        <div class="dash-grid">
            <div class="panel">
                <div class="panel-head"><h3>Сейчас на территории</h3>
                    <button class="btn btn-outline btn-sm" onclick="ui.setPage('active')">ОТКРЫТЬ</button></div>
                <div class="panel-body" style="padding-top:0;">
                    ${onSite.length === 0
                        ? `<div class="empty-state"><h3>Территория свободна</h3><p>Сейчас нет транспорта на базе</p></div>`
                        : `<table class="mini-table">
                            <thead><tr><th>№</th><th>Транспорт</th><th>Водитель</th><th>Время</th><th>Статус</th></tr></thead>
                            <tbody>${onSite.slice(0, 8).map(i => `<tr>
                                <td>${i.num}</td><td>${this.esc(i.truck)}</td><td>${this.esc(i.driver)}</td>
                                <td>${this.fTime(i.t_in)}</td><td>${this.statusBadge(i.status)}</td></tr>`).join('')}
                            </tbody></table>`}
                </div>
            </div>
            <div class="panel">
                <div class="panel-head"><h3>Последние события</h3>
                    <button class="btn btn-outline btn-sm" onclick="ui.setPage('log')">ЖУРНАЛ</button></div>
                <div class="panel-body" style="padding-top:0;">
                    ${app.log.length === 0
                        ? `<div class="empty-state"><h3>Событий нет</h3></div>`
                        : `<ul class="event-list">${app.log.slice(-7).reverse().map(l => `
                            <li><span class="event-dot ${this.logDot(l.act)}"></span>
                                <span class="event-text"><b>${this.esc(l.act)}</b> — ${this.esc(l.inf)}<br><small>${this.esc(l.usr)}</small></span>
                                <span class="event-time">${l.dt} ${l.tm}</span></li>`).join('')}</ul>`}
                </div>
            </div>
        </div>`;
    },

    logDot(act) {
        if (act.includes('ПРОСТОЙ')) return 'red';
        if (act.includes('Вход') || act.includes('Выход')) return 'gold';
        if (act.includes('Удаление')) return 'red';
        if (act.includes('Погрузка завершена') || act.includes('Регистрация')) return 'green';
        return 'blue';
    },

    /* ================= РЕГИСТРАЦИЯ (выпадающие списки с поиском) ================= */
    renderReg(cont) {
        const dt = new Date();
        const p = n => String(n).padStart(2, '0');
        cont.innerHTML = `
        <div class="reg-card">
            <div class="reg-head">Регистрация талона №${app.db.length + 1}</div>
            <div class="reg-body">
                <div class="form-group">
                    <label>Транспортное средство</label>
                    <div class="combo">
                        <input id="reg-truck" placeholder="Введите номер или выберите из списка..." autocomplete="off" oninput="ui.comboFilter('truck')">
                        <div class="combo-list" id="combo-truck"></div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Водитель (полное ФИО)</label>
                    <div class="combo">
                        <input id="reg-driver" placeholder="Введите ФИО или выберите из списка..." autocomplete="off" oninput="ui.comboFilter('driver')">
                        <div class="combo-list" id="combo-driver"></div>
                    </div>
                </div>
                <div class="reg-meta">
                    <span>Дата: ${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}</span>
                    <span>Время: ${p(dt.getHours())}:${p(dt.getMinutes())}</span>
                </div>
                <button class="btn btn-primary btn-block" onclick="app.registerEntry()">ЗАРЕГИСТРИРОВАТЬ ВЪЕЗД</button>
            </div>
        </div>`;
        this.comboRefresh('truck');
        this.comboRefresh('driver');
    },

    comboFilter(type) {
        this.comboRefresh(type);
    },

    comboRefresh(type) {
        const input = document.getElementById(type === 'truck' ? 'reg-truck' : 'reg-driver');
        if (!input) return;
        const q = input.value.toLowerCase();
        const list = type === 'truck' ? app.trucks : app.drivers;
        const sel = type === 'truck' ? this.selTruck : this.selDriver;
        const box = document.getElementById(type === 'truck' ? 'combo-truck' : 'combo-driver');
        box.innerHTML = list
            .filter(x => !q || x.toLowerCase().includes(q))
            .map(x => `<div class="combo-item ${x === sel ? 'sel' : ''}" onclick="ui.comboPick('${type}', '${this.esc(x).replace(/'/g, '&#39;')}')" onmousedown="event.preventDefault()">${this.esc(x)}</div>`)
            .join('') || `<div class="combo-empty">Ничего не найдено</div>`;
    },

    comboPick(type, val) {
        const unesc = (() => { const d = document.createElement('div'); d.innerHTML = val; return d.textContent; })();
        if (type === 'truck') { this.selTruck = unesc; document.getElementById('reg-truck').value = unesc; }
        else { this.selDriver = unesc; document.getElementById('reg-driver').value = unesc; }
        this.comboRefresh(type);
    },

    /* ================= СПИСОК НА ТЕРРИТОРИИ ================= */
    renderActive(cont, q) {
        let list = app.db.filter(x => !x.t_out);
        if (q) {
            list = list.filter(x =>
                x.truck.toLowerCase().includes(q) ||
                x.driver.toLowerCase().includes(q) ||
                String(x.num).includes(q) ||
                this.fFull(x.t_in).toLowerCase().includes(q));
        }
        const pList = this.paginate(list);
        cont.innerHTML = `<div class="grid">${pList.map((i, idx) => this.drawCard(i, idx)).join('')}</div>`;
        this.drawPagination(list.length, cont);
    },

    drawCard(i, idx) {
        const mins = this.mins(i.t_in);
        const maxMins = 90;
        const percent = Math.min((mins / maxMins) * 100, 100);
        let color = '#218838';
        if (percent > 60) color = '#d4af37';
        if (percent >= 100) color = '#c82333';

        let actions = '';
        const r = app.user.role;
        if (r === 'admin' || r === 'kpp') actions += `<button class="btn btn-danger btn-sm" onclick="app.updateStep(${i.id}, 't_out', '${STATUS.EXITED}')">ВЫЕЗД</button>`;
        if (r === 'admin' || r === 'store') {
            if (!i.t_s_in) actions += `<button class="btn btn-primary btn-sm" onclick="app.updateStep(${i.id}, 't_s_in', '${STATUS.STORE_IN}')">ПРИБЫЛ СКЛАД</button>`;
            else if (!i.t_s_out) actions += `<button class="btn btn-success btn-sm" onclick="app.updateStep(${i.id}, 't_s_out', '${STATUS.STORE_OUT}')">УБЫЛ СКЛАД</button>`;
        }
        if (r === 'admin' || r === 'eng') {
            if (!i.t_e_in) actions += `<button class="btn btn-primary btn-sm" onclick="app.updateStep(${i.id}, 't_e_in', '${STATUS.ENG_IN}')">ПРИБЫЛ ИНЖ.</button>`;
            else if (!i.p_data) actions += `<button class="btn btn-accent btn-sm" onclick="ui.openModal(${i.id})">ТАЛОН</button>`;
        }
        if (r === 'admin' || r === 'store' || r === 'eng') {
            if (!i.craneStart) actions += `<button class="btn btn-outline btn-sm" onclick="ui.openCrane(${i.id})">КРАН</button>`;
            else if (!i.craneEnd) actions += `<button class="btn btn-accent btn-sm" onclick="ui.openCrane(${i.id})">КРАН: ИДЁТ</button>`;
        }
        if (r === 'admin') actions += `<button class="btn btn-secondary btn-sm" onclick="app.deleteRecord(${i.id})">УДАЛИТЬ</button>`;

        const craneInfo = i.craneStart ? (i.craneEnd
            ? `<div class="crane-line">Кран: <b>${this.esc(i.crane)}</b> · ${this.dur(i.craneEnd - i.craneStart)}${i.idle > 0 ? ` · <span class="idle-text">простой ${i.idle} мин.</span>` : ''}</div>`
            : `<div class="crane-line">Кран: <b>${this.esc(i.crane)}</b> · загрузка ${this.mins(i.craneStart)} мин.</div>`) : '';

        return `
            <div class="card" style="animation-delay:${Math.min(idx * 0.04, 0.4)}s;">
                <div class="card-head"><h4>${this.esc(i.truck)}</h4><span class="card-num">№${i.num}</span></div>
                <div class="card-driver">${this.esc(i.driver)}</div>
                <div class="card-badges">${this.statusBadge(i.status)}</div>
                <div class="timer-box">
                    <div class="timer-row"><span>На базе: <b>${mins} мин.</b></span><span>Предел 90 мин.</span></div>
                    <div class="progress-bg"><div class="progress-fill" style="width:${percent}%; background:${color}"></div></div>
                    ${mins >= maxMins ? '<div class="stall-alert">ПРЕВЫШЕНИЕ ВРЕМЕНИ НА ТЕРРИТОРИИ</div>' : ''}
                    ${craneInfo}
                </div>
                <div class="card-foot">Въезд: ${this.fTime(i.t_in)} · ${this.fDate(i.t_in)}</div>
                <div class="card-actions">${actions}</div>
            </div>`;
    },

    /* ================= LIVE МОНИТОРИНГ ================= */
    renderLive(cont, q) {
        let list = app.db.filter(x => !x.t_out);
        if (q) {
            list = list.filter(x =>
                x.truck.toLowerCase().includes(q) ||
                x.driver.toLowerCase().includes(q) ||
                String(x.num).includes(q));
        }
        cont.innerHTML = `
        <div class="stats-row">
            <div class="stat-card"><div class="stat-label">На территории</div><div class="stat-value">${list.length}</div></div>
            <div class="stat-card red"><div class="stat-label">Превышение 90 мин.</div><div class="stat-value">${list.filter(x => this.mins(x.t_in) > 90).length}</div></div>
            <div class="stat-card gold"><div class="stat-label">Обновление</div><div class="stat-value" style="font-size:20px; padding-top:12px;">авто · 30 сек.</div></div>
        </div>
        <div class="table-container"><table>
            <thead><tr><th>№</th><th>Транспорт</th><th>Водитель</th><th>Въезд</th><th>Минут</th><th>Статус</th></tr></thead>
            <tbody>${list.map(i => `<tr>
                <td>${i.num}</td><td><b>${this.esc(i.truck)}</b></td><td>${this.esc(i.driver)}</td>
                <td>${this.fTime(i.t_in)}</td>
                <td style="color:${this.mins(i.t_in) > 90 ? '#c82333; font-weight:700;' : 'inherit'}"><b>${this.mins(i.t_in)}</b></td>
                <td>${this.statusBadge(i.status)}</td>
            </tr>`).join('') || `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">Нет транспорта на территории</td></tr>`}
            </tbody></table></div>`;
    },

    /* ================= ЖУРНАЛ ЗАПИСЕЙ ================= */
    renderJournal(cont, q) {
        let list = [...app.db].sort((a, b) => b.t_in - a.t_in);
        if (q) {
            list = list.filter(x =>
                x.truck.toLowerCase().includes(q) ||
                x.driver.toLowerCase().includes(q) ||
                String(x.num).includes(q) ||
                this.fFull(x.t_in).toLowerCase().includes(q) ||
                (x.crane || '').toLowerCase().includes(q));
        }
        const pList = this.paginate(list);
        cont.innerHTML = `<div class="table-container"><table>
            <thead><tr>
                <th>№</th><th>Транспорт</th><th>Водитель</th>
                <th>Въезд</th><th>Кладовщик</th><th>Инженер</th><th>Кран</th>
                <th>Выезд</th><th>Статус</th>
            </tr></thead>
            <tbody>${pList.map(i => `<tr>
                <td><b>${i.num}</b></td><td>${this.esc(i.truck)}</td><td>${this.esc(i.driver)}</td>
                <td>${this.fFull(i.t_in)}</td>
                <td>${i.t_s_in ? `<b>${this.fTime(i.t_s_in)}</b>` : '—'}${i.t_s_out ? ` / ${this.fTime(i.t_s_out)}` : ''}</td>
                <td>${i.t_e_in ? `<b>${this.fTime(i.t_e_in)}</b>` : '—'}${i.t_e_out ? ` / ${this.fTime(i.t_e_out)}` : ''}</td>
                <td>${i.crane ? `<b>${this.esc(i.crane)}</b>${i.craneEnd ? `<br><small>${this.dur(i.craneEnd - i.craneStart)}${i.idle > 0 ? ` · <span class="idle-text">+${i.idle}</span>` : ''}</small>` : ''}` : '—'}</td>
                <td>${this.fFull(i.t_out)}</td>
                <td>${this.statusBadge(i.status)}</td>
            </tr>`).join('') || `<tr><td colspan="9" style="text-align:center; padding:40px; color:var(--text-muted);">Записей нет</td></tr>`}
            </tbody></table></div>`;
        this.drawPagination(list.length, cont);
    },

    /* ================= СПРАВОЧНИК (раздельные области) ================= */
    renderFleet(cont) {
        const canEdit = app.user.role === 'admin';
        cont.innerHTML = `
        <div class="dash-grid one">
            <div class="panel">
                <div class="panel-head"><h3>Транспортные средства</h3><span class="tool-count" id="fleet-tcnt"></span></div>
                <div class="panel-body">
                    <input id="fleet-search-t" class="search-input" style="max-width:100%; margin-bottom:10px;" placeholder="Поиск по гос. номеру..." oninput="ui.renderFleetLocal()">
                    <div class="table-container" style="border:none; box-shadow:none; margin:0;">
                        <table style="min-width:500px;">
                            <thead><tr><th>№</th><th>Гос. номер</th><th>Визитов</th>${canEdit ? '<th></th>' : ''}</tr></thead>
                            <tbody id="fleet-tbody-t"></tbody>
                        </table></div>
                    ${canEdit ? `<div class="fleet-add">
                        <input id="fleet-plate" placeholder="Гос. номер (напр. А123ВС 86)">
                        <button class="btn btn-primary" onclick="app.addTruck()">ДОБАВИТЬ</button>
                    </div>` : ''}
                </div>
            </div>
            <div class="panel">
                <div class="panel-head"><h3>Водители</h3><span class="tool-count" id="fleet-dcnt"></span></div>
                <div class="panel-body">
                    <input id="fleet-search-d" class="search-input" style="max-width:100%; margin-bottom:10px;" placeholder="Поиск по ФИО..." oninput="ui.renderFleetLocal()">
                    <div class="table-container" style="border:none; box-shadow:none; margin:0;">
                        <table style="min-width:500px;">
                            <thead><tr><th>№</th><th>ФИО</th>${canEdit ? '<th></th>' : ''}</tr></thead>
                            <tbody id="fleet-tbody-d"></tbody>
                        </table></div>
                    ${canEdit ? `<div class="fleet-add">
                        <input id="fleet-driver" placeholder="Полное ФИО водителя">
                        <button class="btn btn-primary" onclick="app.addDriver()">ДОБАВИТЬ</button>
                    </div>` : ''}
                </div>
            </div>
        </div>`;
        this.renderFleetLocal();
    },

    renderFleetLocal() {
        const et = document.getElementById('fleet-tbody-t');
        const ed = document.getElementById('fleet-tbody-d');
        if (!et || !ed) return;
        const canEdit = app.user.role === 'admin';
        const qt = (document.getElementById('fleet-search-t')?.value || '').toLowerCase();
        const qd = (document.getElementById('fleet-search-d')?.value || '').toLowerCase();
        const trucks = app.trucks.filter(t => !qt || t.toLowerCase().includes(qt));
        const drivers = app.drivers.filter(d => !qd || d.toLowerCase().includes(qd));
        const visits = plate => app.db.filter(x => x.truck === plate).length;
        document.getElementById('fleet-tcnt').textContent = `${trucks.length} ед.`;
        document.getElementById('fleet-dcnt').textContent = `${drivers.length} чел.`;
        et.innerHTML = trucks.map((t, i) => `<tr>
            <td>${i + 1}</td><td><b>${this.esc(t)}</b></td>
            <td><span class="badge badge-blue">${visits(t)}</span></td>
            ${canEdit ? `<td><button class="btn btn-secondary btn-sm" onclick="app.removeTruck(${app.trucks.indexOf(t)})">УДАЛИТЬ</button></td>` : ''}
        </tr>`).join('') || `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">Ничего не найдено</td></tr>`;
        ed.innerHTML = drivers.map((d, i) => `<tr>
            <td>${i + 1}</td><td><b>${this.esc(d)}</b></td>
            ${canEdit ? `<td><button class="btn btn-secondary btn-sm" onclick="app.removeDriver(${app.drivers.indexOf(d)})">УДАЛИТЬ</button></td>` : ''}
        </tr>`).join('') || `<tr><td colspan="3" style="text-align:center; padding:30px; color:var(--text-muted);">Ничего не найдено</td></tr>`;
    },

    /* ================= ПОЛЬЗОВАТЕЛИ (только админ) ================= */
    renderUsers(cont) {
        if (app.user.role !== 'admin') { cont.innerHTML = '<div class="empty-state">Доступ только для администратора</div>'; return; }
        const rows = app.users.map(u => `<tr>
            <td><b>${this.esc(u.name)}</b><br><small style="color:var(--text-muted);">${this.esc(u.login)}</small></td>
            <td>${this.esc(u.tab) || '—'}</td>
            <td><select class="role-select" onchange="app.updateUserRole('${u.id}', this.value)">
                ${Object.keys(ROLES).map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${ROLES[r]}</option>`).join('')}
            </select></td>
            <td><div class="btn-group-sm">
                <button class="btn btn-outline btn-sm" onclick="app.resetUserPass('${u.id}')">ПАРОЛЬ</button>
                <button class="btn btn-secondary btn-sm" onclick="app.deleteUser('${u.id}')">УДАЛИТЬ</button>
            </div></td>
        </tr>`).join('');
        cont.innerHTML = `
        <div class="dash-grid one">
            <div class="panel">
                <div class="panel-head"><h3>Новый пользователь</h3></div>
                <div class="panel-body">
                    <div class="grid2">
                        <div class="form-group"><label>ФИО (полностью)</label><input id="u-name" placeholder="Фамилия Имя Отчество"></div>
                        <div class="form-group"><label>Логин (если отличается от ФИО)</label><input id="u-login" placeholder="оставьте пустым = ФИО"></div>
                        <div class="form-group"><label>Табельный номер (пароль)</label><input id="u-tab" type="text" placeholder="только цифры" inputmode="numeric"></div>
                        <div class="form-group"><label>Роль</label>
                            <select id="u-role">${Object.keys(ROLES).map(r => `<option value="${r}">${ROLES[r]}</option>`).join('')}</select>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="app.addUser()">СОЗДАТЬ ПОЛЬЗОВАТЕЛЯ</button>
                </div>
            </div>
            <div class="panel">
                <div class="panel-head"><h3>Список пользователей</h3><span class="tool-count">${app.users.length}</span></div>
                <div class="panel-body" style="padding-top:0;">
                    <div class="table-container" style="border:none; box-shadow:none; margin:0;">
                        <table style="min-width:700px;">
                            <thead><tr><th>ФИО / Логин</th><th>Табельный №</th><th>Роль</th><th>Действия</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table></div>
                </div>
            </div>
            <div class="panel">
                <div class="panel-head"><h3>Резервное копирование</h3></div>
                <div class="panel-body">
                    <p class="field-hint">База хранится локально на устройстве. Скачивайте резервную копию до очистки данных устройства.</p>
                    <div class="fleet-add">
                        <button class="btn btn-primary" onclick="app.backup()">СКАЧАТЬ КОПИЮ</button>
                        <label class="btn btn-outline">ВОССТАНОВИТЬ
                            <input type="file" accept=".json,application/json" style="display:none;" onchange="app.restoreFromFile(this)">
                        </label>
                    </div>
                </div>
            </div>
        </div>`;
    },

    /* ================= ЖУРНАЛ СОБЫТИЙ ================= */
    renderLog(cont, q) {
        let list = [...app.log].reverse();
        if (q) list = list.filter(x => x.fs.includes(q));
        const pList = this.paginate(list);
        cont.innerHTML = `<div class="table-container"><table>
            <thead><tr><th>Дата/Время</th><th>Кто</th><th>Событие</th><th>Инфо</th></tr></thead>
            <tbody>${pList.map(l => `<tr>
                <td>${l.dt} ${l.tm}</td><td><b>${this.esc(l.usr)}</b></td>
                <td>${l.act.includes('ПРОСТОЙ') ? `<span class="idle-badge">${this.esc(l.act)}</span>` : this.esc(l.act)}</td>
                <td>${this.esc(l.inf)}</td>
            </tr>`).join('') || `<tr><td colspan="4" style="text-align:center; padding:40px; color:var(--text-muted);">Событий нет</td></tr>`}
            </tbody></table></div>`;
        this.drawPagination(list.length, cont);
    },

    /* ================= АНАЛИТИКА ================= */
    renderAnalytics(cont) {
        if (!app.db.length) {
            cont.innerHTML = `<div class="panel"><div class="empty-state"><h3>Нет данных для аналитики</h3><p>Зарегистрируйте транспорт — отчёты появятся автоматически</p></div></div>`;
            return;
        }
        const d1 = new Date();
        d1.setDate(d1.getDate() - 30);
        cont.innerHTML = `
        <div class="analytics-toolbar">
            <div class="form-group"><label>Период с</label><input type="date" id="ana-from" value="${d1.toISOString().slice(0, 10)}"></div>
            <div class="form-group"><label>Период по</label><input type="date" id="ana-to" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="form-group" style="min-width:200px;">
                <label>Показатель</label>
                <select id="ana-metric" onchange="ui.renderAnalyticsCharts()">
                    <option value="visits">Заезды по дням</option>
                    <option value="hours">Пиковые часы</option>
                    <option value="status">Статусы</option>
                    <option value="idle">Простои (загрузка)</option>
                </select>
            </div>
            <button class="btn btn-primary" onclick="ui.renderAnalyticsCharts()">ПРИМЕНИТЬ</button>
        </div>
        <div id="ana-charts"></div>`;
        this.renderAnalyticsCharts();
    },

    getPeriod() {
        const from = document.getElementById('ana-from').value;
        const to = document.getElementById('ana-to').value;
        return {
            f: from ? new Date(from + 'T00:00:00') : new Date(0),
            t: to ? new Date(to + 'T23:59:59') : new Date()
        };
    },

    filterPeriod() {
        const { f, t } = this.getPeriod();
        return app.db.filter(x => x.t_in >= f.getTime() && x.t_in <= t.getTime());
    },

    renderAnalyticsCharts() {
        const box = document.getElementById('ana-charts');
        if (!box) return;
        const metric = document.getElementById('ana-metric')?.value || 'visits';
        const list = this.filterPeriod();
        if (!list.length) {
            box.innerHTML = `<div class="panel"><div class="empty-state"><h3>Нет данных за период</h3><p>Измените даты</p></div></div>`;
            return;
        }
        let html = '';
        if (metric === 'visits') html += this.chartVisits(list);
        else if (metric === 'hours') html += this.chartHours(list);
        else if (metric === 'status') html += this.chartStatus(list);
        else if (metric === 'idle') html += this.chartIdle(list);
        html += `<div class="dash-grid one">${this.chartIdleTable(list)}</div>`;
        box.innerHTML = html;
    },

    chartVisits(list) {
        const { f, t } = this.getPeriod();
        const days = [];
        const cur = new Date(f); cur.setHours(0, 0, 0, 0);
        while (cur <= t) {
            const key = cur.toDateString();
            days.push({ key, label: this.fDateShort(cur.getTime()), date: cur.getTime(), count: 0 });
            cur.setDate(cur.getDate() + 1);
        }
        list.forEach(x => {
            const d = new Date(x.t_in);
            const hit = days.find(k => k.key === d.toDateString());
            if (hit) hit.count++;
        });
        const max = Math.max(...days.map(d => d.count), 1);
        return `<div class="chart-box">
            <h3>Динамика заездов по дням</h3>
            <div class="chart-sub">${days.length} дн. · всего ${list.length} заездов</div>
            <div class="chart-wrap">${this.barChart(days.map(d => d.count), days.map(d => d.label), max, 'Заездов')}</div>
        </div>`;
    },

    chartHours(list) {
        const hours = Array(24).fill(0);
        list.forEach(x => hours[new Date(x.t_in).getHours()]++);
        const max = Math.max(...hours, 1);
        const mode = hours.indexOf(max);
        return `<div class="chart-box">
            <h3>Пиковые часы заездов</h3>
            <div class="chart-sub">Максимум в ${String(mode).padStart(2, '0')}:00 — ${max} заездов</div>
            <div class="chart-wrap">${this.barChart(hours, hours.map((_, i) => String(i).padStart(2, '0') + ':00'), max, 'Заездов')}</div>
        </div>`;
    },

    chartStatus(list) {
        const counts = {};
        list.forEach(x => { counts[x.status] = (counts[x.status] || 0) + 1; });
        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const total = list.length;
        const colors = ['#004a99', '#d4af37', '#218838', '#c82333', '#6c757d', '#0066cc', '#e67e22'];
        return `<div class="chart-box">
            <h3>Распределение по статусам</h3>
            <div class="chart-sub">Всего записей: ${total}</div>
            <div style="display:flex; align-items:center; gap:30px; flex-wrap:wrap;">
                ${this.donutChart(entries.map(e => e[1]), colors)}
                <div class="chart-legend" style="flex-direction:column; gap:10px; margin:0;">
                    ${entries.map((e, i) => `<span class="lg"><span class="sw" style="background:${colors[i % colors.length]}"></span>${this.esc(e[0])} — <b>${e[1]}</b> (${Math.round(e[1] / total * 100)}%)</span>`).join('')}
                </div>
            </div>
        </div>`;
    },

    chartIdle(list) {
        const byCrane = {};
        list.filter(x => x.crane && x.craneEnd).forEach(x => {
            if (!byCrane[x.crane]) byCrane[x.crane] = { ops: 0, idle: 0 };
            const d = (x.craneEnd - x.craneStart) / 60000;
            byCrane[x.crane].ops++;
            byCrane[x.crane].idle += Math.max(0, d - CRANE_LIMIT_MIN);
        });
        const entries = Object.entries(byCrane);
        if (!entries.length) {
            return `<div class="chart-box"><h3>Простои при погрузке</h3>
                <div class="empty-state"><h3>Нет данных о погрузках</h3><p>Появятся после фиксации загрузки на кране</p></div></div>`;
        }
        return `<div class="chart-box">
            <h3>Простой по кранам (мин.)</h3>
            <div class="chart-sub">Лимит: ${CRANE_LIMIT_MIN} мин. на погрузку</div>
            <div class="chart-wrap">${this.barChart(entries.map(e => Math.round(e[1].idle)), entries.map(e => this.esc(e[0])), Math.max(...entries.map(e => Math.round(e[1].idle)), 1), 'Простой, мин.')}</div>
            <div class="chart-legend">
                ${entries.map(e => `<span class="lg"><span class="sw" style="background:${e[1].idle > 0 ? '#c82333' : '#218838'}"></span>${this.esc(e[0])}: ${e[1].ops} погр. · простой ${Math.round(e[1].idle)} мин.</span>`).join('')}
            </div>
        </div>`;
    },

    chartIdleTable(list) {
        const idle = list.filter(x => x.crane && x.craneEnd && x.idle > 0).sort((a, b) => b.idle - a.idle);
        if (!idle.length) {
            return `<div class="panel"><div class="panel-head"><h3>Простои за период</h3></div>
                <div class="panel-body"><div class="empty-state"><h3>Простоев нет</h3><p>Все погрузки в пределах лимита ${CRANE_LIMIT_MIN} мин.</p></div></div></div>`;
        }
        return `<div class="panel"><div class="panel-head"><h3>Простои за период (${idle.length})</h3>
            <button class="btn btn-outline btn-sm" onclick="ui.exportIdleCSV()">CSV</button></div>
            <div class="panel-body" style="padding-top:0;">
            <div class="table-container" style="border:none; box-shadow:none; margin:0;"><table style="min-width:700px;">
                <thead><tr><th>Дата</th><th>Транспорт</th><th>Водитель</th><th>Кран</th><th>Длительность</th><th>Простой</th></tr></thead>
                <tbody>${idle.slice(0, 20).map(x => `<tr>
                    <td>${this.fFull(x.craneStart)}</td><td><b>${this.esc(x.truck)}</b></td><td>${this.esc(x.driver)}</td>
                    <td>${this.esc(x.crane)}</td><td>${this.dur(x.craneEnd - x.craneStart)}</td>
                    <td><span class="idle-badge">+${x.idle} мин.</span></td>
                </tr>`).join('')}</tbody>
            </table></div></div></div>`;
    },

    barChart(values, labels, max, unit) {
        const W = 760, H = 260, PL = 42, PB = 42, PT = 14, PR = 10;
        const iw = W - PL - PR, ih = H - PT - PB;
        const n = values.length;
        const bw = Math.max(6, (iw / n) * 0.62);
        const step = iw / n;
        let g = '';
        for (let i = 0; i <= 4; i++) {
            const y = PT + ih - (ih * i / 4);
            const v = Math.round(max * i / 4);
            g += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#e6eaf0"/>`;
            g += `<text x="${PL - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6c757d">${v}</text>`;
        }
        values.forEach((v, i) => {
            const x = PL + i * step + (step - bw) / 2;
            const h = v ? (ih * v / max) : 2;
            const y = PT + ih - h;
            g += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 2)}" rx="2" fill="${v > 0 ? '#004a99' : '#e6eaf0'}" opacity="${v > 0 ? 1 : 0.4}"><title>${labels[i]}: ${v} ${unit}</title></rect>`;
            if (n <= 31 && (n <= 15 || i % Math.ceil(n / 15) === 0)) {
                g += `<text x="${x + bw / 2}" y="${H - PB + 16}" text-anchor="middle" font-size="10" fill="#6c757d">${labels[i]}</text>`;
            }
        });
        return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;">${g}</svg>`;
    },

    donutChart(values, colors) {
        const size = 200, r = 66, sw = 30, cx = size / 2, cy = size / 2;
        const total = values.reduce((s, v) => s + v, 0) || 1;
        const R = r + sw / 2;
        const circ = 2 * Math.PI * R;
        let off = 0, arcs = '';
        values.forEach((v, i) => {
            const frac = v / total;
            const dash = frac * circ;
            const rot = off / circ * 360 - 90;
            arcs += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${colors[i % colors.length]}"
                stroke-width="${sw}" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-off}" transform="rotate(${rot} ${cx} ${cy})"></circle>`;
            off += dash;
        });
        return `<svg width="${size}" height="${size}">
            ${arcs}
            <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="24" font-weight="800" fill="#002d5a">${total}</text>
        </svg>`;
    },

    fDateShort(ts) {
        const d = new Date(ts);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    },

    /* ================= УВЕДОМЛЕНИЯ И ПРОФИЛЬ ================= */
    buildNotifs() {
        const role = app.user.role;
        const now = Date.now();
        const list = [];
        const over = app.db.filter(x => !x.t_out && now - x.t_in > 90 * 60000).length;
        const loading = app.db.filter(x => x.status === STATUS.LOADING);
        const waitStore = app.db.filter(x => x.status === STATUS.STORE_IN && !x.t_s_out).length;
        const waitEng = app.db.filter(x => x.status === STATUS.ENG_IN && !x.p_data).length;
        const unreadMsgs = app.msgs.filter(m => !m.answer).length;

        if (role === 'admin' || role === 'kpp') {
            if (over > 0) list.push({ t: `Превышение времени: ${over} ТС на территории`, page: 'active', icon: 'red' });
        }
        if (role === 'admin' || role === 'store') {
            if (waitStore > 0) list.push({ t: `На складе ожидают: ${waitStore}`, page: 'active', icon: 'blue' });
        }
        if (role === 'admin' || role === 'eng') {
            if (waitEng > 0) list.push({ t: `Ожидают талон у инженера: ${waitEng}`, page: 'active', icon: 'gold' });
        }
        if (role === 'admin' || role === 'store' || role === 'eng') {
            const idleLoad = loading.filter(x => now - x.craneStart > CRANE_LIMIT_MIN * 60000).length;
            if (idleLoad > 0) list.push({ t: `Простой погрузки: ${idleLoad}`, page: 'active', icon: 'red' });
        }
        if (role === 'admin') {
            if (unreadMsgs > 0) list.push({ t: `Обращения в поддержку: ${unreadMsgs}`, page: 'support', icon: 'gold' });
        }
        return list;
    },

    refreshBell() {
        if (!app.user || app.user.role === 'boss') return;
        const n = this.buildNotifs().length;
        const count = document.getElementById('bell-count');
        if (!count) return;
        count.textContent = n;
        count.style.display = n ? 'block' : 'none';
    },

    togglePanel(which) {
        const isBell = which === 'bell';
        const pop = document.getElementById(isBell ? 'bell-pop' : 'profile-pop');
        const other = document.getElementById(isBell ? 'profile-pop' : 'bell-pop');
        other.classList.remove('open');
        if (pop.classList.contains('open')) { pop.classList.remove('open'); return; }
        if (isBell) this.renderBell(pop);
        else this.renderProfile(pop);
        pop.classList.add('open');
    },

    closePopovers() {
        document.querySelectorAll('.popover').forEach(p => p.classList.remove('open'));
    },

    renderBell(pop) {
        const items = this.buildNotifs();
        pop.innerHTML = items.length
            ? `<div class="pop-head">Уведомления</div>` + items.map(x => `
                <div class="pop-item" onclick="ui.notifGo('${x.page}')">
                    <span class="event-dot ${x.icon}"></span>${this.esc(x.t)}
                </div>`).join('')
            : `<div class="pop-head">Уведомления</div><div class="pop-empty">Сейчас всё спокойно</div>`;
    },

    notifGo(page) {
        this.closePopovers();
        if (page === 'support') { this.openSupport(); return; }
        this.setPage(page);
    },

    renderProfile(pop) {
        const u = app.user;
        pop.innerHTML = `
            <div class="pop-head">Профиль</div>
            <div class="profile-line"><b>${this.esc(u.name)}</b></div>
            <div class="profile-line">${ROLES[u.role]}</div>
            ${u.tab ? `<div class="profile-line">Табельный: ${this.esc(u.tab)}</div>` : ''}
            <button class="btn btn-outline btn-sm btn-block" style="margin-top:10px;" onclick="ui.openSupport()">ПОДДЕРЖКА И ОБРАЩЕНИЯ</button>
        `;
        this.closePopovers();
        pop.classList.add('open');
    },

    /* ================= ПОДДЕРЖКА ================= */
    openSupport() {
        const modal = document.getElementById('modal-support');
        modal.style.display = 'flex';
        modal.classList.add('open');
        this.renderMsgs();
    },

    renderMsgs() {
        const body = document.getElementById('support-body');
        if (!body) return;
        const isAdmin = app.user.role === 'admin';
        if (isAdmin) {
            const msgs = [...app.msgs].reverse();
            body.innerHTML = msgs.length ? msgs.map(m => `
                <div class="msg-card ${m.answer ? '' : 'unanswered'}">
                    <div class="msg-head"><b>${this.esc(m.fromName)}</b> <span>${ROLES[m.role] || ''}</span> <small>${this.fFull(m.date)}</small></div>
                    <div class="msg-text">${this.esc(m.text)}</div>
                    ${m.answer
                        ? `<div class="msg-answer"><b>Ответ (${this.esc(m.answeredBy)}):</b> ${this.esc(m.answer)}</div>`
                        : `<div class="msg-reply">
                            <input id="r-${m.id}" placeholder="Ответ администратора...">
                            <button class="btn btn-primary btn-sm" onclick="app.replySupport(${m.id}, document.getElementById('r-${m.id}').value)">ОТВЕТИТЬ</button>
                          </div>`}
                </div>`).join('')
                : `<div class="empty-state"><h3>Обращений пока нет</h3></div>`;
        } else {
            const mine = app.msgs.filter(m => m.from === app.user.id).reverse();
            body.innerHTML = `
                <div class="msg-form">
                    <textarea id="support-text" rows="3" placeholder="Опишите вопрос или проблему..."></textarea>
                    <button class="btn btn-primary" onclick="app.sendSupport(document.getElementById('support-text').value)">ОТПРАВИТЬ</button>
                </div>
                <h4 style="margin:18px 0 8px;">Мои обращения</h4>
                ${mine.length ? mine.map(m => `
                    <div class="msg-card ${m.answer ? '' : 'unanswered'}">
                        <div class="msg-head"><b>Вы</b> <small>${this.fFull(m.date)}</small></div>
                        <div class="msg-text">${this.esc(m.text)}</div>
                        ${m.answer
                            ? `<div class="msg-answer"><b>Ответ администрации (${this.esc(m.answeredBy)}):</b> ${this.esc(m.answer)}</div>`
                            : `<div class="msg-pending">Ожидает ответа администратора</div>`}
                    </div>`).join('')
                : `<div class="empty-state"><h3>Обращений пока нет</h3><p>Напишите — администратор ответит</p></div>`}`;
        }
    },

    /* ================= МОДАЛКИ ================= */
    openModal(id) {
        app.editingId = id;
        const i = app.db.find(x => x.id === id);
        document.getElementById('modal-permit').style.display = 'flex';
        document.getElementById('modal-permit').classList.add('open');
        if (i && i.p_data) {
            document.getElementById('p-customer').value = i.p_data.cust || '';
            document.getElementById('p-eng-name').value = i.p_data.eng || '';
            document.getElementById('p-crane').value = i.p_data.crane || '';
            document.getElementById('p-shelf').value = i.p_data.shelf || '';
            document.getElementById('p-pipe').value = i.p_data.pipe || '';
            document.getElementById('p-qty').value = i.p_data.qty || '';
            document.getElementById('p-type-1').checked = !!i.p_data.type1;
            document.getElementById('p-type-2').checked = !!i.p_data.type2;
        } else {
            document.getElementById('p-customer').value = '';
            document.getElementById('p-eng-name').value = app.user.name;
            document.getElementById('p-crane').value = '';
            document.getElementById('p-shelf').value = '';
            document.getElementById('p-pipe').value = '';
            document.getElementById('p-qty').value = '';
            document.getElementById('p-type-1').checked = false;
            document.getElementById('p-type-2').checked = false;
        }
    },

    openCrane(id) {
        app.editingId = id;
        const i = app.db.find(x => x.id === id);
        const modal = document.getElementById('modal-crane');
        const sel = document.getElementById('crane-select');
        sel.innerHTML = CRANES.map(c => `<option>${c}</option>`).join('');
        document.getElementById('crane-info').innerHTML = `ТС: <b>${this.esc(i.truck)}</b><br>Водитель: <b>${this.esc(i.driver)}</b>`;
        const startBtn = document.getElementById('crane-start-btn');
        const finishBtn = document.getElementById('crane-finish-btn');
        if (i.craneStart && !i.craneEnd) {
            startBtn.style.display = 'none';
            finishBtn.style.display = '';
            sel.value = i.crane || CRANES[0];
            document.getElementById('crane-limit-hint').innerHTML = `Загрузка идёт ${this.mins(i.craneStart)} мин. Лимит: ${CRANE_LIMIT_MIN} мин.`;
        } else {
            startBtn.style.display = '';
            finishBtn.style.display = 'none';
            sel.value = CRANES[0];
            document.getElementById('crane-limit-hint').innerHTML = `Лимит погрузки: ${CRANE_LIMIT_MIN} мин. Превышение фиксируется как простой.`;
        }
        modal.style.display = 'flex';
        modal.classList.add('open');
    },

    closeModal() {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.classList.remove('open');
            setTimeout(() => { if (!m.classList.contains('open')) m.style.display = 'none'; }, 180);
        });
        this.closePopovers();
    },

    printPermit(i) {
        const d = i.p_data;
        const w = window.open('', '', 'width=900,height=1000');
        w.document.write(`
<html><head><style>
body{font-family:Arial;padding:20px}
.page{width:100%;height:140mm;border:1px solid #000;padding:15px;position:relative;box-sizing:border-box;page-break-after:always;margin-bottom:20px}
.header{text-align:center;margin-bottom:15px}
.line{border-bottom:1px solid #000;margin-bottom:8px;display:flex;justify-content:space-between;font-size:14px}
.footer-box{border:2px dashed #000;padding:10px;text-align:center;margin-top:20px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #000;padding:4px;text-align:center;font-size:11px}
.sign{width:120px;border-bottom:1px solid #000;display:inline-block}
@media print{.page{page-break-after:always}}
</style></head><body>
<div class="page">
<div style="display:flex;justify-content:space-between"><span>Время выдачи талона: <b>${this.esc(d.time)}</b></span><span>A 4027</span></div>
<div class="header"><h1>Талон-разрешение</h1><h3>"___" ___________ 2026</h3></div>
<div class="line"><span>№ а/м: <b>${this.esc(i.truck)}</b></span><span>Водитель: <b>${this.esc(i.driver)}</b></span></div>
<div class="line"><span>Заказчик: <b>${this.esc(d.cust)}</b></span></div>
<div class="line"><span>Инженер ООГ: <b>${this.esc(d.eng)}</b></span><span>Подпись: <span class="sign"></span></span></div>
<div class="line"><span>№ крана: <b>${this.esc(d.crane)}</b></span><span>№ стеллажа: <b>${this.esc(d.shelf)}</b></span></div>
<div class="line"><span>Типоразмер труб: <b>${this.esc(d.pipe)}</b></span></div>
<div class="line"><span>Количество: <b>${this.esc(d.qty)}</b></span></div>
<div class="line"><span>Заведующий складом, кладовщик:</span><span>Подпись: <span class="sign"></span></span></div>
<p>Погрузка: [${d.type1 ? '<b>X</b>' : ' '}] труба [${d.type2 ? '<b>X</b>' : ' '}] патрубки</p>
<div class="footer-box"><h2 style="margin:0">ВОДИТЕЛЬ ВНИМАНИЕ</h2>
<p style="margin:5px">После оформления груза и получения ТТН необходимо покинуть территорию ЦТБ в течение 10 минут.</p></div>
</div>
<div class="page">
<h3 style="text-align:center">Спецификация труб</h3>
<table><thead><tr><th>№</th><th>Краткое наименование труб</th><th>Кол-во шт.</th><th>Метры</th><th>Доп. информация</th></tr></thead>
<tbody>${Array(18).fill('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table>
<p style="margin-top:15px;">Кладовщик: ___________________________ (подпись)</p>
</div>
</body></html>`);
        w.document.close();
    },

    /* ================= ЭКСПОРТ ================= */
    exportJournalCSV() {
        const rows = app.db.map(x => ({
            '№': x.num, 'Транспорт': x.truck, 'Водитель': x.driver,
            'Въезд': this.fFull(x.t_in), 'Кладовщик приб.': x.t_s_in ? this.fTime(x.t_s_in) : '',
            'Кладовщик уб.': x.t_s_out ? this.fTime(x.t_s_out) : '',
            'Инженер приб.': x.t_e_in ? this.fTime(x.t_e_in) : '',
            'Инженер уб.': x.t_e_out ? this.fTime(x.t_e_out) : '',
            'Кран': x.crane || '', 'Простой мин': x.idle || 0,
            'Выезд': this.fFull(x.t_out), 'Статус': x.status
        }));
        app.exportCSV(rows, `Журнал_${new Date().toISOString().slice(0, 10)}.csv`);
    },

    exportLogCSV() {
        const rows = app.log.map(x => ({ 'Дата': x.dt, 'Время': x.tm, 'Кто': x.usr, 'Событие': x.act, 'Инфо': x.inf }));
        app.exportCSV(rows, `События_${new Date().toISOString().slice(0, 10)}.csv`);
    },

    exportAnalyticsCSV() {
        const list = this.filterPeriod();
        const rows = list.map(x => ({
            'Дата': this.fDate(x.t_in), 'Время': this.fTime(x.t_in),
            'Транспорт': x.truck, 'Водитель': x.driver,
            'Кран': x.crane || '', 'Погрузка мин': x.craneStart && x.craneEnd ? Math.round((x.craneEnd - x.craneStart) / 60000) : '',
            'Простой мин': x.idle || 0, 'Выезд': this.fFull(x.t_out), 'Статус': x.status
        }));
        app.exportCSV(rows, `Аналитика_${new Date().toISOString().slice(0, 10)}.csv`);
    },

    exportIdleCSV() {
        const list = this.filterPeriod().filter(x => x.crane && x.craneEnd && x.idle > 0);
        const rows = list.map(x => ({
            'Дата': this.fFull(x.craneStart), 'Транспорт': x.truck, 'Водитель': x.driver,
            'Кран': x.crane, 'Длительность мин': Math.round((x.craneEnd - x.craneStart) / 60000),
            'Простой мин': x.idle
        }));
        app.exportCSV(rows, `Простои_${new Date().toISOString().slice(0, 10)}.csv`);
    },

    printReport() {
        const list = this.filterPeriod();
        const w = window.open('', '', 'width=1000,height=900');
        const rows = list.slice(0, 60).map(x => `
            <tr><td>${x.num}</td><td>${this.esc(x.truck)}</td><td>${this.esc(x.driver)}</td>
            <td>${this.fFull(x.t_in)}</td><td>${this.esc(x.crane || '—')}</td>
            <td>${x.craneStart && x.craneEnd ? Math.round((x.craneEnd - x.craneStart) / 60000) : '—'}</td>
            <td>${x.idle || 0}</td><td>${this.fFull(x.t_out)}</td><td>${this.esc(x.status)}</td></tr>`).join('');
        const totalIdle = list.reduce((s, x) => s + (x.idle || 0), 0);
        const loaded = list.filter(x => x.craneEnd);
        const avgLoading = loaded.length ? loaded.reduce((s, x) => s + (x.craneEnd - x.craneStart), 0) / loaded.length : 0;
        w.document.write(`<html><head><title>Отчёт ЦТБ</title><style>
            body{font-family:Arial;padding:30px;color:#222}
            h1{color:#004a99;border-bottom:3px solid #d4af37;padding-bottom:10px}
            .meta{color:#666;margin-bottom:20px}
            .stats{display:flex;gap:20px;margin:20px 0;flex-wrap:wrap}
            .stat{border:1px solid #ddd;border-left:4px solid #004a99;padding:12px 18px;border-radius:6px;min-width:160px}
            .stat b{font-size:22px;color:#002d5a;display:block}
            table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}
            th{background:#002d5a;color:#fff;padding:8px;text-align:left}
            td{border-bottom:1px solid #eee;padding:6px 8px}
            .foot{margin-top:30px;color:#888;font-size:12px}
        </style></head><body>
            <h1>Отчёт по транспорту ЦТБ</h1>
            <div class="meta">Период: ${this.fDate(this.getPeriod().f.getTime())} — ${this.fDate(this.getPeriod().t.getTime())}<br>
            Сформирован: ${new Date().toLocaleString('ru-RU')}</div>
            <div class="stats">
                <div class="stat">Заездов<b>${list.length}</b></div>
                <div class="stat">Простоев<b>${list.filter(x => x.idle > 0).length}</b></div>
                <div class="stat">Общий простой<b>${totalIdle} мин.</b></div>
                <div class="stat">Ср. погрузка<b>${Math.round(avgLoading / 60000)} мин.</b></div>
            </div>
            <h3>Детализация</h3>
            <table>
                <thead><tr><th>№</th><th>Транспорт</th><th>Водитель</th><th>Въезд</th><th>Кран</th><th>Погрузка, мин.</th><th>Простой, мин.</th><th>Выезд</th><th>Статус</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="9" style="text-align:center;">Нет данных за период</td></tr>'}</tbody>
            </table>
            <div class="foot">ЦТБ Сургутнефтегаз · Сформировано автоматически</div>
        </body></html>`);
        w.document.close();
    },

    /* ================= ПАГИНАЦИЯ ================= */
    paginate(list) {
        this.totalForPage = list.length;
        const start = (this.currentPageNumber - 1) * app.itemsPerPage;
        return list.slice(start, start + app.itemsPerPage);
    },

    drawPagination(totalItems, container) {
        const pages = Math.ceil(totalItems / app.itemsPerPage);
        if (pages <= 1) return;
        const nav = document.createElement('div');
        nav.className = 'pagination';
        nav.innerHTML = `<div class="page-item ${this.currentPageNumber === 1 ? 'disabled' : ''}" onclick="ui.goToPage(${this.currentPageNumber - 1})">&laquo;</div>`;
        for (let i = 1; i <= pages; i++) {
            if (i === 1 || i === pages || Math.abs(i - this.currentPageNumber) <= 2) {
                nav.innerHTML += `<div class="page-item ${i === this.currentPageNumber ? 'active' : ''}" onclick="ui.goToPage(${i})">${i}</div>`;
            } else if (Math.abs(i - this.currentPageNumber) === 3) {
                nav.innerHTML += `<div class="page-item disabled">...</div>`;
            }
        }
        nav.innerHTML += `<div class="page-item ${this.currentPageNumber === pages ? 'disabled' : ''}" onclick="ui.goToPage(${this.currentPageNumber + 1})">&raquo;</div>`;
        container.appendChild(nav);
    },

    goToPage(p) {
        const pages = Math.ceil(this.totalForPage / app.itemsPerPage);
        this.currentPageNumber = Math.min(Math.max(1, p), pages || 1);
        this.render();
    },

    toast(msg, type) {
        const c = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type || ''}`;
        el.textContent = msg;
        c.appendChild(el);
        setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3500);
    }
};

/* ========== ЗАПУСК ========== */
app.init();

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') ui.closeModal();
    if ((e.key === 'Enter') && document.getElementById('auth-screen').style.display !== 'none') {
        app.login();
    }
});

document.addEventListener('click', e => {
    if (e.target.classList && e.target.classList.contains('modal-overlay')) {
        ui.closeModal();
    }
    if (!e.target.closest('.popover') && !e.target.closest('.tool-wrap')) {
        ui.closePopovers();
    }
});

if (app.user) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'grid';
    ui.init();
    ui.authMode();
}