/**
 * PDF timetable headings + class subject picker strings for locales that use
 * the English base plus `localePatches6` overlays (nl, pl, ro, ru, uk, ar).
 */
export const EXTRA_PDF_TIMETABLE_AND_CLASS_SUBJECT: Record<
  "nl" | "pl" | "ro" | "ru" | "uk" | "ar",
  Record<string, string>
> = {
  nl: {
    "pdf.timetableTitle": "Weekrooster",
    "pdf.timetableMyTitle": "Mijn rooster",
    "pdf.timetableLunch": "Lunch",
    "pdf.timetablePeriodAm": "VM {n}",
    "pdf.timetablePeriodPm": "NM {n}",
    "pdf.timetableRoomN": "Lokaal {n}",
    "pdf.timetablePageRoom": "Ruimte {n}",
    "class.selectOrDefineSubject": "Vak kiezen of invoeren",
    "class.subjectPickerHint":
      "Kies een vooraf ingestelde code (bijv. efl) of typ een nieuwe vaknaam; nieuwe namen worden voor deze school bewaard.",
    "class.invalidSubject": "Voer een geldig vak in (vooraf ingestelde code of max. 120 tekens).",
    "class.customSubjectsTitle": "Eigen vakken (deze school)",
    "class.customSubjectsLead":
      "Hernoem of verwijder vakken die u aan de scholenlijst hebt toegevoegd. Vooraf ingestelde codes kunt u hier niet wijzigen. Verwijderen zet klassen die het gebruikten op Engels (efl).",
    "class.editCustomSubject": "Bewerken",
    "class.deleteCustomSubject": "Verwijderen",
    "class.saveCustomSubjectRename": "Opslaan",
    "class.cancelCustomSubjectRename": "Annuleren",
    "class.confirmDeleteCustomSubject":
      "«{name}» uit de vakkenlijst van deze school verwijderen? Klassen die het gebruikten krijgen Engels (efl) als standaard.",
    "class.subjectRenameFailed": "Vak kon niet worden hernoemd.",
    "class.subjectDeleteFailed": "Vak kon niet worden verwijderd.",
  },
  pl: {
    "pdf.timetableTitle": "Plan tygodniowy",
    "pdf.timetableMyTitle": "Mój plan",
    "pdf.timetableLunch": "Obiad",
    "pdf.timetablePeriodAm": "Lekcja {n} (przedpołudnie)",
    "pdf.timetablePeriodPm": "Lekcja {n} (popołudnie)",
    "pdf.timetableRoomN": "Sala {n}",
    "pdf.timetablePageRoom": "Sala {n}",
    "class.selectOrDefineSubject": "Wybierz lub wpisz przedmiot",
    "class.subjectPickerHint":
      "Wybierz kod z listy (np. efl) lub wpisz nową nazwę przedmiotu; nowe nazwy są zapisywane dla tej szkoły.",
    "class.invalidSubject": "Podaj prawidłowy przedmiot (kod z listy lub do 120 znaków).",
    "class.customSubjectsTitle": "Własne przedmioty (ta szkoła)",
    "class.customSubjectsLead":
      "Zmień nazwę lub usuń przedmioty dodane do listy szkoły. Kodów z listy nie edytuje się tutaj. Po usunięciu klasy, które go używały, mają domyślnie angielski (efl).",
    "class.editCustomSubject": "Edytuj",
    "class.deleteCustomSubject": "Usuń",
    "class.saveCustomSubjectRename": "Zapisz",
    "class.cancelCustomSubjectRename": "Anuluj",
    "class.confirmDeleteCustomSubject":
      "Usunąć „{name}” z listy przedmiotów tej szkoły? Klasy, które go używały, dostaną domyślnie angielski (efl).",
    "class.subjectRenameFailed": "Nie udało się zmienić nazwy przedmiotu.",
    "class.subjectDeleteFailed": "Nie udało się usunąć przedmiotu.",
  },
  ro: {
    "pdf.timetableTitle": "Orar săptămânal",
    "pdf.timetableMyTitle": "Orarul meu",
    "pdf.timetableLunch": "Pauză de masă",
    "pdf.timetablePeriodAm": "Dimineața {n}",
    "pdf.timetablePeriodPm": "După-amiază {n}",
    "pdf.timetableRoomN": "Sală {n}",
    "pdf.timetablePageRoom": "Sală {n}",
    "class.selectOrDefineSubject": "Selectați sau definiți disciplina",
    "class.subjectPickerHint":
      "Alegeți un cod presetat din listă (ex. efl) sau introduceți un nume nou; numele noi se salvează pentru această școală.",
    "class.invalidSubject": "Introduceți o disciplină validă (cod presetat sau până la 120 de caractere).",
    "class.customSubjectsTitle": "Discipline personalizate (această școală)",
    "class.customSubjectsLead":
      "Redenumiți sau eliminați disciplinele adăugate la lista școlii. Codurile predefinite nu se schimbă aici. La ștergere, clasele afectate trec la engleză (efl).",
    "class.editCustomSubject": "Editare",
    "class.deleteCustomSubject": "Ștergere",
    "class.saveCustomSubjectRename": "Salvare",
    "class.cancelCustomSubjectRename": "Anulare",
    "class.confirmDeleteCustomSubject":
      "Eliminați „{name}” din lista de discipline a școlii? Clasele care o foloseau vor avea implicit engleză (efl).",
    "class.subjectRenameFailed": "Redenumirea a eșuat.",
    "class.subjectDeleteFailed": "Ștergerea a eșuat.",
  },
  ru: {
    "pdf.timetableTitle": "Расписание на неделю",
    "pdf.timetableMyTitle": "Моё расписание",
    "pdf.timetableLunch": "Обед",
    "pdf.timetablePeriodAm": "Урок {n} (до обеда)",
    "pdf.timetablePeriodPm": "Урок {n} (после обеда)",
    "pdf.timetableRoomN": "Каб. {n}",
    "pdf.timetablePageRoom": "Аудитория {n}",
    "class.selectOrDefineSubject": "Выберите или введите предмет",
    "class.subjectPickerHint":
      "Выберите код из списка (например efl) или введите новое название; новые названия сохраняются для этой школы.",
    "class.invalidSubject": "Введите допустимый предмет (код из списка или до 120 символов).",
    "class.customSubjectsTitle": "Свои предметы (эта школа)",
    "class.customSubjectsLead":
      "Переименуйте или удалите предметы, добавленные в список школы. Предустановленные коды здесь не меняются. При удалении классы, которые его использовали, получают английский (efl).",
    "class.editCustomSubject": "Изменить",
    "class.deleteCustomSubject": "Удалить",
    "class.saveCustomSubjectRename": "Сохранить",
    "class.cancelCustomSubjectRename": "Отмена",
    "class.confirmDeleteCustomSubject":
      "Удалить «{name}» из списка предметов этой школы? Классы, где он был, перейдут на английский (efl) по умолчанию.",
    "class.subjectRenameFailed": "Не удалось переименовать предмет.",
    "class.subjectDeleteFailed": "Не удалось удалить предмет.",
  },
  uk: {
    "pdf.timetableTitle": "Тижневий розклад",
    "pdf.timetableMyTitle": "Мій розклад",
    "pdf.timetableLunch": "Обід",
    "pdf.timetablePeriodAm": "Урок {n} (ранок)",
    "pdf.timetablePeriodPm": "Урок {n} (після обіду)",
    "pdf.timetableRoomN": "Кім. {n}",
    "pdf.timetablePageRoom": "Аудиторія {n}",
    "class.selectOrDefineSubject": "Виберіть або введіть предмет",
    "class.subjectPickerHint":
      "Оберіть код із списку (наприклад efl) або введіть нову назву; нові назви зберігаються для цієї школи.",
    "class.invalidSubject": "Введіть коректний предмет (код із списку або до 120 символів).",
    "class.customSubjectsTitle": "Власні предмети (ця школа)",
    "class.customSubjectsLead":
      "Перейменуйте або приберіть предмети, додані до списку школи. Налаштовані коди тут не змінюються. Після видалення класи, що їх використовували, отримають англійську (efl).",
    "class.editCustomSubject": "Редагувати",
    "class.deleteCustomSubject": "Видалити",
    "class.saveCustomSubjectRename": "Зберегти",
    "class.cancelCustomSubjectRename": "Скасувати",
    "class.confirmDeleteCustomSubject":
      "Прибрати «{name}» зі списку предметів цієї школи? Класи, що його використовували, матимуть за замовчуванням англійську (efl).",
    "class.subjectRenameFailed": "Не вдалося перейменувати предмет.",
    "class.subjectDeleteFailed": "Не вдалося видалити предмет.",
  },
  ar: {
    "pdf.timetableTitle": "الجدول الأسبوعي",
    "pdf.timetableMyTitle": "جدولي",
    "pdf.timetableLunch": "غداء",
    "pdf.timetablePeriodAm": "حصة {n} صباحًا",
    "pdf.timetablePeriodPm": "حصة {n} مساءً",
    "pdf.timetableRoomN": "قاعة {n}",
    "pdf.timetablePageRoom": "غرفة {n}",
    "class.selectOrDefineSubject": "اختر أو عرّف المادة",
    "class.subjectPickerHint":
      "اختر رمزًا جاهزًا من القائمة (مثل efl) أو اكتب اسم مادة جديد؛ تُحفظ الأسماء الجديدة لهذه المدرسة.",
    "class.invalidSubject": "أدخل مادة صالحة (رمز جاهز أو حتى 120 حرفًا).",
    "class.customSubjectsTitle": "مواد مخصصة (هذه المدرسة)",
    "class.customSubjectsLead":
      "أعد تسمية المواد أو احذفها من قائمة المدرسة. الرموز الجاهزة لا تُعدّل هنا. عند الحذف، الصفوف التي كانت تستخدم المادة تنتقل إلى الإنجليزية (efl).",
    "class.editCustomSubject": "تعديل",
    "class.deleteCustomSubject": "حذف",
    "class.saveCustomSubjectRename": "حفظ",
    "class.cancelCustomSubjectRename": "إلغاء",
    "class.confirmDeleteCustomSubject":
      "إزالة «{name}» من قائمة مواد هذه المدرسة؟ الصفوف التي كانت تستخدمها ستصبح افتراضيًا إنجليزية (efl).",
    "class.subjectRenameFailed": "تعذّر إعادة التسمية.",
    "class.subjectDeleteFailed": "تعذّر الحذف.",
  },
};
