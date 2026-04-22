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
  },
};
