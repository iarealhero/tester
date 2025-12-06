const form = document.getElementById("search-form");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const minPriceEl = document.getElementById("min-price");
const maxPriceEl = document.getElementById("max-price");
const avgPriceEl = document.getElementById("avg-price");
const resetBtn = document.getElementById("reset");

const API_BASE = "https://eapi.stalcraft.net";

const formatNumber = (value) => new Intl.NumberFormat("ru-RU").format(value);

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function guessPrice(lot) {
  // API может возвращать разные ключи цены. Пытаемся подобрать наиболее вероятные.
  return (
    lot.unitPrice ??
    lot.price ??
    lot.startPrice ??
    lot.buyoutPrice ??
    lot.buyout ??
    lot.cost ??
    0
  );
}

function guessCount(lot) {
  return lot.amount ?? lot.count ?? lot.quantity ?? 1;
}

function normalizeLot(lot) {
  return {
    name: lot.name ?? lot.title ?? "Неизвестный предмет",
    price: guessPrice(lot),
    count: guessCount(lot),
    seller: lot.seller ?? lot.owner ?? "—",
    expires: lot.expiresAt ?? lot.expiration ?? lot.endsAt ?? null,
  };
}

function renderLots(lots) {
  if (!lots?.length) {
    resultsEl.innerHTML = '<p class="muted">Ничего не найдено.</p>';
    summaryEl.hidden = true;
    return;
  }

  const normalized = lots.map(normalizeLot).filter((lot) => Number.isFinite(lot.price));
  if (!normalized.length) {
    resultsEl.innerHTML = '<p class="muted">Нет цен в ответе API.</p>';
    summaryEl.hidden = true;
    return;
  }

  const prices = normalized.map((lot) => lot.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  minPriceEl.textContent = `${formatNumber(min)} ₽`;
  maxPriceEl.textContent = `${formatNumber(max)} ₽`;
  avgPriceEl.textContent = `${formatNumber(Math.round(avg))} ₽`;
  summaryEl.hidden = false;

  resultsEl.innerHTML = normalized
    .map(
      (lot) => `
      <article class="result-item">
        <div>
          <h3>${lot.name}</h3>
          <p class="muted">Продавец: ${lot.seller}</p>
        </div>
        <div>
          <p class="label muted">Цена</p>
          <p class="value">${formatNumber(lot.price)} ₽</p>
        </div>
        <div>
          <p class="label muted">Количество</p>
          <p class="value">${formatNumber(lot.count)}</p>
        </div>
        <div>
          <p class="label muted">Срок</p>
          <span class="badge">${lot.expires ? new Date(lot.expires).toLocaleString("ru-RU") : "—"}</span>
        </div>
      </article>
    `
    )
    .join("");
}

async function search(query, region, token) {
  const endpoint = `${API_BASE}/auction/${region}/lots?search=${encodeURIComponent(query)}`;

  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(endpoint, { headers });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Ошибка авторизации: API Stalcraft требует валидный Bearer-токен или права на выбранный эндпоинт."
      );
    }
    throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // Возможные варианты структуры: { lots: [...] } или сразу массив
  return data.lots ?? data.items ?? data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = form.query.value.trim();
  const region = form.region.value;
  const token = form.token.value.trim();

  if (!query) return;

  setStatus("Загрузка...");
  resultsEl.innerHTML = '<p class="muted">Запрос выполняется...</p>';
  summaryEl.hidden = true;

  try {
    const lots = await search(query, region, token);
    renderLots(lots);
    setStatus("Данные получены");
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
    resultsEl.innerHTML = `<p class="muted">${error.message}</p>`;
    summaryEl.hidden = true;
  }
});

resetBtn.addEventListener("click", () => {
  form.reset();
  summaryEl.hidden = true;
  resultsEl.innerHTML = '<p class="muted">Начните поиск, чтобы увидеть лоты.</p>';
  setStatus("Готово к поиску");
});
