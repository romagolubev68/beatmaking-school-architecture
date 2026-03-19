const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
    try {
        // Ищем токен в заголовках запроса
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Сохраняем ID юзера из токена
        next(); // Пропускаем к следующей функции
    } catch (e) {
        res.status(401).json({ message: "Вы не авторизованы! Токен неверный или отсутствует." });
    }
};