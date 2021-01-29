const err = require('http-errors')
const { send, json } = require('micro')
const { router, get, post } = require('microrouter')
const { customAlphabet } = require('nanoid')
const { sql, createPool } = require('slonik')
const { Box, flush } = require('hypobox')
const { document } = require('presta/document')

const { NODE_ENV = 'development' } = process.env
const PROD = NODE_ENV === 'production'
const URL = PROD ? 'https://xyzzy.to/' : 'http://localhost:4000/'

const { connection } = require('./knexfile')[NODE_ENV]
const db = createPool(connection)

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz123456789', 16)

const script = `
!(function() {
  var form = document.getElementsByTagName('form')[0]

  form.onsubmit = function (e) {
    e.preventDefault()

    fetch(form.action, {
      method: form.method,
      body: JSON.stringify({
        target: e.target.elements.target.value,
        name: e.target.elements.name.value,
      })
    })
      .then(res => res.json())
      .then(res => {
        prompt('Copy below', res.alias)
      })
  }
})()
`

function prune (src) {
  let obj = Object.assign({}, src)

  for (let key in obj) {
    if (!obj[key]) {
      delete obj[key]
    }
  }

  return obj
}

function error(res, {
  status = 500,
  details,
  title,
  code,
}) {
  send(res, status, {
    errors: [
      prune({
        status: status,
        code,
        title,
        details,
      })
    ]
  })
}

function h(as, props, children) {
  return Box({
    as,
    ...props,
    children
  })
}

function home () {
  return h('main', {
    f: true,
    aic: true,
    jcc: true,
    w: true,
    py: 16
  }, [
    h('div', {}, [
      h('form', {
        action: '/api/alias',
        method: 'POST',
      }, [
        h('input', {
          name: 'target',
          placeholder: 'URL'
        }),
        h('input', {
          name: 'name',
          placeholder: 'name'
        }),
        h('button', {
          type: 'submit',
        }, 'Create')
      ])
    ])
  ])
}

require('http').createServer(async (req, res) => {
  try {
    await router(
      post('/api/alias', async (req, res) => {
        const { url } = req
        const [ path, search ] = url.split('?')
        const {
          target,
          name = nanoid()
        } = await json(req)

        if (!target) {
          return error(res, {
            status: 400,
            details: `Please provide a 'target' property.`
          })
        }

        try {
          const alias = await db.query(sql`
            insert into aliases (target, name) values (
              ${target},
              ${name}
            ) returning name;
          `);

          const { name: n } = alias.rows[0]

          send(res, 201, {
            alias: URL + n
          })
        } catch (e) {
          if (e.name === 'UniqueIntegrityConstraintViolationError') {
            return error(res, {
              status: 400,
              details: `Alias name '${name}' is alread in use.`
            })
          }

          console.error(e)

          error(res, {
            status: 500,
          })
        }
      }),
      get('/:name/stats', async (req, res) => {
        const hits = await db.query(sql`
          select timestamp from hits where alias = (select id from aliases where name = ${req.params.name});
        `)

        send(res, 200, {
          url: req.url.split('/stats')[0],
          hits: hits.rowCount,
        })
      }),
      get('/', async (req, res) => {
        const body = home()
        const css = flush()
        send(res, 200, document({
          head: {
            title: 'xyzzy',
            link: [ { rel: 'stylesheet', href: 'https://unpkg.com/svbstrate@4.1.2/dist/svbstrate.css' } ],
            style: [ { children: css } ],
          },
          body,
          foot: {
            script: [ { children: script } ],
          }
        }))
      }),
      get('/:name', async (req, res) => {
        const alias = await db.query(sql`
          select id, target from aliases where name = ${req.params.name};
        `)
        const { id, target } = alias.rows[0] || {}

        // throw to outer
        if (!target) {
          throw err(404)
        }

        // don't wait
        db.query(sql`
          insert into hits (alias) values (${id})
        `)

        res.writeHead(PROD ? 301 : 302, {
          'location': target
        })
        res.end()
      }),
    )(req, res)
  } catch (e) {
    console.log(e)
    send(res, 404)
  }
}).listen(4000, () => {
  console.log('up - localhost:4000')
})
