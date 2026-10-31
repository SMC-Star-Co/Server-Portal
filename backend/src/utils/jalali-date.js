const { APP_TIME_ZONE } = require('../config/env');

function pad2(num) {
  return String(num).padStart(2, '0');
}

function gregorianToJalali(gy, gm, gd) {
  const gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy
    + Math.floor((gy2 + 3) / 4)
    - Math.floor((gy2 + 99) / 100)
    + Math.floor((gy2 + 399) / 400)
    - 80
    + gd
    + gDaysInMonth[gm - 1];

  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);

  return [jy, jm, jd];
}

function getAppTimeParts(dateValue = new Date()) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const parts = {};
  const formatter = new Intl.DateTimeFormat('en-US-u-nu-latn', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  formatter.formatToParts(date).forEach(part => {
    if (part.type !== 'literal') parts[part.type] = part.value;
  });

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hours: Number(parts.hour),
    minutes: Number(parts.minute),
    seconds: Number(parts.second)
  };
}

function toJalaliDateTime(dateValue = new Date()) {
  const parts = getAppTimeParts(dateValue);
  const [jy, jm, jd] = gregorianToJalali(parts.year, parts.month, parts.day);
  return `${jy}/${pad2(jm)}/${pad2(jd)} - ${pad2(parts.hours)}:${pad2(parts.minutes)}`;
}

function toJalaliDateTimeWithSeconds(dateValue = new Date()) {
  const parts = getAppTimeParts(dateValue);
  const [jy, jm, jd] = gregorianToJalali(parts.year, parts.month, parts.day);
  return `${jy}/${pad2(jm)}/${pad2(jd)} - ${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
}

function getJalaliDatePart(jalaliDateTime) {
  return (jalaliDateTime || '').split(' - ')[0].trim();
}

module.exports = {
  pad2,
  gregorianToJalali,
  getAppTimeParts,
  toJalaliDateTime,
  toJalaliDateTimeWithSeconds,
  getJalaliDatePart
};
