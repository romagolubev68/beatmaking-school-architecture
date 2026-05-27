const { EventEmitter } = require('events'); // Импортируем EventEmitter из модуля events

const appEvents = new EventEmitter(); // Создаем экземпляр EventEmitter
let dataVersion = 1; // Версия данных

function broadcastDataChange(scope = 'global') { // Функция для отправки события о изменении данных
  dataVersion += 1; 
  appEvents.emit('data:changed', { // Отправляем событие о изменении данных
    scope, 
    at: new Date().toISOString(), // Время изменения
    version: dataVersion // Версия данных
  });
}

// Функция для получения версии данных
function getDataVersion() {
  return dataVersion;
}

// Экспортируем модуль
module.exports = {
  appEvents,
  broadcastDataChange,
  getDataVersion
};