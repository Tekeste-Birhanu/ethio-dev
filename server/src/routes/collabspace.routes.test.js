import assert from 'node:assert/strict'
import test from 'node:test'
import { createDeleteCollabspaceHandler, createRenameCollabspaceHandler } from './collabspace.routes.js'

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    ended: false,
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(body) {
      this.body = body
      return this
    },
    end() {
      this.ended = true
      return this
    },
  }
}

test('deleting a Collabspace is restricted to its active Owner', async () => {
  let query
  let transactionOptions
  const database = {
    async $transaction(callback, options) {
      transactionOptions = options
      return callback({
        workspace: {
          async deleteMany(args) {
            query = args
            return { count: 1 }
          },
        },
      })
    },
  }
  const response = createResponse()

  await createDeleteCollabspaceHandler(database)(
    { params: { id: 'space-1' }, auth: { user: { id: 'owner-1' } } },
    response,
  )

  assert.equal(response.statusCode, 204)
  assert.equal(response.ended, true)
  assert.deepEqual(query.where.memberships.some, {
    userId: 'owner-1',
    role: 'OWNER',
    status: 'ACTIVE',
  })
  assert.equal(transactionOptions.isolationLevel, 'Serializable')
})

test('non-owners cannot delete a Collabspace', async () => {
  const database = {
    async $transaction(callback) {
      return callback({ workspace: { async deleteMany() { return { count: 0 } } } })
    },
  }
  const response = createResponse()

  await createDeleteCollabspaceHandler(database)(
    { params: { id: 'space-1' }, auth: { user: { id: 'admin-1' } } },
    response,
  )

  assert.equal(response.statusCode, 404)
  assert.equal(response.body.error.code, 'COLLABSPACE_NOT_FOUND')
})

test('concurrent Collabspace changes return a retryable conflict', async () => {
  const database = {
    async $transaction() {
      throw { code: 'P2034' }
    },
  }
  const response = createResponse()

  await createDeleteCollabspaceHandler(database)(
    { params: { id: 'space-1' }, auth: { user: { id: 'owner-1' } } },
    response,
  )

  assert.equal(response.statusCode, 409)
  assert.equal(response.body.error.code, 'COLLABSPACE_CHANGED')
})

test('renaming a Collabspace trims the name and is restricted to its active Owner', async () => {
  let query
  let transactionOptions
  const database = {
    async $transaction(callback, options) {
      transactionOptions = options
      return callback({
        workspace: {
          async updateMany(args) {
            query = args
            return { count: 1 }
          },
        },
      })
    },
  }
  const response = createResponse()

  await createRenameCollabspaceHandler(database)(
    { params: { id: 'space-1' }, auth: { user: { id: 'owner-1' } }, body: { name: '  Study team  ' } },
    response,
  )

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { collabspace: { id: 'space-1', name: 'Study team' } })
  assert.deepEqual(query.where.memberships.some, {
    userId: 'owner-1',
    role: 'OWNER',
    status: 'ACTIVE',
  })
  assert.deepEqual(query.data, { name: 'Study team' })
  assert.equal(transactionOptions.isolationLevel, 'Serializable')
})

test('renaming a Collabspace rejects blank or oversized names', async () => {
  let transactionStarted = false
  const database = {
    async $transaction() {
      transactionStarted = true
    },
  }
  for (const name of ['   ', 'x'.repeat(101)]) {
    const response = createResponse()
    await createRenameCollabspaceHandler(database)(
      { params: { id: 'space-1' }, auth: { user: { id: 'owner-1' } }, body: { name } },
      response,
    )

    assert.equal(response.statusCode, 400)
    assert.equal(response.body.error.code, 'INVALID_NAME')
  }
  assert.equal(transactionStarted, false)
})

test('non-owners cannot rename a Collabspace', async () => {
  const database = {
    async $transaction(callback) {
      return callback({ workspace: { async updateMany() { return { count: 0 } } } })
    },
  }
  const response = createResponse()

  await createRenameCollabspaceHandler(database)(
    { params: { id: 'space-1' }, auth: { user: { id: 'admin-1' } }, body: { name: 'New name' } },
    response,
  )

  assert.equal(response.statusCode, 404)
  assert.equal(response.body.error.code, 'COLLABSPACE_NOT_FOUND')
})
