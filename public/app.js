const appEl = document.getElementById('app');
const API_URL = '/api/auth';

function isAuthenticated() {
  return !!localStorage.getItem('token');
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function syncNav() {
  const logged = isAuthenticated();
  const navLogin = document.getElementById('navLogin');
  const navRegister = document.getElementById('navRegister');
  const navLogoutBtn = document.getElementById('navLogoutBtn');

  if (navLogin) navLogin.style.display = logged ? 'none' : '';
  if (navRegister) navRegister.style.display = logged ? 'none' : '';
  if (navLogoutBtn) navLogoutBtn.style.display = logged ? '' : 'none';
}

const pages = {
  '/': () => '<h2>Главная</h2><p>Добро пожаловать в приложение SPA (без перезагрузки).</p>',
  '/auth/login': () => `
    <h2>Вход</h2>
    <form id="loginForm">
      <label>email:<br><input name="email" type="email" required></label><br><br>
      <label>пароль:<br><input name="password" type="password" required></label><br><br>
      <button type="submit">Войти</button>
    </form>
    <p><small>Нет аккаунта? <a data-link href="/auth/register">Зарегистрируйтесь</a>.</small></p>
  `,
  '/auth/register': () => `
    <h2>Регистрация</h2>
    <form id="registerForm">
      <label>имя:<br><input name="name" required></label><br><br>
      <label>email:<br><input name="email" type="email" required></label><br><br>
      <label>пароль:<br><input name="password" type="password" required></label><br><br>
      <label>повторите пароль:<br><input name="password2" type="password" required></label><br><br>
      <button type="submit">Зарегистрироваться</button>
    </form>
    <p><small>Уже есть аккаунт? <a data-link href="/auth/login">Войти</a>.</small></p>
  `,
  '/profile': async () => {
    try {
      const resp = await fetch(`${API_URL}/me`, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      });

      if (!resp.ok) {
        localStorage.removeItem('token');
        await render('/auth/login');
        return null;
      }

      const user = await resp.json();
      return `
        <h2>Профиль</h2>
        <p><strong>Имя:</strong> ${user.name}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>ID:</strong> ${user.id}</p>

        <h3>Мои биты</h3>
        <form id="addBeatForm">
          <label>Название битa:<br><input name="title" required></label><br><br>
          <label>Цена:<br><input name="price" type="number" min="0" step="0.01" required></label><br><br>
          <label>Жанр:<br><input name="genre" required></label><br><br>
          <button type="submit">Добавить бит</button>
        </form>

        <div id="beatsList"><em>Загрузка битов...</em></div>
      `;
    } catch (error) {
      console.error(error);
      localStorage.removeItem('token');
      await render('/auth/login');
      return null;
    }
  }
};

async function render(path) {
  const logged = isAuthenticated();
  let finalPath = path;
  let replace = false;

  // Guard: если уже залогинен — нельзя сидеть на /auth/login и /auth/register
  if (logged && (path === '/auth/login' || path === '/auth/register')) {
    finalPath = '/profile';
    replace = true;
  }

  // Guard: если нет токена — нельзя открыть /profile
  if (!logged && path === '/profile') {
    finalPath = '/auth/login';
    replace = true;
  }

  if (replace) {
    history.replaceState({}, '', finalPath);
  } else {
    history.pushState({}, '', finalPath);
  }

  syncNav();

  const renderer = pages[finalPath];
  if (!renderer) {
    appEl.innerHTML = '<h2>404</h2><p>Страница не найдена</p>';
    return;
  }

  const content = typeof renderer === 'function' ? await renderer() : renderer;
  if (content === null) return;

  appEl.innerHTML = content;

  document.querySelectorAll('a[data-link]').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === finalPath);
  });

  attachForms();
}

async function loadBeats() {
  const listEl = document.getElementById('beatsList');
  if (!listEl) return;

  try {
    const resp = await fetch('/api/beats/my', { headers: getAuthHeaders() });
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        await render('/auth/login');
        return;
      }
      listEl.innerHTML = '<p>Не удалось загрузить биты</p>';
      return;
    }

    const beats = await resp.json();
    if (!beats.length) {
      listEl.innerHTML = '<p>Пока нет ваших битов.</p>';
      return;
    }

    listEl.innerHTML = `<ul>${beats.map(b => `<li><strong>${b.title}</strong> ${b.genre} ${b.price} <button data-delete-id="${b.id}">Удалить</button></li>`).join('')}</ul>`;
  } catch (e) {
    listEl.innerHTML = '<p>Ошибка при загрузке битов.</p>';
  }
}

async function attachForms() {
  const lf = document.getElementById('loginForm');
  if (lf) {
    lf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(lf);
      const email = formData.get('email');
      const password = formData.get('password');

      const resp = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await resp.json();
      if (!resp.ok) {
        alert(data.message || 'Ошибка входа');
        return;
      }

      localStorage.setItem('token', data.token);
      await render('/profile');
    });
  }

  const rf = document.getElementById('registerForm');
  if (rf) {
    rf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(rf);
      const name = formData.get('name');
      const email = formData.get('email');
      const password = formData.get('password');
      const password2 = formData.get('password2');

      if (password !== password2) {
        alert('Пароли не совпадают');
        return;
      }

      const resp = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await resp.json();
      if (!resp.ok) {
        alert(data.message || 'Ошибка регистрации');
        return;
      }

      alert('Регистрация успешна, теперь войдите');
      await render('/auth/login');
    });
  }

  const addBeatForm = document.getElementById('addBeatForm');
  if (addBeatForm) {
    addBeatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(addBeatForm);
      const title = formData.get('title');
      const price = formData.get('price');
      const genre = formData.get('genre');

      try {
        const resp = await fetch('/api/beats', {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, price, genre })
        });

        const data = await resp.json();
        if (!resp.ok) {
          alert(data.message || 'Ошибка добавления бита');
          return;
        }

        alert('Бит добавлен');
        addBeatForm.reset();
        await loadBeats();
      } catch (error) {
        alert('Ошибка сети при добавлении бита');
        console.error(error);
      }
    });
  }

  const beatsList = document.getElementById('beatsList');
  if (beatsList) {
    beatsList.addEventListener('click', async (e) => {
      const deleteId = e.target.dataset.deleteId;
      if (!deleteId) return;

      if (!confirm('Удалить бит?')) return;

      try {
        const resp = await fetch(`/api/beats/${deleteId}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });

        const data = await resp.json();
        if (!resp.ok) {
          alert(data.message || 'Ошибка удаления');
          return;
        }

        alert('Бит удален');
        await loadBeats();
      } catch (error) {
        alert('Ошибка сети при удалении');
        console.error(error);
      }
    });
  }

  if (location.pathname === '/profile') {
    await loadBeats();
  }
}

document.body.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-link]');
  if (!link) return;
  e.preventDefault();
  render(link.getAttribute('href'));
});

window.addEventListener('popstate', () => render(location.pathname));

const navLogoutBtn = document.getElementById('navLogoutBtn');
if (navLogoutBtn) {
  navLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    render('/auth/login');
  });
}

syncNav();
render(location.pathname === '/' ? '/' : location.pathname);

