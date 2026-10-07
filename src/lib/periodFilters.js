import { currentFinancialYear, financialYearFromDate, localToday, normalizeFinancialYear } from './financialYear.js';

// Every listing starts in the user's current local calendar month and April–March FY.
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const FY_MONTHS = [...MONTHS.slice(3), ...MONTHS.slice(0, 3)];
export const defaultPeriod = () => ({ financialYear: currentFinancialYear(), month: MONTHS[new Date().getMonth()] });
export const currentMonthName = () => MONTHS[new Date().getMonth()];

export function monthBounds(financialYear, month) {
  const fy = normalizeFinancialYear(financialYear) || currentFinancialYear();
  const index = typeof month === 'number' ? month : MONTHS.indexOf(month);
  if (index < 0 || index > 11) return { startDate: `${fy.slice(0, 4)}-04-01`, endDate: `${Number(fy.slice(0, 4)) + 1}-03-31` };
  const year = Number(fy.slice(0, 4)) + (index < 3 ? 1 : 0);
  const pad = (number) => String(number).padStart(2, '0');
  return {
    startDate: `${year}-${pad(index + 1)}-01`,
    endDate: `${year}-${pad(index + 1)}-${pad(new Date(year, index + 1, 0).getDate())}`,
  };
}

export function inPeriod(date, financialYear, month) {
  if (!date) return false;
  const raw = typeof date === 'string' ? date.slice(0, 10) : '';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : (() => {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? '' : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  })();
  if (!day || financialYearFromDate(day) !== financialYear) return false;
  const { startDate, endDate } = monthBounds(financialYear, month);
  return day >= startDate && day <= endDate;
}

export const currentDate = localToday;
