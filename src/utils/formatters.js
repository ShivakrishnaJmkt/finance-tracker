// src/utils/formatters.js

export const formatINR = (value = 0) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

export const formatNumber = (value = 0) =>
  Number(value || 0).toLocaleString("en-IN");

export const safeNumber = (value = 0) =>
  Number(value || 0);
