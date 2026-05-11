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

const USERS = {
    'AndrianovAV': { pass: '123', role: 'admin', name: 'Андриянов А.В.' },
    'KhvorostyanyukMU': { pass: '123', role: 'admin', name: 'Хворостянюк М.Ю.' },
    'kpp':   { pass: '123', role: 'kpp',   name: 'КПП' },
    'sklad': { pass: '123', role: 'store', name: 'Кладовщик' },
    'eng':   { pass: '123', role: 'eng',   name: 'Инженер ЦТБ' }
};

const STATUS = {
    IN: "На территории",
    STORE_IN: "У кладовщика",
    STORE_OUT: "Выехал от кладовщика",
    ENG_IN: "У инженера",
    READY: "Получил талон, уехал от инженера",
    EXITED: "Выехал"
};