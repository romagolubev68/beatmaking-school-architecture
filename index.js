const express = require('express'); // Подключаем фреймворк для сервера
const cors = require('cors');       // Разрешаем запросы с других адресов (важно для фронтенда)
const authMiddleware = require('./middleware');
const db = require('./db');
const beatsRoutes = require('./beats');
const path = require('path');
require('dotenv').config();         // Снова подключаем конфиг

const app = express();

// Middleware 
app.use(cors());             // Включаем CORS
app.use(express.json());     // "Ты должен понимать данные в формате JSON"

app.use(express.static('public'));

const authRoutes = require('./auth'); // Импортируем наш новый файл
app.use('/api/auth', authRoutes);     // Все маршруты из auth.js будут начинаться с /api/auth

app.use('/api/beats', beatsRoutes);

// Настраиваем порт (5000 или тот, что в .env)
const PORT = process.env.PORT || 5000;

// Это "эндпоинт" (маршрут) для проверки, что сервер работает
app.get('/', (req, res) => {
    res.json({ message: "Сервер BeatMaster Academy работает!" });
});

// Маршрут получения профиля (доступен только с токеном)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const [users] = await db.query("SELECT id, name, email FROM Users WHERE id = ?", [req.user.userId]);
        res.json(users[0]);
    } catch (e) {
        res.status(500).json({ message: "Ошибка при получении профиля" });
    }
});

// Запускаем прослушивание порта
app.listen(PORT, () => {
    console.log(`>>> Сервер запущен на порту ${PORT}`);
    console.log(`>>> Ссылка: http://localhost:${PORT}`);
});

// Роут для страницы входа
app.get('/auth/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Роут для страницы регистрации
app.get('/auth/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Роут для страницы профиля (чтобы работала ссылка /profile)
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});
