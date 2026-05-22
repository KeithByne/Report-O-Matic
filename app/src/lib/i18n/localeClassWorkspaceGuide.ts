/**
 * Class workspace menu hover tips and related labels (class.guide.*, class.printReport, class.registerMenu).
 * Merged into IT, EL, DE, PT, NL, PL, RO, RU, UK, AR locale bundles in uiStrings.ts.
 */

const CLASS_GUIDE_KEYS = [
  "class.registerMenu",
  "class.printReport",
  "class.guide.settingsTitle",
  "class.guide.settings1",
  "class.guide.settings2",
  "class.guide.settings3",
  "class.guide.studentsTitle",
  "class.guide.students1",
  "class.guide.students2",
  "class.guide.students3",
  "class.guide.bulkTitle",
  "class.guide.bulk1",
  "class.guide.bulk2",
  "class.guide.bulk3",
  "class.guide.registerTitle",
  "class.guide.register1",
  "class.guide.register2",
  "class.guide.register3",
  "class.guide.moveTitle",
  "class.guide.move1",
  "class.guide.move2",
  "class.guide.move3",
  "class.guide.locateTitle",
  "class.guide.locate1",
  "class.guide.locate2",
  "class.guide.locate3",
] as const;

const CLASS_GUIDE_LOCATE_IT: Record<string, string> = {
  "class.guide.locateTitle": "Colloca da Studenti attivi",
  "class.guide.locate1":
    "Apri per collocare uno studente dall’elenco Studenti attivi in questa classe.",
  "class.guide.locate2":
    "Scegli lo studente e conferma — resta nell’elenco attivo per altre classi.",
  "class.guide.locate3": "Aggiungi prima nuovi studenti in Studenti attivi nel pannello.",
};

const CLASS_GUIDE_LOCATE_FR: Record<string, string> = {
  "class.guide.locateTitle": "Placer depuis les élèves actifs",
  "class.guide.locate1":
    "Ouvrez ceci pour placer un élève de la liste Élèves actifs dans cette classe.",
  "class.guide.locate2":
    "Choisissez l’élève, puis confirmez — il reste sur la liste active pour d’autres classes.",
  "class.guide.locate3": "Ajoutez d’abord de nouveaux élèves via Élèves actifs sur le tableau de bord.",
};

const CLASS_GUIDE_LOCATE_DE: Record<string, string> = {
  "class.guide.locateTitle": "Aus aktiven Schülern zuordnen",
  "class.guide.locate1":
    "Öffnen Sie dies, um einen Schüler aus der Liste Aktive Schüler dieser Klasse zuzuordnen.",
  "class.guide.locate2":
    "Schüler wählen und bestätigen — er bleibt auf der aktiven Liste für andere Klassen.",
  "class.guide.locate3": "Neue Schüler zuerst unter Aktive Schüler im Dashboard anlegen.",
};

const CLASS_GUIDE_LOCATE_ES: Record<string, string> = {
  "class.guide.locateTitle": "Colocar desde alumnos activos",
  "class.guide.locate1":
    "Abra esto para colocar un alumno de la lista de Alumnos activos en esta clase.",
  "class.guide.locate2":
    "Elija el alumno y confirme — sigue en la lista activa para otras clases.",
  "class.guide.locate3": "Añada primero alumnos nuevos en Alumnos activos del panel.",
};

const CLASS_GUIDE_LOCATE_RU: Record<string, string> = {
  "class.guide.locateTitle": "Разместить из активных учеников",
  "class.guide.locate1":
    "Откройте, чтобы добавить ученика из списка активных в этот класс.",
  "class.guide.locate2":
    "Выберите ученика и подтвердите — он остаётся в активном списке для других классов.",
  "class.guide.locate3": "Сначала добавьте учеников в «Активные ученики» на панели.",
};

const CLASS_GUIDE_LOCATE_AR: Record<string, string> = {
  "class.guide.locateTitle": "تعيين من الطلاب النشطين",
  "class.guide.locate1": "افتح لتعيين تلميذ من قائمة الطلاب النشطين في هذا الصف.",
  "class.guide.locate2": "اختر التلميذ ثم أكّد — يبقى في القائمة النشطة لصفوف أخرى.",
  "class.guide.locate3": "أضف تلاميذ جدداً أولاً في الطلاب النشطون على لوحة التحكم.",
};

export const CLASS_WORKSPACE_GUIDE_IT: Record<string, string> = {
  "class.registerMenu": "Registro",
  "class.printReport": "Stampa rapporti",
  "class.guide.settingsTitle": "Impostazioni classe",
  "class.guide.settings1":
    "Nome classe, anno, livello, materia e lingua predefinita per i nuovi rapporti.",
  "class.guide.settings2": "Scegli i giorni di lezione — il registro usa quei giorni.",
  "class.guide.settings3":
    "Proprietario e capo dipartimento possono assegnare docente e aula.",
  "class.guide.studentsTitle": "Studenti",
  "class.guide.students1": "Aggiungi studenti; apri uno per scrivere o modificare il rapporto.",
  "class.guide.students2": "Usa Nuovo rapporto se non c’è ancora un rapporto per il periodo.",
  "class.guide.students3": "Modifica o rimuovi uno studente qui prima dei rapporti.",
  "class.guide.bulkTitle": "Stampa rapporti di classe",
  "class.guide.bulk1":
    "Scegli un periodo, poi Stampa rapporti per vedere tutti i rapporti completati in un PDF.",
  "class.guide.bulk2": "Ogni studente deve avere un rapporto completato per il periodo scelto.",
  "class.guide.bulk3": "Usa Stampa nella barra dell’anteprima o apri in una nuova scheda.",
  "class.guide.registerTitle": "Registro",
  "class.guide.register1": "Apre il registro presenze per i giorni impostati nelle impostazioni.",
  "class.guide.register2": "Aggiungi studenti e giorni di lezione se il registro non è ancora disponibile.",
  "class.guide.register3": "Usa Stampa nella barra dell’anteprima quando il registro è visibile.",
  "class.guide.moveTitle": "Sposta studente",
  "class.guide.move1": "Sposta uno studente in un’altra classe senza perdere i rapporti.",
  "class.guide.move2": "Scegli studente e classe di destinazione, poi conferma.",
  "class.guide.move3": "Utile quando uno studente cambia gruppo a metà anno.",
  ...CLASS_GUIDE_LOCATE_IT,
};

export const CLASS_WORKSPACE_GUIDE_EL: Record<string, string> = {
  "class.registerMenu": "Παρουσιολόγιο",
  "class.printReport": "Εκτύπωση αναφορών",
  "class.guide.settingsTitle": "Ρυθμίσεις τάξης",
  "class.guide.settings1":
    "Όνομα τάξης, έτος, επίπεδο, μάθημα και προεπιλεγμένη γλώσσα για νέες αναφορές.",
  "class.guide.settings2": "Επιλέξτε τις ημέρες διδασκαλίας — το παρουσιολόγιο χρησιμοποιεί αυτές τις ημέρες.",
  "class.guide.settings3": "Ιδιοκτήτης και προϊστάμενος τμήματος μπορούν να ορίσουν καθηγητή και αίθουσα.",
  "class.guide.studentsTitle": "Μαθητές",
  "class.guide.students1": "Προσθέστε μαθητές· ανοίξτε έναν για να γράψετε ή να επεξεργαστείτε την αναφορά.",
  "class.guide.students2": "Χρησιμοποιήστε Νέα αναφορά αν δεν υπάρχει ακόμη αναφορά για την περίοδο.",
  "class.guide.students3": "Επεξεργαστείτε ή αφαιρέστε μαθητή εδώ πριν τις αναφορές.",
  "class.guide.bulkTitle": "Εκτύπωση αναφορών τάξης",
  "class.guide.bulk1":
    "Επιλέξτε περίοδο, μετά Εκτύπωση αναφορών για προεπισκόπηση όλων των ολοκληρωμένων αναφορών σε ένα PDF.",
  "class.guide.bulk2": "Όλοι οι μαθητές χρειάζονται ολοκληρωμένη αναφορά για την επιλεγμένη περίοδο.",
  "class.guide.bulk3": "Χρησιμοποιήστε Εκτύπωση στη γραμμή εργαλείων ή ανοίξτε σε νέα καρτέλα.",
  "class.guide.registerTitle": "Παρουσιολόγιο",
  "class.guide.register1": "Ανοίγει το παρουσιολόγιο για τις ημέρες που ορίζονται στις ρυθμίσεις.",
  "class.guide.register2": "Προσθέστε μαθητές και ημέρες διδασκαλίας αν το παρουσιολόγιο δεν είναι ακόμη διαθέσιμο.",
  "class.guide.register3": "Χρησιμοποιήστε Εκτύπωση στη γραμμή εργαλείων όταν εμφανίζεται το παρουσιολόγιο.",
  "class.guide.moveTitle": "Μετακίνηση μαθητή",
  "class.guide.move1": "Μετακινήστε μαθητή σε άλλη τάξη χωρίς να χάσετε τις αναφορές.",
  "class.guide.move2": "Επιλέξτε μαθητή και τάξη προορισμού, μετά επιβεβαιώστε.",
  "class.guide.move3": "Χρήσιμο όταν ένας μαθητής αλλάζει ομάδα στη μέση της χρονιάς.",
  ...CLASS_GUIDE_LOCATE_FR,
};

export const CLASS_WORKSPACE_GUIDE_DE: Record<string, string> = {
  "class.registerMenu": "Klassenbuch",
  "class.printReport": "Berichte drucken",
  "class.guide.settingsTitle": "Klasseneinstellungen",
  "class.guide.settings1":
    "Klassenname, Schuljahr, Niveau, Fach und Standardsprache für neue Berichte festlegen.",
  "class.guide.settings2": "Unterrichtstage wählen — das Klassenbuch nutzt diese Tage.",
  "class.guide.settings3": "Schulleitung und Fachleitung können Lehrkraft und Raum zuweisen.",
  "class.guide.studentsTitle": "Schüler",
  "class.guide.students1": "Schüler hinzufügen; einen öffnen, um den Bericht zu schreiben oder zu bearbeiten.",
  "class.guide.students2": "„Neuer Bericht“ verwenden, wenn für das Halbjahr noch kein Bericht existiert.",
  "class.guide.students3": "Schüler hier bearbeiten oder entfernen, bevor Sie Berichte schreiben.",
  "class.guide.bulkTitle": "Klassenberichte drucken",
  "class.guide.bulk1":
    "Halbjahr wählen, dann Berichte drucken, um alle fertigen Berichte in einer PDF-Vorschau zu sehen.",
  "class.guide.bulk2": "Jeder Schüler braucht einen fertigen Bericht für das gewählte Halbjahr.",
  "class.guide.bulk3": "Drucken in der Vorschau-Symbolleiste oder in neuem Tab öffnen.",
  "class.guide.registerTitle": "Klassenbuch",
  "class.guide.register1": "Öffnet das Anwesenheitsregister für die in den Einstellungen gesetzten Tage.",
  "class.guide.register2": "Schüler und Unterrichtstage hinzufügen, wenn das Register noch nicht verfügbar ist.",
  "class.guide.register3": "Drucken in der Vorschau-Symbolleiste, wenn das Register angezeigt wird.",
  "class.guide.moveTitle": "Schüler verschieben",
  "class.guide.move1": "Schüler in eine andere Klasse verschieben, ohne Berichte zu verlieren.",
  "class.guide.move2": "Schüler und Zielklasse wählen, dann bestätigen.",
  "class.guide.move3": "Nützlich, wenn ein Schüler die Gruppe im Jahresverlauf wechselt.",
  ...CLASS_GUIDE_LOCATE_DE,
};

export const CLASS_WORKSPACE_GUIDE_PT: Record<string, string> = {
  "class.registerMenu": "Registo",
  "class.printReport": "Imprimir relatórios",
  "class.guide.settingsTitle": "Definições da turma",
  "class.guide.settings1":
    "Nome da turma, ano letivo, nível, disciplina e idioma predefinido para novos relatórios.",
  "class.guide.settings2": "Escolha os dias de aula — o registo usa esses dias.",
  "class.guide.settings3": "O proprietário e o chefe de departamento podem atribuir professor e sala.",
  "class.guide.studentsTitle": "Alunos",
  "class.guide.students1": "Adicione alunos; abra um para escrever ou editar o relatório.",
  "class.guide.students2": "Use Novo relatório se ainda não houver relatório para o período.",
  "class.guide.students3": "Edite ou remova um aluno aqui antes de elaborar relatórios.",
  "class.guide.bulkTitle": "Imprimir relatórios da turma",
  "class.guide.bulk1":
    "Escolha um período e depois Imprimir relatórios para ver todos os relatórios concluídos num PDF.",
  "class.guide.bulk2": "Todos os alunos precisam de um relatório concluído para o período escolhido.",
  "class.guide.bulk3": "Use Imprimir na barra da pré-visualização ou abra num novo separador.",
  "class.guide.registerTitle": "Registo",
  "class.guide.register1": "Abre o registo de presenças para os dias definidos nas definições.",
  "class.guide.register2": "Adicione alunos e dias de aula se o registo ainda não estiver disponível.",
  "class.guide.register3": "Use Imprimir na barra da pré-visualização quando o registo estiver visível.",
  "class.guide.moveTitle": "Mover aluno",
  "class.guide.move1": "Mova um aluno para outra turma sem perder os relatórios.",
  "class.guide.move2": "Escolha o aluno e a turma de destino e confirme.",
  "class.guide.move3": "Útil quando um aluno muda de grupo a meio do ano letivo.",
  ...CLASS_GUIDE_LOCATE_ES,
};

export const CLASS_WORKSPACE_GUIDE_NL: Record<string, string> = {
  "class.registerMenu": "Registratie",
  "class.printReport": "Rapporten afdrukken",
  "class.guide.settingsTitle": "Klasinstellingen",
  "class.guide.settings1":
    "Klassennaam, schooljaar, niveau, vak en standaardtaal voor nieuwe rapporten instellen.",
  "class.guide.settings2": "Kies lesdagen — de registratie gebruikt die dagen.",
  "class.guide.settings3": "Schoolleider en afdelingshoofd kunnen docent en lokaal toewijzen.",
  "class.guide.studentsTitle": "Leerlingen",
  "class.guide.students1": "Voeg leerlingen toe; open een leerling om het rapport te schrijven of te bewerken.",
  "class.guide.students2": "Gebruik Nieuw rapport als er nog geen rapport is voor de periode.",
  "class.guide.students3": "Bewerk of verwijder een leerling hier vóór u rapporten schrijft.",
  "class.guide.bulkTitle": "Klasrapporten afdrukken",
  "class.guide.bulk1":
    "Kies een periode en open daarna Rapporten afdrukken om alle voltooide rapporten in één PDF te bekijken.",
  "class.guide.bulk2": "Elke leerling moet een voltooid rapport hebben voor de gekozen periode.",
  "class.guide.bulk3": "Gebruik Afdrukken in de werkbalk of open in een nieuw tabblad.",
  "class.guide.registerTitle": "Registratie",
  "class.guide.register1": "Opent het presentieregister voor de dagen in de klasinstellingen.",
  "class.guide.register2": "Voeg leerlingen en lesdagen toe als het register nog niet beschikbaar is.",
  "class.guide.register3": "Gebruik Afdrukken in de werkbalk wanneer het register zichtbaar is.",
  "class.guide.moveTitle": "Leerling verplaatsen",
  "class.guide.move1": "Verplaats een leerling naar een andere klas zonder rapporten te verliezen.",
  "class.guide.move2": "Kies leerling en doelklas en bevestig.",
  "class.guide.move3": "Handig wanneer een leerling van groep wisselt tijdens het schooljaar.",
  ...CLASS_GUIDE_LOCATE_FR,
};

export const CLASS_WORKSPACE_GUIDE_PL: Record<string, string> = {
  "class.registerMenu": "Dziennik",
  "class.printReport": "Drukuj sprawozdania",
  "class.guide.settingsTitle": "Ustawienia klasy",
  "class.guide.settings1":
    "Nazwa klasy, rok szkolny, poziom, przedmiot i domyślny język dla nowych sprawozdań.",
  "class.guide.settings2": "Wybierz dni zajęć — dziennik korzysta z tych dni.",
  "class.guide.settings3": "Właściciel i kierownik działu mogą przypisać nauczyciela i salę.",
  "class.guide.studentsTitle": "Uczniowie",
  "class.guide.students1": "Dodaj uczniów; otwórz ucznia, aby napisać lub edytować sprawozdanie.",
  "class.guide.students2": "Użyj Nowe sprawozdanie, jeśli nie ma jeszcze sprawozdania na dany okres.",
  "class.guide.students3": "Edytuj lub usuń ucznia tutaj przed pisaniem sprawozdań.",
  "class.guide.bulkTitle": "Drukuj sprawozdania klasy",
  "class.guide.bulk1":
    "Wybierz okres, następnie Drukuj sprawozdania, aby zobaczyć wszystkie ukończone sprawozdania w jednym PDF.",
  "class.guide.bulk2": "Każdy uczeń musi mieć ukończone sprawozdanie na wybrany okres.",
  "class.guide.bulk3": "Użyj Drukuj na pasku podglądu lub otwórz w nowej karcie.",
  "class.guide.registerTitle": "Dziennik",
  "class.guide.register1": "Otwiera dziennik obecności dla dni ustawionych w ustawieniach klasy.",
  "class.guide.register2": "Dodaj uczniów i dni zajęć, jeśli dziennik nie jest jeszcze dostępny.",
  "class.guide.register3": "Użyj Drukuj na pasku podglądu, gdy dziennik jest widoczny.",
  "class.guide.moveTitle": "Przenieś ucznia",
  "class.guide.move1": "Przenieś ucznia do innej klasy bez utraty sprawozdań.",
  "class.guide.move2": "Wybierz ucznia i klasę docelową, potem potwierdź.",
  "class.guide.move3": "Przydatne, gdy uczeń zmienia grupę w trakcie roku.",
  ...CLASS_GUIDE_LOCATE_FR,
};

export const CLASS_WORKSPACE_GUIDE_RO: Record<string, string> = {
  "class.registerMenu": "Registru",
  "class.printReport": "Tipărește rapoarte",
  "class.guide.settingsTitle": "Setări clasă",
  "class.guide.settings1":
    "Nume clasă, an școlar, nivel, materie și limba implicită pentru rapoarte noi.",
  "class.guide.settings2": "Alegeți zilele de curs — registrul folosește acele zile.",
  "class.guide.settings3": "Proprietarul și șeful de departament pot atribui profesorul și sala.",
  "class.guide.studentsTitle": "Elevi",
  "class.guide.students1": "Adăugați elevi; deschideți un elev pentru a scrie sau edita raportul.",
  "class.guide.students2": "Folosiți Raport nou dacă nu există încă raport pentru perioadă.",
  "class.guide.students3": "Editați sau eliminați un elev aici înainte de raportare.",
  "class.guide.bulkTitle": "Tipărește rapoartele clasei",
  "class.guide.bulk1":
    "Alegeți o perioadă, apoi Tipărește rapoarte pentru a vedea toate rapoartele finalizate într-un PDF.",
  "class.guide.bulk2": "Fiecare elev trebuie să aibă un raport finalizat pentru perioada aleasă.",
  "class.guide.bulk3": "Folosiți Tipărire în bara de previzualizare sau deschideți într-un tab nou.",
  "class.guide.registerTitle": "Registru",
  "class.guide.register1": "Deschide registrul de prezență pentru zilele setate în setări.",
  "class.guide.register2": "Adăugați elevi și zile de curs dacă registrul nu este încă disponibil.",
  "class.guide.register3": "Folosiți Tipărire în bara de previzualizare când registrul este vizibil.",
  "class.guide.moveTitle": "Mută elev",
  "class.guide.move1": "Mutați un elev în altă clasă fără a pierde rapoartele.",
  "class.guide.move2": "Alegeți elevul și clasa destinație, apoi confirmați.",
  "class.guide.move3": "Util când un elev schimbă grupa la mijlocul anului.",
  ...CLASS_GUIDE_LOCATE_FR,
};

export const CLASS_WORKSPACE_GUIDE_RU: Record<string, string> = {
  "class.registerMenu": "Журнал",
  "class.printReport": "Печать отчётов",
  "class.guide.settingsTitle": "Настройки класса",
  "class.guide.settings1":
    "Название класса, год, уровень, предмет и язык по умолчанию для новых отчётов.",
  "class.guide.settings2": "Выберите учебные дни — журнал использует эти дни.",
  "class.guide.settings3": "Владелец и завуч могут назначить учителя и кабинет.",
  "class.guide.studentsTitle": "Ученики",
  "class.guide.students1": "Добавьте учеников; откройте ученика, чтобы написать или изменить отчёт.",
  "class.guide.students2": "Используйте «Новый отчёт», если отчёта за период ещё нет.",
  "class.guide.students3": "Измените или удалите ученика здесь перед написанием отчётов.",
  "class.guide.bulkTitle": "Печать отчётов класса",
  "class.guide.bulk1":
    "Выберите период, затем «Печать отчётов», чтобы просмотреть все готовые отчёты в одном PDF.",
  "class.guide.bulk2": "У каждого ученика должен быть готовый отчёт за выбранный период.",
  "class.guide.bulk3": "Используйте «Печать» на панели просмотра или откройте в новой вкладке.",
  "class.guide.registerTitle": "Журнал",
  "class.guide.register1": "Открывает журнал посещаемости для дней, заданных в настройках.",
  "class.guide.register2": "Добавьте учеников и учебные дни, если журнал ещё недоступен.",
  "class.guide.register3": "Используйте «Печать» на панели, когда журнал на экране.",
  "class.guide.moveTitle": "Переместить ученика",
  "class.guide.move1": "Переместите ученика в другой класс без потери отчётов.",
  "class.guide.move2": "Выберите ученика и класс назначения, затем подтвердите.",
  "class.guide.move3": "Полезно, когда ученик меняет группу в середине года.",
  ...CLASS_GUIDE_LOCATE_RU,
};

export const CLASS_WORKSPACE_GUIDE_UK: Record<string, string> = {
  "class.registerMenu": "Журнал",
  "class.printReport": "Друк звітів",
  "class.guide.settingsTitle": "Налаштування класу",
  "class.guide.settings1":
    "Назва класу, рік, рівень, предмет і мова за замовчуванням для нових звітів.",
  "class.guide.settings2": "Оберіть навчальні дні — журнал використовує ці дні.",
  "class.guide.settings3": "Власник і завуч можуть призначити вчителя та кабінет.",
  "class.guide.studentsTitle": "Учні",
  "class.guide.students1": "Додайте учнів; відкрийте учня, щоб написати або змінити звіт.",
  "class.guide.students2": "Скористайтеся «Новий звіт», якщо звіту за період ще немає.",
  "class.guide.students3": "Змініть або видаліть учня тут перед написанням звітів.",
  "class.guide.bulkTitle": "Друк звітів класу",
  "class.guide.bulk1":
    "Оберіть період, потім «Друк звітів», щоб переглянути всі готові звіти в одному PDF.",
  "class.guide.bulk2": "Кожен учень має мати готовий звіт за обраний період.",
  "class.guide.bulk3": "Скористайтеся «Друк» на панелі перегляду або відкрийте в новій вкладці.",
  "class.guide.registerTitle": "Журнал",
  "class.guide.register1": "Відкриває журнал відвідуваності для днів у налаштуваннях класу.",
  "class.guide.register2": "Додайте учнів і навчальні дні, якщо журнал ще недоступний.",
  "class.guide.register3": "Скористайтеся «Друк» на панелі, коли журнал на екрані.",
  "class.guide.moveTitle": "Перемістити учня",
  "class.guide.move1": "Перемістіть учня в інший клас без втрати звітів.",
  "class.guide.move2": "Оберіть учня та клас призначення, потім підтвердіть.",
  "class.guide.move3": "Корисно, коли учень змінює групу в середині року.",
  ...CLASS_GUIDE_LOCATE_RU,
  "class.guide.locateTitle": "Розмістити з активних учнів",
  "class.guide.locate1":
    "Відкрийте, щоб додати учня зі списку активних у цей клас.",
  "class.guide.locate2":
    "Оберіть учня та підтвердіть — він лишається в активному списку для інших класів.",
  "class.guide.locate3": "Спочатку додайте учнів у «Активні учні» на панелі.",
};

export const CLASS_WORKSPACE_GUIDE_AR: Record<string, string> = {
  "class.registerMenu": "السجل",
  "class.printReport": "طباعة التقارير",
  "class.guide.settingsTitle": "إعدادات الصف",
  "class.guide.settings1": "اسم الصف والسنة والمستوى والمادة واللغة الافتراضية للتقارير الجديدة.",
  "class.guide.settings2": "اختر أيام الحصص — يستخدم السجل هذه الأيام.",
  "class.guide.settings3": "يمكن للمالك ورئيس القسم تعيين المعلم والقاعة.",
  "class.guide.studentsTitle": "التلاميذ",
  "class.guide.students1": "أضف التلاميذ؛ افتح تلميذاً لكتابة التقرير أو تعديله.",
  "class.guide.students2": "استخدم تقريراً جديداً إذا لم يكن هناك تقرير للفترة بعد.",
  "class.guide.students3": "عدّل أو أزل تلميذاً هنا قبل إعداد التقارير.",
  "class.guide.bulkTitle": "طباعة تقارير الصف",
  "class.guide.bulk1": "اختر فترة، ثم طباعة التقارير لمعاينة كل التقارير المكتملة في ملف PDF واحد.",
  "class.guide.bulk2": "يجب أن يكون لكل تلميذ تقرير مكتمل للفترة المختارة.",
  "class.guide.bulk3": "استخدم طباعة من شريط المعاينة أو افتح في تبويب جديد.",
  "class.guide.registerTitle": "السجل",
  "class.guide.register1": "يفتح سجل الحضور لأيام الحصص المحددة في الإعدادات.",
  "class.guide.register2": "أضف تلاميذ وأيام حصص إذا لم يكن السجل متاحاً بعد.",
  "class.guide.register3": "استخدم طباعة من شريط المعاينة عند ظهور السجل.",
  "class.guide.moveTitle": "نقل تلميذ",
  "class.guide.move1": "انقل تلميذاً إلى صف آخر دون فقدان تقاريره.",
  "class.guide.move2": "اختر التلميذ والصف الوجهة ثم أكّد.",
  "class.guide.move3": "مفيد عندما يغيّر التلميذ مجموعته منتصف العام.",
  ...CLASS_GUIDE_LOCATE_AR,
};

/** Keys exported for tests or validation. */
export const CLASS_WORKSPACE_GUIDE_KEY_COUNT = CLASS_GUIDE_KEYS.length;
