import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCollaborationRequestHandler,
  createIncomingCollaborationRequestsHandler,
} from './opportunity.routes.js'

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

function createDatabase({ opportunity, createdRequest, existingRequest, createError } = {}) {
  const calls = { opportunity: [], requestLookup: [], request: [] }
  return {
    calls,
    async $transaction(callback) {
      return callback({
        opportunity: {
          async findFirst(args) {
            calls.opportunity.push(args)
            return opportunity ?? null
          },
        },
        request: {
          async findFirst(args) {
            calls.requestLookup.push(args)
            return existingRequest ?? null
          },
          async create(args) {
            calls.request.push(args)
            if (createError) throw createError
            return createdRequest ?? {
              id: 'request-1',
              status: 'PENDING',
              message: args.data.message,
              createdAt: new Date('2026-10-31T12:00:00.000Z'),
            }
          },
        },
      })
    },
  }
}

const opportunity = {
  id: 'opportunity-1',
  description: 'Build a study planner',
  ownerId: 'owner-1',
  status: 'OPEN',
  owner: { id: 'owner-1', name: 'Space Owner', username: 'owner' },
}

test('creates a collaboration request for the opportunity owner with an optional message', async () => {
  const database = createDatabase({ opportunity })
  const response = createResponse()

  await createCollaborationRequestHandler(database)(
    { params: { id: opportunity.id }, body: { message: '  I can help with React.  ' }, auth: { user: { id: 'requester-1', name: 'Applicant', username: 'applicant' } } },
    response,
  )

  assert.equal(response.statusCode, 201)
  assert.deepEqual(database.calls.request[0].data, {
    senderId: 'requester-1',
    recipientId: opportunity.ownerId,
    type: 'COLLABORATION_REQUEST',
    opportunityId: opportunity.id,
    message: 'I can help with React.',
  })
  assert.deepEqual(response.body.request.opportunity, {
    id: opportunity.id,
    description: opportunity.description,
  })
  assert.deepEqual(response.body.request.recipient, opportunity.owner)
})

test('creates a request without a message when the optional field is omitted', async () => {
  const database = createDatabase({ opportunity })
  const response = createResponse()

  await createCollaborationRequestHandler(database)(
    { params: { id: opportunity.id }, body: {}, auth: { user: { id: 'requester-1', name: 'Applicant', username: 'applicant' } } },
    response,
  )

  assert.equal(response.statusCode, 201)
  assert.equal(database.calls.request[0].data.message, null)
})

test('rejects non-text and oversized collaboration request messages', async () => {
  for (const message of [42, 'x'.repeat(1001)]) {
    const database = createDatabase({ opportunity })
    const response = createResponse()
    await createCollaborationRequestHandler(database)(
      { params: { id: opportunity.id }, body: { message }, auth: { user: { id: 'requester-1', name: 'Applicant', username: 'applicant' } } },
      response,
    )
    assert.equal(response.statusCode, 400)
    assert.equal(database.calls.request.length, 0)
  }
})

test('does not create a request for a missing opportunity or to oneself', async () => {
  const missingDb = createDatabase()
  const missingResponse = createResponse()
  await createCollaborationRequestHandler(missingDb)(
    { params: { id: 'missing' }, body: {}, auth: { user: { id: 'requester-1', name: 'Applicant', username: 'applicant' } } },
    missingResponse,
  )
  assert.equal(missingResponse.statusCode, 404)
  assert.equal(missingDb.calls.request.length, 0)

  const ownOpportunityDb = createDatabase({
    opportunity: { ...opportunity, ownerId: 'requester-1' },
  })
  const ownOpportunityResponse = createResponse()
  await createCollaborationRequestHandler(ownOpportunityDb)(
    { params: { id: opportunity.id }, body: {}, auth: { user: { id: 'requester-1', name: 'Applicant', username: 'applicant' } } },
    ownOpportunityResponse,
  )
  assert.equal(ownOpportunityResponse.statusCode, 400)
  assert.equal(ownOpportunityDb.calls.request.length, 0)
})

test('requires a completed profile and an open opportunity', async () => {
  const incompleteDb = createDatabase({ opportunity })
  const incompleteResponse = createResponse()
  await createCollaborationRequestHandler(incompleteDb)(
    { params: { id: opportunity.id }, body: {}, auth: { user: { id: 'requester-1', name: '', username: null } } },
    incompleteResponse,
  )
  assert.equal(incompleteResponse.statusCode, 403)
  assert.equal(incompleteDb.calls.opportunity.length, 0)

  const pausedDb = createDatabase({ opportunity: { ...opportunity, status: 'PAUSED' } })
  const pausedResponse = createResponse()
  await createCollaborationRequestHandler(pausedDb)(
    { params: { id: opportunity.id }, body: {}, auth: { user: { id: 'requester-1', name: 'Applicant', username: 'applicant' } } },
    pausedResponse,
  )
  assert.equal(pausedResponse.statusCode, 409)
  assert.equal(pausedDb.calls.request.length, 0)
})

test('rejects an existing pending request and a duplicate insert race', async () => {
  const pendingDb = createDatabase({ opportunity, existingRequest: { id: 'existing-request', status: 'PENDING' } })
  const pendingResponse = createResponse()
  await createCollaborationRequestHandler(pendingDb)(
    { params: { id: opportunity.id }, body: {}, auth: { user: { id: 'requester-1', name: 'Applicant', username: 'applicant' } } },
    pendingResponse,
  )
  assert.equal(pendingResponse.statusCode, 409)
  assert.equal(pendingDb.calls.request.length, 0)

  const raceDb = createDatabase({ opportunity, createError: { code: 'P2002' } })
  const raceResponse = createResponse()
  await createCollaborationRequestHandler(raceDb)(
    { params: { id: opportunity.id }, body: {}, auth: { user: { id: 'requester-1', name: 'Applicant', username: 'applicant' } } },
    raceResponse,
  )
  assert.equal(raceResponse.statusCode, 409)
  assert.equal(raceResponse.body.error.code, 'REQUEST_PENDING')
})

test('does not allow a second request after the owner accepted or declined the first', async () => {
  for (const status of ['ACCEPTED', 'DECLINED']) {
    const database = createDatabase({ opportunity, existingRequest: { id: 'resolved-request', status } })
    const response = createResponse()
    await createCollaborationRequestHandler(database)(
      { params: { id: opportunity.id }, body: {}, auth: { user: { id: 'requester-1', name: 'Applicant', username: 'applicant' } } },
      response,
    )
    assert.equal(response.statusCode, 409)
    assert.equal(database.calls.request.length, 0)
  }
})

test('lists pending and resolved incoming collaboration requests as notification history', async () => {
  const ownerId = 'owner-1'
  const sender = {
    id: 'sender-1',
    name: 'Applicant',
    username: 'applicant',
    skills: [{ skill: { name: 'React' } }],
  }
  const requests = ['PENDING', 'ACCEPTED', 'DECLINED'].map((status) => ({
    id: `request-${status.toLowerCase()}`,
    status,
    sender,
    opportunity: { id: 'opportunity-1', description: 'Build a study planner', status: 'OPEN' },
    createdAt: new Date('2026-10-31T12:00:00.000Z'),
  }))
  const calls = []
  const database = {
    request: {
      async findMany(args) {
        calls.push(args)
        return requests
      },
    },
  }
  const response = createResponse()

  await createIncomingCollaborationRequestsHandler(database)(
    { auth: { user: { id: ownerId } } },
    response,
  )

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].where, {
    recipientId: ownerId,
    type: 'COLLABORATION_REQUEST',
    OR: [
      {
        status: 'PENDING',
        opportunity: {
          ownerId,
          deletedAt: null,
          status: { in: ['OPEN', 'PAUSED'] },
        },
      },
      {
        status: { in: ['ACCEPTED', 'DECLINED'] },
        opportunity: { ownerId },
      },
    ],
  })
  assert.deepEqual(response.body.requests.map(({ status }) => status), ['PENDING', 'ACCEPTED', 'DECLINED'])
  assert.deepEqual(response.body.requests[0].sender.skills, ['React'])
})
