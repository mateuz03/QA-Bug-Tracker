const { closeSync, existsSync, mkdirSync, openSync } = require('node:fs');
const { join } = require('node:path');

const prismaDirectory = join(__dirname, '..', 'prisma');
const databasePath = join(prismaDirectory, 'dev.db');

mkdirSync(prismaDirectory, { recursive: true });
if (!existsSync(databasePath)) {
  closeSync(openSync(databasePath, 'a'));
}
