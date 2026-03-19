// Подключаем библиотеку mysql2
const mysql = require('mysql2');

// Подключаем dotenv, чтобы он прочитал данные из файла .env
require('dotenv').config();

// Создаем "пул" соединений.
const pool = mysql.createPool({
    host: process.env.DB_HOST,      // берет из .env
    user: process.env.DB_USER,      // берет из .env
    password: process.env.DB_PASSWORD, // берет из .env
    database: process.env.DB_NAME    // берет из .env
});

// Экспортируем пул, чтобы использовать его в других файлах (например, при регистрации)
// .promise() позволяет использовать современный синтаксис async/await (упрощает код)
module.exports = pool.promise();