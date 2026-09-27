const API = "https://bible-api.com/";
const STORAGE = {
  favorites: "bible_favorites",
  history: "bible_history",
  notes: "bible_notes",
  prayers: "bible_prayers",
  feedback: "bible_feedback_demo",
  settings: "bible_settings"
};

const OLD = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi"];
const NEW = ["Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];
const TOPICS = ["Love","Faith","Hope","Anxiety","Forgiveness","Strength","Prayer","Wisdom","Family","Peace","Courage"];
const DAILY = ["John 3:16","Psalm 23:1","Romans 8:28","Philippians 4:13","Jeremiah 29:11","Proverbs 3:5","Isaiah 41:10","Matthew 11:28","Psalm 46:1","John 14:27"];

const $ = id => document.getElementById(id);
const get = (key, fallback=[]) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
};
const set = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => el.style.display = "none", 1900);
}

function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = $("page-" + name);
  if (!target) return;
  target.classList.add("active");
  if (name === "favorites") renderFavorites();
  if (name === "prayers") renderPrayers();
  if (name === "browse") renderBooks("old");
  if (name === "admin") renderAdmin();
  window.scrollTo({top:0, behavior:"smooth"});
}

async function api(path) {
  const response = await fetch(API + encodeURIComponent(path), {headers:{Accept:"application/json"}});
  if (!response.ok) throw new Error("Bible API request failed");
  return response.json();
}

function normalizeVerse(v) {
  return {
    reference: v.reference || `${v.book_name || ""} ${v.chapter || ""}:${v.verse || ""}`.trim(),
    text: (v.text || "").trim()
  };
}

function verseCard(verse) {
  const v = normalizeVerse(verse);
  const encoded = encodeURIComponent(JSON.stringify(v));
  const isFav = get(STORAGE.favorites).some(x => x.reference === v.reference);
  return `
    <article class="card verse-card">
      <div class="verse-text">“${escapeHTML(v.text)}”</div>
      <div class="verse-ref">${escapeHTML(v.reference)}</div>
      <div class="translation">King James Version (KJV)</div>
      <div class="actions">
        <button data-action="favorite" data-verse="${encoded}">${isFav ? "💔 Remove favorite" : "❤️ Favorite"}</button>
        <button data-action="copy" data-verse="${encoded}">📋 Copy</button>
        <button data-action="note" data-reference="${encodeURIComponent(v.reference)}">📝 Note</button>
        <button data-action="feedback" data-reference="${encodeURIComponent(v.reference)}">💬 Feedback</button>
        <button data-action="share" data-verse="${encoded}">↗️ Share</button>
      </div>
    </article>`;
}

async function search(query) {
  query = String(query || "").trim();
  if (!query) return toast("Type a verse, book, chapter, or keyword first.");
  $("search-results").innerHTML = `<div class="card"><p>Searching for <b>${escapeHTML(query)}</b>…</p></div>`;
  try {
    const data = await api(query);
    const verses = data.verses || [data];
    const normalized = verses.filter(v => v.text).map(normalizeVerse);
    if (!normalized.length) throw new Error("No results");
    $("search-results").innerHTML = normalized.map(verseCard).join("");
    addHistory(normalized[0]);
  } catch {
    $("search-results").innerHTML = `<div class="card"><b>No result found.</b><p class="muted">Try a reference such as John 3:16 or Psalm 23:1.</p></div>`;
  }
}

function addHistory(v) {
  let history = get(STORAGE.history);
  history = [{...v, at:Date.now()}, ...history.filter(x => x.reference !== v.reference)].slice(0,15);
  set(STORAGE.history, history);
  renderRecent();
}

function renderRecent() {
  const history = get(STORAGE.history);
  $("recent-list").innerHTML = history.length ? history.slice(0,5).map(v =>
    `<div class="list-item"><b>${escapeHTML(v.reference)}</b><div class="actions"><button data-action="open-reference" data-reference="${encodeURIComponent(v.reference)}">Open</button></div></div>`
  ).join("") : `<p class="muted">No recent verses yet.</p>`;
}

function toggleFavorite(v) {
  let favorites = get(STORAGE.favorites);
  if (favorites.some(x => x.reference === v.reference)) {
    favorites = favorites.filter(x => x.reference !== v.reference);
    toast("Removed from favorites");
  } else {
    favorites.unshift(v);
    toast("Added to favorites");
  }
  set(STORAGE.favorites, favorites);
  renderFavorites();
  if ($("search-results").innerHTML) search($("search-input").value || v.reference);
}

function renderFavorites() {
  const favorites = get(STORAGE.favorites);
  $("favorites-list").innerHTML = favorites.length
    ? favorites.map(verseCard).join("")
    : `<div class="card"><p class="muted">No favorite verses yet. Search for a verse and tap ❤️ Favorite.</p></div>`;
}

function saveNote(reference) {
  const notes = get(STORAGE.notes, {});
  const current = notes[reference] || "";
  const value = prompt(`Private note for ${reference}:`, current);
  if (value === null) return;
  if (value.trim()) notes[reference] = value.trim();
  else delete notes[reference];
  set(STORAGE.notes, notes);
  toast("Note saved privately");
}

async function copyVerse(v) {
  const text = `${v.text}\n— ${v.reference} (KJV)`;
  try { await navigator.clipboard.writeText(text); toast("Verse copied"); }
  catch { toast("Copy is not available in this browser"); }
}

async function shareVerse(v) {
  const text = `${v.text}\n— ${v.reference} (KJV)`;
  if (navigator.share) {
    try { await navigator.share({title:v.reference, text}); } catch {}
  } else {
    await copyVerse(v);
    toast("Verse copied — ready to share");
  }
}

function renderTopics() {
  $("topics").innerHTML = TOPICS.map(t =>
    `<button class="chip" data-action="topic" data-topic="${encodeURIComponent(t)}">${t}</button>`
  ).join("");
}

function dailyVerse() {
  const index = Math.floor(Date.now() / 86400000) % DAILY.length;
  api(DAILY[index]).then(v => $("daily-verse").innerHTML = verseCard(v))
    .catch(() => $("daily-verse").innerHTML = `<p class="muted">Daily verse could not load.</p>`);
}

function randomVerse() {
  search(DAILY[Math.floor(Math.random() * DAILY.length)]);
}

function renderBooks(testament="old") {
  const list = testament === "old" ? OLD : NEW;
  $("books-grid").innerHTML = list.map(book =>
    `<button class="book-button" data-action="book" data-book="${encodeURIComponent(book)}">
      <strong>${book}</strong><small>${testament === "old" ? "Old Testament" : "New Testament"}</small>
    </button>`
  ).join("");
}

async function openBook(book) {
  $("chapter-reader").classList.remove("hidden");
  $("chapter-reader").innerHTML = `<div class="card"><p>Loading ${escapeHTML(book)}…</p></div>`;
  try {
    const data = await api(`${book} 1`);
    const verses = data.verses || [data];
    const first = verses[0];
    const chapter = first.chapter || 1;
    $("chapter-reader").innerHTML = `
      <div class="card">
        <div class="chapter-head">
          <div><p class="eyebrow">CHAPTER READING</p><h2>${escapeHTML(book)} ${chapter}</h2></div>
          <button data-action="close-reader">Close</button>
        </div>
        <p class="muted small">The API lookup above provides chapter 1. Use the search box on Home for a specific chapter.</p>
        ${verses.map(v => `<div class="chapter-verse"><b>${v.verse}</b> ${escapeHTML(v.text.trim())}</div>`).join("")}
      </div>`;
    addHistory(normalizeVerse(first));
  } catch {
    $("chapter-reader").innerHTML = `<div class="card"><p>Could not load this chapter.</p></div>`;
  }
}

function openFeedback(reference="") {
  showPage("feedback");
  $("feedback-verse").value = reference;
}

function submitFeedback(event) {
  event.preventDefault();
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    category: $("feedback-category").value,
    verse: $("feedback-verse").value.trim(),
    message: $("feedback-message").value.trim(),
    date: new Date().toISOString(),
    status: "New"
  };
  if (!item.message) return toast("Please enter your feedback.");
  const feedback = get(STORAGE.feedback);
  feedback.unshift(item);
  set(STORAGE.feedback, feedback);
  $("feedback-form").reset();
  toast("Feedback saved in this browser");
  showPage("home");
}

function openProblem() {
  showPage("problem");
}

function submitProblem(event) {
  event.preventDefault();
  const feedback = get(STORAGE.feedback);
  feedback.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    category: $("problem-type").value,
    verse: $("problem-verse").value.trim(),
    message: $("problem-message").value.trim(),
    date: new Date().toISOString(),
    status: "New"
  });
  set(STORAGE.feedback, feedback);
  $("problem-form").reset();
  toast("Problem report saved in this browser");
  showPage("home");
}

function adminLogin() {
  const code = prompt("Enter administrator access code:");
  if (code !== "4817") return toast("Access denied");
  showPage("admin");
}

function renderAdmin(sort="newest") {
  const feedback = get(STORAGE.feedback);
  const sorted = [...feedback].sort((a,b) => {
    if (sort === "oldest") return a.date.localeCompare(b.date);
    if (sort === "category") return a.category.localeCompare(b.category);
    return b.date.localeCompare(a.date);
  });
  $("admin-content").innerHTML = `
    <div class="card">
      <div class="page-title"><div><h2>${feedback.length} feedback item${feedback.length===1?"":"s"}</h2><p class="muted small">Local demo data only.</p></div></div>
      <div class="actions">
        <button data-action="admin-sort" data-sort="newest">Newest</button>
        <button data-action="admin-sort" data-sort="oldest">Oldest</button>
        <button data-action="admin-sort" data-sort="category">Category</button>
      </div>
    </div>
    <div class="list top-gap">
      ${sorted.length ? sorted.map(item => `
        <div class="list-item">
          <div class="page-title">
            <span><b>${escapeHTML(item.category)}</b>${item.verse ? ` · ${escapeHTML(item.verse)}` : ""}</span>
            <span class="muted small">${new Date(item.date).toLocaleString()}</span>
          </div>
          <p>${escapeHTML(item.message)}</p>
          <span class="chip small">${escapeHTML(item.status)}</span>
          <div class="actions">
            <button data-action="feedback-status" data-id="${item.id}" data-status="Reviewed">Mark reviewed</button>
            <button data-action="feedback-status" data-id="${item.id}" data-status="Resolved">Resolve</button>
            <button class="danger-outline" data-action="delete-feedback" data-id="${item.id}">Delete</button>
          </div>
        </div>`).join("") : `<div class="card"><p class="muted">No feedback has been submitted in this browser.</p></div>`}
    </div>`;
}

function setFeedbackStatus(id,status) {
  const feedback = get(STORAGE.feedback);
  const item = feedback.find(x => x.id === id);
  if (item) item.status = status;
  set(STORAGE.feedback, feedback);
  renderAdmin();
}

function deleteFeedback(id) {
  if (!confirm("Delete this feedback?")) return;
  set(STORAGE.feedback, get(STORAGE.feedback).filter(x => x.id !== id));
  renderAdmin();
}

function savePrayer() {
  const text = $("prayer-text").value.trim();
  if (!text) return toast("Write a prayer first.");
  const prayers = get(STORAGE.prayers);
  prayers.unshift({id:Date.now(), text, date:new Date().toISOString()});
  set(STORAGE.prayers, prayers);
  $("prayer-text").value = "";
  renderPrayers();
  toast("Prayer saved privately");
}

function renderPrayers() {
  const prayers = get(STORAGE.prayers);
  $("prayer-list").innerHTML = prayers.length ? prayers.map(p =>
    `<div class="list-item"><span class="muted small">${new Date(p.date).toLocaleString()}</span><p>${escapeHTML(p.text)}</p><button class="danger-outline" data-action="delete-prayer" data-id="${p.id}">Delete</button></div>`
  ).join("") : `<div class="card"><p class="muted">No saved prayers yet.</p></div>`;
}

function loadSettings() {
  const settings = get(STORAGE.settings, {theme:"auto", fontSize:20});
  $("theme-select").value = settings.theme || "auto";
  $("font-size").value = settings.fontSize || 20;
  applyTheme(settings.theme || "auto");
  document.documentElement.style.setProperty("--reading-size", `${settings.fontSize || 20}px`);
}

function applyTheme(theme) {
  const dark = theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark", dark);
}

function saveSettings() {
  const settings = {theme:$("theme-select").value, fontSize:Number($("font-size").value)};
  set(STORAGE.settings, settings);
  applyTheme(settings.theme);
  document.documentElement.style.setProperty("--reading-size", `${settings.fontSize}px`);
}

function clearSavedData() {
  if (!confirm("Clear favorites, notes, history, prayers and local feedback?")) return;
  Object.values(STORAGE).forEach(key => localStorage.removeItem(key));
  location.reload();
}

document.addEventListener("click", event => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) return showPage(pageButton.dataset.page);

  const el = event.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "favorite") toggleFavorite(JSON.parse(decodeURIComponent(el.dataset.verse)));
  if (action === "copy") copyVerse(JSON.parse(decodeURIComponent(el.dataset.verse)));
  if (action === "share") shareVerse(JSON.parse(decodeURIComponent(el.dataset.verse)));
  if (action === "note") saveNote(decodeURIComponent(el.dataset.reference));
  if (action === "feedback") openFeedback(decodeURIComponent(el.dataset.reference || ""));
  if (action === "admin") adminLogin();
  if (action === "problem") openProblem();
  if (action === "open-reference") search(decodeURIComponent(el.dataset.reference));
  if (action === "topic") search(decodeURIComponent(el.dataset.topic));
  if (action === "book") openBook(decodeURIComponent(el.dataset.book));
  if (action === "close-reader") $("chapter-reader").classList.add("hidden");
  if (action === "admin-sort") renderAdmin(el.dataset.sort);
  if (action === "feedback-status") setFeedbackStatus(el.dataset.id, el.dataset.status);
  if (action === "delete-feedback") deleteFeedback(el.dataset.id);
  if (action === "delete-prayer") {
    set(STORAGE.prayers, get(STORAGE.prayers).filter(x => String(x.id) !== String(el.dataset.id)));
    renderPrayers();
  }
});

$("search-form").addEventListener("submit", e => { e.preventDefault(); search($("search-input").value); });
$("random-button").addEventListener("click", randomVerse);
$("feedback-form").addEventListener("submit", submitFeedback);
$("problem-form").addEventListener("submit", submitProblem);
$("save-prayer").addEventListener("click", savePrayer);
$("clear-favorites").addEventListener("click", () => {
  if (confirm("Clear all favorites?")) { localStorage.removeItem(STORAGE.favorites); renderFavorites(); }
});
$("clear-data").addEventListener("click", clearSavedData);
$("theme-select").addEventListener("change", saveSettings);
$("font-size").addEventListener("input", saveSettings);
document.querySelectorAll("[data-testament]").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll("[data-testament]").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  renderBooks(btn.dataset.testament);
}));

renderTopics();
renderRecent();
renderBooks("old");
dailyVerse();
loadSettings();
