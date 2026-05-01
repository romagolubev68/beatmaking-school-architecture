const express = require('express');
const router = express.Router();
const db = require('./db');
const authMiddleware = require('./middleware');
const { broadcastDataChange } = require('./events');

function validateBeatPayload(payload = {}) { // Проверяем, что в запросе есть все нужные поля и они корректные
    const { title, price, genre } = payload;

    if (!title || !genre || price === undefined || price === null || price === '') {
        return "Поля title, price и genre обязательны";
    }

    if (String(title).trim().length < 2) {
        return "Название должно быть не короче 2 символов";
    }

    if (String(genre).trim().length < 2) {
        return "Жанр должен быть не короче 2 символов";
    }

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return "Цена должна быть корректным числом больше либо равным 0";
    }

    return null;
}

function normalizePagination(query = {}) { // пагинация (ограничиваем количество записей на странице)
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(20, Math.max(1, Number.parseInt(query.limit, 10) || 6));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

function buildSort(sort = '') { 
    switch (sort) {
        case 'title_asc':
            return 'b.title ASC';
        case 'price_asc':
            return 'b.price ASC';
        case 'price_desc':
            return 'b.price DESC';
        case 'likes_desc':
            return 'likesCount DESC, b.createdAt DESC';
        default:
            return 'b.createdAt DESC';
    }
}

// 1. ПОЛУЧИТЬ КАТАЛОГ БИТОВ (публично, c поиском/фильтрами/сортировкой/пагинацией)
router.get('/', async (req, res) => { // получаем биты из базы данных
    try {
        const { search = '', genre = '', minPrice = '', maxPrice = '', sort = 'newest' } = req.query;
        const { page, limit, offset } = normalizePagination(req.query);

        const where = [];
        const params = [];

        if (search) {
            where.push('b.title LIKE ?');
            params.push(`%${String(search).trim()}%`);
        }
        if (genre) {
            where.push('b.genre = ?');
            params.push(String(genre).trim());
        }
        if (minPrice !== '') {
            where.push('b.price >= ?');
            params.push(Number(minPrice) || 0);
        }
        if (maxPrice !== '') {
            where.push('b.price <= ?');
            params.push(Number(maxPrice) || 0);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''; 
        const orderBy = buildSort(String(sort));

        const [rows] = await db.query( 
            `
            SELECT
                b.id,
                b.title,
                b.genre,
                b.price,
                b.userId,
                b.createdAt,
                u.name AS authorName,
                COUNT(DISTINCT bl.id) AS likesCount
            FROM Beats b
            LEFT JOIN Users u ON u.id = b.userId
            LEFT JOIN BeatLikes bl ON bl.beatId = b.id
            ${whereSql}
            GROUP BY b.id, b.title, b.genre, b.price, b.userId, b.createdAt, u.name
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
            `,
            [...params, limit, offset]
        );

        const [countRows] = await db.query( // получаем количество битов
            `
            SELECT COUNT(*) AS total
            FROM Beats b
            ${whereSql}
            `,
            params
        );

        const total = countRows[0]?.total || 0; 
        const totalPages = Math.max(1, Math.ceil(total / limit));

        res.json({ // возвращаем биты и пагинацию
            items: rows,
            pagination: { page, limit, total, totalPages }
        });
    } catch (e) { 
        res.status(500).json({ message: "Ошибка при получении битов" });
    }
});

// 1.0. ПОЛУЧИТЬ БИТЫ ПО СПИСКУ ID (для checkout)
router.get('/by-ids/list', async (req, res) => {
    try {
        const rawIds = String(req.query.ids || '')
            .split(',')
            .map((item) => Number(item))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (!rawIds.length) {
            return res.json([]);
        }

        const placeholders = rawIds.map(() => '?').join(', ');
        const [rows] = await db.query(
            `
            SELECT b.id, b.title, b.genre, b.price, b.createdAt, u.name AS authorName
            FROM Beats b
            LEFT JOIN Users u ON u.id = b.userId
            WHERE b.id IN (${placeholders})
            ORDER BY b.createdAt DESC
            `,
            rawIds
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ message: "Ошибка загрузки данных для оплаты" });
    }
});

// 1.1. ПОЛУЧИТЬ СВОИ БИТЫ (Приватный эндпоинт)
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await db.query('SELECT * FROM Beats WHERE userId = ?', [userId]);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ message: "Ошибка при получении ваших битов" });
    }
});

// 1.2. ЛАЙК / СНЯТИЕ ЛАЙКА
router.post('/item/:id/like', authMiddleware, async (req, res) => {
    try {
        const beatId = Number(req.params.id);
        const userId = req.user.userId; // получаем id пользователя из токена
        const [beats] = await db.query('SELECT id FROM Beats WHERE id = ?', [beatId]);
        if (!beats.length) {
            return res.status(404).json({ message: "Бит не найден" });
        }

        const [existing] = await db.query( // проверяем, есть ли лайк на этот бит у этого пользователя
            'SELECT id FROM BeatLikes WHERE beatId = ? AND userId = ?',
            [beatId, userId]
        );

        let liked;
        if (existing.length) { // если лайк существует, то удаляем его
            await db.query('DELETE FROM BeatLikes WHERE beatId = ? AND userId = ?', [beatId, userId]);
            liked = false;
        } else { // если лайк не существует, то добавляем его
            await db.query('INSERT INTO BeatLikes (beatId, userId) VALUES (?, ?)', [beatId, userId]);
            liked = true; 
        }

        const [countRows] = await db.query( // получаем количество лайков на этот бит
            'SELECT COUNT(*) AS likesCount FROM BeatLikes WHERE beatId = ?',
            [beatId]
        );
        broadcastDataChange('likes');
        res.json({ liked, likesCount: countRows[0]?.likesCount || 0 });
    } catch (e) {
        res.status(500).json({ message: "Ошибка при обновлении лайка" });
    }
});

// 1.3. ИЗБРАННОЕ / УДАЛЕНИЕ ИЗ ИЗБРАННОГО
router.post('/item/:id/favorite', authMiddleware, async (req, res) => {
    try {
        const beatId = Number(req.params.id); 
        const userId = req.user.userId; // получаем id пользователя из токена
        const [beats] = await db.query('SELECT id FROM Beats WHERE id = ?', [beatId]); // проверяем, существует ли бит
        if (!beats.length) {
            return res.status(404).json({ message: "Бит не найден" });
        }

        const [existing] = await db.query( // проверяем, есть ли избранное на этот бит у этого пользователя
            'SELECT id FROM BeatFavorites WHERE beatId = ? AND userId = ?',
            [beatId, userId]
        );

        let favorite;
        if (existing.length) {
            await db.query('DELETE FROM BeatFavorites WHERE beatId = ? AND userId = ?', [beatId, userId]);
            favorite = false;
        } else {
            await db.query('INSERT INTO BeatFavorites (beatId, userId) VALUES (?, ?)', [beatId, userId]);
            favorite = true;
        }

        broadcastDataChange('favorites');
        res.json({ favorite });
    } catch (e) {
        res.status(500).json({ message: "Ошибка при обновлении избранного" });
    }
});

// 1.4. МОЕ ОБУЧЕНИЕ / DASHBOARD (приватно)
router.get('/dashboard/summary', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await db.query(
            `
            SELECT
                b.id,
                b.title,
                b.genre,
                b.price,
                b.createdAt,
                CASE WHEN bf.id IS NULL THEN 0 ELSE 1 END AS inFavorites,
                COUNT(DISTINCT bl.id) AS likesCount
            FROM Beats b
            LEFT JOIN BeatFavorites bf ON bf.beatId = b.id AND bf.userId = ?
            LEFT JOIN BeatLikes bl ON bl.beatId = b.id
            WHERE b.userId = ? OR bf.id IS NOT NULL
            GROUP BY b.id, b.title, b.genre, b.price, b.createdAt, bf.id
            ORDER BY b.createdAt DESC
            `,
            [userId, userId]
        );

        res.json({ // возвращаем биты и статистику
            items: rows,
            stats: {
                totalItems: rows.length,
                ownBeats: rows.filter((row) => row.inFavorites === 0).length,
                favorites: rows.filter((row) => row.inFavorites === 1).length
            }
        });
    } catch (e) {
        res.status(500).json({ message: "Ошибка загрузки дашборда" });
    }
});

// 1.5. МОЕ ИЗБРАННОЕ (приватно)
router.get('/favorites/list', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId; // получаем id пользователя из токена
        const [rows] = await db.query(
            `
            SELECT b.id, b.title, b.genre, b.price, b.createdAt
            FROM BeatFavorites bf
            JOIN Beats b ON b.id = bf.beatId
            WHERE bf.userId = ?
            ORDER BY bf.createdAt DESC
            `,
            [userId]
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ message: "Ошибка загрузки избранного" });
    }
});

// 1.6. ПОЛУЧИТЬ ДЕТАЛИ БИТА
router.get('/item/:id', async (req, res) => {
    try {
        const beatId = Number(req.params.id);
        if (!Number.isInteger(beatId) || beatId <= 0) { // проверяем, является ли id бита целым числом и больше 0
            return res.status(400).json({ message: "Некорректный id бита" });
        }

        const [rows] = await db.query( // получаем бит по id
            `
            SELECT
                b.id,
                b.title,
                b.genre,
                b.price,
                b.userId,
                b.createdAt,
                u.name AS authorName,
                COUNT(DISTINCT bl.id) AS likesCount
            FROM Beats b
            LEFT JOIN Users u ON u.id = b.userId
            LEFT JOIN BeatLikes bl ON bl.beatId = b.id
            WHERE b.id = ?
            GROUP BY b.id, b.title, b.genre, b.price, b.userId, b.createdAt, u.name
            `,
            [beatId]
        );

        const beat = rows[0];
        if (!beat) {
            return res.status(404).json({ message: "Бит не найден" });
        }

        res.json(beat);
    } catch (e) {
        res.status(500).json({ message: "Ошибка при получении бита" });
    }
});

// 1.7. СОСТОЯНИЕ ЛАЙКА/ИЗБРАННОГО ДЛЯ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ
router.get('/item/:id/state', authMiddleware, async (req, res) => {
    try {
        const beatId = Number(req.params.id);
        const userId = req.user.userId;
        if (!Number.isInteger(beatId) || beatId <= 0) {
            return res.status(400).json({ message: "Некорректный id бита" });
        }

        const [[likeRow]] = await db.query(
            'SELECT id FROM BeatLikes WHERE beatId = ? AND userId = ? LIMIT 1',
            [beatId, userId]
        );
        const [[favoriteRow]] = await db.query(
            'SELECT id FROM BeatFavorites WHERE beatId = ? AND userId = ? LIMIT 1',
            [beatId, userId]
        );

        res.json({
            liked: !!likeRow,
            favorite: !!favoriteRow
        });
    } catch (e) {
        res.status(500).json({ message: "Ошибка получения состояния действий" });
    }
});


// 2. ДОБАВИТЬ БИТ (Защищенный эндпоинт - только для залогиненных)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const validationError = validateBeatPayload(req.body); // проверяем, что в запросе есть все нужные поля и они корректные
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const title = String(req.body.title).trim(); // получаем название бита
        const genre = String(req.body.genre).trim();
        const price = Number(req.body.price);
        const sql = "INSERT INTO Beats (title, price, genre, userId) VALUES (?, ?, ?, ?)"; // добавляем бит в базу данных
        await db.query(sql, [title, price, genre, req.user.userId]);
        broadcastDataChange('beats');
        
        res.status(201).json({ message: "Бит успешно добавлен!" });
    } catch (e) {
        res.status(500).json({ message: "Ошибка при создании бита" });
    }
});

// 3. УДАЛИТЬ БИТ (Защищенный эндпоинт: DELETE /api/beats/:id)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const beatId = req.params.id; 
        const userId = req.user.userId;

        // Проверяем, принадлежит ли бит этому пользователю
        const [beat] = await db.query("SELECT * FROM Beats WHERE id = ? AND userId = ?", [beatId, userId]);
        
        if (beat.length === 0) { 
            return res.status(403).json({ message: "У вас нет прав на удаление этого бита" });
        }

        await db.query("DELETE FROM Beats WHERE id = ?", [beatId]);
        broadcastDataChange('beats');
        res.json({ message: "Бит успешно удален!" });
    } catch (e) {
        res.status(500).json({ message: "Ошибка при удалении" });
    }
});

module.exports = router; // Экспортируем роутер, чтобы использовать его в index.js