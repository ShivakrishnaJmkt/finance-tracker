// src/utils/financeUtils.js

export const sumValues = (values = []) =>
  values.reduce((sum, item) => sum + Number(item || 0), 0);

export const getMonthTotal = (monthData = {}, segments = []) =>
  segments.reduce((sum, seg) => sum + Number(monthData[seg] || 0), 0);

export const calculateNetWorth = ({
  cash = 0,
  savings = 0,
  investments = 0,
  licValue = 0,
  totalDebt = 0,
}) => {
  const assets =
    Number(cash || 0) +
    Number(savings || 0) +
    Number(investments || 0) +
    Number(licValue || 0);

  const liabilities = Number(totalDebt || 0);

  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
  };
};

export const estimateDebtFreeMonths = (totalDebt = 0, monthlyPayment = 0) => {
  if (!monthlyPayment || Number(monthlyPayment) <= 0) return null;
  return Math.ceil(Number(totalDebt || 0) / Number(monthlyPayment));
};


// వడ్డీ రేటు ఉన్నప్పుడు ఎన్ని నెలలు పడుతుందో లెక్కించే ఫంక్షన్
export const calculateMonthsToPayOff = (balance, monthlyPayment, annualInterestRate) => {
  if (annualInterestRate === 0) return balance / monthlyPayment;
  
  const monthlyRate = annualInterestRate / 100 / 12;
  // ఫార్ములా: N = -log(1 - (Ai / P)) / log(1 + i)
  // A = balance, i = monthlyRate, P = monthlyPayment
  const numerator = -Math.log(1 - (balance * monthlyRate) / monthlyPayment);
  const denominator = Math.log(1 + monthlyRate);
  
  return Math.ceil(numerator / denominator);
};