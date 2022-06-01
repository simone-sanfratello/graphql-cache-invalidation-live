'use strict'

const undici = require('undici')

async function request (query) {
  const response = await undici.request('http://localhost:3000/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query })
  })
  const r = (await response.body.json()).data
  console.dir(r)
  return r
}

module.exports = {
  request
}
