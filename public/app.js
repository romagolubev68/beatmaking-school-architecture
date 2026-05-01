const appEl = document.getElementById('app'); 
const API_AUTH = '/api/auth';
const PRIVATE_ROUTES = new Set(['/profile', '/dashboard', '/checkout']); // приватные маршруты (только для авторизованных пользователей)
const LIVE_UPDATE_ROUTES = new Set(['/', '/courses', '/courses/:id', '/dashboard', '/profile', '/checkout']);
const defaultMentorPortfolio = {
  achievements: ['Публикации релизов', 'Индивидуальные разборы', 'Практика с проектами'],
  socials: []
};
const mentorPortfolioMeta = {
  'Roman K.': {
    photo: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=80',
    achievements: ['12+ лет в индустрии', 'Саунд-продюсер независимых артистов', 'Автор 4 учебных программ по Trap/Drill'],
    socials: ['YouTube', 'SoundCloud']
  },
  'Alex M.': {
    photo: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=800&q=80',
    achievements: ['Сведение для 100+ треков', 'Работа с коммерческими релизами', 'Наставник по мастерингу с 2020'],
    socials: ['YouTube', 'Instagram']
  },
  'Vika P.': {
    photo: 'https://images.unsplash.com/photo-1516280030429-27679b3dc9cf?auto=format&fit=crop&w=800&q=80',
    achievements: ['Эксперт Ableton Live', 'Куратор live-performance проектов', 'Проводит воркшопы по саунд-дизайну'],
    socials: ['Ableton', 'Telegram']
  }
};
const state = { 
  token: localStorage.getItem('token'), // токен авторизации
  user: null,
  flash: '',
  courseFilters: {
    search: '',
    genre: '',
    minPrice: '',
    maxPrice: '',
    sort: 'newest',
    page: 1,
    limit: 6
  },
  checkoutCart: []
};

let activeRouteKey = '/';
let activeRoutePath = '/';
let eventSource = null;
let lastRealtimeRerenderAt = 0;
let realtimeVersion = 0;
let courseActionState = { liked: false, favorite: false };

function escapeHtml(value) { // функция для экранирования HTML-тегов
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isAuthenticated() { // функция для проверки авторизации
  return !!state.token;
}

function getAuthHeaders() { // функция для получения заголовков
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

function getBeatImageUrl(beat = {}) {
  const genre = String(beat.genre || 'beats').toLowerCase();
  const seed = encodeURIComponent(`${beat.id || beat.title || 'beat'}-${genre}`);
  return `https://picsum.photos/seed/${seed}/600/360`;
}

function getMentorPortfolio(mentor = {}) {
  const known = mentorPortfolioMeta[mentor.fullName];
  if (!known) {
    return {
      ...defaultMentorPortfolio,
      photo: `https://picsum.photos/seed/mentor-${mentor.id || 'default'}/800/500`
    };
  }
  return known;
}

async function apiFetch(url, options = {}) {
  try {
    const method = String(options.method || 'GET').toUpperCase();
    const fetchOptions = {
      ...options
    };
    if (method === 'GET' || method === 'HEAD') {
      fetchOptions.cache = 'no-store';
    }
    const response = await fetch(url, fetchOptions);
    let payload = {};
    try {
      payload = await response.json();
    } catch (_) {
      payload = {};
    }
    if (!response.ok && !payload.message) {
      const fallback = response.status >= 500
        ? 'Ошибка сервера. Попробуйте позже.'
        : 'Запрос не выполнен. Проверьте введенные данные.';
      payload.message = fallback;
    }
    return { ok: response.ok, status: response.status, data: payload };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { message: 'Ошибка сети. Проверьте, запущен ли сервер.' },
      error
    };
  }
}

function withTs(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}ts=${Date.now()}`;
}

function updateCourseActionButtons() {
  const likeBtn = document.getElementById('likeBtn');
  const favoriteBtn = document.getElementById('favoriteBtn');
  if (likeBtn) {
    likeBtn.classList.toggle('active', !!courseActionState.liked);
    likeBtn.textContent = courseActionState.liked ? 'Лайк: Вкл' : 'Лайк: Выкл';
  }
  if (favoriteBtn) {
    favoriteBtn.classList.toggle('active', !!courseActionState.favorite);
    favoriteBtn.textContent = courseActionState.favorite ? 'Избранное: Вкл' : 'Избранное: Выкл';
  }
}

async function hydrateCourseActionState(beatId) {
  if (!isAuthenticated()) {
    courseActionState = { liked: false, favorite: false };
    updateCourseActionButtons();
    return;
  }
  const { ok, data } = await apiFetch(withTs(`/api/beats/item/${beatId}/state`), {
    headers: getAuthHeaders()
  });
  if (!ok) {
    // Не сбрасываем UI при временной сетевой ошибке/таймауте.
    // Иначе в некоторых браузерах кнопка визуально "отжимается" сама.
    return;
  }
  courseActionState = {
    liked: !!data.liked,
    favorite: !!data.favorite
  };
  updateCourseActionButtons();
}

async function refreshCourseDetailsInPlace() {
  if (activeRouteKey !== '/courses/:id') return;
  const beatId = activeRoutePath.split('/')[2];
  if (!beatId) return;

  const beat = await apiFetch(withTs(`/api/beats/item/${beatId}`));
  if (beat.ok) {
    const likeCount = document.getElementById('likeCount');
    if (likeCount) likeCount.textContent = String(beat.data.likesCount || 0);
  }
  await hydrateCourseActionState(beatId);
}

function setFlash(message = '') { // функция для установки сообщения
  state.flash = message;
}

async function refreshCoursesInPlace() {
  if (activeRouteKey !== '/courses') return;
  const q = new URLSearchParams({
    search: state.courseFilters.search,
    genre: state.courseFilters.genre,
    minPrice: state.courseFilters.minPrice,
    maxPrice: state.courseFilters.maxPrice,
    sort: state.courseFilters.sort,
    page: String(state.courseFilters.page),
    limit: String(state.courseFilters.limit)
  });
  const { ok, data } = await apiFetch(withTs(`/api/beats?${q.toString()}`));
  if (!ok) return;

  const listContainer = document.getElementById('coursesListContainer');
  const paginationContainer = document.getElementById('coursesPaginationContainer');
  if (listContainer) {
    listContainer.innerHTML = data.items.length
      ? `<div class="grid">${data.items.map((item) => cardBeat(item)).join('')}</div>`
      : '<p class="muted">Ничего не найдено.</p>';
  }
  if (paginationContainer) {
    paginationContainer.innerHTML = `
      <button class="btn" id="prevPageBtn" ${data.pagination.page <= 1 ? 'disabled' : ''}>Назад</button>
      <span>Страница ${data.pagination.page} из ${data.pagination.totalPages}</span>
      <button class="btn" id="nextPageBtn" ${data.pagination.page >= data.pagination.totalPages ? 'disabled' : ''}>Вперед</button>
    `;
    attachHandlers('/courses');
  }
}

function syncNav(pathname = location.pathname) { // функция для синхронизации навигации (кнопки входа/выхода, статус пользователя)
  const logged = isAuthenticated();
  const navLogin = document.getElementById('navLogin');
  const navRegister = document.getElementById('navRegister');
  const navLogoutBtn = document.getElementById('navLogoutBtn');
  const userState = document.getElementById('userState');

  if (navLogin) navLogin.style.display = logged ? 'none' : '';
  if (navRegister) navRegister.style.display = logged ? 'none' : '';
  if (navLogoutBtn) navLogoutBtn.style.display = logged ? '' : 'none';
  if (userState) {
    userState.textContent = logged
       ? `Пользователь: ${state.user?.name || state.user?.email || 'авторизован'}`
      : 'Гость';
  }

  document.querySelectorAll('a[data-link]').forEach((a) => { 
    const href = a.getAttribute('href');
    const active = href === pathname || (href === '/courses' && pathname.startsWith('/courses/'));
    a.classList.toggle('active', active);
  });
}

function cardBeat(beat, withDetails = true) { // функция для отображения карточки бита
  return `
    <article class="card">
      <img class="card-cover" src="${escapeHtml(getBeatImageUrl(beat))}" alt="Обложка курса ${escapeHtml(beat.title)}" loading="lazy" />
      <h3>${escapeHtml(beat.title)}</h3>
      <p class="muted">Жанр: ${escapeHtml(beat.genre)}</p>
      <p class="muted">Автор: ${escapeHtml(beat.authorName || 'неизвестно')}</p>
      <p><strong>${Number(beat.price).toFixed(2)} ₽</strong></p>
      <p>Лайков: <strong>${beat.likesCount || 0}</strong></p>
      ${withDetails ? `<p><a data-link href="/courses/${beat.id}">Открыть</a></p>` : ''}
    </article>
  `;
}

async function renderHome() { // функция для отображения главной страницы
  appEl.innerHTML = '<div class="spinner">Загрузка главной страницы...</div>';
  const { ok, data } = await apiFetch(withTs('/api/home/summary')); // получаем данные для главной страницы
  if (!ok) {
    appEl.innerHTML = '<div class="error">Не удалось загрузить главную страницу.</div>';
    return;
  }
  appEl.innerHTML = `
    <h2>Главная</h2>
    <div class="grid">
      <article class="card"><h3 id="homeUsersCount">${data.stats.usersCount}</h3><p class="muted">Пользователей</p></article>
      <article class="card"><h3 id="homeBeatsCount">${data.stats.beatsCount}</h3><p class="muted">Курсов в каталоге</p></article>
      <article class="card"><h3 id="homeFavoritesCount">${data.stats.favoritesCount}</h3><p class="muted">Добавлений в избранное</p></article>
    </div>
    <h3>Популярные курсы</h3>
    <div id="homePopularContainer">
      ${data.popular.length ? `<div class="grid">${data.popular.map((item) => cardBeat(item)).join('')}</div>` : '<p class="muted">Пока нет данных.</p>'}
    </div>
  `;
}

async function refreshHomeInPlace() {
  if (activeRouteKey !== '/') return;
  const { ok, data } = await apiFetch(withTs('/api/home/summary'));
  if (!ok) return;

  const users = document.getElementById('homeUsersCount');
  const beats = document.getElementById('homeBeatsCount');
  const favorites = document.getElementById('homeFavoritesCount');
  const popularContainer = document.getElementById('homePopularContainer');

  if (users) users.textContent = String(data.stats.usersCount ?? 0);
  if (beats) beats.textContent = String(data.stats.beatsCount ?? 0);
  if (favorites) favorites.textContent = String(data.stats.favoritesCount ?? 0);
  if (popularContainer) {
    popularContainer.innerHTML = data.popular.length
      ? `<div class="grid">${data.popular.map((item) => cardBeat(item)).join('')}</div>`
      : '<p class="muted">Пока нет данных.</p>';
  }
}

async function renderMentors() {
  appEl.innerHTML = '<div class="spinner">Загрузка наставников...</div>';
  const { ok, data } = await apiFetch('/api/mentors');
  if (!ok) {
    appEl.innerHTML = '<div class="error">Не удалось загрузить наставников.</div>';
    return;
  }
  appEl.innerHTML = `
    <h2>Наставники</h2>
    ${data.length ? `
      <div class="grid">
        ${data.map((m) => `
          <article class="card">
            <img class="card-cover" src="${escapeHtml(getMentorPortfolio(m).photo)}" alt="Фото наставника ${escapeHtml(m.fullName)}" loading="lazy" />
            <h3>${escapeHtml(m.fullName)}</h3>
            <p>${escapeHtml(m.specialization)}</p>
            <p class="muted">${escapeHtml(m.bio)}</p>
            <div class="mentor-tags">
              ${getMentorPortfolio(m).socials.map((social) => `<span class="mentor-tag">${escapeHtml(social)}</span>`).join('')}
            </div>
            <ul>
              ${getMentorPortfolio(m).achievements.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
            <p><a href="${escapeHtml(m.portfolioUrl)}" target="_blank" rel="noreferrer">Портфолио</a></p>
          </article>
        `).join('')}
      </div>
    ` : '<p class="muted">Список наставников пуст.</p>'}
  `;
}

function renderLogin() {
  return `
    <h2>Вход</h2>
    ${state.flash ? `<div class="success">${escapeHtml(state.flash)}</div>` : ''}
    <form id="loginForm">
      <div class="form-row">
        <label>Email<input name="email" type="email" required /></label>
      </div>
      <div class="form-row">
        <label>Пароль<input name="password" type="password" minlength="6" required /></label>
      </div>
      <button class="btn primary" type="submit">Войти</button>
    </form>
    <p><small>Нет аккаунта? <a data-link href="/auth/register">Зарегистрируйтесь</a>.</small></p>
    <div id="authError"></div>
  `;
}

function renderRegister() {
  return `
    <h2>Регистрация</h2>
    <form id="registerForm">
      <div class="form-row">
        <label>Имя<input name="name" minlength="2" required /></label>
        <label>Email<input name="email" type="email" required /></label>
      </div>
      <div class="form-row">
        <label>Пароль<input name="password" type="password" minlength="6" required /></label>
        <label>Повтор пароля<input name="password2" type="password" minlength="6" required /></label>
      </div>
      <button class="btn primary" type="submit">Создать аккаунт</button>
    </form>
    <div id="registerError"></div>
  `;
}

async function ensureAuthUser() { // функция для проверки авторизации пользователя
  if (!isAuthenticated()) {
    state.user = null;
    return false;
  }
  if (state.user) return true;
  const me = await apiFetch(`${API_AUTH}/me`, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
  });
  if (!me.ok) {
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
    return false;
  }
  state.user = me.data;
  return true;
}

async function renderCourses() {
  appEl.innerHTML = '<div class="spinner">Загрузка каталога...</div>';
  const q = new URLSearchParams({
    search: state.courseFilters.search,
    genre: state.courseFilters.genre,
    minPrice: state.courseFilters.minPrice,
    maxPrice: state.courseFilters.maxPrice,
    sort: state.courseFilters.sort,
    page: String(state.courseFilters.page),
    limit: String(state.courseFilters.limit)
  });
  const { ok, data } = await apiFetch(`/api/beats?${q.toString()}`);
  if (!ok) {
    appEl.innerHTML = '<div class="error">Ошибка загрузки каталога. Попробуйте позже.</div>';
    return;
  }
  const { items, pagination } = data;
  appEl.innerHTML = `
    <h2>Каталог курсов</h2>
    <form id="catalogFilterForm">
      <div class="form-row">
        <label>Поиск<input name="search" value="${escapeHtml(state.courseFilters.search)}" placeholder="Название курса" /></label>
        <label>Жанр
          <select name="genre">
            <option value="">Все</option>
            <option value="Trap" ${state.courseFilters.genre === 'Trap' ? 'selected' : ''}>Trap</option>
            <option value="Drill" ${state.courseFilters.genre === 'Drill' ? 'selected' : ''}>Drill</option>
            <option value="Lo-fi" ${state.courseFilters.genre === 'Lo-fi' ? 'selected' : ''}>Lo-fi</option>
          </select>
        </label>
      </div>
      <div class="form-row">
        <label>Мин. цена<input type="number" name="minPrice" min="0" value="${escapeHtml(state.courseFilters.minPrice)}" /></label>
        <label>Макс. цена<input type="number" name="maxPrice" min="0" value="${escapeHtml(state.courseFilters.maxPrice)}" /></label>
        <label>Сортировка
          <select name="sort">
            <option value="newest" ${state.courseFilters.sort === 'newest' ? 'selected' : ''}>Сначала новые</option>
            <option value="title_asc" ${state.courseFilters.sort === 'title_asc' ? 'selected' : ''}>По названию</option>
            <option value="price_asc" ${state.courseFilters.sort === 'price_asc' ? 'selected' : ''}>Цена по возрастанию</option>
            <option value="price_desc" ${state.courseFilters.sort === 'price_desc' ? 'selected' : ''}>Цена по убыванию</option>
            <option value="likes_desc" ${state.courseFilters.sort === 'likes_desc' ? 'selected' : ''}>По лайкам</option>
          </select>
        </label>
      </div>
      <button class="btn primary" type="submit">Найти</button>
    </form>
    <div id="coursesListContainer">
      ${items.length ? `<div class="grid">${items.map((item) => cardBeat(item)).join('')}</div>` : '<p class="muted">Ничего не найдено.</p>'}
    </div>
    <div id="coursesPaginationContainer" class="pagination">
      <button class="btn" id="prevPageBtn" ${pagination.page <= 1 ? 'disabled' : ''}>Назад</button>
      <span>Страница ${pagination.page} из ${pagination.totalPages}</span>
      <button class="btn" id="nextPageBtn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''}>Вперед</button>
    </div>
  `;
}

async function renderCourseDetails(id) {
  appEl.innerHTML = '<div class="spinner">Загрузка страницы курса...</div>';
  const beat = await apiFetch(`/api/beats/item/${id}`);
  if (!beat.ok) {
    appEl.innerHTML = '<div class="error">Курс не найден или недоступен.</div>';
    return;
  }
  appEl.innerHTML = `
    <h2>${escapeHtml(beat.data.title)}</h2>
    <p class="muted">Автор: ${escapeHtml(beat.data.authorName || 'неизвестно')}</p>
    <p>Жанр: <strong>${escapeHtml(beat.data.genre)}</strong></p>
    <p>Цена: <strong>${Number(beat.data.price).toFixed(2)} ₽</strong></p>
    <p>Лайков: <strong id="likeCount">${beat.data.likesCount || 0}</strong></p>
    <div class="toggle-group">
      <button class="btn toggle" id="likeBtn" data-id="${beat.data.id}" type="button">Лайк: Выкл</button>
      <button class="btn toggle favorite" id="favoriteBtn" data-id="${beat.data.id}" type="button">Избранное: Выкл</button>
    </div>
    <div class="form-row">
      <button class="btn primary" id="addToCheckoutBtn" data-id="${beat.data.id}">Добавить к оплате</button>
    </div>
    <p><a data-link href="/courses">Назад к каталогу</a></p>
    <div id="courseActionError"></div>
  `;
  await hydrateCourseActionState(beat.data.id);
}

async function renderProfile() {
  appEl.innerHTML = '<div class="spinner">Загрузка профиля...</div>';
  const me = await apiFetch(`${API_AUTH}/me`, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
  });
  if (!me.ok) { // если пользователь не авторизован, то перенаправляем на страницу входа
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    await render('/auth/login', true);
    return;
  }
  state.user = me.data;
  const myBeats = await apiFetch('/api/beats/my', { headers: getAuthHeaders() });
  const beats = myBeats.ok ? myBeats.data : [];
  appEl.innerHTML = `
    <h2>Профиль</h2>
    <p><strong>Имя:</strong> ${escapeHtml(me.data.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(me.data.email)}</p>
    <h3>Создать курс</h3>
    <form id="addBeatForm">
      <div class="form-row">
        <label>Название<input name="title" required minlength="2" /></label>
        <label>Жанр<input name="genre" required minlength="2" /></label>
      </div>
      <div class="form-row">
        <label>Цена<input name="price" type="number" min="0" required /></label>
      </div>
      <button class="btn primary" type="submit">Добавить курс</button>
    </form>
    <div id="profileFormError"></div>
    <h3>Мои курсы</h3>
    ${beats.length ? `<div class="grid">${beats.map((item) => cardBeat(item, false)).join('')}</div>` : '<p class="muted">У вас пока нет курсов.</p>'}
  `;
}

async function renderDashboard() { // функция для отображения раздела обучения
  appEl.innerHTML = '<div class="spinner">Загрузка моего обучения...</div>';
  const { ok, data } = await apiFetch('/api/beats/dashboard/summary', { headers: getAuthHeaders() });
  if (!ok) {
    appEl.innerHTML = '<div class="error">Не удалось загрузить раздел обучения.</div>';
    return;
  }
  appEl.innerHTML = `
    <h2>Мое обучение</h2>
    <div class="grid">
      <article class="card"><h3>${data.stats.totalItems}</h3><p class="muted">Всего материалов</p></article>
      <article class="card"><h3>${data.stats.ownBeats}</h3><p class="muted">Ваши материалы</p></article>
      <article class="card"><h3>${data.stats.favorites}</h3><p class="muted">В избранном</p></article>
    </div>
    <h3>Список</h3>
    ${data.items.length ? `<div class="grid">${data.items.map((item) => cardBeat(item)).join('')}</div>` : '<p class="muted">Пока пусто.</p>'}
  `;
}

async function renderCheckout() {
  appEl.innerHTML = '<div class="spinner">Загрузка раздела оплаты...</div>';
  const { ok, data } = await apiFetch(withTs(`/api/beats/by-ids/list?ids=${state.checkoutCart.join(',')}`), {
    headers: getAuthHeaders()
  });
  if (!ok) {
    appEl.innerHTML = '<div class="error">Не удалось загрузить корзину оплаты.</div>';
    return;
  }
  const total = data.reduce((acc, item) => acc + Number(item.price || 0), 0);
  appEl.innerHTML = `
    <h2>Оплата</h2>
    <p class="muted">Список выбранных курсов получен с сервера.</p>
    ${data.length ? `
      <ul>
        ${data.map((item) => `<li>${escapeHtml(item.title)} - ${Number(item.price).toFixed(2)} ₽</li>`).join('')}
      </ul>
      <p><strong>Итого: ${total.toFixed(2)} ₽</strong></p>
    ` : '<p>Корзина пуста.</p>'}
    <button id="checkoutSubmitBtn" class="btn primary" ${data.length ? '' : 'disabled'}>Оплатить курсы</button>
    <div id="checkoutMessage"></div>
  `;
}

function render404() {
  appEl.innerHTML = `
    <section class="not-found">
      <h2>404</h2>
      <p>Страница не найдена или была перемещена.</p>
      <a class="btn primary" data-link href="/">На главную</a>
    </section>
  `;
}

function parseRoute(path) { // функция для парсинга маршрута нужна для того, чтобы определить какая страница нужна для отображения
  if (path.startsWith('/courses/')) {
    return { key: '/courses/:id', params: { id: path.split('/')[2] } };
  }
  return { key: path, params: {} };
}

async function render(path, replace = false) {
  try {
    const targetPath = path || '/'; // получаем целевой маршрут
    const route = parseRoute(targetPath);
    const privateGuard = PRIVATE_ROUTES.has(route.key) || PRIVATE_ROUTES.has(targetPath); // проверяем, является ли маршрут приватным

    if (privateGuard && !(await ensureAuthUser())) { // если маршрут приватный и пользователь не авторизован, то перенаправляем на страницу входа
      setFlash('Сначала войдите в аккаунт, чтобы открыть приватный раздел.');
      const redirected = '/auth/login';
      history.replaceState({}, '', redirected);
      syncNav(redirected);
      appEl.innerHTML = renderLogin();
      attachHandlers('/auth/login');
      return;
    }

    if ((targetPath === '/auth/login' || targetPath === '/auth/register') && (await ensureAuthUser())) {
      await render('/profile', true); // если пользователь авторизован, то перенаправляем на страницу профиля
      return;
    }

    if (replace) {
      history.replaceState({}, '', targetPath);
    } else {
      history.pushState({}, '', targetPath);
    }
    syncNav(targetPath);
    setFlash('');

    switch (route.key) {
      case '/':
        await renderHome();
        break;
      case '/auth/login':
        appEl.innerHTML = renderLogin();
        break;
      case '/auth/register':
        appEl.innerHTML = renderRegister();
        break;
      case '/courses':
        await renderCourses();
        break;
      case '/courses/:id':
        await renderCourseDetails(route.params.id);
        break;
      case '/mentors':
        await renderMentors();
        break;
      case '/profile':
        await renderProfile();
        break;
      case '/dashboard':
        await renderDashboard();
        break;
      case '/checkout':
        await renderCheckout();
        break;
      default:
        render404();
        break;
    }

    activeRouteKey = route.key;
    activeRoutePath = targetPath;
    attachHandlers(route.key);
  } catch (error) {
    console.error(error);
    appEl.innerHTML = `
      <div class="error">
        Произошла ошибка рендеринга страницы. Обновите страницу и проверьте, что сервер запущен.
      </div>
    `;
  }
}

function rerenderOnLiveUpdate(force = false) {
  if (!LIVE_UPDATE_ROUTES.has(activeRouteKey)) return;
  if (activeRouteKey === '/') {
    refreshHomeInPlace();
    return;
  }
  if (activeRouteKey === '/courses') {
    refreshCoursesInPlace();
    return;
  }
  if (activeRouteKey === '/courses/:id') {
    refreshCourseDetailsInPlace();
    return;
  }
  const now = Date.now();
  if (!force && now - lastRealtimeRerenderAt < 1200) return;
  lastRealtimeRerenderAt = now;
  render(activeRoutePath, true);
}

async function checkRealtimeVersionAndSync() {
  const { ok, data } = await apiFetch(withTs('/api/realtime/version'));
  if (!ok || typeof data.version !== 'number') return;
  if (!realtimeVersion) {
    realtimeVersion = data.version;
    return;
  }
  if (data.version > realtimeVersion) {
    realtimeVersion = data.version;
    if (activeRouteKey === '/courses/:id') {
      await refreshCourseDetailsInPlace();
    } else {
      rerenderOnLiveUpdate(true);
    }
  }
}

function initRealtimeUpdates() {
  if (eventSource) return;
  if (!window.EventSource) return;

  eventSource = new EventSource('/api/events');
  eventSource.addEventListener('connected', (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (typeof payload.version === 'number') {
        realtimeVersion = payload.version;
      }
    } catch (_) {}
  });
  eventSource.addEventListener('data_changed', (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (typeof payload.version === 'number') {
        realtimeVersion = Math.max(realtimeVersion, payload.version);
      }
    } catch (_) {}
    if (activeRouteKey === '/courses/:id') {
      refreshCourseDetailsInPlace();
      return;
    }
    rerenderOnLiveUpdate(true);
  });
  eventSource.onerror = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    setTimeout(() => {
      initRealtimeUpdates();
    }, 3000);
  };
}

setInterval(() => {
  checkRealtimeVersionAndSync();
}, 4000);

setInterval(() => {
  if (activeRouteKey !== '/courses/:id') return;
  refreshCourseDetailsInPlace();
}, 2500);

setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  if (activeRouteKey !== '/') return;
  refreshHomeInPlace();
}, 2500);

function showError(containerId, text) {
  const target = document.getElementById(containerId);
  if (!target) return;
  target.innerHTML = `<div class="error">${escapeHtml(text)}</div>`;
}

async function handleLoginSubmit(form) {
  const formData = new FormData(form);
  const email = String(formData.get('email')).trim();
  const password = String(formData.get('password'));
  if (!email.includes('@')) {
    showError('authError', 'Введите корректный email.');
    return;
  }
  if (password.length < 6) {
    showError('authError', 'Пароль должен быть не короче 6 символов.');
    return;
  }
  const { ok, data } = await apiFetch(`${API_AUTH}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!ok) {
    showError('authError', data.message || 'Ошибка входа.');
    return;
  }
  state.token = data.token;
  state.user = data.user || null;
  localStorage.setItem('token', data.token);
  await render('/profile', true);
}

async function handleRegisterSubmit(form) { // функция для регистрации пользователя
  const formData = new FormData(form);
  const name = String(formData.get('name')).trim();
  const email = String(formData.get('email')).trim();
  const password = String(formData.get('password'));
  const password2 = String(formData.get('password2'));

  if (name.length < 2) {
    showError('registerError', 'Имя должно быть не короче 2 символов.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('registerError', 'Некорректный формат email.');
    return;
  }
  if (password.length < 6) {
    showError('registerError', 'Пароль должен быть не короче 6 символов.');
    return;
  }
  if (password !== password2) {
    showError('registerError', 'Пароли не совпадают.');
    return;
  }

  const { ok, data } = await apiFetch(`${API_AUTH}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  if (!ok) {
    showError('registerError', data.message || 'Ошибка регистрации.');
    return;
  }
  setFlash('Регистрация успешна. Теперь выполните вход.');
  await render('/auth/login', true);
}

async function handleCreateBeat(form) { // функция для добавления бита
  const formData = new FormData(form); 
  const title = String(formData.get('title')).trim();
  const genre = String(formData.get('genre')).trim();
  const price = Number(formData.get('price'));

  if (title.length < 2 || genre.length < 2 || !Number.isFinite(price) || price < 0) {
    showError('profileFormError', 'Проверьте поля: название/жанр >= 2 символов, цена >= 0.');
    return;
  }

  const { ok, data } = await apiFetch('/api/beats', { // добавляем бит в базу данных
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, genre, price })
  });
  if (!ok) {
    showError('profileFormError', data.message || 'Ошибка создания курса.');
    return;
  }
  await render('/profile', true);
}

async function handleLikeOrFavorite(endpoint, beatId) {
  if (!isAuthenticated()) {
    showError('courseActionError', 'Для этой операции нужно войти в аккаунт.');
    return;
  }
  const { ok, data } = await apiFetch(`/api/beats/item/${beatId}/${endpoint}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!ok) {
    showError('courseActionError', data.message || 'Операция не выполнена.');
    return null;
  }
  if (endpoint === 'like') {
    const likeCount = document.getElementById('likeCount');
    if (likeCount) likeCount.textContent = String(data.likesCount || 0);
    courseActionState.liked = !!data.liked;
  }
  if (endpoint === 'favorite') {
    courseActionState.favorite = !!data.favorite;
  }
  updateCourseActionButtons();
  await refreshCourseDetailsInPlace();
  return data;
}

function attachHandlers(routeKey) {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleLoginSubmit(loginForm);
    });
  }

  const registerForm = document.getElementById('registerForm'); // добавляем обработчик нажатия на кнопку регистрации 
  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleRegisterSubmit(registerForm);
    });
  }

  const addBeatForm = document.getElementById('addBeatForm');
  if (addBeatForm) {
    addBeatForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleCreateBeat(addBeatForm);
    });
  }

  const filterForm = document.getElementById('catalogFilterForm'); // добавляем обработчик нажатия на кнопку фильтрации
  if (filterForm) {
    filterForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(filterForm);
      state.courseFilters.search = String(formData.get('search')).trim();
      state.courseFilters.genre = String(formData.get('genre')).trim();
      state.courseFilters.minPrice = String(formData.get('minPrice')).trim();
      state.courseFilters.maxPrice = String(formData.get('maxPrice')).trim();
      state.courseFilters.sort = String(formData.get('sort')).trim();
      state.courseFilters.page = 1;
      await render('/courses', true);
    });
  }

  const prevPageBtn = document.getElementById('prevPageBtn');
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', async () => {
      state.courseFilters.page = Math.max(1, state.courseFilters.page - 1);
      await render('/courses', true);
    });
  }
  const nextPageBtn = document.getElementById('nextPageBtn');
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', async () => {
      state.courseFilters.page += 1;
      await render('/courses', true);
    });
  }

  const likeBtn = document.getElementById('likeBtn'); // добавляем обработчик нажатия на кнопку лайка
  if (likeBtn) {
    likeBtn.addEventListener('click', async () => {
      await handleLikeOrFavorite('like', likeBtn.dataset.id); // добавляем лайк в базу данных
    });
  }
  const favoriteBtn = document.getElementById('favoriteBtn'); // добавляем обработчик нажатия на кнопку добавления в избранное
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', async () => {
      await handleLikeOrFavorite('favorite', favoriteBtn.dataset.id); // добавляем в избранное в базу данных
    });
  }
  const addToCheckoutBtn = document.getElementById('addToCheckoutBtn');
  if (addToCheckoutBtn) {
    addToCheckoutBtn.addEventListener('click', () => {
      const id = Number(addToCheckoutBtn.dataset.id);
      if (!state.checkoutCart.includes(id)) state.checkoutCart.push(id);
      setFlash('Курс добавлен в корзину оплаты.');
      render('/checkout', true);
    });
  }

  const checkoutSubmitBtn = document.getElementById('checkoutSubmitBtn');
  if (checkoutSubmitBtn) {
    checkoutSubmitBtn.addEventListener('click', async () => {
      const { ok, data } = await apiFetch('/api/beats/checkout/process', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: state.checkoutCart })
      });
      const msg = document.getElementById('checkoutMessage');
      if (!ok) {
        if (msg) msg.innerHTML = `<div class="error">${escapeHtml(data.message || 'Оплата не выполнена')}</div>`;
        return;
      }
      state.checkoutCart = [];
      if (msg) {
        msg.innerHTML = `
          <div class="success">
            ${escapeHtml(data.message || 'Оплата успешно выполнена')}. Куплено курсов: <strong>${Number(data.purchasedCount || 0)}</strong>.
            Сумма: <strong>${Number(data.totalAmount || 0).toFixed(2)} ₽</strong>
          </div>
        `;
      }
      await refreshHomeInPlace();
    });
  }

  if (routeKey === '/courses/:id') {
    syncNav('/courses');
  }
}

document.body.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-link]');
  if (!link) return;
  e.preventDefault();
  render(link.getAttribute('href'));
});

window.addEventListener('popstate', () => render(location.pathname, true));

const navLogoutBtn = document.getElementById('navLogoutBtn');
if (navLogoutBtn) {
  navLogoutBtn.addEventListener('click', async () => {
    await apiFetch(`${API_AUTH}/logout`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
    });
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
    state.checkoutCart = [];
    await render('/auth/login', true);
  });
}

window.addEventListener('storage', (event) => {
  if (event.key === 'token') {
    state.token = localStorage.getItem('token');
    state.user = null;
    syncNav(location.pathname);
  }
});

window.addEventListener('focus', () => {
  if (activeRouteKey === '/') {
    refreshHomeInPlace();
  }
  if (activeRouteKey === '/courses/:id') {
    refreshCourseDetailsInPlace();
  }
});

initRealtimeUpdates();
render(location.pathname || '/', true);