import { books, films } from "./daily-culture-catalog";

const firstFilmDay = Date.UTC(2026, 10, 10);
const dayMs = 86_400_000;

export function cultureForDate(date: string) {
  const elapsedDays = (Date.parse(`${date}T00:00:00Z`) - firstFilmDay) / dayMs;
  const isFilm = elapsedDays % 2 === 0;
  const pool = isFilm ? films : books;
  const turn = Math.floor(elapsedDays / 2);
  const entry = pool[((turn % pool.length) + pool.length) % pool.length];

  return { ...entry, isFilm };
}
