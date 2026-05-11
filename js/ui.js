const ui = {
    currentPageNumber: 1,

    init() {
        const u = app.user;
        document.getElementById('user-info').innerHTML = `<b>${u.name}</b><br><small>${u.role}</small>`;
        const menu = [
            {id:'log', n:'Журнал событий', roles:['admin']},
            {id:'reg', n:'Регистрация транспорта', roles:['admin', 'kpp']},
            {id:'active', n:'Список на территории', roles:['admin', 'kpp', 'store', 'eng', 'boss']},
            {id:'boss', n:'LIVE Мониторинг', roles:['admin', 'boss']},
            {id:'journal', n:'Журнал записей', roles:['admin', 'boss']},
            {id:'fleet', n:'Справочник ТС', roles:['admin', 'boss', 'kpp']}
        ];
        document.getElementById('menu-container').innerHTML = menu
            .filter(m => m.roles.includes(u.role))
            .map(m => `<div class="menu-item" onclick="ui.setPage('${m.id}')" id="m-${m.id}">${m.n}</div>`).join('');
        this.setPage('active');
        setInterval(() => { if(app.currentPage === 'active' || app.currentPage === 'journal' || app.currentPage === 'boss') this.render(); }, 60000);
    },

    setPage(id) {
        app.currentPage = id;
        this.currentPageNumber = 1;
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        if(document.getElementById(`m-${id}`)) document.getElementById(`m-${id}`).classList.add('active');
        document.getElementById('page-title').innerText = document.getElementById(`m-${id}`)?.innerText;
        document.getElementById('search-wrapper').style.display = (id === 'reg') ? 'none' : 'block';
        this.render();
    },

    fTime(ts) { return ts ? new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '---'; },
    fFull(ts) { return ts ? new Date(ts).toLocaleString([], {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '---'; },

    render() {
        const cont = document.getElementById('data-container');
        const p = app.currentPage;
        const q = app.searchQuery.toLowerCase(); // Приводим к нижнему регистру один раз
        cont.innerHTML = '';

        // --- РЕГИСТРАЦИЯ ТРАНСПОРТА ---
        if (p === 'reg') {
            cont.innerHTML = `<div class="card" style="max-width:450px; margin:auto; border-top: 5px solid var(--accent);">
                <h3>Регистрация талона №${app.db.length+1}</h3>
                <label>Выберите ТС</label><select id="reg-truck">${TRUCKS.map(t=>`<option>${t.plate} (${t.model})</option>`).join('')}</select>
                <label style="margin-top:15px; display:block;">Выберите водителя</label><select id="reg-driver">${DRIVERS.map(d=>`<option>${d}</option>`).join('')}</select>
                <button class="btn btn-primary btn-block" style="margin-top:25px;" onclick="app.registerEntry()">ЗАРЕГИСТРИРОВАТЬ</button>
            </div>`;
        }
        // --- СПИСОК НА ТЕРРИТОРИИ ---
        else if (p === 'active') {
            let list = app.db.filter(x => !x.t_out);
            if(q) { // Фильтрация по номеру, водителю, или дате (месяц/день)
                list = list.filter(x =>
                    x.truck.toLowerCase().includes(q) ||
                    x.driver.toLowerCase().includes(q) ||
                    String(x.num).includes(q) || // Поиск по номеру талона
                    this.fFull(x.t_in).toLowerCase().includes(q) // Поиск по дате въезда (MM.DD.YYYY или DD.MM.YYYY, зависит от локали)
                );
            }
            const pList = this.paginate(list);
            cont.innerHTML = `<div class="grid">${pList.map(i => this.drawCard(i)).join('')}</div>`;
            this.drawPagination(list.length, cont);
        }
        // --- LIVE МОНИТОРИНГ ---
        else if (p === 'boss') {
            let list = app.db.filter(x => !x.t_out);
            if(q) {
                list = list.filter(x =>
                    x.truck.toLowerCase().includes(q) ||
                    x.driver.toLowerCase().includes(q) ||
                    String(x.num).includes(q) ||
                    this.fTime(x.t_in).toLowerCase().includes(q) // Поиск по времени въезда
                );
            }
            cont.innerHTML = this.drawLiveTable(list);
        }
        // --- ЖУРНАЛ ЗАПИСЕЙ ---
        else if (p === 'journal') {
            let list = app.db;
            if(q) {
                list = list.filter(x =>
                    x.truck.toLowerCase().includes(q) ||
                    x.driver.toLowerCase().includes(q) ||
                    String(x.num).includes(q) ||
                    this.fFull(x.t_in).toLowerCase().includes(q) || // Поиск по дате и времени
                    this.fTime(x.t_s_in).toLowerCase().includes(q) ||
                    this.fTime(x.t_s_out).toLowerCase().includes(q) ||
                    this.fTime(x.t_e_in).toLowerCase().includes(q) ||
                    this.fTime(x.t_e_out).toLowerCase().includes(q) ||
                    this.fFull(x.t_out).toLowerCase().includes(q)
                );
            }
            const pList = this.paginate(list);
            cont.innerHTML = this.drawJournalTable(pList);
            this.drawPagination(list.length, cont);
        }
        // --- СПРАВОЧНИК ТС ---
        else if (p === 'fleet') {
            let list = TRUCKS;
            if(q) {
                list = list.filter(x =>
                    x.plate.toLowerCase().includes(q) ||
                    x.model.toLowerCase().includes(q)
                );
            }
            cont.innerHTML = `<div class="table-container"><table>
                <thead><tr><th>Гос. номер</th><th>Марка / Модель ТС</th></tr></thead>
                <tbody>${list.map(t=>`<tr><td><b>${t.plate}</b></td><td>${t.model}</td></tr>`).join('')}</tbody>
            </table></div>`;
        }
        // --- ЖУРНАЛ СОБЫТИЙ (ЛОГИ) ---
        else if (p === 'log') {
            let list = app.log;
            if(q) {
                list = list.filter(x =>
                    x.fs.includes(q) // Поиск по полному строковому представлению события
                );
            }
            const pList = this.paginate(list);
            cont.innerHTML = `<div class="table-container"><table>
                <thead><tr><th>Дата/Время</th><th>Кто</th><th>Событие</th><th>Инфо</th></tr></thead>
                <tbody>${pList.map(l=>`<tr><td>${l.dt} ${l.tm}</td><td><b>${l.usr}</b></td><td>${l.act}</td><td>${l.inf}</td></tr>`).join('')}</tbody>
            </table></div>`;
            this.drawPagination(list.length, cont);
        }
    },

    drawCard(i) {
        const mins = Math.floor((Date.now() - i.t_in) / 60000);
        const maxMins = 90;
        const percent = Math.min((mins / maxMins) * 100, 100);
        
        let color = '#218838'; // Зеленый
        if(percent > 60) color = '#d4af37'; // Желтый
        if(percent >= 100) color = '#c82333'; // Красный

        let actions = '';
        const r = app.user.role;
        if (r==='admin' || r==='kpp') actions += `<button class="btn btn-danger btn-sm" onclick="app.updateStep(${i.id}, 't_out', 'Выехал')">ВЫЕЗД</button>`;
        if (r==='admin' || r==='store') {
            if(!i.t_s_in) actions += `<button class="btn btn-primary btn-sm" onclick="app.updateStep(${i.id}, 't_s_in', 'На складе')">ПРИБЫЛ СКЛАД</button>`;
            else if(!i.t_s_out) actions += `<button class="btn btn-success btn-sm" onclick="app.updateStep(${i.id}, 't_s_out', 'Склад завершен')">УБЫЛ СКЛАД</button>`;
        }
        if (r==='admin' || r==='eng') {
            if(!i.t_e_in) actions += `<button class="btn btn-primary btn-sm" onclick="app.updateStep(${i.id}, 't_e_in', 'У инженера')">ПРИБЫЛ ИНЖ.</button>`;
            else actions += `<button class="btn btn-accent btn-sm" onclick="ui.openModal(${i.id})">МАРШРУТИЗАЦИЯ</button>`;
        }
        if (r==='admin') actions += `<button class="btn btn-secondary btn-sm" onclick="app.deleteRecord(${i.id})">УДАЛИТЬ</button>`;
        
        return `
            <div class="card">
                <span class="card-num">№${i.num}</span>
                <h4>${i.truck}</h4>
                <small>${i.driver}</small>
                <div class="timer-box">
                    <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                        <span>Время на базе: ${mins} мин.</span>
                        <span>Предел: ${maxMins} мин.</span>
                    </div>
                    <div class="progress-bg">
                        <div class="progress-fill" style="width:${percent}%; background:${color}"></div>
                    </div>
                    ${mins >= maxMins ? '<div class="stall-alert">⚠ ПЕРЕСТОЙ / ВНИМАНИЕ ⚠</div>' : ''}
                </div>
                <p style="font-size:13px;">Статус: <b>${i.status}</b></p>
                <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:10px;">${actions}</div>
            </div>`;
    },

    drawLiveTable(list) {
        return `<div class="table-container"><table>
            <thead><tr><th>№</th><th>Транспорт</th><th>Водитель</th><th>Время въезда</th><th>Минут на базе</th><th>Текущий статус</th></tr></thead>
            <tbody>${list.map(i=>`<tr>
                <td>${i.num}</td><td><b>${i.truck}</b></td><td>${i.driver}</td>
                <td>${this.fTime(i.t_in)}</td>
                <td style="color:${(Date.now()-i.t_in)/60000 > 90 ? 'red':'inherit'}"><b>${Math.floor((Date.now()-i.t_in)/60000)} мин.</b></td>
                <td>${i.status}</td>
            </tr>`).join('')}</tbody>
        </table></div>`;
    },

    drawJournalTable(list) {
        return `<div class="table-container"><table>
            <thead><tr>
                <th>№</th><th>Транспорт</th>
                <th>Дата и время въезда на территорию</th>
                <th>Прибыл к кладовщику</th><th>Уехал от кладовщика</th>
                <th>Приехал к инженеру</th><th>Уехал от инженера</th>
                <th>Дата и время выезда</th><th>Статус</th>
            </tr></thead>
            <tbody>${list.map(i=>`<tr>
                <td><b>${i.num}</b></td><td>${i.truck}</td>
                <td>${this.fFull(i.t_in)}</td>
                <td>${this.fTime(i.t_s_in)}</td><td>${this.fTime(i.t_s_out)}</td>
                <td>${this.fTime(i.t_e_in)}</td><td>${this.fTime(i.t_e_out)}</td>
                <td>${this.fFull(i.t_out)}</td>
                <td><b>${i.status}</b></td>
            </tr>`).join('')}</tbody>
        </table></div>`;
    },

    openModal(id) { app.editingId = id; document.getElementById('modal-permit').style.display = 'flex'; },
    closeModal() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); },

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
                <p>Погрузка: [${d.type1?'<b>X</b>':' '}] труба [${d.type2?'<b>X</b>':' '}] патрубки</p>
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

    // --- Пагинация ---
    paginate(list) {
        const start = (this.currentPageNumber - 1) * app.itemsPerPage;
        return list.slice(start, start + app.itemsPerPage);
    },

    drawPagination(totalItems, container) {
        const pages = Math.ceil(totalItems / app.itemsPerPage);
        if (pages <= 1) return;
        const nav = document.createElement('div');
        nav.className = 'pagination';
        for (let i = 1; i <= pages; i++) {
            nav.innerHTML += `<div class="page-item ${i === this.currentPageNumber ? 'active' : ''}" onclick="ui.goToPage(${i})">${i}</div>`;
        }
        container.appendChild(nav);
    },

    goToPage(p) { this.currentPageNumber = p; this.render(); },
};