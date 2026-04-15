const appEl = document.getElementById('app');
const API_AUTH = '/api/auth';
const PRIVATE_ROUTES = new Set(['/profile', '/dashboard', '/checkout']);
const state = {
  token: localStorage.getItem('token'),
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isAuthenticated() {
  return !!state.token;
}

function getAuthHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function apiFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    let payload = {};
    try {
      payload = await response.json();
    } catch (_) {
      payload = {};
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

function setFlash(message = '') {
  state.flash = message;
}

function syncNav(pathname = location.pathname) {
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

function cardBeat(beat, withDetails = true) {
  return `
    <article class="card">
      <h3>${escapeHtml(beat.title)}</h3>
      <p class="muted">Жанр: ${escapeHtml(beat.genre)}</p>
      <p class="muted">Автор: ${escapeHtml(beat.authorName || 'неизвестно')}</p>
      <p><strong>${Number(beat.price).toFixed(2)} ₽</strong></p>
      <p>Лайков: <strong>${beat.likesCount || 0}</strong></p>
      ${withDetails ? `<p><a data-link href="/courses/${beat.id}">Открыть</a></p>` : ''}
    </article>
  `;
}

async function renderHome() {
  appEl.innerHTML = '<div class="spinner">Загрузка главной страницы...</div>';
  const { ok, data } = await apiFetch('/api/home/summary');
  if (!ok) {
    appEl.innerHTML = '<div class="error">Не удалось загрузить главную страницу.</div>';
    return;
  }
  appEl.innerHTML = `
    <h2>Главная</h2>
    <div class="grid">
      <article class="card"><h3>${data.stats.usersCount}</h3><p class="muted">Пользователей</p></article>
      <article class="card"><h3>${data.stats.beatsCount}</h3><p class="muted">Битов в каталоге</p></article>
      <article class="card"><h3>${data.stats.favoritesCount}</h3><p class="muted">Добавлений в избранное</p></article>
    </div>
    <h3>Популярные курсы</h3>
    ${data.popular.length ? `<div class="grid">${data.popular.map((item) => cardBeat(item)).join('')}</div>` : '<p class="muted">Пока нет данных.</p>'}
  `;
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
            <h3>${escapeHtml(m.fullName)}</h3>
            <p>${escapeHtml(m.specialization)}</p>
            <p class="muted">${escapeHtml(m.bio)}</p>
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

async function ensureAuthUser() {
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
        <label>Поиск<input name="search" value="${escapeHtml(state.courseFilters.search)}" placeholder="Название бита" /></label>
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
    ${items.length ? `<div class="grid">${items.map((item) => cardBeat(item)).join('')}</div>` : '<p class="muted">Ничего не найдено.</p>'}
    <div class="pagination">
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
    <div class="form-row">
      <button class="btn" id="likeBtn" data-id="${beat.data.id}">Лайк / убрать лайк</button>
      <button class="btn" id="favoriteBtn" data-id="${beat.data.id}">В избранное / убрать</button>
      <button class="btn primary" id="addToCheckoutBtn" data-id="${beat.data.id}">Добавить к оплате</button>
    </div>
    <p><a data-link href="/courses">Назад к каталогу</a></p>
    <div id="courseActionError"></div>
  `;
}

async function renderProfile() {
  appEl.innerHTML = '<div class="spinner">Загрузка профиля...</div>';
  const me = await apiFetch(`${API_AUTH}/me`, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
  });
  if (!me.ok) {
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
    <h3>Создать контент</h3>
    <form id="addBeatForm">
      <div class="form-row">
        <label>Название<input name="title" required minlength="2" /></label>
        <label>Жанр<input name="genre" required minlength="2" /></label>
      </div>
      <div class="form-row">
        <label>Цена<input name="price" type="number" min="0" required /></label>
      </div>
      <button class="btn primary" type="submit">Добавить бит</button>
    </form>
    <div id="profileFormError"></div>
    <h3>Мои биты</h3>
    ${beats.length ? `<div class="grid">${beats.map((item) => cardBeat(item, false)).join('')}</div>` : '<p class="muted">У вас пока нет битов.</p>'}
  `;
}

async function renderDashboard() {
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
  const { ok, data } = await apiFetch(`/api/beats/by-ids/list?ids=${state.checkoutCart.join(',')}`);
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
    <button id="checkoutSubmitBtn" class="btn primary" ${data.length ? '' : 'disabled'}>Оплатить</button>
    <div id="checkoutMessage"></div>
  `;
}

function render404() {
  appEl.innerHTML = '<h2>404</h2><p>Страница не найдена.</p>';
}

function parseRoute(path) {
  if (path.startsWith('/courses/')) {
    return { key: '/courses/:id', params: { id: path.split('/')[2] } };
  }
  return { key: path, params: {} };
}

async function render(path, replace = false) {
  try {
    const targetPath = path || '/';
    const route = parseRoute(targetPath);
    const privateGuard = PRIVATE_ROUTES.has(route.key) || PRIVATE_ROUTES.has(targetPath);

    if (privateGuard && !(await ensureAuthUser())) {
      setFlash('Сначала войдите в аккаунт, чтобы открыть приватный раздел.');
      const redirected = '/auth/login';
      history.replaceState({}, '', redirected);
      syncNav(redirected);
      appEl.innerHTML = renderLogin();
      attachHandlers('/auth/login');
      return;
    }

    if ((targetPath === '/auth/login' || targetPath === '/auth/register') && (await ensureAuthUser())) {
      await render('/profile', true);
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

async function handleRegisterSubmit(form) {
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

async function handleCreateBeat(form) {
  const formData = new FormData(form);
  const title = String(formData.get('title')).trim();
  const genre = String(formData.get('genre')).trim();
  const price = Number(formData.get('price'));

  if (title.length < 2 || genre.length < 2 || !Number.isFinite(price) || price < 0) {
    showError('profileFormError', 'Проверьте поля: название/жанр >= 2 символов, цена >= 0.');
    return;
  }

  const { ok, data } = await apiFetch('/api/beats', {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, genre, price })
  });
  if (!ok) {
    showError('profileFormError', data.message || 'Ошибка создания контента.');
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
    return;
  }
  if (endpoint === 'like') {
    const likeCount = document.getElementById('likeCount');
    if (likeCount) likeCount.textContent = String(data.likesCount || 0);
  }
}

function attachHandlers(routeKey) {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await handleLoginSubmit(loginForm);
    });
  }

  const registerForm = document.getElementById('registerForm');
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

  const filterForm = document.getElementById('catalogFilterForm');
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

  const likeBtn = document.getElementById('likeBtn');
  if (likeBtn) {
    likeBtn.addEventListener('click', async () => {
      await handleLikeOrFavorite('like', likeBtn.dataset.id);
    });
  }
  const favoriteBtn = document.getElementById('favoriteBtn');
  if (favoriteBtn) {
    favoriteBtn.addEventListener('click', async () => {
      await handleLikeOrFavorite('favorite', favoriteBtn.dataset.id);
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
    checkoutSubmitBtn.addEventListener('click', () => {
      state.checkoutCart = [];
      const msg = document.getElementById('checkoutMessage');
      if (msg) msg.innerHTML = '<div class="success">Оплата успешно выполнена (демо-режим).</div>';
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
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
    state.checkoutCart = [];
    await render('/auth/login', true);
  });
}

render(location.pathname || '/', true);