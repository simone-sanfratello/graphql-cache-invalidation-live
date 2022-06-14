'use strict'

const fastify = require('fastify')
const mercurius = require('mercurius')
const cache = require('mercurius-cache')
const Redis = require('ioredis')

const db = require('./lib/db')
const { request } = require('./lib/util')

async function main() {
  const app = fastify()

  const schema = `
  type User {
    id: ID
    name: String
  }
  
  type Query {
    getUser(id: ID): User
    getUsers: [User]
    getCountries: [String]
  }

  input UserInput {
    name: String
  }

  type Mutation {
    updateUser (id: ID, user: UserInput): User
  }
  `

  const resolvers = {
    Query: {
      getUser: (_, { id }) => db.users[id],
      getUsers: () => Object.values(db.users),
      getCountries: () => db.countries
    },
    Mutation: {
      updateUser: (_, { id, user }) => {
        db.users[id].name = user.name
        return db.users[id]
      }
    }
  }

  app.register(mercurius, { schema, resolvers })

  const client = new Redis()
  app.register(cache, {
    ttl: 120,
    storage: { type: 'redis', options: { client, invalidation: true } },
    policy: {
      Query: {
        getCountries: {
          ttl: 864000,
          storage: { type: 'memory' }
        },
        getUser: {
          references: (request, key, result) => {
            return [`user:${result.id}`]
          }
        },
        getUsers: {
          references: (request, key, result) => {
            return result.map(r => `user:${r.id}`)
          }
        }
      },
      Mutation: {
        updateUser: {
          invalidate: (_, { id }) => {
            return [`user:${id}`]
          }
        }
      }
    },

    onHit: (type, field) => { console.log('++++ HIT', type, field) },
    onMiss: (type, field) => { console.log('---- MISS', type, field) },
  })

  await app.listen(3000)

  await app.graphql.cache.clear()

  await request('{ getUser(id: "1") {name} }')
  await request('{ getUsers {id, name} }')
  await request('{ getCountries }')

  await request('{ getCountries }')

  await request('mutation { updateUser(id: "1", user: { name: "Alexandra" }) { name } }')

  await request('{ getUser(id: "1") {name} }')
  await request('{ getUsers {id, name} }')

  // await app.graphql.cache.invalidate('user:*')

  await client.end()
  await app.close()
}

main()
