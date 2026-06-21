// src/utils/dateUtils.js

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const getTodayDate = () => new Date().toISOString().split("T")[0];

export const getMonthShort = (monthName = "") => monthName.slice(0, 3);

export const getMonthKeyFromDate = (dateStr) => {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};
