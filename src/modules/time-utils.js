/**
 * KST 시간 유틸리티
 * utils/time_utils.py 이식
 */

function getKstNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function formatKstDateTime(date) {
  const d = date || getKstNow();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

function formatKstDate(date) {
  return formatKstDateTime(date).slice(0, 10);
}

function getGreeting() {
  const hour = getKstNow().getHours();
  if (hour >= 5 && hour < 12) return '좋은 아침입니다';
  if (hour >= 12 && hour < 18) return '좋은 오후입니다';
  if (hour >= 18 && hour < 22) return '좋은 저녁입니다';
  return '안녕하세요';
}

const DAY_NAMES_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function formatKstDateFull(date) {
  const d = date || getKstNow();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dayName = DAY_NAMES_KR[d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${dayName})`;
}

function formatKstTime(date) {
  const d = date || getKstNow();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

module.exports = { getKstNow, formatKstDateTime, formatKstDate, getGreeting, formatKstDateFull, formatKstTime, DAY_NAMES_KR };
