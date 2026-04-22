-- Allow class "cefr_level" to store CEFR bands (language context) or year labels (primary/secondary).

alter table public.classes drop constraint if exists classes_cefr_level_check;

alter table public.classes
  add constraint classes_cefr_level_check
  check (
    cefr_level is null
    or cefr_level in (
      'A1',
      'A2',
      'B1',
      'B2',
      'C1',
      'C2',
      'Year 1',
      'Year 2',
      'Year 3',
      'Year 4',
      'Year 5',
      'Year 6',
      'Year 7',
      'Year 8',
      'Year 9',
      'Year 10',
      'Year 11',
      'Year 12',
      'Year 13'
    )
  );
