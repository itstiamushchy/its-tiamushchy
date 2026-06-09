// ═══════════════════════════════════════════════════════════════
// ТЯМУЩИЙ — Google Apps Script v5.1 (акаунт ITS_tiamushchy)
// © 2026 ITS_Tiamushchy
// Автори: Хоменко Олексій, Устименко Іван, Наливайко Олена
// PDF = присланий сайтом protocolHtml → той самий HTML, що в email і
// в друкованій формі (єдине джерело). Apps Script лише конвертує у PDF.
// ═══════════════════════════════════════════════════════════════

// Акаунт ITS_tiamushchy. Таблиця BD_ITS + теки 5k–12k.
const SHEET_ID = '1cmHDrKic5aekdXovQqQsSBebNiEk9I9BlUK6Ez8E010';

const FOLDER_IDS = {
  '5':  '1rNvTY0Uq85zvZzxNY1PObMbZQzfNrT3u',
  '6':  '17ut-dNZ6REy_WFmI92z62etFsehXJ47X',
  '7':  '10_36KzNY7lm4uZXliP7Tq-Bh672NiYur',
  '8':  '16tUN9bZb0rTka8Hyw33CrAFytrYeSdJ6',
  '9':  '15Xf9MlI6_Chd24Jxz0GRk6w9Odk9zMSA',
  '10': '1Gp8rxjdhGYGrRUMYxUeCYAdpM72XfAQ5',
  '11': '1OHxg58EC5k-bvee2Wuh-B0lqcQSC-E_F',
  '12': '1d9i2r5PrueErZOavNS-xlOSTh1z2NbJ-',
};

// ── Головна функція ───────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    saveToSheet(data);
    saveToDoc(data);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Рекомендований бал (для таблиці) ──────────────────────────────
function recommendedScaled(data) {
  if (data.recommendedScore !== undefined && data.recommendedScore !== null) {
    return data.recommendedScore;
  }
  const recScore = (data.results || []).reduce((sum, r) => {
    if (r.skipped) return sum;
    return sum + (r.points || 0) * (r.suspicious ? 0.25 : 1);
  }, 0);
  return Math.min(11, Math.max(0, Math.round(recScore)));
}

// ── Текст «Зафіксовано підозрілі дії» (стовпець 13) ───────────────
function suspiciousActionsText(data) {
  const parts = [];
  const leaves = data.windowLeaveCount || 0;
  const awayMs = data.windowAwayMs || 0;
  if (leaves > 0) {
    const sec = Math.round(awayMs / 1000);
    parts.push('вихід з вікна ×' + leaves + (sec ? (' (≈' + sec + ' с)') : ''));
  }
  const kl = data.keyLog || {};
  const keys = Object.keys(kl).filter(function(k){ return kl[k] > 0; });
  if (keys.length) {
    parts.push('клавіші: ' + keys.map(function(k){ return k + (kl[k] > 1 ? ('×' + kl[k]) : ''); }).join(', '));
  }
  return parts.length ? parts.join('; ') : '—';
}

// ── % за групою результатів (стовпці ГР1–ГР4) ────────────────────
// Заповнюється, коли сайт надсилає об'єкт data.gr = {ГР1:%, ГР2:%, ...}
// (реалізація у v5.3 після педагогічної експертизи). Доти — порожньо.
function grPct(data, code) {
  if (data.gr && data.gr[code] !== undefined && data.gr[code] !== null && data.gr[code] !== '') {
    return data.gr[code];
  }
  return '';
}

// ── Похідні значення для нових стовпців ──────────────────────────
function schoolYear(now){ var y=now.getFullYear(), m=now.getMonth()+1; return (m>=9)?(y+'/'+(y+1)):((y-1)+'/'+y); }
function overallLevel(pct){ var p=parseFloat(pct); if(isNaN(p))return ''; if(p>=83)return 'Високий'; if(p>=67)return 'Достатній'; if(p>=34)return 'Середній'; return 'Початковий'; }
function modeText(data){ return (data.gr && Object.keys(data.gr).length) ? 'ГР' : 'Загальна'; }
function durationFmt(data){
  var sec;
  if(data.durationSec!=null) sec=data.durationSec;
  else { var rs=data.results||[]; sec=rs.reduce(function(s,r){return s+(r.answerTime||0);},0); }
  if(!sec) return '';
  var m=Math.floor(sec/60), ss=sec%60;
  return m + ':' + (ss<10?('0'+ss):ss);
}
function testCode(data){ return data.code || data.testCode || ''; }

// ── Запис у Google Sheets ─────────────────────────────────────────
function saveToSheet(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  const now   = new Date();
  const date  = Utilities.formatDate(now, 'Europe/Kiev', 'dd.MM.yyyy');
  const time  = Utilities.formatDate(now, 'Europe/Kiev', 'HH:mm');

  sheet.appendRow([
    date, time,
    schoolYear(now),
    data.name, data.cls,
    data.subject, data.topic,
    testCode(data),
    modeText(data),
    data.score, data.percent + '%',
    overallLevel(data.percent),
    data.correct, data.wrong,
    durationFmt(data),
    data.suspiciousCount,
    recommendedScaled(data),
    suspiciousActionsText(data),
    grPct(data, 'ГР1'), grPct(data, 'ГР2'), grPct(data, 'ГР3'), grPct(data, 'ГР4')
  ]);
}

// ── Створення PDF ─────────────────────────────────────────────────
// Беремо готовий protocolHtml із сайту (та сама верстка, що email і
// друкована форма) і конвертуємо у PDF. Нічого не перебудовуємо —
// тому PDF на 100% збігається з email і друкованою формою.
function saveToDoc(data) {
  const cls = String(data.cls).replace(/[^0-9]/g, '');
  const folderId = FOLDER_IDS[cls];
  if (!folderId) return;

  const html = data.protocolHtml;
  if (!html) return; // сайт не надіслав HTML — нічого зберігати

  const folder = DriveApp.getFolderById(folderId);
  const date   = Utilities.formatDate(new Date(), 'Europe/Kiev', 'dd.MM.yyyy');

  const htmlBlob = Utilities.newBlob(html, 'text/html', 'temp.html');
  const tempFile = DriveApp.createFile(htmlBlob);
  const pdfBlob  = tempFile.getAs('application/pdf');
  const fileName = data.name + ' · ' + String(data.subject).substring(0, 25) + ' · ' + date + '.pdf';
  pdfBlob.setName(fileName);
  folder.createFile(pdfBlob);
  tempFile.setTrashed(true);
}
