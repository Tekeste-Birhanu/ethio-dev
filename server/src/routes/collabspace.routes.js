import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireSameOrigin } from '../middleware/require-same-origin.js'
import { broadcastGroupMessage } from '../lib/chat-websocket.js'

const router = Router()
const publicUserSelect = { id: true, name: true, username: true }

router.post('/', requireSameOrigin, authenticate, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  if (!name || name.length > 100) {
    return res.status(400).json({
      error: { code: 'INVALID_NAME', message: 'Enter a Collabspace name up to 100 characters.' },
    })
  }

  try {
    const collabspace = await prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.create({
        data: { name },
        select: { id: true, name: true, createdAt: true },
      })
      await transaction.membership.create({
        data: { workspaceId: workspace.id, userId: req.auth.user.id, role: 'OWNER', status: 'ACTIVE' },
      })
      return workspace
    }, { isolationLevel: 'Serializable' })

    return res.status(201).json({ collabspace })
  } catch (error) {
    if (error?.code === 'P2034') {
      return res.status(409).json({
        error: { code: 'COLLABSPACE_CHANGED', message: 'Could not create the Collabspace. Try again.' },
      })
    }
    console.error('Collabspace could not be created')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not create the Collabspace.' },
    })
  }
})

function readFromDate(membership) {
  if (!membership.lastReadAt || membership.joinedAt > membership.lastReadAt) return membership.joinedAt
  return membership.lastReadAt
}

async function findCollabspaceMembership(client, workspaceId, userId) {
  const workspace = await client.workspace.findFirst({
    where: {
      id: workspaceId,
      memberships: { some: { userId, status: 'ACTIVE' } },
    },
    select: {
      id: true,
      conversation: { select: { id: true, type: true, endedAt: true } },
      memberships: {
        where: { userId, status: 'ACTIVE' },
        select: { id: true, role: true, status: true, joinedAt: true, endedAt: true, lastReadAt: true },
      },
    },
  })
  const membership = workspace?.memberships[0]
  return workspace && membership ? { workspace, membership } : null
}

async function getUnreadCount(client, conversationId, userId, membership) {
  if (!conversationId) return 0
  return client.message.count({
    where: {
      conversationId,
      senderId: { not: userId },
      createdAt: { gt: readFromDate(membership) },
    },
  })
}

async function getActiveMemberIds(client, workspaceId) {
  const members = await client.membership.findMany({
    where: { workspaceId, status: 'ACTIVE' },
    select: { userId: true },
  })
  return members.map(({ userId }) => userId)
}

router.get('/', authenticate, async (req, res) => {
  try {
    const collabspaces = await prisma.workspace.findMany({
      where: {
        memberships: {
          some: { userId: req.auth.user.id, status: 'ACTIVE' },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        memberships: {
          where: { userId: req.auth.user.id },
          select: { status: true, role: true, joinedAt: true, endedAt: true, lastReadAt: true },
        },
        conversation: { select: { id: true } },
      },
    })

    const accessibleSpaces = await Promise.all(collabspaces.map(async (space) => {
      const ownMembership = space.memberships[0]
      const unreadCount = !space.conversation
        ? 0
        : await prisma.message.count({
          where: {
            conversationId: space.conversation.id,
            senderId: { not: req.auth.user.id },
            createdAt: { gt: readFromDate(ownMembership) },
          },
        })
      const { memberships, conversation, ...record } = space
      return { ...record, role: ownMembership.role, unreadCount }
    }))

    return res.json({ collabspaces: accessibleSpaces })
  } catch {
    console.error('Collabspaces could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load Collabspaces.' },
    })
  }
})

router.get('/:id', authenticate, async (req, res) => {
  try {
    const collabspace = await prisma.workspace.findFirst({
      where: {
        id: req.params.id,
        memberships: {
          some: { userId: req.auth.user.id, status: 'ACTIVE' },
        },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        memberships: {
          where: { status: 'ACTIVE' },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          select: {
            id: true,
            role: true,
            status: true,
            joinedAt: true,
            endedAt: true,
            user: { select: { id: true, name: true, username: true } },
          },
        },
        conversation: { select: { id: true } },
      },
    })

    if (!collabspace || !collabspace.memberships.some((membership) => membership.user.id === req.auth.user.id)) {
      return res.status(404).json({
        error: { code: 'COLLABSPACE_NOT_FOUND', message: 'This Collabspace could not be found.' },
      })
    }

    return res.json({
      collabspace: {
        ...collabspace,
        memberships: collabspace.memberships,
      },
    })
  } catch {
    console.error('Collabspace could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load this Collabspace.' },
    })
  }
})

export function createGetCollabspaceTaskboardHandler(database) {
  return async (req, res) => {
    try {
      const collabspace = await database.workspace.findFirst({
        where: {
          id: req.params.id,
          memberships: { some: { userId: req.auth.user.id, status: 'ACTIVE' } },
        },
        select: {
          milestones: {
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              name: true,
              position: true,
              tasks: {
                orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
                select: {
                  id: true,
                  title: true,
                  description: true,
                  status: true,
                  position: true,
                  dueAt: true,
                  assignee: { select: publicUserSelect },
                },
              },
            },
          },
          memberships: {
            where: { status: 'ACTIVE' },
            orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
            select: {
              role: true,
              user: { select: publicUserSelect },
            },
          },
        },
      })

      if (!collabspace) {
        return res.status(404).json({
          error: { code: 'COLLABSPACE_NOT_FOUND', message: 'This Collabspace could not be found.' },
        })
      }

      return res.json({
        milestones: collabspace.milestones,
        members: collabspace.memberships.map(({ user, role }) => ({ ...user, role })),
      })
    } catch {
      console.error('Collabspace taskboard could not be loaded')
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Could not load this taskboard.' },
      })
    }
  }
}

router.get('/:id/taskboard', authenticate, createGetCollabspaceTaskboardHandler(prisma))

export function createUpdateCollabspaceTaskHandler(database, broadcast = broadcastGroupMessage) {
  return async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const allowedFields = new Set(['title', 'description', 'assigneeId', 'dueAt', 'status', 'milestoneId'])
    const fields = Object.keys(body)
    if (!fields.length || fields.some((field) => !allowedFields.has(field))) {
      return res.status(400).json({ error: { code: 'INVALID_TASK', message: 'Update at least one task field.' } })
    }

    const data = {}
    if (Object.hasOwn(body, 'title')) {
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title || title.length > 200) {
        return res.status(400).json({ error: { code: 'INVALID_TITLE', message: 'Enter a task title up to 200 characters.' } })
      }
      data.title = title
    }
    if (Object.hasOwn(body, 'description')) {
      if (body.description !== null && typeof body.description !== 'string') {
        return res.status(400).json({ error: { code: 'INVALID_DESCRIPTION', message: 'Enter task details as text.' } })
      }
      const description = typeof body.description === 'string' ? body.description.trim() : ''
      if (description.length > 5000) {
        return res.status(400).json({ error: { code: 'INVALID_DESCRIPTION', message: 'Task details must be 5,000 characters or fewer.' } })
      }
      data.description = description || null
    }
    if (Object.hasOwn(body, 'assigneeId')) {
      if (body.assigneeId !== null && (typeof body.assigneeId !== 'string' || !body.assigneeId.trim())) {
        return res.status(400).json({ error: { code: 'INVALID_ASSIGNEE', message: 'Choose a valid assignee.' } })
      }
      data.assigneeId = body.assigneeId?.trim() || null
    }
    if (Object.hasOwn(body, 'dueAt')) {
      if (body.dueAt !== null && (typeof body.dueAt !== 'string' || Number.isNaN(Date.parse(body.dueAt)))) {
        return res.status(400).json({ error: { code: 'INVALID_DUE_DATE', message: 'Choose a valid due date.' } })
      }
      data.dueAt = body.dueAt ? new Date(body.dueAt) : null
    }
    if (Object.hasOwn(body, 'status')) {
      if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(body.status)) {
        return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Choose To do, In progress, or Done.' } })
      }
      data.status = body.status
    }
    if (Object.hasOwn(body, 'milestoneId')) {
      if (typeof body.milestoneId !== 'string' || !body.milestoneId.trim()) {
        return res.status(400).json({ error: { code: 'INVALID_MILESTONE', message: 'Choose a milestone in this Collabspace.' } })
      }
      data.milestoneId = body.milestoneId.trim()
    }

    try {
      const result = await database.$transaction(async (transaction) => {
        const workspace = await transaction.workspace.findFirst({
          where: {
            id: req.params.id,
            memberships: { some: { userId: req.auth.user.id, status: 'ACTIVE' } },
          },
          select: {
            memberships: {
              where: { status: 'ACTIVE' },
              select: { userId: true, role: true },
            },
          },
        })
        if (!workspace) return null

        const actor = workspace.memberships.find((membership) => membership.userId === req.auth.user.id)
        const task = await transaction.task.findFirst({
          where: { id: req.params.taskId, milestone: { is: { workspaceId: req.params.id } } },
          select: { id: true, assigneeId: true, milestoneId: true, status: true },
        })
        if (!actor || !task) return null

        const canManage = ['OWNER', 'ADMIN'].includes(actor.role)
        const statusOnly = fields.length === 1 && fields[0] === 'status'
        if (!canManage && !(statusOnly && task.assigneeId === req.auth.user.id)) return null
        if (!canManage && !statusOnly) return null

        if (data.assigneeId && !workspace.memberships.some((membership) => membership.userId === data.assigneeId)) {
          return { invalidAssignee: true }
        }

        const destinationMilestoneId = data.milestoneId ?? task.milestoneId
        const destinationStatus = data.status ?? task.status
        if (destinationMilestoneId !== task.milestoneId) {
          const milestone = await transaction.milestone.findFirst({
            where: { id: destinationMilestoneId, workspaceId: req.params.id },
            select: { id: true },
          })
          if (!milestone) return { invalidMilestone: true }
        }
        if (destinationMilestoneId !== task.milestoneId || destinationStatus !== task.status) {
          const position = await transaction.task.aggregate({
            where: { milestoneId: destinationMilestoneId, status: destinationStatus },
            _max: { position: true },
          })
          data.position = (position._max.position ?? -1) + 1
        }

        const updatedTask = await transaction.task.update({
          where: { id: task.id },
          data,
          select: {
            id: true,
            milestoneId: true,
            title: true,
            description: true,
            status: true,
            position: true,
            dueAt: true,
            assignee: { select: publicUserSelect },
          },
        })
        return { task: updatedTask, memberIds: workspace.memberships.map((membership) => membership.userId) }
      }, { isolationLevel: 'Serializable' })

      if (result?.invalidAssignee) {
        return res.status(400).json({ error: { code: 'INVALID_ASSIGNEE', message: 'Choose an active member of this Collabspace.' } })
      }
      if (result?.invalidMilestone) {
        return res.status(400).json({ error: { code: 'INVALID_MILESTONE', message: 'Choose a milestone in this Collabspace.' } })
      }
      if (!result) {
        return res.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'This task is not available to update.' } })
      }

      broadcast(result.memberIds, { type: 'task.updated', workspaceId: req.params.id, task: result.task })
      return res.json({ task: result.task })
    } catch (error) {
      if (error?.code === 'P2034') {
        return res.status(409).json({ error: { code: 'TASK_CHANGED', message: 'The task changed. Refresh and try again.' } })
      }
      console.error('Collabspace task could not be updated')
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not update this task.' } })
    }
  }
}

router.patch('/:id/tasks/:taskId', requireSameOrigin, authenticate, createUpdateCollabspaceTaskHandler(prisma))

async function findTaskboardManager(transaction, workspaceId, userId) {
  const workspace = await transaction.workspace.findFirst({
    where: {
      id: workspaceId,
      memberships: { some: { userId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } } },
    },
    select: {
      memberships: {
        where: { status: 'ACTIVE' },
        select: { userId: true, role: true },
      },
    },
  })
  const actor = workspace?.memberships.find((membership) => membership.userId === userId)
  return actor && ['OWNER', 'ADMIN'].includes(actor.role) ? workspace : null
}

function taskboardActionError(res, error) {
  if (error?.code === 'P2034') {
    return res.status(409).json({ error: { code: 'TASKBOARD_CHANGED', message: 'The taskboard changed. Refresh and try again.' } })
  }
  console.error('Collabspace taskboard could not be updated')
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not update this taskboard.' } })
}

export function createMilestoneHandler(database, broadcast = broadcastGroupMessage) {
  return async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name || name.length > 100) {
      return res.status(400).json({ error: { code: 'INVALID_NAME', message: 'Enter a milestone name up to 100 characters.' } })
    }
    try {
      const result = await database.$transaction(async (transaction) => {
        const workspace = await findTaskboardManager(transaction, req.params.id, req.auth.user.id)
        if (!workspace) return null
        const position = await transaction.milestone.aggregate({
          where: { workspaceId: req.params.id },
          _max: { position: true },
        })
        const milestone = await transaction.milestone.create({
          data: { workspaceId: req.params.id, name, position: (position._max.position ?? -1) + 1 },
          select: { id: true, name: true, position: true },
        })
        return { milestone, memberIds: workspace.memberships.map((membership) => membership.userId) }
      }, { isolationLevel: 'Serializable' })
      if (!result) return res.status(404).json({ error: { code: 'COLLABSPACE_NOT_FOUND', message: 'This Collabspace could not be found.' } })
      broadcast(result.memberIds, { type: 'milestone.created', workspaceId: req.params.id, milestone: result.milestone })
      return res.status(201).json({ milestone: result.milestone })
    } catch (error) {
      return taskboardActionError(res, error)
    }
  }
}

router.post('/:id/milestones', requireSameOrigin, authenticate, createMilestoneHandler(prisma))

export function createRenameMilestoneHandler(database, broadcast = broadcastGroupMessage) {
  return async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name || name.length > 100) {
      return res.status(400).json({ error: { code: 'INVALID_NAME', message: 'Enter a milestone name up to 100 characters.' } })
    }
    try {
      const result = await database.$transaction(async (transaction) => {
        const workspace = await findTaskboardManager(transaction, req.params.id, req.auth.user.id)
        if (!workspace) return null
        const milestone = await transaction.milestone.findFirst({
          where: { id: req.params.milestoneId, workspaceId: req.params.id },
          select: { id: true, name: true, position: true },
        })
        if (!milestone) return null
        const updatedMilestone = await transaction.milestone.update({
          where: { id: milestone.id },
          data: { name },
          select: { id: true, name: true, position: true },
        })
        return { milestone: updatedMilestone, memberIds: workspace.memberships.map((membership) => membership.userId) }
      }, { isolationLevel: 'Serializable' })
      if (!result) return res.status(404).json({ error: { code: 'MILESTONE_NOT_FOUND', message: 'This milestone is not available to rename.' } })
      broadcast(result.memberIds, { type: 'milestone.updated', workspaceId: req.params.id, milestone: result.milestone })
      return res.json({ milestone: result.milestone })
    } catch (error) {
      return taskboardActionError(res, error)
    }
  }
}

router.patch('/:id/milestones/:milestoneId', requireSameOrigin, authenticate, createRenameMilestoneHandler(prisma))

export function createDeleteMilestoneHandler(database, broadcast = broadcastGroupMessage) {
  return async (req, res) => {
    const expectedTaskCount = req.body?.expectedTaskCount
    if (!Number.isInteger(expectedTaskCount) || expectedTaskCount < 0) {
      return res.status(400).json({ error: { code: 'INVALID_TASK_COUNT', message: 'Review the milestone tasks and confirm deletion.' } })
    }
    try {
      const result = await database.$transaction(async (transaction) => {
        const workspace = await findTaskboardManager(transaction, req.params.id, req.auth.user.id)
        if (!workspace) return null
        const milestone = await transaction.milestone.findFirst({
          where: { id: req.params.milestoneId, workspaceId: req.params.id },
          select: { id: true, _count: { select: { tasks: true } } },
        })
        if (!milestone) return null
        if (milestone._count.tasks !== expectedTaskCount) return { taskCountChanged: true }
        await transaction.milestone.delete({ where: { id: milestone.id } })
        return { milestoneId: milestone.id, memberIds: workspace.memberships.map((membership) => membership.userId) }
      }, { isolationLevel: 'Serializable' })
      if (!result) return res.status(404).json({ error: { code: 'MILESTONE_NOT_FOUND', message: 'This milestone is not available to delete.' } })
      if (result.taskCountChanged) return res.status(409).json({ error: { code: 'MILESTONE_TASK_COUNT_CHANGED', message: 'The tasks in this milestone changed. Review it and confirm deletion again.' } })
      broadcast(result.memberIds, { type: 'milestone.deleted', workspaceId: req.params.id, milestoneId: result.milestoneId })
      return res.status(204).end()
    } catch (error) {
      return taskboardActionError(res, error)
    }
  }
}

router.delete('/:id/milestones/:milestoneId', requireSameOrigin, authenticate, createDeleteMilestoneHandler(prisma))

export function createTaskHandler(database, broadcast = broadcastGroupMessage) {
  return async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length > 200) {
      return res.status(400).json({ error: { code: 'INVALID_TITLE', message: 'Enter a task title up to 200 characters.' } })
    }
    if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
      return res.status(400).json({ error: { code: 'INVALID_DESCRIPTION', message: 'Enter task details as text.' } })
    }
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    if (description.length > 5000) {
      return res.status(400).json({ error: { code: 'INVALID_DESCRIPTION', message: 'Task details must be 5,000 characters or fewer.' } })
    }
    const assigneeId = typeof body.assigneeId === 'string' && body.assigneeId.trim() ? body.assigneeId.trim() : null
    if (body.assigneeId !== undefined && body.assigneeId !== null && !assigneeId) {
      return res.status(400).json({ error: { code: 'INVALID_ASSIGNEE', message: 'Choose a valid assignee.' } })
    }
    const dueAt = body.dueAt === undefined || body.dueAt === null || body.dueAt === '' ? null : body.dueAt
    if (dueAt !== null && (typeof dueAt !== 'string' || Number.isNaN(Date.parse(dueAt)))) {
      return res.status(400).json({ error: { code: 'INVALID_DUE_DATE', message: 'Choose a valid due date.' } })
    }
    const status = body.status === undefined ? 'TODO' : body.status
    if (!['TODO', 'IN_PROGRESS', 'DONE'].includes(status)) {
      return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Choose To do, In progress, or Done.' } })
    }
    try {
      const result = await database.$transaction(async (transaction) => {
        const workspace = await findTaskboardManager(transaction, req.params.id, req.auth.user.id)
        if (!workspace) return null
        const milestone = await transaction.milestone.findFirst({
          where: { id: req.params.milestoneId, workspaceId: req.params.id },
          select: { id: true },
        })
        if (!milestone) return null
        if (assigneeId && !workspace.memberships.some((membership) => membership.userId === assigneeId)) {
          return { invalidAssignee: true }
        }
        const position = await transaction.task.aggregate({
          where: { milestoneId: milestone.id, status },
          _max: { position: true },
        })
        const task = await transaction.task.create({
          data: {
            milestoneId: milestone.id,
            title,
            description: description || null,
            assigneeId,
            dueAt: dueAt ? new Date(dueAt) : null,
            status,
            position: (position._max.position ?? -1) + 1,
          },
          select: {
            id: true,
            milestoneId: true,
            title: true,
            description: true,
            status: true,
            position: true,
            dueAt: true,
            assignee: { select: publicUserSelect },
          },
        })
        return { task, memberIds: workspace.memberships.map((membership) => membership.userId) }
      }, { isolationLevel: 'Serializable' })
      if (result?.invalidAssignee) {
        return res.status(400).json({ error: { code: 'INVALID_ASSIGNEE', message: 'Choose an active member of this Collabspace.' } })
      }
      if (!result) return res.status(404).json({ error: { code: 'MILESTONE_NOT_FOUND', message: 'This milestone is not available.' } })
      broadcast(result.memberIds, { type: 'task.created', workspaceId: req.params.id, task: result.task })
      return res.status(201).json({ task: result.task })
    } catch (error) {
      return taskboardActionError(res, error)
    }
  }
}

router.post('/:id/milestones/:milestoneId/tasks', requireSameOrigin, authenticate, createTaskHandler(prisma))

export function createDeleteCollabspaceHandler(database) {
  return async (req, res) => {
    try {
      const deleted = await database.$transaction(async (transaction) => {
        const ownedSpace = await transaction.workspace.findFirst({
          where: {
            id: req.params.id,
            memberships: { some: { userId: req.auth.user.id, role: 'OWNER', status: 'ACTIVE' } },
          },
          select: { id: true },
        })
        if (!ownedSpace) return false
        await transaction.request.updateMany({
          where: { workspaceId: req.params.id, type: 'COLLABSPACE_INVITATION', status: 'PENDING' },
          data: { status: 'CANCELED', resolvedAt: new Date() },
        })
        const result = await transaction.workspace.deleteMany({
          where: {
            id: req.params.id,
            memberships: {
              some: { userId: req.auth.user.id, role: 'OWNER', status: 'ACTIVE' },
            },
          },
        })
        return result.count === 1
      }, { isolationLevel: 'Serializable' })

      if (!deleted) {
        return res.status(404).json({
          error: { code: 'COLLABSPACE_NOT_FOUND', message: 'This Collabspace could not be found.' },
        })
      }
      return res.status(204).end()
    } catch (error) {
      if (error?.code === 'P2034') {
        return res.status(409).json({
          error: { code: 'COLLABSPACE_CHANGED', message: 'The Collabspace changed. Refresh and try again.' },
        })
      }
      console.error('Collabspace could not be deleted')
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Could not delete this Collabspace.' },
      })
    }
  }
}

router.delete('/:id', requireSameOrigin, authenticate, createDeleteCollabspaceHandler(prisma))

export function createRenameCollabspaceHandler(database) {
  return async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name || name.length > 100) {
      return res.status(400).json({
        error: { code: 'INVALID_NAME', message: 'Enter a Collabspace name up to 100 characters.' },
      })
    }

    try {
      const renamed = await database.$transaction(async (transaction) => {
        const result = await transaction.workspace.updateMany({
          where: {
            id: req.params.id,
            memberships: {
              some: { userId: req.auth.user.id, role: 'OWNER', status: 'ACTIVE' },
            },
          },
          data: { name },
        })
        return result.count === 1
      }, { isolationLevel: 'Serializable' })

      if (!renamed) {
        return res.status(404).json({
          error: { code: 'COLLABSPACE_NOT_FOUND', message: 'This Collabspace could not be found.' },
        })
      }
      return res.json({ collabspace: { id: req.params.id, name } })
    } catch (error) {
      if (error?.code === 'P2034') {
        return res.status(409).json({
          error: { code: 'COLLABSPACE_CHANGED', message: 'The Collabspace changed. Refresh and try again.' },
        })
      }
      console.error('Collabspace could not be renamed')
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Could not rename this Collabspace.' },
      })
    }
  }
}

router.patch('/:id', requireSameOrigin, authenticate, createRenameCollabspaceHandler(prisma))

router.patch('/:id/members/:userId/role', requireSameOrigin, authenticate, async (req, res) => {
  const role = req.body?.role
  if (!['ADMIN', 'MEMBER'].includes(role)) {
    return res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Choose Admin or Member.' } })
  }

  try {
    const membership = await prisma.$transaction(async (transaction) => {
      const workspace = await transaction.workspace.findUnique({
        where: { id: req.params.id },
        select: {
          memberships: {
            where: { userId: { in: [req.auth.user.id, req.params.userId] }, status: 'ACTIVE' },
            select: { id: true, userId: true, role: true, status: true },
          },
        },
      })
      if (!workspace) return null
      const actor = workspace.memberships.find((membership) => membership.userId === req.auth.user.id)
      const target = workspace.memberships.find((membership) => membership.userId === req.params.userId)
      if (actor?.role !== 'OWNER' || !target || target.role === 'OWNER') return null
      return transaction.membership.update({
        where: { id: target.id },
        data: { role },
        select: { id: true, role: true, status: true },
      })
    }, { isolationLevel: 'Serializable' })
    if (!membership) {
      return res.status(404).json({ error: { code: 'MEMBER_NOT_FOUND', message: 'This member is not available to manage.' } })
    }
    return res.json({ membership })
  } catch (error) {
    if (error?.code === 'P2034') return res.status(409).json({ error: { code: 'MEMBERSHIP_CHANGED', message: 'The member list changed. Refresh and try again.' } })
    console.error('Collabspace member role could not be changed')
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not update this member role.' } })
  }
})

export function createRemoveCollabspaceMemberHandler(database) {
  return async (req, res) => {
    try {
      const removed = await database.$transaction(async (transaction) => {
        const workspace = await transaction.workspace.findUnique({
          where: { id: req.params.id },
          select: {
            memberships: {
              where: { userId: { in: [req.auth.user.id, req.params.userId] } },
              select: { id: true, userId: true, role: true, status: true },
            },
          },
        })
        if (!workspace) return false
        const actor = workspace.memberships.find((membership) => membership.userId === req.auth.user.id && membership.status === 'ACTIVE')
        const target = workspace.memberships.find((membership) => membership.userId === req.params.userId && membership.status === 'ACTIVE')
        if (!actor || !target || target.role === 'OWNER') return false
        const isOwner = actor.role === 'OWNER'
        const isAdmin = actor.role === 'ADMIN'
        const isSelfLeave = req.params.userId === req.auth.user.id
        if (isSelfLeave) {
          if (isOwner) return false
        } else if (!isOwner && !(isAdmin && target.role === 'MEMBER')) {
          return false
        }
        await transaction.task.updateMany({
          where: {
            milestone: { is: { workspaceId: req.params.id } },
            assigneeId: target.userId,
            status: { not: 'DONE' },
          },
          data: { assigneeId: null },
        })
        await transaction.membership.update({
          where: { id: target.id },
          data: { status: isSelfLeave ? 'LEFT' : 'REMOVED', endedAt: new Date() },
        })
        return true
      }, { isolationLevel: 'Serializable' })
      if (!removed) {
        return res.status(404).json({ error: { code: 'MEMBER_NOT_FOUND', message: 'This member cannot be removed from the Collabspace.' } })
      }
      return res.status(204).end()
    } catch (error) {
      if (error?.code === 'P2034') return res.status(409).json({ error: { code: 'MEMBERSHIP_CHANGED', message: 'The member list changed. Refresh and try again.' } })
      console.error('Collabspace member access could not be ended')
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not update Collabspace membership.' } })
    }
  }
}

router.delete('/:id/members/:userId', requireSameOrigin, authenticate, createRemoveCollabspaceMemberHandler(prisma))

router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    const access = await findCollabspaceMembership(prisma, req.params.id, req.auth.user.id)
    if (!access) {
      return res.status(404).json({
        error: { code: 'COLLABSPACE_NOT_FOUND', message: 'This Collabspace could not be found.' },
      })
    }

    let conversation = access.workspace.conversation
    if (!conversation) {
      conversation = await prisma.conversation.upsert({
        where: { workspaceId: access.workspace.id },
        update: {},
        create: { workspaceId: access.workspace.id, type: 'COLLABSPACE' },
        select: { id: true, type: true, endedAt: true },
      })
    }
    if (!conversation || conversation.type !== 'COLLABSPACE' || conversation.endedAt) {
      return res.json({ conversationId: null, messages: [], hasMore: false, nextCursor: null, unreadCount: 0 })
    }

    const beforeId = typeof req.query.before === 'string' ? req.query.before.trim() : ''
    if (beforeId.length > 100) {
      return res.status(400).json({
        error: { code: 'INVALID_CURSOR', message: 'The message history cursor is invalid.' },
      })
    }
    if (beforeId) {
      const cursorMessage = await prisma.message.findFirst({
        where: { id: beforeId, conversationId: conversation.id },
        select: { id: true },
      })
      if (!cursorMessage) {
        return res.status(400).json({
          error: { code: 'INVALID_CURSOR', message: 'The message history cursor is invalid.' },
        })
      }
    }

    const rows = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 101,
      ...(beforeId ? { cursor: { id: beforeId }, skip: 1 } : {}),
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        clientMessageId: true,
        content: true,
        createdAt: true,
        editedAt: true,
        sender: { select: publicUserSelect },
      },
    })
    const hasMore = rows.length > 100
    const messages = rows.slice(0, 100).reverse().map((message) => {
      if (message.senderId === req.auth.user.id) return message
      const visibleMessage = { ...message }
      delete visibleMessage.clientMessageId
      return visibleMessage
    })
    const unreadCount = await getUnreadCount(prisma, conversation.id, req.auth.user.id, access.membership)

    return res.json({
      conversationId: conversation.id,
      messages,
      hasMore,
      nextCursor: hasMore ? messages[0]?.id ?? null : null,
      unreadCount,
      canWrite: access.membership.status === 'ACTIVE',
      canDeleteForOthers: ['OWNER', 'ADMIN'].includes(access.membership.role),
    })
  } catch {
    console.error('Collabspace messages could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load group chat messages.' },
    })
  }
})

router.patch('/:id/read', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const access = await findCollabspaceMembership(prisma, req.params.id, req.auth.user.id)
    if (!access || !access.workspace.conversation || access.workspace.conversation.type !== 'COLLABSPACE' || access.workspace.conversation.endedAt) {
      return res.status(404).json({
        error: { code: 'COLLABSPACE_NOT_FOUND', message: 'This Collabspace could not be found.' },
      })
    }
    const throughMessageId = typeof req.body?.throughMessageId === 'string'
      ? req.body.throughMessageId.trim()
      : ''
    if (!throughMessageId) {
      return res.json({ read: true, unreadCount: await getUnreadCount(prisma, access.workspace.conversation.id, req.auth.user.id, access.membership) })
    }

    const throughMessage = await prisma.message.findFirst({
      where: { id: throughMessageId, conversationId: access.workspace.conversation.id },
      select: { createdAt: true },
    })
    if (!throughMessage) {
      return res.status(400).json({
        error: { code: 'INVALID_READ_MARKER', message: 'The read message marker is invalid.' },
      })
    }
    await prisma.membership.updateMany({
      where: {
        id: access.membership.id,
        OR: [
          { lastReadAt: null },
          { lastReadAt: { lt: throughMessage.createdAt } },
        ],
      },
      data: { lastReadAt: throughMessage.createdAt },
    })
    const currentMembership = await prisma.membership.findUnique({
      where: { id: access.membership.id },
      select: { joinedAt: true, lastReadAt: true },
    })
    const unreadCount = await getUnreadCount(
      prisma,
      access.workspace.conversation.id,
      req.auth.user.id,
      currentMembership ?? access.membership,
    )
    return res.json({ read: true, unreadCount })
  } catch {
    console.error('Collabspace chat could not be marked read')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not update group chat read state.' },
    })
  }
})

router.patch('/:id/messages/:messageId', requireSameOrigin, authenticate, async (req, res) => {
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
  if (!content || content.length > 5000) {
    return res.status(400).json({
      error: { code: 'INVALID_MESSAGE_CONTENT', message: 'Messages must contain 1 to 5,000 characters.' },
    })
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const access = await findCollabspaceMembership(transaction, req.params.id, req.auth.user.id)
      if (!access || access.membership.status !== 'ACTIVE') return null
      const message = await transaction.message.findFirst({
        where: {
          id: req.params.messageId,
          senderId: req.auth.user.id,
          conversation: { is: { type: 'COLLABSPACE', workspaceId: req.params.id, endedAt: null } },
        },
        select: { id: true, conversationId: true },
      })
      if (!message) return null
      const updatedMessage = await transaction.message.update({
        where: { id: message.id },
        data: { content, editedAt: new Date() },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          content: true,
          createdAt: true,
          editedAt: true,
          sender: { select: publicUserSelect },
        },
      })
      return { message: updatedMessage, memberIds: await getActiveMemberIds(transaction, req.params.id) }
    }, { isolationLevel: 'Serializable' })

    if (!result) {
      return res.status(404).json({
        error: { code: 'MESSAGE_NOT_FOUND', message: 'This message is not available to edit.' },
      })
    }
    broadcastGroupMessage(result.memberIds, { type: 'group.message.updated', message: result.message })
    return res.json({ message: result.message })
  } catch (error) {
    if (error?.code === 'P2034') {
      return res.status(409).json({
        error: { code: 'MESSAGE_CHANGED', message: 'The group chat changed. Refresh and try again.' },
      })
    }
    console.error('Collabspace message could not be edited')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not edit this group message.' },
    })
  }
})

router.delete('/:id/messages/:messageId', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const access = await findCollabspaceMembership(transaction, req.params.id, req.auth.user.id)
      if (!access || access.membership.status !== 'ACTIVE') return null
      const message = await transaction.message.findFirst({
        where: {
          id: req.params.messageId,
          conversation: { is: { type: 'COLLABSPACE', workspaceId: req.params.id, endedAt: null } },
          OR: [
            { senderId: req.auth.user.id },
            ...(access.membership.role === 'OWNER' || access.membership.role === 'ADMIN'
              ? [{ senderId: { not: req.auth.user.id } }]
              : []),
          ],
        },
        select: { id: true },
      })
      if (!message) return null
      await transaction.message.delete({ where: { id: message.id } })
      const [memberIds, workspace] = await Promise.all([
        getActiveMemberIds(transaction, req.params.id),
        transaction.workspace.findUnique({
          where: { id: req.params.id },
          select: { conversation: { select: { id: true } } },
        }),
      ])
      return { memberIds, conversationId: workspace?.conversation?.id }
    }, { isolationLevel: 'Serializable' })

    if (!result) {
      return res.status(404).json({
        error: { code: 'MESSAGE_NOT_FOUND', message: 'This message is not available to delete.' },
      })
    }
    broadcastGroupMessage(result.memberIds, {
      type: 'group.message.deleted',
      conversationId: result.conversationId,
      messageId: req.params.messageId,
    })
    return res.status(204).end()
  } catch (error) {
    if (error?.code === 'P2034') {
      return res.status(409).json({
        error: { code: 'MESSAGE_CHANGED', message: 'The group chat changed. Refresh and try again.' },
      })
    }
    console.error('Collabspace message could not be deleted')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not delete this group message.' },
    })
  }
})

export default router
