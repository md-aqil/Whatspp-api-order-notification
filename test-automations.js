import { queryMany } from './lib/mysql.js';

async function run() {
  try {
    const tables = await queryMany('SHOW TABLES');
    console.log(tables);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
