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

export function createDeleteCollabspaceHandler(database) {
  return async (req, res) => {
    try {
      const deleted = await database.$transaction(async (transaction) => {
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

router.delete('/:id/members/:userId', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const removed = await prisma.$transaction(async (transaction) => {
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
})

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
