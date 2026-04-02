/** Stable fill color per teacher email for timetable cells (PDF + UI). */

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

export function teacherHexColor(email: string): string {
  const e = email.trim().toLowerCase();
  const h = hashString(e);
  const hue = h % 360;
  const sat = 55 + (h % 25);
  const light = 82 + (h % 8);
  return hslToHex(hue, sat / 100, light / 100);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
