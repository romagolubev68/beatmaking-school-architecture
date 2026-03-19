const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

// 1. РЕГИСТРАЦИЯ: POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ message: "Заполните все поля" });
        }

        // Шифруем пароль
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Сохраняем в MySQL
        const sql = "INSERT INTO Users (email, passwordHash, name) VALUES (?, ?, ?)";
        await db.query(sql, [email, passwordHash, name]);

        res.status(201).json({ message: "Пользователь успешно зарегистрирован!" });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: "Этот email уже занят" });
        }
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
});

// 2. ВХОД (ЛОГИН): POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Ищем юзера по email
        const [users] = await db.query("SELECT * FROM Users WHERE email = ?", [email]);
        const user = users[0];

        if (!user) {
            return res.status(400).json({ message: "Пользователь не найден" });
        }

        // Сравниваем введенный пароль с тем, что в базе (хэшем)
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ message: "Неверный пароль" });
        }

        // Создаем JWT токен (ключ доступа)
        // Он будет действовать 1 час
        const token = jwt.sign(
            { userId: user.id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        );

        res.json({ 
            token, 
            message: "Вход выполнен успешно!",
            user: { id: user.id, name: user.name, email: user.email }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
});

module.exports = router;