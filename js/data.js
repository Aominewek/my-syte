const TRUCKS = [
    { plate: "С100ОО 186", model: "KAMAZ (Трубовоз)" },
    { plate: "А250КР 86", model: "MAN (Площадка)" },
    { plate: "Х777НТ 186", model: "URAL (Вездеход)" },
    { plate: "В123ВВ 86", model: "KAMAZ (КМУ)" },
    { plate: "Е555КХ 186", model: "MAZ (Длинномер)" }
];

const DRIVERS = [
    "Иванов Иван Иванович", "Петров Петр Петрович", "Сидоров С.С.", "Морозов А.Д.",
    "Андреев Андрей Андреевич", "Борисов Борис Борисович"
];

const CRANES = ["Кран №1", "Кран №2", "Кран №3", "Кран №4"];

const CRANE_LIMIT_MIN = 30;

const USERS = {
    'AndrianovAV': { pass: '123', role: 'admin', name: 'Андриянов А.В.' },
    'KhvorostyanyukMU': { pass: '123', role: 'admin', name: 'Хворостянюк М.Ю.' },
    'boss':         { pass: '123', role: 'boss',  name: 'Руководитель' },
    'kpp':          { pass: '123', role: 'kpp',   name: 'КПП' },
    'sklad':        { pass: '123', role: 'store', name: 'Кладовщик' },
    'eng':          { pass: '123', role: 'eng',   name: 'Инженер ЦТБ' }
};

const STATUS = {
    IN: "На территории",
    STORE_IN: "У кладовщика",
    STORE_OUT: "Выехал от кладовщика",
    ENG_IN: "У инженера",
    READY: "Получил талон",
    LOADING: "На погрузке",
    LOADED: "Погрузка завершена",
    EXITED: "Выехал"
};