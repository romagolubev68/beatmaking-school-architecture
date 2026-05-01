# BeatMaster Academy

SPA-приложение на JavaScript для обучения битмейкингу: каталог курсов, авторизация, личный кабинет, лайки, избранное, оплата (демо) и блок наставников.

## Production ссылки

- Frontend: `https://beatmaking-school-architecture-production.up.railway.app`
- Backend API: `https://beatmaking-school-architecture-production.up.railway.app/api/home/summary`

## Технологии

- Frontend: Vanilla JavaScript, HTML, CSS (без React)
- Backend: Node.js, Express
- База данных: MySQL (Railway) + `mysql2`
- Аутентификация: JWT + `bcrypt`
- Хостинг: Railway (frontend + backend + database)

## Ключевые возможности

- Регистрация, вход, выход (`logout`) и проверка текущего пользователя
- Каталог с поиском, фильтрацией, сортировкой и пагинацией
- Детальная страница курса с лайком/избранным
- Личный кабинет: создание собственных курсов (битов)
- Раздел "Мое обучение"
- Демо-корзина и страница оплаты
- 404 страница для несуществующих маршрутов
- Улучшенная обработка сетевых/серверных ошибок на клиенте
- Автообновление данных между открытыми окнами/браузерами через SSE

## API эндпоинты

### Auth

- `POST /api/auth/register` - регистрация
- `POST /api/auth/login` - вход, получение JWT
- `POST /api/auth/logout` - выход
- `GET /api/auth/me` - профиль текущего пользователя

### Beats / Courses

- `GET /api/beats` - каталог (query: `search`, `genre`, `minPrice`, `maxPrice`, `sort`, `page`, `limit`)
- `GET /api/beats/item/:id` - детали курса
- `POST /api/beats` - создание курса (private)
- `DELETE /api/beats/:id` - удаление своего курса (private)
- `GET /api/beats/my` - мои курсы (private)
- `POST /api/beats/item/:id/like` - лайк/дизлайк (private)
- `POST /api/beats/item/:id/favorite` - в избранное/убрать (private)
- `GET /api/beats/favorites/list` - избранное (private)
- `GET /api/beats/dashboard/summary` - данные "Мое обучение" (private)
- `GET /api/beats/by-ids/list?ids=1,2,3` - данные корзины для оплаты

### Other

- `GET /api/home/summary` - статистика и популярные курсы
- `GET /api/mentors` - список наставников
- `GET /api/events` - серверные события (живое обновление контента)

## Локальный запуск

1. Клонировать репозиторий:
   - `git clone <url-репозитория>`
   - `cd beatmaster-academy`
2. Установить зависимости:
   - `npm install`
3. Создать `.env` в корне проекта:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=beatmaster
JWT_SECRET=your_jwt_secret
```

4. Создать БД и применить миграции из папки `migrations`:
   - `001_create_users.sql`
   - `002_create_beats.sql`
   - `003_create_mentors.sql`
5. Запустить сервер:
   - `node index.js`
6. Открыть:
   - `http://localhost:5000`

## Страницы приложения

- `/` - главная
- `/courses` и `/courses/:id` - каталог и карточка курса
- `/mentors` - наставники с подробным портфолио
- `/auth/login`, `/auth/register` - авторизация
- `/profile`, `/dashboard`, `/checkout` - приватные разделы
- неизвестный маршрут - страница 404

## Скриншоты

Добавьте 3-5 скриншотов итогового интерфейса в репозиторий, например в `docs/screenshots/`:

- `home.png` - главная
- `catalog.png` - каталог
- `profile.png` - личный кабинет
- `mentors.png` - наставники
- `checkout.png` - оплата
