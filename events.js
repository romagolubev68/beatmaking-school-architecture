const { EventEmitter } = require('events');

const appEvents = new EventEmitter();
let dataVersion = 1;

function broadcastDataChange(scope = 'global') {
  dataVersion += 1;
  appEvents.emit('data:changed', {
    scope,
    at: new Date().toISOString(),
    version: dataVersion
  });
}

function getDataVersion() {
  return dataVersion;
}

module.exports = {
  appEvents,
  broadcastDataChange,
  getDataVersion
};
