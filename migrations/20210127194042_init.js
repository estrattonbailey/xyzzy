exports.up = async function(knex) {
  await knex.raw(`
    create table if not exists aliases (
      id serial primary key,
      target varchar(2000) not null,
      name varchar(64) unique not null,
      created_at timestamptz not null default now()
    );

    create table if not exists hits (
      id serial primary key,
      alias int,
      timestamp timestamptz not null default now(),
      constraint alias_relation foreign key(alias) references aliases(id)
    );
  `)
};

exports.down = async function(knex) {
  await knex.raw(`
    drop table aliases;
    drop table hits;
  `)
};
