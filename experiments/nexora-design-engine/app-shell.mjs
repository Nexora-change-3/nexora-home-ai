export const APP_HTML = String.raw`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f5f2ec">
<title>NEXORA Design Engine</title>
<style>
:root{color-scheme:light;--ink:#252721;--muted:#73766e;--line:#deded5;--paper:#f5f2ec;--card:#fffefa;--accent:#45584c;--accent2:#d9e2d9;--danger:#9b3c32}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
header{padding:28px max(22px,calc((100vw - 1160px)/2));border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{font-size:17px;font-weight:750;letter-spacing:.18em}.brand small{display:block;font-size:10px;letter-spacing:.22em;color:var(--muted);font-weight:500}
.status{font-size:12px;color:var(--accent);border:1px solid #cbd5ca;padding:6px 10px;border-radius:99px}
main{max-width:1160px;margin:0 auto;padding:34px 22px 70px}.intro{max-width:760px;margin-bottom:28px}.eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}h1{font-family:Georgia,serif;font-size:clamp(32px,5vw,52px);font-weight:400;line-height:1.08;margin:10px 0 14px}.intro p{color:#5f625b;max-width:690px;margin:0}
.layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.82fr);gap:22px;align-items:start}.panel{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;margin-bottom:18px;box-shadow:0 8px 28px #25272108}
h2{font-size:16px;margin:0 0 16px;letter-spacing:.02em}.step{font-size:11px;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:7px}
label{display:block;font-size:13px;font-weight:600;margin:14px 0 6px}input,select,textarea{width:100%;font:inherit;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:10px;padding:11px 12px;outline:none}textarea{min-height:88px;resize:vertical}input:focus,select:focus,textarea:focus{border-color:#7f9685;box-shadow:0 0 0 3px #d9e2d955}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.upload{border:1px dashed #aeb6aa;border-radius:14px;background:#fafaf6;padding:18px;text-align:center}.upload input{border:0;background:transparent;padding:8px}.preview{display:none;max-width:100%;max-height:360px;object-fit:contain;border-radius:10px;margin:14px auto 0}.hint{font-size:12px;color:var(--muted);margin-top:6px}
button{border:0;border-radius:10px;background:var(--accent);color:white;font:600 14px inherit;padding:13px 17px;cursor:pointer;min-height:46px}button:disabled{opacity:.45;cursor:not-allowed}.secondary{background:#e8ebe5;color:#354239}.danger{background:#f5e6e3;color:#87372f}.full{width:100%;margin-top:16px}
.concepts{display:grid;gap:12px}.concept{border:1px solid var(--line);border-radius:13px;padding:15px;background:#fff}.concept.selected{border-color:#728b78;background:#f6f9f5}.concept-head{display:flex;gap:10px;align-items:flex-start}.concept-head input{width:18px;height:18px;margin-top:4px;accent-color:var(--accent)}.concept h3{margin:0;font-size:15px}.concept p{margin:7px 0;color:#64675f;font-size:13px}.concept-meta{font-size:12px;color:var(--muted)}
.consent{display:flex;gap:10px;align-items:flex-start;padding:13px;background:#f8f4e9;border-radius:12px;margin-top:14px;font-size:12px;color:#625c4e}.consent input{width:18px;height:18px;flex:none;margin-top:2px;accent-color:var(--accent)}
.notice{font-size:12px;color:var(--muted);padding:12px 0 0}.notice strong{color:#595c54}.statusline{margin-top:12px;font-size:13px;color:var(--accent);min-height:22px}.error{color:var(--danger)}.progress{height:5px;background:#e6e7df;border-radius:9px;overflow:hidden;margin-top:10px;display:none}.progress>i{display:block;width:0;height:100%;background:#647d69;transition:width .25s}
.results{display:grid;gap:14px}.result{border:1px solid var(--line);border-radius:13px;padding:12px;background:#fff}.result img{width:100%;display:block;border-radius:8px}.result-title{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:8px 0;font-size:13px;font-weight:650}.result a{color:var(--accent);font-size:12px}
.empty{font-size:13px;color:var(--muted);padding:14px 0}.footer{margin-top:28px;color:var(--muted);font-size:11px;max-width:820px}.footer a{color:inherit}
@media(max-width:820px){.layout{grid-template-columns:1fr}header{padding:20px 18px}main{padding:26px 16px 50px}.panel{padding:18px}.grid2{grid-template-columns:1fr}}
 .reference-preview{display:none;max-width:100%;max-height:240px;object-fit:contain;margin-top:12px;border-radius:10px;border:1px solid var(--line)}
</style>
</head>
<body>
<header><div class="brand">NEXORA<small>DESIGN ENGINE</small></div><div class="status">Отдельная версия · 1.1</div></header>
<main>
<section class="intro"><div class="eyebrow">Interior intelligence / image editing</div><h1>Переосмыслите своё пространство.</h1><p>Загрузите фотографию комнаты, задайте пожелания и получите три разные дизайнерские концепции. Исходное фото остаётся неизменным, каждый результат сохраняется отдельно.</p></section>
<div class="layout">
<section>
<div class="panel">
<div class="step">01 / Исходное пространство</div><h2>Фотография помещения</h2>
<div class="upload"><label for="photo" style="margin:0">Выберите исходную фотографию</label><input id="photo" type="file" accept="image/jpeg,image/png,image/webp"><div class="hint">JPEG, PNG или WebP · до 8 МБ · исходник хранится в браузере; для модели создаётся уменьшенная копия</div><img id="preview" class="preview" alt="Предпросмотр исходной фотографии"></div>
<div class="upload reference-upload"><label for="referencePhoto" style="margin:0">Фото-референс (необязательно)</label><input id="referencePhoto" type="file" accept="image/jpeg,image/png,image/webp"><div class="hint">Добавьте интерьер или отдельный визуальный пример. NEXORA извлечёт стиль, материалы, ритм, свет и композицию — но не будет копировать чужую планировку. JPEG, PNG или WebP · до 8 МБ</div><img id="referencePreview" class="reference-preview" alt="Предпросмотр фото-референса"></div>
<div class="grid2"><div><label for="room">Тип помещения</label><select id="room"><option value="kitchen">Кухня</option><option value="living_room">Гостиная</option><option value="bedroom">Спальня</option><option value="bathroom">Ванная</option><option value="hallway">Прихожая</option><option value="office">Кабинет</option><option value="studio">Студия</option><option value="other">Другое</option></select></div><div><label for="style">Стилевой ориентир</label><select id="style"><option value="designer-led">Пусть дизайнер предложит решение</option><option value="contemporary">Современный</option><option value="minimalism">Минимализм</option><option value="japandi">Japandi</option><option value="scandinavian">Скандинавский</option><option value="classic">Современная классика</option><option value="organic">Органический / природный</option><option value="art-deco">Ар-деко</option><option value="industrial">Индустриальный</option></select></div></div>
<label for="brief">Что вы хотите изменить?</label><textarea id="brief" placeholder="Например: полностью новое оформление кухни, больше цельных материалов, выразительный остров, спокойная палитра..."></textarea>
<label for="use">Как будет использоваться помещение?</label><input id="use" placeholder="Например: ежедневная готовка, семейные ужины, работа из дома">
<label for="fixed">Что нельзя менять? (каждый пункт с новой строки)</label><textarea id="fixed">Несущие стены и геометрия помещения
Окна и двери
Потолок
Фиксированные инженерные коммуникации</textarea>
<label for="preserve">Что обязательно сохранить?</label><textarea id="preserve">Геометрия помещения
Окна и двери
Потолок
Фиксированные коммуникации
Ракурс исходной фотографии</textarea>
<label for="replace">Что можно заменить?</label><textarea id="replace">Корпуса и фасады мебели
Столешницы и рабочие поверхности
Отделка стен и фартук
Светильники и сценарии освещения
Свободно стоящая мебель
Фурнитура и декор</textarea>
<button id="plan" class="secondary full">Сформировать 3 дизайнерские концепции</button>
<div id="planStatus" class="statusline" aria-live="polite"></div>
</div>
<div class="panel" id="conceptPanel" hidden>
<div class="step">02 / Выбор направления</div><h2>Три разные идеи</h2><div id="concepts" class="concepts"></div>
<div class="consent"><input type="checkbox" id="consent"><label for="consent" style="margin:0;font-weight:500">Я разрешаю передать исходную фотографию и, если добавлен, фото-референс в Cloudflare Workers AI: анализ помещения и дизайн-языка (Moondream), разработка трёх концепций (Llama 3.3 70B) и генерация изображений (FLUX.2 Dev). NEXORA не сохраняет исходное фото на сервере; оно хранится в браузере. Сервер временно хранит только концепции и результаты. Бесплатная квота ограничена; платные сервисы не подключаются.</label></div>
<button id="render" class="full" disabled>Создать выбранные варианты</button>
<div id="renderStatus" class="statusline" aria-live="polite"></div><div class="progress" id="progress"><i id="progressBar"></i></div>
<p class="notice">Варианты создаются последовательно. Общий лимит — 3 генерации в сутки на весь проект, чтобы использовать только бесплатную дневную квоту Cloudflare Workers AI. Платный резервный сервис отключён.</p>
</div>
</section>
<aside>
<div class="panel"><div class="step">03 / Результаты</div><h2>Ваши варианты дизайна</h2><div id="results" class="results"><div class="empty">Здесь появятся созданные изображения. Они сохраняются в локальной базе этого браузера.</div></div></div>
<div class="panel"><h2>Хранение и приватность</h2><div id="providerStatus" class="notice">Проверяю доступность бесплатного генератора…</div>
<p class="notice">Исходное фото не сохраняется на сервере NEXORA. При запуске генерации оно передаётся выбранному внешнему сервису. Готовые изображения временно хранятся в NEXORA до 24 часов для восстановления, а затем остаются в локальной базе браузера.</p><button id="clear" class="danger full">Удалить локальные фотографии и результаты</button><div id="clearStatus" class="statusline"></div></div>
</aside>
</div>
<div class="footer">NEXORA Design Engine 1.4 · Llama 3.3 70B Design Brain · FLUX.2 Dev · Moondream room-identity check. Результат требует проверки архитектором: модель может ошибаться в геометрии, деталях и функциональности. Не используйте изображение как строительный чертёж.</div>
</main>
<script>
const $ = (id) => document.getElementById(id);
const DB_NAME = "nexora-design-engine-local";
let sourceBlob = null;
let referenceBlob = null;
let referenceName = "design-reference";
let currentDesignSessionId = null;
let currentSourceImageId = null;
let isPlanning = false;
let sourceName = "room-photo";
let currentConcepts = [];
let isRendering = false;
let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("source")) db.createObjectStore("source", { keyPath: "id" });
      if (!db.objectStoreNames.contains("results")) db.createObjectStore("results", { keyPath: "id" });
      if (!db.objectStoreNames.contains("jobs")) db.createObjectStore("jobs", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function dbPut(store, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function dbGet(store, id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function dbAll(store) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function dbDelete(store, id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function dbClear(store) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function setStatus(id, message, isError = false) {
  $(id).textContent = message;
  $(id).classList.toggle("error", isError);
}
function lines(id) { return $(id).value.trim(); }
function designInput(sourceImageId) {
  return {
    sourceImageId,
    roomType: $("room").value,
    stylePreference: $("style").value,
    userBrief: lines("brief"),
    intendedUse: lines("use"),
    fixed: lines("fixed"),
    preserve: lines("preserve"),
    replaceable: lines("replace")
  };
}
async function sha256(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function setPhoto(blob, name) {
  sourceBlob = blob;
  sourceName = name || "room-photo";
  invalidateDesignSession();
  const image = $("preview");
  image.src = URL.createObjectURL(blob);
  image.style.display = "block";
  updatePlanButton();
  $("conceptPanel").hidden = true;
  setStatus("planStatus", "Фото сохранено локально. Оно ещё не отправлялось на сервер.");
}
function conceptCard(concept, index) {
  const article = document.createElement("article");
  article.className = "concept selected";
  const head = document.createElement("div");
  head.className = "concept-head";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;
  checkbox.dataset.conceptId = concept.concept_id;
  const body = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = (index + 1) + ". " + concept.name;
  const thesis = document.createElement("p");
  thesis.textContent = concept.thesis;
  const meta = document.createElement("div");
  meta.className = "concept-meta";
  meta.textContent = "Материалы: " + concept.materials + " · Свет: " + concept.lighting;
  body.append(title, thesis, meta);
  head.append(checkbox, body);
  article.append(head);
  checkbox.addEventListener("change", () => {
    article.classList.toggle("selected", checkbox.checked);
    updateRenderButton();
  });
  return article;
}
function selectedConcepts() {
  const ids = [...$("concepts").querySelectorAll("input[type=checkbox]:checked")].map((x) => x.dataset.conceptId);
  return currentConcepts.filter((x) => ids.includes(x.concept_id));
}
function updatePlanButton() { $("plan").disabled = !sourceBlob || !$("consent").checked || isPlanning; }
function invalidateDesignSession() { currentDesignSessionId=null; currentSourceImageId=null; currentConcepts=[]; $("conceptPanel").hidden=true; updateRenderButton(); }
function updateRenderButton() {
  $("render").disabled = !sourceBlob || !currentDesignSessionId || !selectedConcepts().length || !$("consent").checked || isRendering;
}
async function planConcepts(){if(!sourceBlob||!$("consent").checked||isPlanning)return;isPlanning=true;updatePlanButton();invalidateDesignSession();setStatus("planStatus",referenceBlob?"Анализирую исходную комнату и отдельно извлекаю дизайн-язык референса…":"Анализирую исходную фотографию и разрабатываю три разные дизайнерские концепции…");try{const sourceId="sha256:"+await sha256(sourceBlob),input=designInput(sourceId),form=new FormData();form.append("image",sourceBlob,sourceName||"nexora-source");form.append("externalProcessingConsent","true");if(referenceBlob)form.append("referenceImage",referenceBlob,referenceName);for(const key of ["roomType","stylePreference","userBrief","intendedUse","fixed","preserve","replaceable"]){const value=input[key];form.append(key,Array.isArray(value)?value.join("\n"):String(value??""));}const response=await fetch("/api/concepts",{method:"POST",body:form}),data=await response.json();if(!response.ok)throw new Error(data.message||"Не удалось сформировать концепции.");currentDesignSessionId=data.session_id;currentSourceImageId=sourceId;currentConcepts=data.concepts;$("concepts").replaceChildren(...currentConcepts.map(conceptCard));$("conceptPanel").hidden=false;const review=data.vision_review_required||data.constraint_review_required?" Требуется ручная проверка неоднозначных элементов помещения.":"";setStatus("planStatus","AI-дизайнер проанализировал фотографию и подготовил три самостоятельные концепции."+review);setStatus("renderStatus","Выберите концепции для визуализации. Исходная фотография останется неизменной.");updateRenderButton();}catch(error){invalidateDesignSession();setStatus("planStatus",error.message,true);}finally{isPlanning=false;updatePlanButton();}}
async function fetchAndSaveResult(job, result) {
  const response = await fetch(result.result_url || ("/api/results/" + job.id));
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось получить изображение.");
  }
  const blob = await response.blob();
  await dbPut("results", {
    id: job.id,
    blob,
    conceptName: result.concept_name || job.conceptName,
    createdAt: new Date().toISOString(),
    model: result.model_id || "FLUX.2 Dev",
    recovered: Boolean(result.recovered)
  });
  await dbPut("jobs", { ...job, state: "succeeded" });
  await dbDelete("jobs", job.id);
  await renderSavedResults();
}
async function prepareRenderBlob(blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = objectUrl; });
    let maxDim = 512;
    let quality = 0.86;
    for (let attempt = 0; attempt < 3; attempt++) {
      const scale = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { alpha: false });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const output = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (output && output.size <= 1500000) return { blob: output, width: canvas.width, height: canvas.height };
      maxDim = Math.round(maxDim * 0.85);
      quality = Math.max(0.72, quality - 0.06);
    }
    throw new Error("Не удалось подготовить фотографию для безопасной отправки.");
  } finally { URL.revokeObjectURL(objectUrl); }
}
async function renderOne(concept, index, total, renderInput) {
  const id = crypto.randomUUID();
  const job = { id, conceptId: concept.concept_id, conceptName: concept.name, state: "submitting", createdAt: new Date().toISOString() };
  await dbPut("jobs", job);
  const form = new FormData();
  form.append("image", renderInput.blob, "nexora-source.jpg");
  form.append("imageWidth", String(renderInput.width));
  form.append("imageHeight", String(renderInput.height));
  form.append("requestId", id);
  form.append("externalProcessingConsent", "true");
  form.append("roomType", $("room").value);
  form.append("stylePreference", $("style").value);
  form.append("userBrief", lines("brief"));
  form.append("intendedUse", lines("use"));
  form.append("fixed", lines("fixed"));
  form.append("preserve", lines("preserve"));
  form.append("replaceable", lines("replace"));
  form.append("conceptId", concept.concept_id);
  form.append("designSessionId", currentDesignSessionId || "");
  form.append("sourceImageId", currentSourceImageId || "");
  const response = await fetch("/api/render", { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) {
    const knownNoRun = ["WORKERS_AI_FREE_QUOTA_EXHAUSTED", "GLOBAL_DAILY_LIMIT_REACHED", "DAILY_LIMIT_REACHED"].includes(data.error);
    if (knownNoRun) {
      await dbDelete("jobs", id);
      throw new Error(data.message || "Бесплатный дневной лимит генераций исчерпан.");
    }
    await dbPut("jobs", { ...job, state: data.error || "failed", message: data.message });
    throw Object.assign(new Error(data.message || "Генерация не завершилась."), { requestId: id, code: data.error });
  }
  await fetchAndSaveResult(job, data);
  setStatus("renderStatus", "Готов вариант " + index + " из " + total + ": " + concept.name);
}
async function renderSelected() {
  const chosen = selectedConcepts();
  if (!sourceBlob || !currentDesignSessionId || !chosen.length || !$("consent").checked || isRendering) return;
  isRendering = true;
  updateRenderButton();
  $("progress").style.display = "block";
  $("progressBar").style.width = "0%";
  let completed = 0;
  try {
    setStatus("renderStatus", "Подготавливаю уменьшенную копию фотографии. Исходник останется без изменений…");
    const renderInput = await prepareRenderBlob(sourceBlob);
    for (const concept of chosen) {
      setStatus("renderStatus", "Генерация " + (completed + 1) + " из " + chosen.length + ": " + concept.name + "…");
      await renderOne(concept, completed + 1, chosen.length, renderInput);
      completed++;
      $("progressBar").style.width = Math.round(completed / chosen.length * 100) + "%";
    }
    setStatus("renderStatus", "Готово. Создано вариантов: " + completed + ".");
  } catch (error) {
    setStatus("renderStatus", error.message + (error.requestId ? " Задание сохранено для проверки и восстановления." : ""), true);
    if (error.requestId) {
      const jobs = await dbAll("jobs");
      const job = jobs.find((x) => x.id === error.requestId);
      if (job) showRecovery(job);
    }
  } finally {
    isRendering = false;
    updateRenderButton();
  }
}
function showRecovery(job) {
  const button = document.createElement("button");
  button.className = "secondary full";
  button.textContent = "Проверить / восстановить " + job.conceptName;
  button.addEventListener("click", async () => {
    button.disabled = true;
    setStatus("renderStatus", "Проверяю сохранённое задание…");
    try {
      const response = await fetch("/api/jobs/" + job.id + "/recover", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Результат пока недоступен.");
      await fetchAndSaveResult(job, { ...data, result_url: "/api/results/" + job.id, concept_name: job.conceptName });
      setStatus("renderStatus", "Результат восстановлен и сохранён локально.");
      button.remove();
    } catch (error) {
      setStatus("renderStatus", error.message, true);
      button.disabled = false;
    }
  });
  $("renderStatus").after(button);
}
async function renderSavedResults() {
  const results = (await dbAll("results")).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  if (!results.length) {
    $("results").innerHTML = '<div class="empty">Здесь появятся созданные изображения.</div>';
    return;
  }
  const cards = results.map((item, index) => {
    const card = document.createElement("article");
    card.className = "result";
    const img = document.createElement("img");
    img.alt = item.conceptName || "Результат NEXORA";
    img.src = URL.createObjectURL(item.blob);
    const title = document.createElement("div");
    title.className = "result-title";
    const name = document.createElement("span");
    name.textContent = item.conceptName || ("Вариант " + (index + 1));
    const link = document.createElement("a");
    link.href = img.src;
    link.download = "nexora-design-" + (index + 1) + ".png";
    link.textContent = "Сохранить";
    title.append(name, link);
    card.append(img, title);
    return card;
  });
  $("results").replaceChildren(...cards);
}
async function clearLocal() {
  const results = await dbAll("results");
  for (const item of results) {
    await fetch("/api/results/" + item.id, { method: "DELETE" }).catch(() => {});
  }
  await dbClear("source");
  await dbClear("results");
  await dbClear("jobs");
  sourceBlob = null; referenceBlob = null; referenceName = "design-reference"; $("referencePreview").removeAttribute("src"); $("referencePreview").style.display = "none"; $("referencePhoto").value = ""; currentDesignSessionId=null; currentSourceImageId=null; currentConcepts=[];
  $("preview").removeAttribute("src");
  $("preview").style.display = "none";
  $("photo").value = "";
  $("conceptPanel").hidden = true;
  currentConcepts = [];
  setStatus("clearStatus", "Локальные фотографии и результаты удалены.");
  setStatus("planStatus", "");
  setStatus("renderStatus", "");
}
$("photo").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    setStatus("planStatus", "Файл больше 8 МБ.", true);
    return;
  }
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
    setStatus("planStatus", "Выберите JPEG, PNG или WebP.", true);
    return;
  }
  await dbPut("source", { id: "active", blob: file, name: file.name, savedAt: new Date().toISOString() });
  setPhoto(file, file.name);
});
$("referencePhoto").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) { referenceBlob = null; $("referencePreview").removeAttribute("src"); $("referencePreview").style.display = "none"; invalidateDesignSession(); return; }
  if (file.size > 8 * 1024 * 1024) { referenceBlob = null; event.target.value = ""; $("referencePreview").removeAttribute("src"); $("referencePreview").style.display = "none"; invalidateDesignSession(); setStatus("planStatus", "Фото-референс больше 8 МБ.", true); return; }
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) { referenceBlob = null; event.target.value = ""; $("referencePreview").removeAttribute("src"); $("referencePreview").style.display = "none"; invalidateDesignSession(); setStatus("planStatus", "Для референса выберите JPEG, PNG или WebP.", true); return; }
  referenceBlob = file; referenceName = file.name || "design-reference";
  const preview = $("referencePreview"); preview.src = URL.createObjectURL(file); preview.style.display = "block";
  invalidateDesignSession(); setStatus("planStatus", "Референс выбран. Его дизайн-язык будет проанализирован отдельно от геометрии вашей комнаты.");
});
$("plan").addEventListener("click", planConcepts);
$("consent").addEventListener("change", () => { updatePlanButton(); updateRenderButton(); });
for (const id of ["room","style","brief","use","fixed","preserve","replace"]) { $(id).addEventListener("input",invalidateDesignSession); $(id).addEventListener("change",invalidateDesignSession); }
$("render").addEventListener("click", renderSelected);
$("clear").addEventListener("click", clearLocal);
(async function init() {
  try {
    const health = await fetch("/api/health").then((r) => r.json());
    if (!health.ok || health.provider !== "cloudflare-workers-ai") throw new Error("Native Workers AI provider is unavailable.");
    $("providerStatus").textContent = "Cloudflare Workers AI · Llama 3.3 70B Design Brain · FLUX.2 Dev · Moondream room-identity check. 1 проектная сессия и до 3 генераций в сутки; платные резервные сервисы отключены.";
    const saved = await dbGet("source", "active");
    if (saved?.blob) setPhoto(saved.blob, saved.name);
    await renderSavedResults();
    const jobs = await dbAll("jobs");
    for (const job of jobs) showRecovery(job);
  } catch (error) {
    setStatus("planStatus", "Локальное хранилище недоступно в этом браузере.", true);
  }
  updatePlanButton();
  updateRenderButton();
})();
</script>
</body></html>`;