import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireSameOrigin } from '../middleware/require-same-origin.js'
import { broadcastConversationEnded, broadcastPrivateMessageChanged } from '../lib/chat-websocket.js'

const router = Router()

const senderSelect = { id: true, name: true, username: true }

async function findActivePrivateConversation(client, firstUserId, secondUserId) {
  return client.conversation.findFirst({
    where: {
      type: 'PRIVATE',
      endedAt: null,
      participants: { some: { userId: firstUserId } },
      AND: [
        { participants: { some: { userId: secondUserId } } },
        { participants: { every: { userId: { in: [firstUserId, secondUserId] } } } },
      ],
    },
    select: { id: true },
  })
}

async function findOrCreatePrivateConversation(transaction, firstUserId, secondUserId) {
  const conversation = await transaction.conversation.findFirst({
    where: {
      type: 'PRIVATE',
      endedAt: null,
      participants: { some: { userId: firstUserId } },
      AND: [
        { participants: { some: { userId: secondUserId } } },
        { participants: { every: { userId: { in: [firstUserId, secondUserId] } } } },
      ],
    },
    select: {
      id: true,
      createdAt: true,
      participants: { select: { user: { select: senderSelect } } },
    },
  })
  if (conversation) {
    if (conversation.participants.length !== 2) {
      throw new Error('Private conversation must have exactly two participants.')
    }
    return conversation
  }

  return transaction.conversation.create({
    data: {
      type: 'PRIVATE',
      participants: {
        create: [
          { user: { connect: { id: firstUserId } } },
          { user: { connect: { id: secondUserId } } },
        ],
      },
    },
    select: {
      id: true,
      createdAt: true,
      participants: { select: { user: { select: senderSelect } } },
    },
  })
}

router.post('/requests', requireSameOrigin, authenticate, async (req, res) => {
  const recipientId = typeof req.body?.recipientId === 'string'
    ? req.body.recipientId.trim()
    : ''

  if (!recipientId || recipientId.length > 100) {
    return res.status(400).json({
      error: { code: 'INVALID_RECIPIENT', message: 'Choose a developer to request a chat with.' },
    })
  }
  if (!req.auth.user.username) {
    return res.status(403).json({
      error: { code: 'PROFILE_INCOMPLETE', message: 'Complete your profile before requesting a chat.' },
    })
  }
  if (recipientId === req.auth.user.id) {
    return res.status(400).json({
      error: { code: 'SELF_CHAT_REQUEST', message: 'You cannot request a chat with yourself.' },
    })
  }

  try {
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: senderSelect,
    })
    if (!recipient?.username) {
      return res.status(404).json({
        error: { code: 'PROFILE_NOT_FOUND', message: 'This developer could not be found.' },
      })
    }

    const priorActive = await prisma.request.findFirst({
      where: {
        type: 'CHAT_REQUEST',
        status: 'PENDING',
        OR: [
          { senderId: req.auth.user.id, recipientId },
          { senderId: recipientId, recipientId: req.auth.user.id },
        ],
      },
      select: { id: true, status: true, senderId: true },
    })
    if (priorActive) {
      return res.status(409).json({
        error: {
          code: 'CHAT_REQUEST_PENDING',
          message: 'A chat request between you is already pending.',
        },
      })
    }

    const activeConversation = await findActivePrivateConversation(prisma, req.auth.user.id, recipientId)
    if (activeConversation) {
      return res.status(409).json({
        error: {
          code: 'CHAT_REQUEST_ACCEPTED',
          message: 'You already have an active chat with this developer.',
        },
      })
    }

    const request = await prisma.request.create({
      data: {
        senderId: req.auth.user.id,
        recipientId,
        type: 'CHAT_REQUEST',
      },
      select: { id: true, status: true, createdAt: true },
    })
    return res.status(201).json({ request: { ...request, recipient } })
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'CHAT_REQUEST_PENDING', message: 'A chat request between you is already pending.' },
      })
    }
    console.error('Chat request could not be created')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not send the chat request.' },
    })
  }
})

router.get('/requests/with/:username', authenticate, async (req, res) => {
  const username = req.params.username.trim().toLowerCase()
  try {
    const otherUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (!otherUser) return res.json({ status: 'NONE' })

    const request = await prisma.request.findFirst({
      where: {
        type: 'CHAT_REQUEST',
        OR: [
          { senderId: req.auth.user.id, recipientId: otherUser.id },
          { senderId: otherUser.id, recipientId: req.auth.user.id },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { status: true, senderId: true },
    })
    if (!request) return res.json({ status: 'NONE' })
    if (request.status === 'ACCEPTED') {
      const activeConversation = await findActivePrivateConversation(
        prisma,
        req.auth.user.id,
        otherUser.id,
      )
      if (!activeConversation) return res.json({ status: 'NONE' })
    }
    return res.json({
      status: request.status,
      direction: request.senderId === req.auth.user.id ? 'OUTGOING' : 'INCOMING',
    })
  } catch {
    console.error('Chat request status could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not check the chat request.' },
    })
  }
})

router.get('/requests/incoming', authenticate, async (req, res) => {
  try {
    const requests = await prisma.request.findMany({
      where: {
        recipientId: req.auth.user.id,
        type: 'CHAT_REQUEST',
        status: 'PENDING',
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        createdAt: true,
        sender: { select: senderSelect },
      },
    })
    return res.json({ requests })
  } catch {
    console.error('Incoming chat requests could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load incoming chat requests.' },
    })
  }
})

router.get('/conversations', authenticate, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        type: 'PRIVATE',
        endedAt: null,
        participants: { some: { userId: req.auth.user.id } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        participants: {
          select: {
            userId: true,
            lastReadAt: true,
            mutedAt: true,
            user: { select: senderSelect },
          },
        },
        messages: {
          take: 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, senderId: true, content: true, createdAt: true },
        },
      },
    })

    const result = await Promise.all(conversations.map(async (conversation) => {
      const ownParticipant = conversation.participants.find(
        (participant) => participant.userId === req.auth.user.id,
      )
      const otherParticipant = conversation.participants.find(
        (participant) => participant.userId !== req.auth.user.id,
      )
      if (!ownParticipant || !otherParticipant) return null

      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: req.auth.user.id },
          ...(ownParticipant.lastReadAt ? { createdAt: { gt: ownParticipant.lastReadAt } } : {}),
        },
      })
      return {
        id: conversation.id,
        createdAt: conversation.createdAt,
        participant: otherParticipant.user,
        lastMessage: conversation.messages[0] ?? null,
        unreadCount,
        isMuted: Boolean(ownParticipant.mutedAt),
      }
    }))

    const visibleConversations = result.filter(Boolean).sort((first, second) => {
      const firstActivity = new Date(first.lastMessage?.createdAt ?? first.createdAt).getTime()
      const secondActivity = new Date(second.lastMessage?.createdAt ?? second.createdAt).getTime()
      return secondActivity - firstActivity
    })
    return res.json({ conversations: visibleConversations })
  } catch {
    console.error('Private conversations could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load private conversations.' },
    })
  }
})

router.get('/conversations/:id/messages', authenticate, async (req, res) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        type: 'PRIVATE',
        endedAt: null,
        participants: { some: { userId: req.auth.user.id } },
      },
      select: { id: true },
    })
    if (!conversation) {
      return res.status(404).json({
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'This conversation is not available.' },
      })
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
        content: true,
        createdAt: true,
        editedAt: true,
        senderId: true,
        clientMessageId: true,
        sender: { select: senderSelect },
      },
    })
    const hasMore = rows.length > 100
    const messages = rows.slice(0, 100).reverse().map((message) => {
      if (message.senderId === req.auth.user.id) return message
      const visibleMessage = { ...message }
      delete visibleMessage.clientMessageId
      return visibleMessage
    })
    return res.json({
      messages,
      hasMore,
      nextCursor: hasMore ? messages[0]?.id ?? null : null,
    })
  } catch {
    console.error('Private conversation messages could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load conversation messages.' },
    })
  }
})

router.patch('/conversations/:id/messages/:messageId', requireSameOrigin, authenticate, async (req, res) => {
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
  if (!content || content.length > 5000) {
    return res.status(400).json({
      error: { code: 'INVALID_MESSAGE_CONTENT', message: 'Messages must contain 1 to 5,000 characters.' },
    })
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const message = await transaction.message.findFirst({
        where: {
          id: req.params.messageId,
          conversationId: req.params.id,
          senderId: req.auth.user.id,
          conversation: {
            is: {
              type: 'PRIVATE',
              endedAt: null,
              participants: { some: { userId: req.auth.user.id } },
            },
          },
        },
        select: { id: true, conversationId: true },
      })
      if (!message) return null

      await transaction.message.update({
        where: { id: message.id },
        data: { content, editedAt: new Date() },
      })
      const conversation = await transaction.conversation.findUnique({
        where: { id: message.conversationId },
        select: { participants: { select: { userId: true } } },
      })
      const updatedMessage = await transaction.message.findUnique({
        where: { id: message.id },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          content: true,
          createdAt: true,
          editedAt: true,
          sender: { select: senderSelect },
        },
      })
      return { message: updatedMessage, participantIds: conversation.participants.map((participant) => participant.userId) }
    }, { isolationLevel: 'Serializable' })

    if (!result) {
      return res.status(404).json({
        error: { code: 'MESSAGE_NOT_FOUND', message: 'This message is not available to edit.' },
      })
    }
    broadcastPrivateMessageChanged(result.participantIds, { type: 'message.updated', message: result.message })
    return res.json({ message: result.message })
  } catch (error) {
    if (error?.code === 'P2034') {
      return res.status(409).json({
        error: { code: 'MESSAGE_CHANGED', message: 'The chat changed. Refresh and try again.' },
      })
    }
    console.error('Private message could not be edited')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not edit this message.' },
    })
  }
})

router.delete('/conversations/:id/messages/:messageId', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const conversation = await transaction.conversation.findFirst({
        where: {
          id: req.params.id,
          type: 'PRIVATE',
          endedAt: null,
          participants: { some: { userId: req.auth.user.id } },
        },
        select: { participants: { select: { userId: true } } },
      })
      if (!conversation || conversation.participants.length !== 2) return null

      const deleted = await transaction.message.deleteMany({
        where: {
          id: req.params.messageId,
          conversationId: req.params.id,
          senderId: req.auth.user.id,
        },
      })
      if (deleted.count !== 1) return null
      return { participantIds: conversation.participants.map((participant) => participant.userId) }
    }, { isolationLevel: 'Serializable' })

    if (!result) {
      return res.status(404).json({
        error: { code: 'MESSAGE_NOT_FOUND', message: 'This message is not available to delete.' },
      })
    }
    broadcastPrivateMessageChanged(result.participantIds, {
      type: 'message.deleted',
      conversationId: req.params.id,
      messageId: req.params.messageId,
    })
    return res.status(204).end()
  } catch (error) {
    if (error?.code === 'P2034') {
      return res.status(409).json({
        error: { code: 'MESSAGE_CHANGED', message: 'The chat changed. Refresh and try again.' },
      })
    }
    console.error('Private message could not be deleted')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not delete this message.' },
    })
  }
})

router.delete('/conversations/:id', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const conversation = await transaction.conversation.findFirst({
        where: {
          id: req.params.id,
          type: 'PRIVATE',
          endedAt: null,
          participants: { some: { userId: req.auth.user.id } },
        },
        select: { id: true, participants: { select: { userId: true } } },
      })
      if (!conversation || conversation.participants.length !== 2) return null

      const endedAt = new Date()
      const update = await transaction.conversation.updateMany({
        where: { id: conversation.id, type: 'PRIVATE', endedAt: null },
        data: { endedAt },
      })
      if (update.count !== 1) return null

      await transaction.message.deleteMany({ where: { conversationId: conversation.id } })
      return {
        id: conversation.id,
        participantIds: conversation.participants.map((participant) => participant.userId),
      }
    }, { isolationLevel: 'Serializable' })

    if (!result) {
      return res.status(404).json({
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'This conversation is not available.' },
      })
    }
    broadcastConversationEnded(result.id, result.participantIds)
    return res.status(204).end()
  } catch (error) {
    if (error?.code === 'P2034') {
      return res.status(409).json({
        error: { code: 'CONVERSATION_CHANGED', message: 'The conversation changed. Refresh and try again.' },
      })
    }
    console.error('Private conversation could not be deleted')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not delete this conversation.' },
    })
  }
})

router.patch('/conversations/:id/read', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const throughMessageId = typeof req.body?.throughMessageId === 'string'
      ? req.body.throughMessageId.trim()
      : ''
    const participant = await prisma.privateConversationParticipant.findFirst({
      where: {
        conversationId: req.params.id,
        userId: req.auth.user.id,
        conversation: { is: { type: 'PRIVATE', endedAt: null } },
      },
      select: { conversationId: true },
    })
    if (!participant) {
      return res.status(404).json({
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'This conversation is not available.' },
      })
    }
    if (!throughMessageId) return res.json({ read: true })

    const throughMessage = await prisma.message.findFirst({
      where: { id: throughMessageId, conversationId: participant.conversationId },
      select: { createdAt: true },
    })
    if (!throughMessage) {
      return res.status(400).json({
        error: { code: 'INVALID_READ_MARKER', message: 'The read message marker is invalid.' },
      })
    }
    await prisma.privateConversationParticipant.updateMany({
      where: {
        conversationId: participant.conversationId,
        userId: req.auth.user.id,
        OR: [
          { lastReadAt: null },
          { lastReadAt: { lt: throughMessage.createdAt } },
        ],
      },
      data: { lastReadAt: throughMessage.createdAt },
    })
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: participant.conversationId,
        senderId: { not: req.auth.user.id },
        createdAt: { gt: throughMessage.createdAt },
      },
    })
    return res.json({ read: true, unreadCount })
  } catch {
    console.error('Private conversation could not be marked read')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not update conversation read state.' },
    })
  }
})

router.patch('/conversations/:id/mute', requireSameOrigin, authenticate, async (req, res) => {
  if (typeof req.body?.muted !== 'boolean') {
    return res.status(400).json({
      error: { code: 'INVALID_MUTE_STATE', message: 'Choose whether to mute this conversation.' },
    })
  }

  try {
    const participant = await prisma.privateConversationParticipant.findFirst({
      where: {
        conversationId: req.params.id,
        userId: req.auth.user.id,
        conversation: { is: { type: 'PRIVATE', endedAt: null } },
      },
      select: { conversationId: true },
    })
    if (!participant) {
      return res.status(404).json({
        error: { code: 'CONVERSATION_NOT_FOUND', message: 'This conversation is not available.' },
      })
    }

    await prisma.privateConversationParticipant.updateMany({
      where: { conversationId: participant.conversationId, userId: req.auth.user.id },
      data: { mutedAt: req.body.muted ? new Date() : null },
    })
    return res.json({ muted: req.body.muted })
  } catch {
    console.error('Private conversation mute state could not be updated')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not update conversation mute settings.' },
    })
  }
})

router.patch('/requests/:id', requireSameOrigin, authenticate, async (req, res) => {
  const status = typeof req.body?.status === 'string'
    ? req.body.status.trim().toUpperCase()
    : ''
  if (!['ACCEPTED', 'DECLINED'].includes(status)) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST_STATUS', message: 'Choose accept or decline.' },
    })
  }

  try {
    if (status === 'DECLINED') {
      const existing = await prisma.request.findFirst({
        where: {
          id: req.params.id,
          recipientId: req.auth.user.id,
          type: 'CHAT_REQUEST',
        },
        select: { id: true, status: true },
      })
      if (!existing) {
        return res.status(404).json({
          error: { code: 'REQUEST_NOT_FOUND', message: 'This chat request is no longer available.' },
        })
      }
      if (existing.status !== 'PENDING') {
        return res.status(409).json({
          error: { code: 'REQUEST_ALREADY_RESOLVED', message: 'This chat request has already been resolved.' },
        })
      }
      const update = await prisma.request.updateMany({
        where: { id: existing.id, recipientId: req.auth.user.id, status: 'PENDING' },
        data: { status, resolvedAt: new Date() },
      })
      if (update.count !== 1) {
        return res.status(409).json({
          error: { code: 'REQUEST_ALREADY_RESOLVED', message: 'This chat request has already been resolved.' },
        })
      }
      return res.json({ request: { id: existing.id, status } })
    }

    const result = await prisma.$transaction(async (transaction) => {
      const request = await transaction.request.findFirst({
        where: {
          id: req.params.id,
          recipientId: req.auth.user.id,
          type: 'CHAT_REQUEST',
        },
        select: { id: true, status: true, senderId: true },
      })
      if (!request) return { error: 'NOT_FOUND' }
      if (request.status !== 'PENDING' && request.status !== 'ACCEPTED') {
        return { error: 'RESOLVED' }
      }

      if (request.status === 'PENDING') {
        const update = await transaction.request.updateMany({
          where: { id: request.id, recipientId: req.auth.user.id, status: 'PENDING' },
          data: { status: 'ACCEPTED', resolvedAt: new Date() },
        })
        if (update.count !== 1) return { error: 'RESOLVED' }
      }

      const conversation = await findOrCreatePrivateConversation(
        transaction,
        request.senderId,
        req.auth.user.id,
      )
      await transaction.notification.upsert({
        where: { requestId: request.id },
        update: {},
        create: {
          recipientId: request.senderId,
          type: 'CHAT_REQUEST_ACCEPTED',
          requestId: request.id,
        },
      })
      return { requestId: request.id, conversation }
    }, { isolationLevel: 'Serializable' })

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({
        error: { code: 'REQUEST_NOT_FOUND', message: 'This chat request is no longer available.' },
      })
    }
    if (result.error === 'RESOLVED') {
      return res.status(409).json({
        error: { code: 'REQUEST_ALREADY_RESOLVED', message: 'This chat request has already been resolved.' },
      })
    }
    return res.json({
      request: { id: result.requestId, status: 'ACCEPTED' },
      conversation: result.conversation,
    })
  } catch (error) {
    if (error?.code === 'P2034') {
      return res.status(409).json({
        error: { code: 'REQUEST_ALREADY_RESOLVED', message: 'This chat request is being handled. Refresh and try again.' },
      })
    }
    console.error('Chat request could not be resolved')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not update the chat request.' },
    })
  }
})

router.get('/notifications/chat-alert', authenticate, async (req, res) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: {
        recipientId: req.auth.user.id,
        OR: [
          { type: 'CHAT_REQUEST_ACCEPTED' },
          {
            type: 'PRIVATE_MESSAGE_RECEIVED',
            message: {
              is: {
                conversation: {
                  is: {
                    participants: {
                      some: { userId: req.auth.user.id, mutedAt: null },
                    },
                  },
                },
              },
            },
          },
        ],
        readAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        type: true,
        createdAt: true,
        request: {
          select: {
            senderId: true,
            recipientId: true,
            recipient: { select: senderSelect },
          },
        },
        message: {
          select: {
            conversationId: true,
            sender: { select: senderSelect },
          },
        },
      },
    })
    if (notification?.type === 'CHAT_REQUEST_ACCEPTED') {
      const conversation = await prisma.conversation.findFirst({
        where: {
          type: 'PRIVATE',
          endedAt: null,
          participants: { some: { userId: notification.request.senderId } },
          AND: [
            { participants: { some: { userId: notification.request.recipientId } } },
            {
              participants: {
                every: {
                  userId: { in: [notification.request.senderId, notification.request.recipientId] },
                },
              },
            },
          ],
        },
        select: { id: true },
      })
      return res.json({ notification: { ...notification, conversationId: conversation?.id ?? null } })
    }
    return res.json({ notification })
  } catch {
    console.error('Chat alert could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load chat alerts.' },
    })
  }
})

router.patch('/notifications/:id/read', requireSameOrigin, authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        recipientId: req.auth.user.id,
        type: { in: ['CHAT_REQUEST_ACCEPTED', 'PRIVATE_MESSAGE_RECEIVED'] },
        readAt: null,
      },
      data: { readAt: new Date() },
    })
    return res.json({ read: true })
  } catch {
    console.error('Chat acceptance alert could not be marked read')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not update the chat alert.' },
    })
  }
})

export default router
