// Integer minor units everywhere. QAR has 2 decimals (dirham).
function toMinor(major) {
  return Math.round(Number(major) * 100);
}
function toMajor(minor) {
  return (minor / 100).toFixed(2);
}
function format(minor, currency = 'QAR', locale = 'en-QA') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
}
module.exports = { toMinor, toMajor, format };
