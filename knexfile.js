module.exports = {
  development: {
    client: 'pg',
    connection: 'postgresql://xyzzy:xyzzy@0.0.0.0:4001/xyzzy',
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'xyzzy_dev_migrations'
    }
  },
};
