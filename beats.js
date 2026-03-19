const express = require('express');
const router = express.Router();
const db = require('./db');
const authMiddleware = require('./middleware');

// 1. ПОЛУЧИТЬ ВСЕ БИТЫ (Публичный эндпоинт)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Beats');
        res.json(rows);
    } catch (e) {
        res.status(500).json({ message: "Ошибка при получении битов" });
    }
});

// 2. ДОБАВИТЬ БИТ (Защищенный эндпоинт - только для залогиненных)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, price, genre } = req.body;
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