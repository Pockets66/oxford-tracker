export function sunSignFromDate(isoDate) {
  if (!isoDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const mo = parseInt(m[2], 10);
  const d  = parseInt(m[3], 10);
  if ((mo === 12 && d >= 22) || (mo === 1  && d <= 19)) return "Capricorn";
  if ((mo === 1  && d >= 20) || (mo === 2  && d <= 18)) return "Aquarius";
  if ((mo === 2  && d >= 19) || (mo === 3  && d <= 20)) return "Pisces";
  if ((mo === 3  && d >= 21) || (mo === 4  && d <= 19)) return "Aries";
  if ((mo === 4  && d >= 20) || (mo === 5  && d <= 20)) return "Taurus";
  if ((mo === 5  && d >= 21) || (mo === 6  && d <= 20)) return "Gemini";
  if ((mo === 6  && d >= 21) || (mo === 7  && d <= 22)) return "Cancer";
  if ((mo === 7  && d >= 23) || (mo === 8  && d <= 22)) return "Leo";
  if ((mo === 8  && d >= 23) || (mo === 9  && d <= 22)) return "Virgo";
  if ((mo === 9  && d >= 23) || (mo === 10 && d <= 22)) return "Libra";
  if ((mo === 10 && d >= 23) || (mo === 11 && d <= 21)) return "Scorpio";
  if ((mo === 11 && d >= 22) || (mo === 12 && d <= 21)) return "Sagittarius";
  return null;
}
