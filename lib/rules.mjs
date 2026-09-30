export const PEOPLE = ['Richard', 'Anastasia', 'Jean-Claude'];
export const PROJECTS = { A: 'Respectable Relatives', B: 'Drunk University Friends' };
export const ALLOCATIONS = ['A', 'B', 'Company overhead'];
export const CATEGORIES = ['Materials', 'Travel', 'Other'];
export const money = cents => `€${(cents / 100).toFixed(2)}`;

export function parseCents(value) {
  const raw = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) throw Error('Amount must be a positive euro amount with at most two decimals.');
  const [euros, decimals = ''] = raw.split('.');
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw Error('Amount must be greater than zero.');
  return cents;
}

export function validateSplit(split) {
  if (!Array.isArray(split) || split.length !== 3 || split.some(x => !Number.isInteger(Number(x)) || Number(x) < 0 || Number(x) > 100) || split.reduce((a, b) => a + Number(b), 0) !== 100) {
    throw Error('Richard, Anastasia and Jean-Claude percentages must each be 0–100 and total exactly 100%.');
  }
  return split.map(Number);
}

export function commission(amountCents, split) {
  split = validateSplit(split);
  const pool = Math.round(amountCents / 10);
  const amounts = split.map(p => Math.round(pool * p / 100));
  let difference = pool - amounts.reduce((a, b) => a + b, 0);
  const largest = split.indexOf(Math.max(...split));
  amounts[largest] += difference;
  return { pool, amounts };
}

export function validateReference(ref, type) {
  if (!new RegExp(`^${type === 'sale' ? 'S' : 'E'}[A-Za-z0-9_-]{2,39}$`).test(String(ref ?? '').trim())) throw Error('Reference must start with S or E and contain 3–40 letters, digits, hyphens or underscores.');
  return ref.trim();
}

export function summarize(sales, expenses) {
  const projects = { A: { income: 0, commission: 0, expenses: 0 }, B: { income: 0, commission: 0, expenses: 0 } };
  const earned = [0, 0, 0];
  let overhead = 0, awaiting = 0, totalExpenses = 0, pendingSales = 0;
  for (const sale of sales) {
    if (sale.status !== 'Approved') { pendingSales += sale.amount_cents; continue; }
    const { pool, amounts } = commission(sale.amount_cents, sale.final_split);
    projects[sale.project].income += sale.amount_cents;
    projects[sale.project].commission += pool;
    amounts.forEach((n, i) => earned[i] += n);
  }
  for (const expense of expenses) {
    totalExpenses += expense.amount_cents;
    if (expense.status === 'Awaiting allocation') awaiting += expense.amount_cents;
    else if (expense.final_allocation === 'Company overhead') overhead += expense.amount_cents;
    else projects[expense.final_allocation].expenses += expense.amount_cents;
  }
  for (const project of Object.values(projects)) project.result = project.income - project.commission - project.expenses;
  const approvedIncome = projects.A.income + projects.B.income;
  const totalCommission = projects.A.commission + projects.B.commission;
  return { projects, earned, overhead, awaiting, pendingSales, totalExpenses, approvedIncome, totalCommission, companyResult: approvedIncome - totalCommission - totalExpenses };
}
