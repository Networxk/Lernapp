/* Lernkarten – App-Logik (ohne Frameworks) */
'use strict';

/* ---------- Leitner-System ---------- */
// Wartezeit in Tagen, bis eine Karte im jeweiligen Fach wieder fällig ist.
// Fach 1: sofort/jede Sitzung, Fach 5: alle 2 Wochen.
const BOX_INTERVAL_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
const DAY = 24 * 60 * 60 * 1000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Fälligkeit: auf Tagesbeginn gerundet, damit Karten morgens komplett bereitliegen. */
function dueDateForBox(box) {
  return startOfToday() + BOX_INTERVAL_DAYS[box] * DAY;
}

const isDue = card => card.due <= Date.now();

/* ---------- Hilfsfunktionen ---------- */
const $ = sel => document.querySelector(sel);

/** Kleiner DOM-Builder: h('div', {class:'x', onclick: fn}, 'Text', child) – Texte werden sicher eingefügt. */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function icon(path) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}
const ICONS = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  play: 'M7 5l12 7-12 7z',
  chevron: 'M9 5l7 7-7 7'
};

let toastTimer;
function toast(msg, ms = 2500) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

function boxCounts(cards) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  cards.forEach(c => { counts[c.box] = (counts[c.box] || 0) + 1; });
  return counts;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- Navigation ---------- */
// Einfacher Hash-Router: #/ , #/deck/<id> , #/learn/<id>[/all] , #/settings
const view = $('#view');
const titleEl = $('#title');
const backBtn = $('#backBtn');

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function setHeader(title, backHash) {
  titleEl.textContent = title;
  document.title = title === 'Lernkarten' ? 'Lernkarten' : `${title} – Lernkarten`;
  backBtn.hidden = !backHash;
  backBtn.onclick = backHash ? () => navigate(backHash) : null;
}

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  document.body.dataset.view = parts[0] || 'home';
  try {
    if (parts[0] === 'deck' && parts[1]) await renderDeck(decodeURIComponent(parts[1]));
    else if (parts[0] === 'learn' && parts[1]) await renderLearn(decodeURIComponent(parts[1]), parts[2] === 'all');
    else if (parts[0] === 'settings') await renderSettings();
    else await renderHome();
  } catch (err) {
    console.error(err);
    view.replaceChildren(h('p', { class: 'empty' }, 'Fehler: ' + err.message));
  }
  view.scrollTop = 0;
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
$('#menuBtn').addEventListener('click', () => navigate('#/settings'));

/* ---------- Startseite: Stapelübersicht ---------- */
async function renderHome() {
  setHeader('Lernkarten', null);
  const [decks, cards] = await Promise.all([DB.getDecks(), DB.getAllCards()]);
  decks.sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const byDeck = {};
  cards.forEach(c => (byDeck[c.deckId] ||= []).push(c));

  const totalDue = cards.filter(isDue).length;

  const list = decks.map(deck => {
    const dc = byDeck[deck.id] || [];
    const due = dc.filter(isDue).length;
    return h('li', {},
      h('button', { class: 'deck-item', onclick: () => navigate('#/deck/' + encodeURIComponent(deck.id)) },
        h('div', { class: 'deck-main' },
          h('span', { class: 'deck-name' }, deck.name),
          h('span', { class: 'deck-meta' }, plural(dc.length, 'Karte', 'Karten'))
        ),
        due > 0 ? h('span', { class: 'badge', title: 'fällig' }, due) : null,
        icon(ICONS.chevron)
      )
    );
  });

  view.replaceChildren(
    totalDue > 0
      ? h('p', { class: 'summary' }, `Heute fällig: ${plural(totalDue, 'Karte', 'Karten')}`)
      : decks.length ? h('p', { class: 'summary' }, 'Alles erledigt für heute 🎉') : null,
    decks.length
      ? h('ul', { class: 'list' }, list)
      : h('div', { class: 'empty' },
          h('p', {}, 'Noch keine Stapel vorhanden.'),
          h('p', { class: 'muted' }, 'Lege deinen ersten Stapel an und füge Karten hinzu.')),
    h('button', { class: 'fab', 'aria-label': 'Neuer Stapel', onclick: () => openDeckDialog() }, icon(ICONS.plus))
  );
}

/* ---------- Stapel-Dialog ---------- */
const deckDialog = $('#deckDialog');
let editingDeck = null;

function openDeckDialog(deck = null) {
  editingDeck = deck;
  $('#deckDialogTitle').textContent = deck ? 'Stapel umbenennen' : 'Neuer Stapel';
  $('#deckName').value = deck ? deck.name : '';
  deckDialog.showModal();
  setTimeout(() => $('#deckName').focus(), 50);
}

$('#deckForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#deckName').value.trim();
  if (!name) return;
  if (editingDeck) {
    await DB.putDeck({ ...editingDeck, name, updated: Date.now() });
    toast('Stapel umbenannt');
  } else {
    const deck = { id: DB.uid(), name, created: Date.now(), updated: Date.now() };
    await DB.putDeck(deck);
    deckDialog.close();
    navigate('#/deck/' + encodeURIComponent(deck.id));
    toast('Stapel angelegt');
    return;
  }
  deckDialog.close();
  route();
});

/* ---------- Stapel-Detail ---------- */
async function renderDeck(deckId) {
  const deck = await DB.getDeck(deckId);
  if (!deck) return navigate('#/');
  setHeader(deck.name, '#/');

  const cards = await DB.getCards(deckId);
  cards.sort((a, b) => (a.created || 0) - (b.created || 0));
  const due = cards.filter(isDue).length;
  const counts = boxCounts(cards);
  const max = Math.max(1, ...Object.values(counts));

  const boxes = h('div', { class: 'boxes', 'aria-label': 'Leitner-Fächer' },
    [1, 2, 3, 4, 5].map(b =>
      h('div', { class: 'box', title: `Fach ${b}: ${counts[b]} Karten` },
        h('div', { class: 'box-bar' }, h('div', { class: `box-fill b${b}`, style: `height:${(counts[b] / max) * 100}%` })),
        h('span', { class: 'box-count' }, counts[b]),
        h('span', { class: 'box-label' }, `Fach ${b}`)
      ))
  );

  const learnBtn = h('button', {
    class: 'btn primary big', disabled: cards.length === 0,
    onclick: () => navigate(`#/learn/${encodeURIComponent(deckId)}${due ? '' : '/all'}`)
  }, icon(ICONS.play), due ? `Lernen (${due} fällig)` : 'Alle Karten üben');

  const cardList = cards.map(card =>
    h('li', { class: 'card-item' },
      h('button', { class: 'card-text', onclick: () => openCardDialog(deckId, card), 'aria-label': 'Karte bearbeiten' },
        h('span', { class: 'front' }, card.front),
        h('span', { class: 'back' }, card.back)
      ),
      h('span', { class: `box-pill b${card.box}`, title: `Fach ${card.box}` }, card.box),
      h('button', { class: 'icon-btn danger', 'aria-label': 'Karte löschen', onclick: async () => {
        if (!confirm('Diese Karte löschen?')) return;
        await DB.deleteCard(card.id);
        toast('Karte gelöscht');
        route();
      } }, icon(ICONS.trash))
    )
  );

  view.replaceChildren(
    h('section', { class: 'panel' },
      boxes,
      h('p', { class: 'muted center' },
        `${plural(cards.length, 'Karte', 'Karten')} · ${due} fällig`),
      learnBtn,
      due === 0 && cards.length
        ? h('p', { class: 'muted center small' }, 'Keine Karte fällig – „Alle Karten üben“ verändert die Fächer trotzdem.')
        : null
    ),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => openDeckDialog(deck) }, icon(ICONS.edit), 'Umbenennen'),
      h('button', { class: 'btn ghost danger', onclick: async () => {
        if (!confirm(`Stapel „${deck.name}“ mit ${plural(cards.length, 'Karte', 'Karten')} wirklich löschen?`)) return;
        await DB.deleteDeck(deckId);
        toast('Stapel gelöscht');
        navigate('#/');
      } }, icon(ICONS.trash), 'Löschen')
    ),
    h('h2', { class: 'section-title' }, 'Karten'),
    cards.length
      ? h('ul', { class: 'list' }, cardList)
      : h('p', { class: 'empty' }, 'Noch keine Karten. Tippe auf +, um eine Karte hinzuzufügen.'),
    h('button', { class: 'fab', 'aria-label': 'Neue Karte', onclick: () => openCardDialog(deckId) }, icon(ICONS.plus))
  );
}

/* ---------- Karten-Dialog ---------- */
const cardDialog = $('#cardDialog');
let cardCtx = { deckId: null, card: null };

function openCardDialog(deckId, card = null) {
  cardCtx = { deckId, card };
  $('#cardDialogTitle').textContent = card ? 'Karte bearbeiten' : 'Neue Karte';
  $('#cardFront').value = card ? card.front : '';
  $('#cardBack').value = card ? card.back : '';
  $('#saveAndNext').hidden = !!card;
  if (!cardDialog.open) cardDialog.showModal();
  setTimeout(() => $('#cardFront').focus(), 50);
}

$('#cardForm').addEventListener('submit', async e => {
  e.preventDefault();
  const front = $('#cardFront').value.trim();
  const back = $('#cardBack').value.trim();
  if (!front || !back) return;
  const action = e.submitter && e.submitter.value;
  const now = Date.now();
  if (cardCtx.card) {
    await DB.putCard({ ...cardCtx.card, front, back, updated: now });
    toast('Karte gespeichert');
  } else {
    await DB.putCard({
      id: DB.uid(), deckId: cardCtx.deckId, front, back,
      box: 1, due: now, created: now, updated: now
    });
    toast('Karte hinzugefügt');
  }
  if (action === 'next') {
    openCardDialog(cardCtx.deckId);
  } else {
    cardDialog.close();
  }
  route();
});

// Abbrechen-Buttons und Tippen auf den Hintergrund schließen Dialoge
document.querySelectorAll('dialog').forEach(dlg => {
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
});

/* ---------- Lernmodus ---------- */
async function renderLearn(deckId, all) {
  const deck = await DB.getDeck(deckId);
  if (!deck) return navigate('#/');
  const back = '#/deck/' + encodeURIComponent(deckId);
  setHeader(deck.name, back);

  const cards = await DB.getCards(deckId);
  // Fällige Karten, niedrigste Fächer zuerst (innerhalb eines Fachs gemischt)
  let queue = shuffle(all ? cards : cards.filter(isDue)).sort((a, b) => a.box - b.box);
  const total = queue.length;
  const stats = { right: 0, wrong: 0 };
  const seen = new Set();

  if (!total) {
    view.replaceChildren(h('div', { class: 'empty' },
      h('p', {}, 'Keine Karten fällig.'),
      h('button', { class: 'btn primary', onclick: () => navigate(back) }, 'Zurück zum Stapel')));
    return;
  }

  const progressFill = h('div', { class: 'progress-fill' });
  const progressText = h('span', { class: 'progress-text' });
  const frontFace = h('div', { class: 'face front-face' });
  const backFace = h('div', { class: 'face back-face' });
  const boxInfo = h('span', { class: 'card-box' });
  const flashcard = h('button', { class: 'flashcard', 'aria-label': 'Karte umdrehen' },
    h('div', { class: 'flashcard-inner' }, frontFace, backFace), boxInfo);
  const hint = h('p', { class: 'muted center small hint' }, 'Tippe auf die Karte, um sie umzudrehen');

  const wrongBtn = h('button', { class: 'btn answer wrong', disabled: true }, '✗ Nicht gewusst');
  const rightBtn = h('button', { class: 'btn answer right', disabled: true }, '✓ Gewusst');
  const answers = h('div', { class: 'answers' }, wrongBtn, rightBtn);

  let current = null;
  let flipped = false;
  let busy = false;

  function updateProgress() {
    const done = seen.size;
    progressFill.style.width = `${(done / total) * 100}%`;
    progressText.textContent = `${done} / ${total}`;
  }

  function show() {
    current = queue.shift();
    flipped = false;
    flashcard.classList.remove('flipped');
    frontFace.textContent = current.front;
    backFace.textContent = current.back;
    boxInfo.textContent = `Fach ${current.box}`;
    wrongBtn.disabled = rightBtn.disabled = true;
    answers.classList.remove('visible');
    hint.classList.remove('invisible');
    updateProgress();
  }

  function flip() {
    if (!current) return;
    flipped = !flipped;
    flashcard.classList.toggle('flipped', flipped);
    if (flipped) {
      wrongBtn.disabled = rightBtn.disabled = false;
      answers.classList.add('visible');
      hint.classList.add('invisible');
    }
  }

  async function answer(known) {
    if (!current || !flipped || busy) return;
    busy = true;
    const card = current;
    const firstTry = !seen.has(card.id);
    seen.add(card.id);
    if (known) {
      const box = Math.min(5, card.box + 1);
      Object.assign(card, { box, due: dueDateForBox(box) });
      if (firstTry) stats.right++;
    } else {
      // Zurück in Fach 1 und in dieser Sitzung später nochmal abfragen
      Object.assign(card, { box: 1, due: Date.now() });
      if (firstTry) stats.wrong++;
      queue.push(card);
    }
    card.lastReviewed = Date.now();
    await DB.putCard(card);
    busy = false;
    if (queue.length) show();
    else finish();
  }

  function finish() {
    current = null;
    updateProgress();
    document.removeEventListener('keydown', onKey);
    view.replaceChildren(
      h('section', { class: 'panel done' },
        h('div', { class: 'done-emoji' }, stats.wrong === 0 ? '🏆' : '👍'),
        h('h2', {}, 'Sitzung beendet'),
        h('p', {}, `${stats.right} gewusst · ${stats.wrong} nicht gewusst`),
        h('p', { class: 'muted small' }, 'Nicht gewusste Karten wurden wiederholt, bis sie saßen, und liegen jetzt in Fach 1.'),
        h('button', { class: 'btn primary big', onclick: () => navigate(back) }, 'Zurück zum Stapel')
      )
    );
  }

  function onKey(e) {
    if (document.querySelector('dialog[open]')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (flipped && (e.key === 'ArrowRight' || e.key === 'j')) answer(true);
    else if (flipped && (e.key === 'ArrowLeft' || e.key === 'n')) answer(false);
  }

  flashcard.addEventListener('click', flip);
  rightBtn.addEventListener('click', () => answer(true));
  wrongBtn.addEventListener('click', () => answer(false));
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => document.removeEventListener('keydown', onKey), { once: true });

  view.replaceChildren(
    h('div', { class: 'learn' },
      h('div', { class: 'progress' }, h('div', { class: 'progress-bar' }, progressFill), progressText),
      flashcard, hint, answers)
  );
  show();
}

/* ---------- Einstellungen / Backup ---------- */
async function renderSettings() {
  setHeader('Einstellungen', '#/');
  const [decks, cards] = await Promise.all([DB.getDecks(), DB.getAllCards()]);

  let storageInfo = null;
  if (navigator.storage && navigator.storage.persisted) {
    const persisted = await navigator.storage.persisted().catch(() => false);
    storageInfo = h('p', { class: 'muted small' },
      persisted ? '✓ Speicher ist als dauerhaft markiert.' : 'Hinweis: Mache regelmäßig ein Backup – iOS kann Website-Daten bei Speichermangel löschen.');
  }

  view.replaceChildren(
    h('section', { class: 'panel' },
      h('h2', {}, 'Backup'),
      h('p', { class: 'muted' }, `${plural(decks.length, 'Stapel', 'Stapel')}, ${plural(cards.length, 'Karte', 'Karten')} gespeichert.`),
      h('button', { class: 'btn primary big', onclick: exportData }, 'Daten exportieren (JSON)'),
      h('button', { class: 'btn ghost big', onclick: () => $('#importFile').click() }, 'Backup importieren'),
      storageInfo
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Beispielstapel'),
      h('p', { class: 'muted small' }, 'Fertige Karten direkt in die App laden. Vorhandene Karten bleiben erhalten, mehrfaches Laden erzeugt keine Duplikate.'),
      SAMPLE_SETS.map(s => h('button', { class: 'btn ghost big', onclick: () => loadSample(s) }, s.label))
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Leitner-System'),
      h('p', { class: 'muted small' }, 'Neue Karten starten in Fach 1. „Gewusst“ schiebt eine Karte ein Fach weiter, „Nicht gewusst“ zurück in Fach 1.'),
      h('table', { class: 'intervals' },
        h('tr', {}, h('th', {}, 'Fach'), [1, 2, 3, 4, 5].map(b => h('td', {}, b))),
        h('tr', {}, h('th', {}, 'Wieder fällig'),
          [1, 2, 3, 4, 5].map(b => h('td', {}, BOX_INTERVAL_DAYS[b] === 0 ? 'sofort' : `${BOX_INTERVAL_DAYS[b]} T.`)))
      )
    ),
    h('section', { class: 'panel' },
      h('h2', {}, 'Gefahrenzone'),
      h('button', { class: 'btn ghost danger big', onclick: async () => {
        if (!confirm('Wirklich ALLE Stapel und Karten löschen? Das kann nicht rückgängig gemacht werden.')) return;
        await DB.importAll({ decks: [], cards: [] }, 'replace');
        toast('Alle Daten gelöscht');
        navigate('#/');
      } }, 'Alle Daten löschen')
    ),
    h('p', { class: 'muted center small' }, 'Lernkarten · funktioniert offline · Daten bleiben auf deinem Gerät')
  );
}

const SAMPLE_SETS = [
  { label: 'Musterung: 100 Übungsfragen laden', url: 'testdaten/musterung-100-fragen.json' }
];

async function loadSample(sample) {
  try {
    const res = await fetch(sample.url);
    if (!res.ok) throw new Error(`Datei nicht gefunden (${res.status})`);
    const data = validateImport(await res.json());
    await DB.importAll(data, 'merge');
    toast(`${plural(data.cards.length, 'Karte', 'Karten')} geladen`);
    navigate('#/');
  } catch (err) {
    console.error(err);
    alert('Laden fehlgeschlagen: ' + err.message);
  }
}

async function exportData() {
  const [decks, cards] = await Promise.all([DB.getDecks(), DB.getAllCards()]);
  const data = { app: 'lernkarten', version: 1, exported: new Date().toISOString(), decks, cards };
  const json = JSON.stringify(data, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `lernkarten-backup-${date}.json`;

  // iOS: Teilen-Menü („In Dateien sichern“) funktioniert auch in der installierten App zuverlässig
  try {
    const file = new File([json], filename, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Lernkarten-Backup' });
      toast('Backup exportiert');
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return; // Nutzer hat abgebrochen
    console.warn('Teilen fehlgeschlagen, nutze Download', err);
  }

  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Backup heruntergeladen');
}

function validateImport(data) {
  if (!data || !Array.isArray(data.decks) || !Array.isArray(data.cards)) {
    throw new Error('Keine gültige Lernkarten-Backup-Datei.');
  }
  const deckIds = new Set();
  const decks = data.decks.map(d => {
    if (!d || typeof d.id !== 'string' || typeof d.name !== 'string') throw new Error('Ungültiger Stapel in der Datei.');
    deckIds.add(d.id);
    return { id: d.id, name: d.name.slice(0, 200), created: Number(d.created) || Date.now(), updated: Number(d.updated) || Date.now() };
  });
  const cards = data.cards.map(c => {
    if (!c || typeof c.id !== 'string' || !deckIds.has(c.deckId)) throw new Error('Ungültige Karte in der Datei.');
    const box = Math.min(5, Math.max(1, parseInt(c.box, 10) || 1));
    return {
      id: c.id, deckId: c.deckId,
      front: String(c.front ?? ''), back: String(c.back ?? ''),
      box, due: Number(c.due) || Date.now(),
      created: Number(c.created) || Date.now(), updated: Number(c.updated) || Date.now(),
      ...(c.lastReviewed ? { lastReviewed: Number(c.lastReviewed) } : {})
    };
  });
  return { decks, cards };
}

$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = validateImport(JSON.parse(await file.text()));
    const msg = `${plural(data.decks.length, 'Stapel', 'Stapel')} und ${plural(data.cards.length, 'Karte', 'Karten')} gefunden.\n\n` +
      'OK = Vorhandene Daten ERSETZEN\nAbbrechen = Mit vorhandenen Daten zusammenführen';
    const replace = confirm(msg);
    if (replace && !confirm('Alle aktuellen Daten werden gelöscht und durch das Backup ersetzt. Fortfahren?')) return;
    await DB.importAll(data, replace ? 'replace' : 'merge');
    toast(replace ? 'Backup wiederhergestellt' : 'Backup zusammengeführt');
    navigate('#/');
  } catch (err) {
    console.error(err);
    alert('Import fehlgeschlagen: ' + (err instanceof SyntaxError ? 'Die Datei ist kein gültiges JSON.' : err.message));
  }
});

/* ---------- Service Worker & Start ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Update installiert – wird beim nächsten Start aktiv', 4000);
          }
        });
      });
    }).catch(err => console.warn('Service Worker nicht registriert:', err));
  });
}

// Dauerhaften Speicher anfragen (verringert das Risiko, dass der Browser Daten löscht)
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

route();
