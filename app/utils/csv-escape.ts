// Kept free of imports so test/csv-escape.test.mjs can run it under `node --test`.

// Excel and Sheets evaluate a cell led by = @ + - (even after a tab or CR),
// however well the CSV is quoted, so one crafted order could run on open.
const FORMULA_LEAD = /^[\t\r]*[=@]/
const SIGN_LEAD = /^[\t\r]*[+-]/
// A signed number, or a phone like +852 1234 5678, is what a buyer meant and
// what a courier importer expects; a leading quote there does more harm than good.
const SIGNED_NUMBER = /^[\t\r]*[+-][\d\s().-]*$/

export function neutralizeSpreadsheetFormula<T>(value: T): T | string {
  if (typeof value !== 'string') { return value }
  if (FORMULA_LEAD.test(value) || (SIGN_LEAD.test(value) && !SIGNED_NUMBER.test(value))) {
    return `'${value}`
  }
  return value
}
