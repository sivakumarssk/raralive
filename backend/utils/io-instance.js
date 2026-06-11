// Shared io instance — set once in server.js after setupSocket(), used in controllers
let _io = null;
module.exports = {
  set(io) { _io = io; },
  get() { return _io; },
};
