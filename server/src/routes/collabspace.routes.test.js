import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDeleteCollabspaceHandler,
  createDeleteMilestoneHandler,
  createMilestoneHandler,
  createGetCollabspaceTaskboardHandler,
  createRenameMilestoneHandler,
  createRemoveCollabspaceMemberHandler,
  createRenameCollabspaceHandler,
  createTaskHandler,
  createUpdateCollabspaceTaskHandler,
} from './collabspace.routes.js'

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

test('taskboard returns ordered milestones and public task assignee fields to an active member', async () => {
  const milestones = [{
    id: 'milestone-1',
    name: 'First milestone',
    position: 0,
    tasks: [{
      id: 'task-1',
      title: 'Build the board',
      description: 'Implement the shared board.',
      status: 'TODO',
      position: 0,
      dueAt: null,
      assignee: { id: 'member-1', name: 'Member', username: 'member' },
    }],
  }]
  let query
  const database = {
    workspace: {
      async findFirst(args) {
        query = args
        return {
          milestones,
          memberships: [{ role: 'OWNER', user: { id: 'member-1', name: 'Member', username: 'member' } }],
        }
      },
    },
  }
  const response = createResponse()

  await createGetCollabspaceTaskboardHandler(database)(
    { params: { id: 'space-1' }, auth: { user: { id: 'member-1' } } },
    response,
  )

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, {
    milestones,
    members: [{ id: 'member-1', name: 'Member', username: 'member', role: 'OWNER' }],
  })
  assert.deepEqual(query.where.memberships.some, { userId: 'member-1', status: 'ACTIVE' })
  assert.deepEqual(query.select.milestones.orderBy, [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }])
  assert.deepEqual(query.select.milestones.select.tasks.select.assignee.select, { id: true, name: true, username: true })
})

test('owners can edit task details and saved changes broadcast to active members', async () => {
  let updateArgs
  let event
  const updatedTask = {
    id: 'task-1', milestoneId: 'milestone-1', title: 'Updated title', description: 'Details',
    status: 'IN_PROGRESS', position: 0, dueAt: null, assignee: null,
  }
  const database = {
    async $transaction(callback, options) {
      assert.equal(options.isolationLevel, 'Serializable')
      return callback({
        workspace: { async findFirst() { return { memberships: [
          { userId: 'owner-1', role: 'OWNER' }, { userId: 'member-1', role: 'MEMBER' },
        ] } } },
        task: {
          async findFirst() { return { id: 'task-1', assigneeId: null, milestoneId: 'milestone-1', status: 'TODO' } },
          async aggregate() { return { _max: { position: 0 } } },
          async update(args) { updateArgs = args; return updatedTask },
        },
      })
    },
  }
  const response = createResponse()

  await createUpdateCollabspaceTaskHandler(database, (memberIds, payload) => { event = { memberIds, payload } })(
    {
      params: { id: 'space-1', taskId: 'task-1' },
      auth: { user: { id: 'owner-1' } },
      body: { title: ' Updated title ', description: ' Details ', status: 'IN_PROGRESS', assigneeId: null, dueAt: null },
    },
    response,
  )

  assert.equal(response.statusCode, 200)
  assert.deepEqual(updateArgs.data, { title: 'Updated title', description: 'Details', status: 'IN_PROGRESS', assigneeId: null, dueAt: null, position: 1 })
  assert.deepEqual(response.body, { task: updatedTask })
  assert.deepEqual(event.memberIds, ['owner-1', 'member-1'])
  assert.deepEqual(event.payload, { type: 'task.updated', workspaceId: 'space-1', task: updatedTask })
})

test('an assignee can change only their own task status', async () => {
  let updateArgs
  const database = {
    async $transaction(callback) {
      return callback({
        workspace: { async findFirst() { return { memberships: [{ userId: 'member-1', role: 'MEMBER' }] } } },
        task: {
          async findFirst() { return { id: 'task-1', assigneeId: 'member-1', milestoneId: 'milestone-1', status: 'TODO' } },
          async aggregate() { return { _max: { position: null } } },
          async update(args) { updateArgs = args; return { id: 'task-1', milestoneId: 'milestone-1', status: 'DONE' } },
        },
      })
    },
  }
  const response = createResponse()

  await createUpdateCollabspaceTaskHandler(database, () => {})(
    { params: { id: 'space-1', taskId: 'task-1' }, auth: { user: { id: 'member-1' } }, body: { status: 'DONE' } },
    response,
  )

  assert.equal(response.statusCode, 200)
  assert.deepEqual(updateArgs.data, { status: 'DONE', position: 0 })
})

test('members cannot edit task details and assignees cannot change another task status', async () => {
  let taskUpdated = false
  const database = {
    async $transaction(callback) {
      return callback({
        workspace: { async findFirst() { return { memberships: [{ userId: 'member-1', role: 'MEMBER' }] } } },
        task: {
          async findFirst() { return { id: 'task-1', assigneeId: 'another-member' } },
          async update() { taskUpdated = true },
        },
      })
    },
  }
  for (const body of [{ title: 'Changed' }, { status: 'DONE' }]) {
    const response = createResponse()
    await createUpdateCollabspaceTaskHandler(database, () => {})(
      { params: { id: 'space-1', taskId: 'task-1' }, auth: { user: { id: 'member-1' } }, body },
      response,
    )
    assert.equal(response.statusCode, 404)
    assert.equal(response.body.error.code, 'TASK_NOT_FOUND')
  }
  assert.equal(taskUpdated, false)
})

test('task updates reject invalid fields and assignees outside the Collabspace', async () => {
  let transactionCount = 0
  const database = {
    async $transaction(callback) {
      transactionCount += 1
      return callback({
        workspace: { async findFirst() { return { memberships: [{ userId: 'owner-1', role: 'OWNER' }] } } },
        task: {
          async findFirst() { return { id: 'task-1', assigneeId: null } },
          async update() { throw new Error('Must not assign a user outside this Collabspace') },
        },
      })
    },
  }
  const invalidResponse = createResponse()
  await createUpdateCollabspaceTaskHandler(database, () => {})(
    { params: { id: 'space-1', taskId: 'task-1' }, auth: { user: { id: 'owner-1' } }, body: { status: 'PENDING' } },
    invalidResponse,
  )
  assert.equal(invalidResponse.statusCode, 400)
  assert.equal(transactionCount, 0)

  const assigneeResponse = createResponse()
  await createUpdateCollabspaceTaskHandler(database, () => {})(
    { params: { id: 'space-1', taskId: 'task-1' }, auth: { user: { id: 'owner-1' } }, body: { assigneeId: 'former-member' } },
    assigneeResponse,
  )
  assert.equal(assigneeResponse.statusCode, 400)
  assert.equal(assigneeResponse.body.error.code, 'INVALID_ASSIGNEE')
  assert.equal(transactionCount, 1)
})

test('owners and admins can create milestones in order and notify current members', async () => {
  let createArgs
  let event
  const database = {
    async $transaction(callback, options) {
      assert.equal(options.isolationLevel, 'Serializable')
      return callback({
        workspace: { async findFirst(args) {
          assert.deepEqual(args.where.memberships.some.role.in, ['OWNER', 'ADMIN'])
          return { memberships: [{ userId: 'owner-1', role: 'OWNER' }, { userId: 'member-1', role: 'MEMBER' }] }
        } },
        milestone: {
          async aggregate() { return { _max: { position: 2 } } },
          async create(args) { createArgs = args; return { id: 'milestone-4', name: 'Next', position: 3 } },
        },
      })
    },
  }
  const response = createResponse()

  await createMilestoneHandler(database, (memberIds, payload) => { event = { memberIds, payload } })(
    { params: { id: 'space-1' }, auth: { user: { id: 'owner-1' } }, body: { name: ' Next ' } },
    response,
  )

  assert.equal(response.statusCode, 201)
  assert.deepEqual(createArgs.data, { workspaceId: 'space-1', name: 'Next', position: 3 })
  assert.deepEqual(event, {
    memberIds: ['owner-1', 'member-1'],
    payload: { type: 'milestone.created', workspaceId: 'space-1', milestone: { id: 'milestone-4', name: 'Next', position: 3 } },
  })
})

test('regular members cannot create milestones and invalid names are rejected', async () => {
  let transactionStarted = false
  const database = { async $transaction() { transactionStarted = true } }
  const badName = createResponse()
  await createMilestoneHandler(database, () => {})(
    { params: { id: 'space-1' }, auth: { user: { id: 'member-1' } }, body: { name: ' ' } },
    badName,
  )
  assert.equal(badName.statusCode, 400)
  assert.equal(transactionStarted, false)

  const databaseForMember = {
    async $transaction(callback) {
      transactionStarted = true
      return callback({ workspace: { async findFirst() { return null } } })
    },
  }
  const forbidden = createResponse()
  await createMilestoneHandler(databaseForMember, () => {})(
    { params: { id: 'space-1' }, auth: { user: { id: 'member-1' } }, body: { name: 'Milestone' } },
    forbidden,
  )
  assert.equal(forbidden.statusCode, 404)
})

test('admins can rename milestones and delete populated milestones with their tasks', async () => {
  let updateArgs
  const renameDatabase = {
    async $transaction(callback) {
      return callback({
        workspace: { async findFirst() { return { memberships: [{ userId: 'admin-1', role: 'ADMIN' }] } } },
        milestone: {
          async findFirst(args) { assert.deepEqual(args.where, { id: 'milestone-1', workspaceId: 'space-1' }); return { id: 'milestone-1' } },
          async update(args) { updateArgs = args; return { id: 'milestone-1', name: 'Planning', position: 0 } },
        },
      })
    },
  }
  const renameResponse = createResponse()
  await createRenameMilestoneHandler(renameDatabase, () => {})(
    { params: { id: 'space-1', milestoneId: 'milestone-1' }, auth: { user: { id: 'admin-1' } }, body: { name: ' Planning ' } },
    renameResponse,
  )
  assert.equal(renameResponse.statusCode, 200)
  assert.deepEqual(updateArgs.data, { name: 'Planning' })

  let deleteArgs
  let event
  const deleteDatabase = {
    async $transaction(callback) {
      return callback({
        workspace: { async findFirst() { return { memberships: [{ userId: 'admin-1', role: 'ADMIN' }] } } },
        milestone: {
          async findFirst() { return { id: 'milestone-1', _count: { tasks: 1 } } },
          async delete(args) { deleteArgs = args },
        },
      })
    },
  }
  const deleteResponse = createResponse()
  await createDeleteMilestoneHandler(deleteDatabase, (memberIds, payload) => { event = { memberIds, payload } })(
    { params: { id: 'space-1', milestoneId: 'milestone-1' }, auth: { user: { id: 'admin-1' } }, body: { expectedTaskCount: 1 } },
    deleteResponse,
  )
  assert.equal(deleteResponse.statusCode, 204)
  assert.deepEqual(deleteArgs.where, { id: 'milestone-1' })
  assert.deepEqual(event, {
    memberIds: ['admin-1'],
    payload: { type: 'milestone.deleted', workspaceId: 'space-1', milestoneId: 'milestone-1' },
  })
})

test('milestone deletion requires the reviewed task count to still match', async () => {
  let wasDeleted = false
  let wasBroadcast = false
  const database = {
    async $transaction(callback) {
      return callback({
        workspace: { async findFirst() { return { memberships: [{ userId: 'owner-1', role: 'OWNER' }] } } },
        milestone: {
          async findFirst() { return { id: 'milestone-1', _count: { tasks: 2 } } },
          async delete() { wasDeleted = true },
        },
      })
    },
  }
  const response = createResponse()
  await createDeleteMilestoneHandler(database, () => { wasBroadcast = true })(
    { params: { id: 'space-1', milestoneId: 'milestone-1' }, auth: { user: { id: 'owner-1' } }, body: { expectedTaskCount: 1 } },
    response,
  )
  assert.equal(response.statusCode, 409)
  assert.equal(response.body.error.code, 'MILESTONE_TASK_COUNT_CHANGED')
  assert.equal(wasDeleted, false)
  assert.equal(wasBroadcast, false)
})

test('milestone deletion rejects a missing or invalid confirmed task count', async () => {
  let transactionStarted = false
  const database = { async $transaction() { transactionStarted = true } }
  const response = createResponse()
  await createDeleteMilestoneHandler(database, () => {})(
    { params: { id: 'space-1', milestoneId: 'milestone-1' }, auth: { user: { id: 'owner-1' } }, body: { expectedTaskCount: -1 } },
    response,
  )
  assert.equal(response.statusCode, 400)
  assert.equal(response.body.error.code, 'INVALID_TASK_COUNT')
  assert.equal(transactionStarted, false)
})

test('owners can create tasks with the selected status and an active Collabspace assignee', async () => {
  let createArgs
  let event
  const createdTask = { id: 'task-4', milestoneId: 'milestone-1', title: 'Ship it', status: 'IN_PROGRESS', position: 2 }
  const database = {
    async $transaction(callback) {
      return callback({
        workspace: { async findFirst() { return { memberships: [
          { userId: 'owner-1', role: 'OWNER' }, { userId: 'member-1', role: 'MEMBER' },
        ] } } },
        milestone: { async findFirst(args) { assert.deepEqual(args.where, { id: 'milestone-1', workspaceId: 'space-1' }); return { id: 'milestone-1' } } },
        task: {
          async aggregate(args) { assert.deepEqual(args.where, { milestoneId: 'milestone-1', status: 'IN_PROGRESS' }); return { _max: { position: 1 } } },
          async create(args) { createArgs = args; return createdTask },
        },
      })
    },
  }
  const response = createResponse()

  await createTaskHandler(database, (memberIds, payload) => { event = { memberIds, payload } })(
    {
      params: { id: 'space-1', milestoneId: 'milestone-1' },
      auth: { user: { id: 'owner-1' } },
      body: { title: ' Ship it ', description: ' Details ', assigneeId: 'member-1', dueAt: null, status: 'IN_PROGRESS' },
    },
    response,
  )

  assert.equal(response.statusCode, 201)
  assert.deepEqual(createArgs.data, {
    milestoneId: 'milestone-1', title: 'Ship it', description: 'Details', assigneeId: 'member-1', dueAt: null, status: 'IN_PROGRESS', position: 2,
  })
  assert.deepEqual(event, {
    memberIds: ['owner-1', 'member-1'],
    payload: { type: 'task.created', workspaceId: 'space-1', task: createdTask },
  })
})

test('task creation rejects a nonmember assignee and regular member', async () => {
  const database = {
    async $transaction(callback) {
      return callback({
        workspace: { async findFirst() { return { memberships: [{ userId: 'member-1', role: 'MEMBER' }] } } },
        milestone: { async findFirst() { return { id: 'milestone-1' } } },
        task: { async aggregate() { throw new Error('A nonmanager must not create a task') } },
      })
    },
  }
  const response = createResponse()
  await createTaskHandler(database, () => {})(
    {
      params: { id: 'space-1', milestoneId: 'milestone-1' },
      auth: { user: { id: 'member-1' } },
      body: { title: 'Task' },
    },
    response,
  )
  assert.equal(response.statusCode, 404)

  const invalidAssigneeDatabase = {
    async $transaction(callback) {
      return callback({
        workspace: { async findFirst() { return { memberships: [{ userId: 'owner-1', role: 'OWNER' }] } } },
        milestone: { async findFirst() { return { id: 'milestone-1' } } },
        task: { async aggregate() { throw new Error('A nonmember assignee must be rejected before writing a task') } },
      })
    },
  }
  const invalidAssigneeResponse = createResponse()
  await createTaskHandler(invalidAssigneeDatabase, () => {})(
    {
      params: { id: 'space-1', milestoneId: 'milestone-1' },
      auth: { user: { id: 'owner-1' } },
      body: { title: 'Task', assigneeId: 'outside-member' },
    },
    invalidAssigneeResponse,
  )
  assert.equal(invalidAssigneeResponse.statusCode, 400)
  assert.equal(invalidAssigneeResponse.body.error.code, 'INVALID_ASSIGNEE')
})

test('taskboard hides unknown Collabspaces and spaces without active membership', async () => {
  const database = { workspace: { async findFirst() { return null } } }
  const response = createResponse()

  await createGetCollabspaceTaskboardHandler(database)(
    { params: { id: 'space-1' }, auth: { user: { id: 'former-member-1' } } },
    response,
  )

  assert.equal(response.statusCode, 404)
  assert.equal(response.body.error.code, 'COLLABSPACE_NOT_FOUND')
})

test('deleting a Collabspace is restricted to its active Owner', async () => {
  let query
  let invitationQuery
  let transactionOptions
  const database = {
    async $transaction(callback, options) {
      transactionOptions = options
      return callback({
        workspace: {
          async findFirst(args) {
            assert.deepEqual(args.where.memberships.some, {
              userId: 'owner-1',
              role: 'OWNER',
              status: 'ACTIVE',
            })
            return { id: 'space-1' }
          },
          async deleteMany(args) {
            query = args
            return { count: 1 }
          },
        },
        request: { async updateMany(args) { invitationQuery = args; return { count: 0 } } },
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
  assert.deepEqual(invitationQuery, {
    where: { workspaceId: 'space-1', type: 'COLLABSPACE_INVITATION', status: 'PENDING' },
    data: { status: 'CANCELED', resolvedAt: invitationQuery.data.resolvedAt },
  })
  assert.ok(invitationQuery.data.resolvedAt instanceof Date)
  assert.equal(transactionOptions.isolationLevel, 'Serializable')
})

test('non-owners cannot delete a Collabspace', async () => {
  const database = {
    async $transaction(callback) {
      return callback({
        workspace: { async findFirst() { return null } },
        request: { async updateMany() { throw new Error('Must not update requests for a non-owner') } },
      })
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

test('removing a member unassigns their unfinished tasks while retaining completed assignments', async () => {
  let taskUpdate
  let membershipUpdate
  const database = {
    async $transaction(callback, options) {
      assert.equal(options.isolationLevel, 'Serializable')
      return callback({
        workspace: {
          async findUnique() {
            return {
              memberships: [
                { id: 'owner-membership', userId: 'owner-1', role: 'OWNER', status: 'ACTIVE' },
                { id: 'member-membership', userId: 'member-1', role: 'MEMBER', status: 'ACTIVE' },
              ],
            }
          },
        },
        task: { async updateMany(args) { taskUpdate = args } },
        membership: { async update(args) { membershipUpdate = args } },
      })
    },
  }
  const response = createResponse()

  await createRemoveCollabspaceMemberHandler(database)(
    { params: { id: 'space-1', userId: 'member-1' }, auth: { user: { id: 'owner-1' } } },
    response,
  )

  assert.equal(response.statusCode, 204)
  assert.deepEqual(taskUpdate, {
    where: {
      milestone: { is: { workspaceId: 'space-1' } },
      assigneeId: 'member-1',
      status: { not: 'DONE' },
    },
    data: { assigneeId: null },
  })
  assert.equal(membershipUpdate.where.id, 'member-membership')
  assert.equal(membershipUpdate.data.status, 'REMOVED')
})

test('a member who cannot be removed does not have tasks unassigned', async () => {
  let taskUpdated = false
  const database = {
    async $transaction(callback) {
      return callback({
        workspace: {
          async findUnique() {
            return {
              memberships: [
                { id: 'admin-membership', userId: 'admin-1', role: 'ADMIN', status: 'ACTIVE' },
                { id: 'other-admin-membership', userId: 'admin-2', role: 'ADMIN', status: 'ACTIVE' },
              ],
            }
          },
        },
        task: { async updateMany() { taskUpdated = true } },
        membership: { async update() { throw new Error('Unauthorized removal must not update membership') } },
      })
    },
  }
  const response = createResponse()

  await createRemoveCollabspaceMemberHandler(database)(
    { params: { id: 'space-1', userId: 'admin-2' }, auth: { user: { id: 'admin-1' } } },
    response,
  )

  assert.equal(response.statusCode, 404)
  assert.equal(response.body.error.code, 'MEMBER_NOT_FOUND')
  assert.equal(taskUpdated, false)
})
