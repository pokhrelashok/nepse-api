const crypto = require('crypto');

/**
 * Generate a v4 UUID
 * @returns {string} UUID string
 */
function generateUuid() {
  return crypto.randomUUID();
}

module.exports = {
  generateUuid
};
