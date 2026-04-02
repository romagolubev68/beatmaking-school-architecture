const express = require('express');
const router = express.Router();
const db = require('./db');
const authMiddleware = require('./middleware');

function validateBeatPayload(payload = {}) {
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

// 1. ПОЛУЧИТЬ ВСЕ БИТЫ (Публичный эндпоинт)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Beats');
        res.json(rows);
    } catch (e) {
        res.status(500).json({ message: "Ошибка при получении битов" });
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

// 2. ДОБАВИТЬ БИТ (Защищенный эндпоинт - только для залогиненных)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const validationError = validateBeatPayload(req.body);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const title = String(req.body.title).trim();
        const genre = String(req.body.genre).trim();
        const price = Number(req.body.price);
        const sql = "INSERT INTO Beats (title, price, genre, userId) VALUES (?, ?, ?, ?)";
        await db.query(sql, [title, price, genre, req.user.userId]);
        
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
        res.json({ message: "Бит успешно удален!" });
    } catch (e) {
        res.status(500).json({ message: "Ошибка при удалении" });
    }
});

module.exports = router;