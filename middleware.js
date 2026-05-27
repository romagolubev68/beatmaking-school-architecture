const jwt = require('jsonwebtoken'); // Для работы с JWT
require('dotenv').config();

module.exports = (req, res, next) => {
    try {
        // Ищем токен в заголовках запроса
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null; // получаем токен из заголовка
        if (!token) {
            return res.status(401).json({ message: "Вы не авторизованы. Передайте Bearer token." });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // декодируем токен
        req.user = decoded; // Сохраняем ID юзера из токена
        next(); // Пропускаем к следующей функции
    } catch (e) {
        res.status(401).json({ message: "Вы не авторизованы! Токен неверный или отсутствует." });
    }
};