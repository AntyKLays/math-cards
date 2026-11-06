const fs = require('fs');
const path = process.argv[2] || 'mathAnal.json';

function fail(message) {
  errors.push(message);
}

function isId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function isDatabaseId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value >= 1;
}

let database;
try {
  database = JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
} catch (error) {
  console.error(`Невозможно прочитать JSON: ${error.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];
const ids = new Set();
const seen = new Map();

function uniqueId(id, location, check = isId, message = 'id должен состоять из строчных латинских букв, цифр и дефисов.') {
  if (!check(id)) {
    fail(`${location}: ${message}`);
    return;
  }
  if (ids.has(id)) fail(`${location}: повторяющийся id "${id}"; первый раз он встречается в ${seen.get(id)}.`);
  else {
    ids.add(id);
    seen.set(id, location);
  }
}

if (!database || typeof database !== 'object' || Array.isArray(database)) fail('Корень файла должен быть объектом.');
else {
  if (database.schema_version !== '1.0') fail('schema_version должен быть равен "1.0".');
  uniqueId(database.id, 'База', isDatabaseId, 'id базы должен состоять из латинских букв, цифр и дефисов.');
  if (typeof database.title !== 'string' || !database.title.trim()) fail('База: заполните title.');
  if (!Array.isArray(database.sections) || !database.sections.length) fail('База: sections должен быть непустым массивом.');
  else database.sections.forEach((section, sectionIndex) => {
    const sectionLocation = `Раздел ${sectionIndex + 1}`;
    if (!section || typeof section !== 'object') return fail(`${sectionLocation}: раздел должен быть объектом.`);
    uniqueId(section.id, sectionLocation);
    if (typeof section.title !== 'string' || !section.title.trim()) fail(`${sectionLocation}: заполните title.`);
    if (!isPositiveInteger(section.sort_order)) fail(`${sectionLocation}: sort_order — положительное целое число.`);
    if (!Array.isArray(section.cards)) return fail(`${sectionLocation}: cards должен быть массивом.`);
    const sectionOrders = new Set();
    section.cards.forEach((card, cardIndex) => {
      const cardLocation = `${sectionLocation}, карточка ${cardIndex + 1}`;
      if (!card || typeof card !== 'object') return fail(`${cardLocation}: карточка должна быть объектом.`);
      uniqueId(card.id, cardLocation);
      if (typeof card.title !== 'string' || !card.title.trim()) fail(`${cardLocation}: заполните title.`);
      if (!['def', 'thm', 'ax', 'other'].includes(card.type)) fail(`${cardLocation}: type может быть только def, thm, ax или other.`);
      if (typeof card.content !== 'string' || !card.content.trim()) fail(`${cardLocation}: заполните content.`);
      if (!isPositiveInteger(card.sort_order)) fail(`${cardLocation}: sort_order — положительное целое число.`);
      else if (sectionOrders.has(card.sort_order)) warnings.push(`${cardLocation}: sort_order ${card.sort_order} повторяется в разделе.`);
      else sectionOrders.add(card.sort_order);
      if (!Array.isArray(card.images)) fail(`${cardLocation}: images должен быть массивом.`);
      else card.images.forEach((image, imageIndex) => {
        const imageLocation = `${cardLocation}, изображение ${imageIndex + 1}`;
        if (!image || typeof image !== 'object' || typeof image.url !== 'string' || !image.url.trim()) fail(`${imageLocation}: укажите url.`);
        else if (/^https?:\/\//i.test(image.url) && !/^https:\/\//i.test(image.url)) warnings.push(`${imageLocation}: рекомендуется HTTPS URL.`);
        if (image && image.url && !image.alt) warnings.push(`${imageLocation}: добавьте alt-описание.`);
      });
    });
  });
}

if (warnings.length) {
  console.warn('Предупреждения:');
  warnings.forEach(item => console.warn(`- ${item}`));
}
if (errors.length) {
  console.error('Ошибки базы:');
  errors.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
const cards = database.sections.reduce((total, section) => total + section.cards.length, 0);
console.log(`База корректна: ${database.sections.length} разделов, ${cards} карточек, ${ids.size} уникальных ID.`);
