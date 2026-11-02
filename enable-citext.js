require('dotenv/config');
const { PrismaClient } = require('./prisma/generated/client/client');
const c = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
(async () => {
  try {
    await c.$executeRaw`CREATE EXTENSION IF NOT EXISTS citext`;
    console.log('citext enabled');
  } catch (e) {
    console.error('citext fail:', e.message);
  } finally {
    await c.$disconnect();
  }
})();
