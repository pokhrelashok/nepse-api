const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || null,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: process.env.REDIS_PREFIX || 'nepse:',
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  logger.info('Connecting to Redis...');
});

redis.on('ready', () => {
  logger.info('Redis client ready.');
});

redis.on('error', (err) => {
  logger.error('Redis error:', err);
});

module.exports = redis;
