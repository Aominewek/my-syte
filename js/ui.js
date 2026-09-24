const ui = {
    currentPageNumber: 1,

    ico: {
        dash: '&#9632;', reg: '&#9998;', active: '&#9673;', boss: '&#9678;',
        journal: '&#9776;', fleet: '&#9688;', log: '&#128203;', ana: '&#9650;'
    },

    init() {
        const u = app.user;
        document.getElementById('user-info').innerHTML = `<b>${u.name}</b><br><small>${this.roleName(u.role)}</small>`;
        const menu = [
            {id:'dash', n:'Сводка', roles:['admin','kpp','store','eng','boss']},
            {id:'log', n:'Журнал событий', roles:['admin','boss']},
            {id:'reg', n:'Регистрация транспорта', roles:['admin','kpp']},
            {id:'active', n:'Список на территории', roles:['admin','kpp','store','eng','boss']},
            {id:'boss', n:'LIVE Мониторинг', roles:['admin','boss']},
            {id:'journal', n:'Журнал записей', roles:['admin','boss']},
            {id:'ana', n:'Аналитика', roles:['admin','boss']},
            {id:'fleet', n:'Справочник ТС', roles:['admin','boss','kpp']}
        ];
        document.getElementById('menu-container').innerHTML = menu
            .filter(m => m.roles.includes(u.role))
            .map(m => `<div class="menu-item" onclick="ui.setPage('${m.id}')" id="m-${m.id}">
                <span class="mi-ico">${this.ico[m.id] || ''}</span>${m.n}</div>`).join('');
        document.getElementById('main-app').classList.add('visible');
        this.setPage('dash');
        setInterval(() => {
            if (['dash','active','journal','boss','ana'].includes(app.currentPage)) this.render();
        }, 60000);
    },

    roleName(r) {
        return { admin:'Администратор', kpp:'Сотрудник КПП', store:'Кладовщик',
                 eng:'Инженер ЦТБ', boss:'Руководитель' }[r] || r;
    },

    setPage(id) {
        app.currentPage = id;
        this.currentPageNumber = 1;
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        if (document.getElementById(`m-${id}`)) document.getElementById(`m-${id}`).classList.add('active');
        document.getElementById('page-title').innerText = document.getElementById(`m-${id}`)?.innerText || 'Раздел';
        document.getElementById('search-wrapper').style.display = (id === 'reg' || id === 'dash' || id === 'ana') ? 'none' : 'block';
        const actions = document.getElementById('page-actions');
        actions.innerHTML = '';
        if (id === 'ana') {
            actions.innerHTML = `
                <button class="btn btn-outline" onclick="ui.exportAnalyticsCSV()">&#11015; CSV</button>
                <button class="btn btn-primary" onclick="ui.printReport()">&#128424; ОТЧЁТ</button>`;
        }
        if (id === 'journal') {
            actions.innerHTML = `<button class="btn btn-primary" onclick="ui.exportJournalCSV()">&#11015; ВЫГРУЗИТЬ</button>`;
        }
        if (id === 'log') {
            actions.innerHTML = `<button class="btn btn-primary" onclick="ui.exportLogCSV()">&#11015; ВЫГРУЗИТЬ</button>`;
        }
        const cont = document.getElementById('data-container');
        cont.classList.remove('page-enter');
        void cont.offsetWidth;
        cont.classList.add('page-enter');
        this.render();
    },

    fTime(ts) { return ts ? new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '---'; },
    fFull(ts) { return ts ? new Date(ts).toLocaleString([], {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '---'; },
    fDate(ts) { return ts ? new Date(ts).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit', year:'numeric'}) : '---'; },
    fDateShort(ts) { return ts ? new Date(ts).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}) : ''; },
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
        return `<span class="badge ${map[st] || 'badge-gray'}">${st}</span>`;
    },

    render() {
        const cont = document.getElementById('data-container');
        const p = app.currentPage;
        const q = app.searchQuery.toLowerCase();
        cont.innerHTML = '';

        if (p === 'dash') { this.renderDash(cont); }
        else if (p === 'reg') { this.renderReg(cont); }
        else if (p === 'active') { this.renderActive(cont, q); }
        else if (p === 'boss') { this.renderLive(cont, q); }
        else if (p === 'journal') { this.renderJournal(cont, q); }
        else if (p === 'fleet') { this.renderFleet(cont, q); }
        else if (p === 'log') { this.renderLog(cont, q); }
        else if (p === 'ana') { this.renderAnalytics(cont); }
    },

    /* ============================================================
       СВОДКА (DAШБОРД)
       ============================================================ */
    renderDash(cont) {
        const onSite = app.db.filter(x => !x.t_out);
        const now = Date.now();
        const over = onSite.filter(x => this.mins(x.t_in) > 90);
        const loading = onSite.filter(x => x.status === STATUS.LOADING);
        const total = app.db.length;
        const todayCount = app.db.filter(x => new Date(x.t_in).toDateString() === new Date().toDateString()).length;
        const avgStay = app.db.filter(x => x.t_out).reduce((s, x) => s + (x.t_out - x.t_in), 0) / (app.db.filter(x => x.t_out).length || 1);

        cont.innerHTML = `
        <div class="stats-row">
            <div class="stat-card"><span class="stat-ico">&#128652;</span>
                <div class="stat-label">Заездов сегодня</div><div class="stat-value">${todayCount}</div>
                <div class="stat-sub">Всего записей: ${total}</div></div>
            <div class="stat-card gold"><span class="stat-ico">&#9673;</span>
                <div class="stat-label">Сейчас на территории</div><div class="stat-value">${onSite.length}</div>
                <div class="stat-sub">Из них на погрузке: ${loading.length}</div></div>
            <div class="stat-card"><span class="stat-ico">&#128337;</span>
                <div class="stat-label">Среднее время на базе</div><div class="stat-value">${this.dur(avgStay)}</div>
                <div class="stat-sub">По завершённым визитам</div></div>
            <div class="stat-card red"><span class="stat-ico">&#9888;</span>
                <div class="stat-label">Превышение лимита</div><div class="stat-value">${over.length}</div>
                <div class="stat-sub">Более 90 мин. на территории</div></div>
        </div>
        <div class="dash-grid">
            <div class="panel">
                <div class="panel-head"><h3><span class="ph-ico">&#9673;</span>Сейчас на территории</h3>
                    <div class="panel-actions"><button class="btn btn-outline btn-sm" onclick="ui.setPage('active')">ВСЕ &#8594;</button></div></div>
                <div class="panel-body" style="padding-top:0;">
                    ${onSite.length === 0 ? `<div class="empty-state"><div class="es-ico">&#128652;</div><h3>Территория свободна</h3><p>Сейчас нет транспорта на базе</p></div>`
                    : `<table class="mini-table">
                        <thead><tr><th>№</th><th>Транспорт</th><th>Водитель</th><th>Время</th><th>Статус</th></tr></thead>
                        <tbody>${onSite.slice(0, 8).map(i => `<tr>
                            <td>${i.num}</td><td>${i.truck}</td><td>${i.driver}</td>
                            <td>${this.fTime(i.t_in)}</td><td>${this.statusBadge(i.status)}</td></tr>`).join('')}
                        </tbody></table>`}
                </div>
            </div>
            <div class="panel">
                <div class="panel-head"><h3><span class="ph-ico">&#128203;</span>Последние события</h3>
                    <div class="panel-actions"><button class="btn btn-outline btn-sm" onclick="ui.setPage('log')">ЖУРНАЛ &#8594;</button></div></div>
                <div class="panel-body" style="padding-top:0;">
                    ${app.log.length === 0 ? `<div class="empty-state"><div class="es-ico">&#128203;</div><h3>Событий нет</h3></div>`
                    : `<ul class="event-list">${app.log.slice(-7).reverse().map(l => `
                        <li><span class="event-dot ${this.logDot(l.act)}"></span>
                            <span class="event-text"><b>${l.act}</b> — ${l.inf}<br><small>${l.usr}</small></span>
                            <span class="event-time">${l.dt} ${l.tm}</span></li>`).join('')}</ul>`}
                </div>
            </div>
        </div>`;
    },

    logDot(act) {
        if (act.includes('ПРОСТОЙ')) return 'red';
        if (act.includes('Вход')) return 'gold';
        if (act.includes('Удаление')) return 'red';
        if (act.includes('Погрузка завершена') || act.includes('Регистрация')) return 'green';
        return 'blue';
    },

    /* ============================================================
       РЕГИСТРАЦИЯ
       ============================================================ */
    renderReg(cont) {
        cont.innerHTML = `<div class="card" style="max-width:460px; margin:auto; border-top: 5px solid var(--accent);">
            <h3 style="display:flex; align-items:center; gap:10px; color:var(--sng-dark);"><span class="ph-ico">&#9998;</span>Регистрация талона №${app.db.length + 1}</h3>
            <div class="form-group"><label>Выберите ТС</label>
                <select id="reg-truck">${TRUCKS.map(t => `<option>${t.plate} (${t.model})</option>`).join('')}</select></div>
            <div class="form-group"><label>Выберите водителя</label>
                <select id="reg-driver">${DRIVERS.map(d => `<option>${d}</option>`).join('')}</select></div>
            <button class="btn btn-primary btn-block" style="margin-top:18px;" onclick="app.registerEntry()">ЗАРЕГИСТРИРОВАТЬ</button>
        </div>`;
    },

    /* ============================================================
       СПИСОК НА ТЕРРИТОРИИ
       ============================================================ */
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

        let color = 'var(--success)';
        if (percent > 60) color = 'var(--accent)';
        if (percent >= 100) color = 'var(--danger)';

        let actions = '';
        const r = app.user.role;
        if (r === 'admin' || r === 'kpp') actions += `<button class="btn btn-danger btn-sm" onclick="app.updateStep(${i.id}, 't_out', '${STATUS.EXITED}')">ВЫЕЗД</button>`;
        if (r === 'admin' || r === 'store') {
            if (!i.t_s_in) actions += `<button class="btn btn-primary btn-sm" onclick="app.updateStep(${i.id}, 't_s_in', '${STATUS.STORE_IN}')">ПРИБЫЛ СКЛАД</button>`;
            else if (!i.t_s_out) actions += `<button class="btn btn-success btn-sm" onclick="app.updateStep(${i.id}, 't_s_out', '${STATUS.STORE_OUT}')">УБЫЛ СКЛАД</button>`;
        }
        if (r === 'admin' || r === 'eng') {
            if (!i.t_e_in) actions += `<button class="btn btn-primary btn-sm" onclick="app.updateStep(${i.id}, 't_e_in', '${STATUS.ENG_IN}')">ПРИБЫЛ ИНЖ.</button>`;
            else if (!i.p_data) actions += `<button class="btn btn-accent btn-sm" onclick="ui.openModal(${i.id})">МАРШРУТИЗАЦИЯ</button>`;
        }
        if (r === 'admin' || r === 'store' || r === 'eng') {
            if (!i.craneStart) actions += `<button class="btn btn-outline btn-sm" onclick="ui.openCrane(${i.id})">КРАН</button>`;
            else if (!i.craneEnd) actions += `<button class="btn btn-accent btn-sm" onclick="ui.openCrane(${i.id})">КРАН: ИДЁТ</button>`;
        }
        if (r === 'admin') actions += `<button class="btn btn-secondary btn-sm" onclick="app.deleteRecord(${i.id})">УДАЛИТЬ</button>`;

        const craneInfo = i.craneStart ? (i.craneEnd
            ? `<div style="font-size:12.5px; margin-top:4px;">Кран: <b>${i.crane}</b> · ${this.dur(i.craneEnd - i.craneStart)}${i.idle > 0 ? ` · <span style="color:var(--danger); font-weight:700;">простой ${i.idle} мин.</span>` : ''}</div>`
            : `<div style="font-size:12.5px; margin-top:4px;">Кран: <b>${i.crane}</b> · идёт погрузка ${this.mins(i.craneStart)} мин.</div>`) : '';

        return `
            <div class="card" style="animation-delay:${idx * 0.05}s;">
                <span class="card-num">№${i.num}</span>
                <h4>${i.truck}</h4>
                <div class="card-driver">${i.driver}</div>
                <div style="margin-bottom:6px;">${this.statusBadge(i.status)}</div>
                <div class="timer-box">
                    <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px; color:var(--text-muted);">
                        <span>Время на базе: <b style="color:var(--text);">${mins} мин.</b></span>
                        <span>Предел: ${maxMins} мин.</span>
                    </div>
                    <div class="progress-bg"><div class="progress-fill" style="width:${percent}%; background:${color}"></div></div>
                    ${mins >= maxMins ? '<div class="stall-alert">⚠ ПЕРЕСТОЙ / ВНИМАНИЕ ⚠</div>' : ''}
                    ${craneInfo}
                </div>
                <p style="font-size:12.5px; color:var(--text-muted); margin:0;">Въезд: ${this.fTime(i.t_in)} · ${this.fDateShort(i.t_in)}</p>
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:12px;">${actions}</div>
            </div>`;
    },

    /* ============================================================
       LIVE МОНИТОРИНГ
       ============================================================ */
    renderLive(cont, q) {
        let list = app.db.filter(x => !x.t_out);
        if (q) {
            list = list.filter(x =>
                x.truck.toLowerCase().includes(q) ||
                x.driver.toLowerCase().includes(q) ||
                String(x.num).includes(q) ||
                this.fTime(x.t_in).toLowerCase().includes(q));
        }
        const count = list.length;
        const over = list.filter(x => this.mins(x.t_in) > 90).length;
        cont.innerHTML = `
        <div class="stats-row">
            <div class="stat-card"><span class="stat-ico">&#9673;</span>
                <div class="stat-label">На территории</div><div class="stat-value">${count}</div></div>
            <div class="stat-card red"><span class="stat-ico">&#9888;</span>
                <div class="stat-label">Превышение 90 мин.</div><div class="stat-value">${over}</div></div>
            <div class="stat-card gold"><span class="stat-ico">&#128337;</span>
                <div class="stat-label">Обновление</div><div class="stat-value" style="font-size:22px; padding-top:10px;">авто · 60 сек.</div></div>
        </div>
        <div class="table-container"><table>
            <thead><tr><th>№</th><th>Транспорт</th><th>Водитель</th><th>Время въезда</th><th>Минут на базе</th><th>Текущий статус</th></tr></thead>
            <tbody>${list.map(i => `<tr>
                <td>${i.num}</td><td><b>${i.truck}</b></td><td>${i.driver}</td>
                <td>${this.fTime(i.t_in)}</td>
                <td style="color:${this.mins(i.t_in) > 90 ? 'var(--danger); font-weight:700;' : 'inherit'}"><b>${this.mins(i.t_in)} мин.</b></td>
                <td>${this.statusBadge(i.status)}</td>
            </tr>`).join('') || `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:40px;">Нет транспорта на территории</td></tr>`}
            </tbody></table></div>`;
    },

    /* ============================================================
       ЖУРНАЛ ЗАПИСЕЙ
       ============================================================ */
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
                <td><b>${i.num}</b></td><td>${i.truck}</td><td>${i.driver}</td>
                <td>${this.fFull(i.t_in)}</td>
                <td>${i.t_s_in ? `<b>${this.fTime(i.t_s_in)}</b>` : '—'}${i.t_s_out ? ` / ${this.fTime(i.t_s_out)}` : ''}</td>
                <td>${i.t_e_in ? `<b>${this.fTime(i.t_e_in)}</b>` : '—'}${i.t_e_out ? ` / ${this.fTime(i.t_e_out)}` : ''}</td>
                <td>${i.crane ? `<b>${i.crane}</b>${i.craneEnd ? `<br><small>${this.dur(i.craneEnd - i.craneStart)}${i.idle > 0 ? ` · <span style="color:var(--danger);">простой ${i.idle} мин.</span>` : ''}</small>` : ''}` : '—'}</td>
                <td>${this.fFull(i.t_out)}</td>
                <td>${this.statusBadge(i.status)}</td>
            </tr>`).join('') || `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:40px;">Записей нет</td></tr>`}
            </tbody></table></div>`;
        this.drawPagination(list.length, cont);
    },

    /* ============================================================
       СПРАВОЧНИК ТС
       ============================================================ */
    renderFleet(cont, q) {
        let list = TRUCKS;
        if (q) {
            list = list.filter(x =>
                x.plate.toLowerCase().includes(q) ||
                x.model.toLowerCase().includes(q));
        }
        const visits = id => app.db.filter(x => x.truck.startsWith(id)).length;
        cont.innerHTML = `<div class="table-container"><table>
            <thead><tr><th>Гос. номер</th><th>Марка / Модель ТС</th><th>Визитов</th></tr></thead>
            <tbody>${list.map(t => `<tr>
                <td><b>${t.plate}</b></td><td>${t.model}</td>
                <td><span class="badge badge-blue">${visits(t.plate.split(' ')[0])} зап.</span></td>
            </tr>`).join('')}</tbody>
        </table></div>`;
    },

    /* ============================================================
       ЖУРНАЛ СОБЫТИЙ
       ============================================================ */
    renderLog(cont, q) {
        let list = [...app.log].reverse();
        if (q) {
            list = list.filter(x => x.fs.includes(q));
        }
        const pList = this.paginate(list);
        cont.innerHTML = `<div class="table-container"><table>
            <thead><tr><th>Дата/Время</th><th>Кто</th><th>Событие</th><th>Инфо</th></tr></thead>
            <tbody>${pList.map(l => `<tr>
                <td>${l.dt} ${l.tm}</td><td><b>${l.usr}</b></td>
                <td>${l.act.includes('ПРОСТОЙ') ? `<span class="idle-badge">${l.act}</span>` : l.act}</td>
                <td>${l.inf}</td>
            </tr>`).join('') || `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:40px;">Событий нет</td></tr>`}
            </tbody></table></div>`;
        this.drawPagination(list.length, cont);
    },

    /* ============================================================
       АНАЛИТИКА
       ============================================================ */
    renderAnalytics(cont) {
        const hasData = app.db.length > 0;
        if (!hasData) {
            cont.innerHTML = `<div class="panel"><div class="empty-state">
                <div class="es-ico">&#9650;</div>
                <h3>Пока нет данных для аналитики</h3>
                <p>Зарегистрируйте транспорт — графики и отчёты появятся автоматически</p>
            </div></div>`;
            return;
        }
        const d1 = new Date();
        d1.setDate(d1.getDate() - 30);
        const defFrom = d1.toISOString().slice(0, 10);
        const defTo = new Date().toISOString().slice(0, 10);

        cont.innerHTML = `
        <div class="analytics-toolbar">
            <div class="form-group">
                <label>Период с</label>
                <input type="date" id="ana-from" value="${defFrom}">
            </div>
            <div class="form-group">
                <label>Период по</label>
                <input type="date" id="ana-to" value="${defTo}">
            </div>
            <div class="form-group" style="min-width: 200px;">
                <label>Показатель</label>
                <select id="ana-metric" onchange="ui.renderAnalyticsCharts()">
                    <option value="visits">Заезды по дням</option>
                    <option value="hours">Пиковые часы</option>
                    <option value="status">Статусы</option>
                    <option value="idle">Простои (загрузка)</option>
                </select>
            </div>
            <button class="btn btn-primary" onclick="ui.renderAnalyticsCharts()">ПРИМЕНИТЬ</button>
            <button class="btn btn-outline" onclick="ui.exportAnalyticsCSV()">&#11015; CSV</button>
            <button class="btn btn-accent" onclick="ui.printReport()">&#128424; ОТЧЁТ</button>
        </div>
        <div id="ana-charts"></div>`;
        this.renderAnalyticsCharts();
    },

    getPeriod() {
        const from = document.getElementById('ana-from').value;
        const to = document.getElementById('ana-to').value;
        const f = from ? new Date(from + 'T00:00:00') : new Date(0);
        const t = to ? new Date(to + 'T23:59:59') : new Date();
        return { f, t };
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
            box.innerHTML = `<div class="panel"><div class="empty-state">
                <div class="es-ico">&#128269;</div>
                <h3>Нет данных за выбранный период</h3>
                <p>Измените даты и нажмите «Применить»</p>
            </div></div>`;
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

    /* --- График: заезды по дням (столбцы) --- */
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
        const svg = this.barChart(days.map(d => d.count), days.map(d => d.label), max, 'Заездов');
        return `<div class="chart-box">
            <h3><span class="ph-ico">&#9650;</span>Динамика заездов по дням</h3>
            <div class="chart-sub">${days.length} дн. · всего ${list.length} заездов в выбранном периоде</div>
            <div class="chart-wrap">${svg}</div>
            <div class="chart-legend">
                <span class="lg"><span class="sw" style="background:linear-gradient(180deg,#004a99,#0066cc)"></span>Заезды</span>
                <span class="lg">Максимум: <b>${max}</b> заездов/день</span>
            </div>
        </div>`;
    },

    /* --- График: пиковые часы --- */
    chartHours(list) {
        const hours = Array(24).fill(0);
        list.forEach(x => hours[new Date(x.t_in).getHours()]++);
        const max = Math.max(...hours, 1);
        const labels = hours.map((_, i) => `${String(i).padStart(2, '0')}:00`);
        const mode = hours.indexOf(max);
        return `<div class="chart-box">
            <h3><span class="ph-ico">&#128336;</span>Пиковые часы заездов</h3>
            <div class="chart-sub">Больше всего транспорта заезжает в <b>${String(mode).padStart(2, '0')}:00</b> — ${max} заездов</div>
            <div class="chart-wrap">${this.barChart(hours, labels, max, 'Заездов')}</div>
        </div>`;
    },

    /* --- Диаграмма: статусы (круговая) --- */
    chartStatus(list) {
        const counts = {};
        list.forEach(x => { counts[x.status] = (counts[x.status] || 0) + 1; });
        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const total = list.length;
        const colors = ['#004a99', '#d4af37', '#218838', '#c82333', '#6c757d', '#0066cc', '#e67e22'];
        const svg = this.donutChart(entries.map(e => e[1]), colors);
        return `<div class="chart-box">
            <h3><span class="ph-ico">&#9679;</span>Распределение по статусам</h3>
            <div class="chart-sub">Всего записей в периоде: ${total}</div>
            <div style="display:flex; align-items:center; gap:30px; flex-wrap:wrap;">
                ${svg}
                <div class="chart-legend" style="flex-direction:column; gap:10px; margin:0;">
                    ${entries.map((e, i) => `<span class="lg"><span class="sw" style="background:${colors[i % colors.length]}"></span>${e[0]} — <b>${e[1]}</b> (${Math.round(e[1] / total * 100)}%)</span>`).join('')}
                </div>
            </div>
        </div>`;
    },

    /* --- Диаграмма: простои по кранам --- */
    chartIdle(list) {
        const byCrane = {};
        list.filter(x => x.crane && x.craneEnd).forEach(x => {
            if (!byCrane[x.crane]) byCrane[x.crane] = { ops: 0, idle: 0, time: 0 };
            const d = (x.craneEnd - x.craneStart) / 60000;
            byCrane[x.crane].ops++;
            byCrane[x.crane].time += d;
            byCrane[x.crane].idle += Math.max(0, d - CRANE_LIMIT_MIN);
        });
        const entries = Object.entries(byCrane);
        if (!entries.length) {
            return `<div class="chart-box"><h3><span class="ph-ico">&#128295;</span>Простои при погрузке</h3>
                <div class="empty-state"><div class="es-ico">&#128295;</div><h3>Нет данных о погрузках</h3>
                <p>Данные появятся, когда транспорт начнут отмечать на кране</p></div></div>`;
        }
        const labels = entries.map(e => e[0]);
        const values = entries.map(e => Math.round(e[1].idle));
        const max = Math.max(...values, 1);
        return `<div class="chart-box">
            <h3><span class="ph-ico">&#128295;</span>Простой по кранам (мин.)</h3>
            <div class="chart-sub">Лимит погрузки: ${CRANE_LIMIT_MIN} мин. · красным — превышение</div>
            <div class="chart-wrap">${this.barChart(values, labels, max, 'Простой, мин.')}</div>
            <div class="chart-legend">
                ${entries.map(e => `<span class="lg"><span class="sw" style="background:${e[1].idle > 0 ? '#c82333' : '#218838'}"></span>${e[0]}: ${Math.round(e[1].ops)} погр. · простой ${Math.round(e[1].idle)} мин.</span>`).join('')}
            </div>
        </div>`;
    },

    /* --- Таблица простоев --- */
    chartIdleTable(list) {
        const idle = list.filter(x => x.crane && x.craneEnd && x.idle > 0).sort((a, b) => b.idle - a.idle);
        if (!idle.length) {
            return `<div class="panel"><div class="panel-head"><h3><span class="ph-ico">&#9888;</span>Простои за период</h3></div>
                <div class="panel-body"><div class="empty-state"><div class="es-ico">&#9989;</div>
                <h3>Простоев не зафиксировано</h3><p>Все погрузки уложились в лимит ${CRANE_LIMIT_MIN} мин.</p></div></div></div>`;
        }
        return `<div class="panel"><div class="panel-head"><h3><span class="ph-ico">&#9888;</span>Простои за период (${idle.length})</h3>
            <div class="panel-actions"><button class="btn btn-outline btn-sm" onclick="ui.exportIdleCSV()">&#11015; CSV</button></div></div>
            <div class="panel-body" style="padding-top:0;">
            <div class="table-container" style="border:none; box-shadow:none; margin:0;"><table class="idle-table" style="min-width:700px;">
                <thead><tr><th>Дата</th><th>Транспорт</th><th>Водитель</th><th>Кран</th><th>Длительность</th><th>Простой</th></tr></thead>
                <tbody>${idle.slice(0, 20).map(x => `<tr>
                    <td>${this.fFull(x.craneStart)}</td><td><b>${x.truck}</b></td><td>${x.driver}</td>
                    <td>${x.crane}</td><td>${this.dur(x.craneEnd - x.craneStart)}</td>
                    <td><span class="idle-badge">+${x.idle} мин.</span></td>
                </tr>`).join('')}</tbody>
            </table></div></div></div>`;
    },

    /* --- SVG: столбчатая диаграмма --- */
    barChart(values, labels, max, unit) {
        const W = 760, H = 280, PL = 42, PB = 42, PT = 16, PR = 12;
        const iw = W - PL - PR, ih = H - PT - PB;
        const n = values.length;
        const bw = Math.max(6, (iw / n) * 0.62);
        const step = iw / n;
        const gridLines = 4;
        let g = '';
        for (let i = 0; i <= gridLines; i++) {
            const y = PT + ih - (ih * i / gridLines);
            const v = Math.round(max * i / gridLines);
            g += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#e6eaf0" stroke-width="1"/>`;
            g += `<text x="${PL - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6c757d">${v}</text>`;
        }
        values.forEach((v, i) => {
            const x = PL + i * step + (step - bw) / 2;
            const h = v ? (ih * v / max) : 2;
            const y = PT + ih - h;
            const col = v > 0 ? 'url(#barGrad)' : '#e6eaf0';
            g += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 2)}" rx="3" fill="${col}" opacity="${v > 0 ? 1 : 0.4}">
                <title>${labels[i]}: ${v} ${unit}</title></rect>`;
            const showLabel = n <= 31 && (labels[i] !== undefined);
            if (showLabel && (n <= 15 || i % Math.ceil(n / 15) === 0)) {
                g += `<text x="${x + bw / 2}" y="${H - PB + 16}" text-anchor="middle" font-size="10" fill="#6c757d">${labels[i]}</text>`;
            }
        });
        return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;" role="img" aria-label="Диаграмма">
            <defs><linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stop-color="#002d5a"/><stop offset="1" stop-color="#0066cc"/>
            </linearGradient></defs>
            ${g}
        </svg>`;
    },

    /* --- SVG: круговая (donut) --- */
    donutChart(values, colors) {
        const size = 200, r = 80, sw = 34, cx = size / 2, cy = size / 2;
        const total = values.reduce((s, v) => s + v, 0) || 1;
        const R = r + sw / 2;
        const circ = 2 * Math.PI * R;
        const rr = r - sw / 2;
        let off = 0, arcs = '';
        values.forEach((v, i) => {
            const frac = v / total;
            const dash = frac * circ;
            const rot = off / circ * 360 - 90;
            arcs += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${colors[i % colors.length]}"
                stroke-width="${sw}" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-off}" transform="rotate(${rot} ${cx} ${cy})">
                <title>${frac * 100}%</title></circle>`;
            off += dash;
        });
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${arcs}
            <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="26" font-weight="800" fill="#002d5a">${values.length ? values.reduce((s, v) => s + v, 0) : 0}</text>
            <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="11" fill="#6c757d">записей</text>
        </svg>`;
    },

    /* ============================================================
       МОДАЛКИ
       ============================================================ */
    openModal(id) {
        app.editingId = id;
        const i = app.db.find(x => x.id === id);
        document.getElementById('modal-permit').style.display = 'flex';
        document.getElementById('modal-permit').classList.add('open');
    },

    openCrane(id) {
        app.editingId = id;
        const i = app.db.find(x => x.id === id);
        const modal = document.getElementById('modal-crane');
        const sel = document.getElementById('crane-select');
        sel.innerHTML = CRANES.map(c => `<option>${c}</option>`).join('');
        document.getElementById('crane-info').innerHTML = `ТС: <b>${i.truck}</b><br>Водитель: <b>${i.driver}</b>`;
        document.getElementById('crane-limit-hint').innerHTML = `Лимит погрузки: <b>${CRANE_LIMIT_MIN} мин.</b>. Превышение фиксируется как простой автоматически.`;
        const startBtn = document.getElementById('crane-start-btn');
        const finishBtn = document.getElementById('crane-finish-btn');
        if (i.craneStart && !i.craneEnd) {
            startBtn.style.display = 'none';
            finishBtn.style.display = '';
            document.getElementById('crane-select').value = i.crane || CRANES[0];
            document.getElementById('crane-limit-hint').innerHTML = `Погрузка идёт: <b>${this.mins(i.craneStart)} мин.</b> (лимит ${CRANE_LIMIT_MIN} мин.)`;
        } else {
            startBtn.style.display = '';
            finishBtn.style.display = 'none';
            document.getElementById('crane-select').value = CRANES[0];
        }
        modal.style.display = 'flex';
        modal.classList.add('open');
    },

    closeModal() {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.classList.remove('open');
            setTimeout(() => { if (!m.classList.contains('open')) m.style.display = 'none'; }, 200);
        });
    },

    printPermit(i) {
        const d = i.p_data;
        const w = window.open('', '', 'width=900,height=1000');
        w.document.write(`
            <html><head><style>
                body { font-family: Arial; padding: 20px; }
                .page { width: 100%; height: 140mm; border: 1px solid #000; padding: 15px; position: relative; box-sizing: border-box; page-break-after: always; margin-bottom: 20px;}
                .header { text-align: center; margin-bottom: 15px; }
                .line { border-bottom: 1px solid #000; margin-bottom: 8px; display: flex; justify-content: space-between; font-size: 14px; }
                .footer-box { border: 2px dashed #000; padding: 10px; text-align: center; margin-top: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 11px; }
                .sign { width: 120px; border-bottom: 1px solid #000; display: inline-block; }
            </style></head><body>
            <div class="page">
                <div style="display:flex; justify-content:space-between"><span>Время выдачи талона: <b>${d.time}</b></span><span>A 4027</span></div>
                <div class="header"><h1>Талон-разрешение</h1><h3>"___" ___________ 2026</h3></div>
                <div class="line"><span>№ а/м: <b>${i.truck}</b></span><span>Водитель: <b>${i.driver}</b></span></div>
                <div class="line"><span>Заказчик: <b>${d.cust}</b></span></div>
                <div class="line"><span>Инженер ООГ: <b>${d.eng}</b></span><span>Подпись: <span class="sign"></span></span></div>
                <div class="line"><span>№ крана: <b>${d.crane}</b></span><span>№ стеллажа: <b>${d.shelf}</b></span></div>
                <div class="line"><span>Типоразмер труб: <b>${d.pipe}</b></span></div>
                <div class="line"><span>Количество: <b>${d.qty}</b></span></div>
                <div class="line"><span>Заведующий складом, кладовщик:</span><span>Подпись: <span class="sign"></span></span></div>
                <p>Погрузка: [${d.type1 ? '<b>X</b>' : ' '}] труба [${d.type2 ? '<b>X</b>' : ' '}] патрубки</p>
                <div class="footer-box">
                    <h2 style="margin:0">ВОДИТЕЛЬ ВНИМАНИЕ</h2>
                    <p style="margin:5px">После оформления груза и получения ТТН необходимо покинуть территорию ЦТБ в течение 10 минут.</p>
                </div>
            </div>
            <div class="page">
                <h3 style="text-align:center">Спецификация труб</h3>
                <table>
                    <thead><tr><th>№</th><th>Краткое наименование труб</th><th>Кол-во шт.</th><th>Метры</th><th>Доп. информация</th></tr></thead>
                    <tbody>${Array(18).fill('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody>
                </table>
                <p style="margin-top:15px;">Кладовщик: ___________________________ (подпись)</p>
            </div>
            <script>window.onload = function(){ window.print(); window.close(); }</script>
            </body></html>
        `);
        w.document.close();
    },

    /* ============================================================
       ЭКСПОРТ / ОТЧЁТЫ
       ============================================================ */
    exportJournalCSV() {
        const rows = app.db.map(x => ({
            '№': x.num, 'Транспорт': x.truck, 'Водитель': x.driver,
            'Въезд': this.fFull(x.t_in), 'Кладовщик': x.t_s_in ? this.fTime(x.t_s_in) : '',
            'Инженер': x.t_e_in ? this.fTime(x.t_e_in) : '', 'Кран': x.crane || '',
            'Простой мин': x.idle || 0, 'Выезд': this.fFull(x.t_out), 'Статус': x.status
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
            'Дата': this.fDate(x.t_in), 'Время въезда': this.fTime(x.t_in),
            'Транспорт': x.truck, 'Водитель': x.driver,
            'Кран': x.crane || '', 'Погрузка мин': x.craneStart && x.craneEnd ? Math.round((x.craneEnd - x.craneStart) / 60000) : '',
            'Простой мин': x.idle || 0, 'Время выезда': this.fFull(x.t_out), 'Статус': x.status
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
            <tr><td>${x.num}</td><td>${x.truck}</td><td>${x.driver}</td>
            <td>${this.fFull(x.t_in)}</td><td>${x.crane || '—'}</td>
            <td>${x.craneStart && x.craneEnd ? Math.round((x.craneEnd - x.craneStart) / 60000) : '—'}</td>
            <td>${x.idle || 0}</td><td>${this.fFull(x.t_out)}</td><td>${x.status}</td></tr>`).join('');
        const totalIdle = list.reduce((s, x) => s + (x.idle || 0), 0);
        const avgLoading = list.filter(x => x.craneEnd).reduce((s, x) => s + (x.craneEnd - x.craneStart), 0) / (list.filter(x => x.craneEnd).length || 1);
        w.document.write(`<html><head><title>Отчёт ЦТБ</title><style>
            body { font-family: Arial; padding: 30px; color: #222; }
            h1 { color: #004a99; border-bottom: 3px solid #d4af37; padding-bottom: 10px; }
            .meta { color: #666; margin-bottom: 20px; }
            .stats { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
            .stat { border: 1px solid #ddd; border-left: 4px solid #004a99; padding: 12px 18px; border-radius: 6px; min-width: 160px; }
            .stat b { font-size: 22px; color: #002d5a; display: block; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th { background: #002d5a; color: #fff; padding: 8px; text-align: left; }
            td { border-bottom: 1px solid #eee; padding: 6px 8px; }
            .foot { margin-top: 30px; color: #888; font-size: 12px; }
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
            <div class="foot">ЦТБ Сургутнефтегаз · Система контроля транспорта · сформировано автоматически</div>
            <script>window.onload = function(){ window.print(); }</script>
            </body></html>`);
        w.document.close();
    },

    /* ============================================================
       ПАГИНАЦИЯ
       ============================================================ */
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
        nav.innerHTML = `<div class="page-item ${this.currentPageNumber === 1 ? 'disabled' : ''}" onclick="ui.goToPage(${this.currentPageNumber - 1})">&#8592;</div>`;
        for (let i = 1; i <= pages; i++) {
            nav.innerHTML += `<div class="page-item ${i === this.currentPageNumber ? 'active' : ''}" onclick="ui.goToPage(${i})">${i}</div>`;
        }
        nav.innerHTML += `<div class="page-item ${this.currentPageNumber === pages ? 'disabled' : ''}" onclick="ui.goToPage(${this.currentPageNumber + 1})">&#8594;</div>`;
        container.appendChild(nav);
    },

    goToPage(p) {
        const pages = Math.ceil(this.totalForPage / app.itemsPerPage);
        this.currentPageNumber = Math.min(Math.max(1, p), pages || 1);
        this.render();
    },

    /* --- Toast уведомление --- */
    toast(msg, type) {
        const c = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type || ''}`;
        el.innerHTML = msg;
        c.appendChild(el);
        setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3500);
    }
};

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') ui.closeModal();
});
document.addEventListener('click', e => {
    if (e.target.classList && e.target.classList.contains('modal-overlay')) {
        ui.closeModal();
    }
});