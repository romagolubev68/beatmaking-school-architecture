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

app.get('/api/home/summary', async (req, res) => {
    try {
        const [popularRows] = await db.query(
            `
            SELECT
                b.id,
                b.title,
                b.genre,
                b.price,
                u.name AS authorName,
                COUNT(DISTINCT bl.id) AS likesCount
            FROM Beats b
            LEFT JOIN Users u ON u.id = b.userId
            LEFT JOIN BeatLikes bl ON bl.beatId = b.id
            GROUP BY b.id, b.title, b.genre, b.price, u.name
            ORDER BY likesCount DESC, b.createdAt DESC
            LIMIT 3
            `
        );

        const [statsRows] = await db.query(
            `
            SELECT
                (SELECT COUNT(*) FROM Users) AS usersCount,
                (SELECT COUNT(*) FROM Beats) AS beatsCount,
                (SELECT COUNT(*) FROM BeatFavorites) AS favoritesCount
            `
        );

        res.json({
            popular: popularRows,
            stats: statsRows[0] || { usersCount: 0, beatsCount: 0, favoritesCount: 0 }
        });
    } catch (e) {
        res.status(500).json({ message: "Ошибка загрузки главной страницы" });
    }
});

app.get('/api/mentors', async (req, res) => {
    try {
        const [rows] = await db.query(
            `
            SELECT id, fullName, specialization, bio, portfolioUrl
            FROM Mentors
            ORDER BY id ASC
            `
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ message: "Ошибка загрузки наставников" });
    }
});

// Настраиваем порт (5000 или тот, что в .env)
const PORT = process.env.PORT || 5000;

// Это "эндпоинт" (маршрут) для SPA: отдаём один HTML, дальше роутит фронтенд
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Маршрут получения профиля (доступен только с токеном)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const [users] = await db.query("SELECT id, name, email, createdAt FROM Users WHERE id = ?", [req.user.userId]);
        res.json(users[0]);
    } catch (e) {
        res.status(500).json({ message: "Ошибка при получении профиля" });
    }
});

// Далее: для всех не-API маршрутов отдаём index.html (SPA)
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запускаем прослушивание порта
app.listen(PORT, () => {
    console.log(`>>> Сервер запущен на порту ${PORT}`);
    console.log(`>>> Ссылка: http://localhost:${PORT}`);
});
