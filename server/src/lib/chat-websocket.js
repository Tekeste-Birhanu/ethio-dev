import { WebSocketServer, WebSocket } from 'ws'
import { prisma } from './prisma.js'
import { findSession, readSessionId } from './session.js'

const CHAT_SOCKET_PATH = '/api/chat/socket'
const MAX_MESSAGE_LENGTH = 5000
const publicUserSelect = { id: true, name: true, username: true }
const clientsByUserId = new Map()

function sendJson(socket, value) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
}

function rejectUpgrade(socket, statusCode, statusText) {
  if (!socket.destroyed) {
    socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`)
    socket.destroy()
  }
}

function addClient(userId, socket) {
  const clients = clientsByUserId.get(userId) ?? new Set()
  clients.add(socket)
  clientsByUserId.set(userId, clients)
}

function removeClient(userId, socket) {
  const clients = clientsByUserId.get(userId)
  if (!clients) return
  clients.delete(socket)
  if (clients.size === 0) clientsByUserId.delete(userId)
}

function broadcastToUser(userId, event) {
  const clients = clientsByUserId.get(userId)
  if (!clients) return
  for (const client of clients) sendJson(client, event)
}

export function broadcastConversationEnded(conversationId, participantIds) {
  for (const userId of participantIds) {
    broadcastToUser(userId, { type: 'conversation.ended', conversationId })
  }
}

export function broadcastPrivateMessageChanged(participantIds, event) {
  for (const userId of participantIds) broadcastToUser(userId, event)
}

function validateMessageEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) || event.type !== 'message.send') {
    return { error: 'Unsupported chat event.' }
  }
  const { conversationId, clientMessageId } = event
  const content = typeof event.content === 'string' ? event.content.trim() : ''
  if (typeof conversationId !== 'string' || conversationId.length < 1 || conversationId.length > 100) {
    return { error: 'Choose a valid conversation.' }
  }
  if (typeof clientMessageId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(clientMessageId)) {
    return { error: 'A valid message ID is required.' }
  }
  if (!content) return { error: 'Write a message before sending.' }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return { error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` }
  }
  return { conversationId, clientMessageId, content }
}

async function persistPrivateMessage(userId, { conversationId, clientMessageId, content }) {
  return prisma.$transaction(async (transaction) => {
    const conversation = await transaction.conversation.findFirst({
      where: {
        id: conversationId,
        type: 'PRIVATE',
        endedAt: null,
        participants: { some: { userId } },
      },
      select: {
        participants: { select: { userId: true, mutedAt: true } },
      },
    })
    if (!conversation || conversation.participants.length !== 2) {
      return { error: { code: 'CONVERSATION_NOT_FOUND', message: 'This conversation is not available.' } }
    }
    const recipient = conversation.participants.find((participant) => participant.userId !== userId)
    if (!recipient) {
      return { error: { code: 'CONVERSATION_NOT_FOUND', message: 'This conversation is not available.' } }
    }

    const message = await transaction.message.upsert({
      where: { senderId_clientMessageId: { senderId: userId, clientMessageId } },
      update: {},
      create: { conversationId, senderId: userId, clientMessageId, content },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        clientMessageId: true,
        content: true,
        createdAt: true,
        sender: { select: publicUserSelect },
      },
    })
    if (message.conversationId !== conversationId || message.content !== content) {
      return { error: { code: 'MESSAGE_ID_REUSED', message: 'This message could not be retried safely.' } }
    }

    if (!recipient.mutedAt) {
      await transaction.notification.upsert({
        where: { messageId: message.id },
        update: {},
        create: {
          recipientId: recipient.userId,
          type: 'PRIVATE_MESSAGE_RECEIVED',
          messageId: message.id,
        },
        select: { id: true },
      })
    }
    return { message, recipientId: recipient.userId }
  }, { isolationLevel: 'Serializable' })
}

async function handleMessage(socket, rawData, isBinary) {
  let event
  try {
    if (isBinary) {
      return sendJson(socket, { type: 'error', code: 'UNSUPPORTED_DATA', message: 'Only text chat events are supported.' })
    }
    event = JSON.parse(rawData.toString())
  } catch {
    return sendJson(socket, { type: 'error', code: 'INVALID_EVENT', message: 'The chat event is not valid JSON.' })
  }

  const validated = validateMessageEvent(event)
  if (validated.error) {
    return sendJson(socket, {
      type: 'error',
      code: 'INVALID_MESSAGE',
      message: validated.error,
      clientMessageId: event?.clientMessageId,
    })
  }

  try {
    const session = await findSession(socket.sessionId)
    if (!session || session.user.id !== socket.user.id) {
      socket.close(4401, 'Session expired')
      return
    }
    const result = await persistPrivateMessage(socket.user.id, validated)
    if (result.error) {
      return sendJson(socket, {
        type: 'error',
        ...result.error,
        clientMessageId: validated.clientMessageId,
      })
    }

    const eventData = { type: 'message.created', message: result.message }
    const recipients = new Set([socket.user.id, result.recipientId])
    for (const recipientId of recipients) {
      const message = { ...result.message }
      if (recipientId !== result.message.senderId) delete message.clientMessageId
      broadcastToUser(recipientId, { ...eventData, message })
    }
    sendJson(socket, {
      type: 'message.ack',
      clientMessageId: validated.clientMessageId,
      message: result.message,
    })
  } catch (error) {
    const code = error?.code === 'P2034' ? 'MESSAGE_RETRY' : 'MESSAGE_SEND_FAILED'
    sendJson(socket, {
      type: 'error',
      code,
      message: code === 'MESSAGE_RETRY'
        ? 'The chat changed while sending. Retry this message.'
        : 'Could not send the message. Reconnect and check the conversation before retrying.',
      clientMessageId: validated.clientMessageId,
    })
  }
}

export function attachChatWebSocket(server) {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 })
  const allowedOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'

  webSocketServer.on('connection', (client) => {
    client.isAlive = true
    client.on('pong', () => { client.isAlive = true })
  })

  const heartbeat = setInterval(() => {
    for (const client of webSocketServer.clients) {
      if (client.readyState !== WebSocket.OPEN) continue
      if (!client.isAlive) {
        client.terminate()
        continue
      }
      client.isAlive = false
      client.ping()
    }
  }, 30000)
  heartbeat.unref()
  webSocketServer.once('close', () => clearInterval(heartbeat))

  server.on('upgrade', async (request, socket, head) => {
    let pathname
    try {
      pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    } catch {
      return rejectUpgrade(socket, 400, 'Bad Request')
    }
    if (pathname !== CHAT_SOCKET_PATH) return rejectUpgrade(socket, 404, 'Not Found')
    if (request.headers.origin !== allowedOrigin) return rejectUpgrade(socket, 403, 'Forbidden')

    try {
      const sessionId = readSessionId(request)
      const session = await findSession(sessionId)
      if (!session) return rejectUpgrade(socket, 401, 'Unauthorized')
      if (socket.destroyed) return

      webSocketServer.handleUpgrade(request, socket, head, (client) => {
        client.sessionId = sessionId
        client.user = session.user
        addClient(session.user.id, client)
        client.on('message', (data, isBinary) => { void handleMessage(client, data, isBinary) })
        client.once('close', () => removeClient(session.user.id, client))
        client.on('error', () => removeClient(session.user.id, client))
        sendJson(client, { type: 'connection.ready' })
      })
    } catch {
      rejectUpgrade(socket, 500, 'Internal Server Error')
    }
  })

  return webSocketServer
}
