import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { findOrCreatePrivateConversation } from '../lib/private-conversation.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireSameOrigin } from '../middleware/require-same-origin.js'

const router = Router()
const publicUserSelect = { id: true, name: true, username: true }

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

router.get('/options', authenticate, async (req, res) => {
  try {
    const [opportunities, spaces] = await Promise.all([
      prisma.opportunity.findMany({
        where: { ownerId: req.auth.user.id, deletedAt: null, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, description: true },
      }),
      prisma.workspace.findMany({
        where: {
          memberships: {
            some: { userId: req.auth.user.id, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true },
      }),
    ])
    return res.json({ opportunities, collabspaces: spaces })
  } catch {
    console.error('Invitation destinations could not be loaded')
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load invitation destinations.' } })
  }
})

router.get('/', authenticate, async (req, res) => {
  try {
    const invitations = await prisma.request.findMany({
      where: { senderId: req.auth.user.id, type: { in: ['CHAT_INVITATION', 'COLLABSPACE_INVITATION'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        type: true,
        status: true,
        message: true,
        createdAt: true,
        resolvedAt: true,
        recipient: { select: publicUserSelect },
        opportunity: { select: { id: true, description: true, status: true, deletedAt: true } },
        workspace: { select: { id: true, name: true } },
      },
    })
    return res.json({ invitations: invitations.map((invitation) => ({
      ...invitation,
      opportunity: invitation.opportunity
        ? { ...invitation.opportunity, isDeleted: Boolean(invitation.opportunity.deletedAt) }
        : null,
    })) })
  } catch {
    console.error('Outgoing invitations could not be loaded')
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load your invitations.' } })
  }
})

router.get('/incoming', authenticate, async (req, res) => {
  try {
    const invitations = await prisma.request.findMany({
      where: {
        recipientId: req.auth.user.id,
        type: { in: ['CHAT_INVITATION', 'COLLABSPACE_INVITATION'] },
        status: 'PENDING',
        OR: [
          { type: 'CHAT_INVITATION', OR: [{ opportunityId: null }, { opportunity: { deletedAt: null, status: { not: 'COMPLETED' } } }] },
          { type: 'COLLABSPACE_INVITATION', workspace: { isNot: null } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        type: true,
        status: true,
        message: true,
        createdAt: true,
        sender: {
          select: {
            ...publicUserSelect,
            city: true,
            experience: true,
            description: true,
            skills: { select: { skill: { select: { name: true } } } },
          },
        },
        opportunity: { select: { id: true, description: true, status: true } },
        workspace: { select: { id: true, name: true } },
      },
    })
    return res.json({ invitations: invitations.map((invitation) => ({
      ...invitation,
      sender: { ...invitation.sender, skills: invitation.sender.skills.map(({ skill }) => skill.name) },
    })) })
  } catch {
    console.error('Incoming invitations could not be loaded')
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not load incoming invitations.' } })
  }
})

router.post('/', requireSameOrigin, authenticate, async (req, res) => {
  const recipientId = typeof req.body?.recipientId === 'string' ? req.body.recipientId.trim() : ''
  const type = req.body?.type
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() || null : null
  if (!recipientId || recipientId.length > 100 || !['CHAT_INVITATION', 'COLLABSPACE_INVITATION'].includes(type)) {
    return res.status(400).json({ error: { code: 'INVALID_INVITATION', message: 'Choose a developer and invitation destination.' } })
  }
  if (req.body?.message !== undefined && req.body.message !== null && typeof req.body.message !== 'string') {
    return res.status(400).json({ error: { code: 'INVALID_MESSAGE', message: 'The optional message must be text up to 1,000 characters.' } })
  }
  if (message && message.length > 1000) {
    return res.status(400).json({ error: { code: 'INVALID_MESSAGE', message: 'The optional message must be text up to 1,000 characters.' } })
  }
  if (!req.auth.user.username) {
    return res.status(403).json({ error: { code: 'PROFILE_INCOMPLETE', message: 'Complete your profile before sending an invitation.' } })
  }
  if (recipientId === req.auth.user.id) {
    return res.status(400).json({ error: { code: 'SELF_INVITATION', message: 'You cannot invite yourself.' } })
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const recipient = await transaction.user.findFirst({ where: { id: recipientId, username: { not: null } }, select: publicUserSelect })
      if (!recipient) return { error: 'RECIPIENT_NOT_FOUND' }

      let opportunityId = null
      let workspaceId = null
      if (type === 'CHAT_INVITATION') {
        opportunityId = typeof req.body?.opportunityId === 'string' ? req.body.opportunityId.trim() : ''
        if (!opportunityId) return { error: 'DESTINATION_NOT_AVAILABLE' }
        const opportunity = await transaction.opportunity.findFirst({
          where: { id: opportunityId, ownerId: req.auth.user.id, deletedAt: null },
          select: { id: true, status: true },
        })
        if (!opportunity) return { error: 'DESTINATION_NOT_AVAILABLE' }
        if (opportunity.status !== 'OPEN') return { error: 'DESTINATION_CLOSED' }
        const activeConversation = await findActivePrivateConversation(transaction, req.auth.user.id, recipientId)
        if (activeConversation) return { error: 'ALREADY_CONNECTED' }
        const pendingPairRequest = await transaction.request.findFirst({
          where: {
            status: 'PENDING',
            type: { in: ['CHAT_REQUEST', 'CHAT_INVITATION'] },
            OR: [
              { senderId: req.auth.user.id, recipientId },
              { senderId: recipientId, recipientId: req.auth.user.id },
            ],
          },
          select: { id: true },
        })
        if (pendingPairRequest) return { error: 'INVITATION_EXISTS' }
        const previousInvitation = await transaction.request.findFirst({
          where: {
            type: 'CHAT_INVITATION',
            status: 'DECLINED',
            OR: [
              { senderId: req.auth.user.id, recipientId },
              { senderId: recipientId, recipientId: req.auth.user.id },
            ],
          },
          select: { id: true },
        })
        if (previousInvitation) return { error: 'INVITATION_DECLINED' }
      } else {
        workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId.trim() : ''
        if (!workspaceId) return { error: 'DESTINATION_NOT_AVAILABLE' }
        const workspace = await transaction.workspace.findFirst({
          where: {
            id: workspaceId,
            memberships: { some: { userId: req.auth.user.id, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } } },
          },
          select: { id: true },
        })
        if (!workspace) return { error: 'DESTINATION_NOT_AVAILABLE' }
        const membership = await transaction.membership.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: recipientId } },
          select: { status: true },
        })
        if (membership?.status === 'ACTIVE') return { error: 'ALREADY_MEMBER' }
        const previousInvitation = await transaction.request.findFirst({
          where: {
            type: 'COLLABSPACE_INVITATION',
            workspaceId,
            recipientId,
            status: { in: ['PENDING', 'DECLINED'] },
          },
          select: { id: true, status: true },
        })
        if (previousInvitation) return { error: previousInvitation.status === 'DECLINED' ? 'INVITATION_DECLINED' : 'INVITATION_EXISTS' }
      }

      const invitation = await transaction.request.create({
        data: { senderId: req.auth.user.id, recipientId, type, opportunityId, workspaceId, message },
        select: {
          id: true,
          type: true,
          status: true,
          message: true,
          createdAt: true,
          opportunity: { select: { id: true, description: true, status: true } },
          workspace: { select: { id: true, name: true } },
        },
      })
      return { invitation: { ...invitation, recipient } }
    }, { isolationLevel: 'Serializable' })

    if (result.error === 'RECIPIENT_NOT_FOUND') return res.status(404).json({ error: { code: 'RECIPIENT_NOT_FOUND', message: 'This developer could not be found.' } })
    if (result.error === 'DESTINATION_NOT_AVAILABLE') return res.status(404).json({ error: { code: 'DESTINATION_NOT_AVAILABLE', message: 'Choose an opportunity or Collabspace you can manage.' } })
    if (result.error === 'DESTINATION_CLOSED') return res.status(409).json({ error: { code: 'DESTINATION_CLOSED', message: 'This opportunity is not accepting new invitations.' } })
    if (result.error === 'ALREADY_CONNECTED') return res.status(409).json({ error: { code: 'ALREADY_CONNECTED', message: 'You already have an active private chat with this developer.' } })
    if (result.error === 'ALREADY_MEMBER') return res.status(409).json({ error: { code: 'ALREADY_MEMBER', message: 'This developer is already a member of that Collabspace.' } })
    if (result.error === 'INVITATION_DECLINED') return res.status(409).json({ error: { code: 'INVITATION_DECLINED', message: 'This developer declined an invitation to this destination.' } })
    if (result.error === 'INVITATION_EXISTS') return res.status(409).json({ error: { code: 'INVITATION_EXISTS', message: 'There is already a pending invitation for this destination.' } })
    return res.status(201).json({ invitation: result.invitation })
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ error: { code: 'INVITATION_EXISTS', message: 'There is already an invitation for this destination.' } })
    if (error?.code === 'P2034') return res.status(409).json({ error: { code: 'INVITATION_CHANGED', message: 'The destination changed. Refresh and try again.' } })
    console.error('Invitation could not be created')
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not send the invitation.' } })
  }
})

router.patch('/:id', requireSameOrigin, authenticate, async (req, res) => {
  const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : ''
  if (!['ACCEPTED', 'DECLINED'].includes(status)) {
    return res.status(400).json({ error: { code: 'INVALID_INVITATION_STATUS', message: 'Choose accept or decline.' } })
  }
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const invitation = await transaction.request.findFirst({
        where: { id: req.params.id, recipientId: req.auth.user.id, type: { in: ['CHAT_INVITATION', 'COLLABSPACE_INVITATION'] } },
        select: { id: true, senderId: true, recipientId: true, type: true, status: true, opportunityId: true, workspaceId: true,
          opportunity: { select: { deletedAt: true, status: true } } },
      })
      if (!invitation) return { error: 'NOT_FOUND' }
      if (invitation.status !== 'PENDING') return { error: 'RESOLVED' }
      if (invitation.type === 'CHAT_INVITATION' && invitation.opportunityId
        && (invitation.opportunity?.deletedAt || invitation.opportunity?.status === 'COMPLETED')) return { error: 'DESTINATION_CLOSED' }

      let conversationId = null
      if (status === 'ACCEPTED' && invitation.type === 'CHAT_INVITATION') {
        const conversation = await findOrCreatePrivateConversation(transaction, invitation.senderId, invitation.recipientId)
        conversationId = conversation.id
      } else if (status === 'ACCEPTED') {
        const authorizedSpace = await transaction.workspace.findFirst({
          where: {
            id: invitation.workspaceId,
            memberships: { some: { userId: invitation.senderId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } } },
          },
          select: { id: true },
        })
        if (!authorizedSpace) {
          await transaction.request.updateMany({
            where: { id: invitation.id, status: 'PENDING' },
            data: { status: 'CANCELED', resolvedAt: new Date() },
          })
          return { error: 'DESTINATION_UNAVAILABLE' }
        }
        const existingMembership = await transaction.membership.findUnique({
          where: { workspaceId_userId: { workspaceId: authorizedSpace.id, userId: invitation.recipientId } },
          select: { id: true, status: true },
        })
        if (existingMembership?.status === 'ACTIVE') {
          // The invitation can be accepted without changing existing access.
        } else if (existingMembership) {
          await transaction.membership.update({ where: { id: existingMembership.id }, data: { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date(), endedAt: null, lastReadAt: null } })
        } else {
          await transaction.membership.create({ data: { workspaceId: authorizedSpace.id, userId: invitation.recipientId, role: 'MEMBER', status: 'ACTIVE' } })
        }
      }
      const updated = await transaction.request.updateMany({
        where: { id: invitation.id, recipientId: req.auth.user.id, status: 'PENDING' },
        data: { status, resolvedAt: new Date() },
      })
      if (updated.count !== 1) return { error: 'RESOLVED' }
      return { id: invitation.id, status, conversationId, workspaceId: invitation.workspaceId }
    }, { isolationLevel: 'Serializable' })
    if (result.error === 'NOT_FOUND') return res.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'This invitation is no longer available.' } })
    if (result.error === 'RESOLVED') return res.status(409).json({ error: { code: 'INVITATION_RESOLVED', message: 'This invitation has already been resolved.' } })
    if (result.error === 'DESTINATION_CLOSED') return res.status(409).json({ error: { code: 'DESTINATION_CLOSED', message: 'This opportunity invitation is no longer available.' } })
    if (result.error === 'DESTINATION_UNAVAILABLE') return res.status(409).json({ error: { code: 'DESTINATION_UNAVAILABLE', message: 'The inviter no longer manages this Collabspace.' } })
    return res.json({ invitation: result })
  } catch (error) {
    if (error?.code === 'P2034') return res.status(409).json({ error: { code: 'INVITATION_CHANGED', message: 'The invitation changed. Refresh and try again.' } })
    console.error('Invitation could not be resolved')
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not update the invitation.' } })
  }
})

router.delete('/:id', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const withdrawn = await prisma.request.updateMany({
      where: { id: req.params.id, senderId: req.auth.user.id, type: { in: ['CHAT_INVITATION', 'COLLABSPACE_INVITATION'] }, status: 'PENDING' },
      data: { status: 'WITHDRAWN', resolvedAt: new Date() },
    })
    if (withdrawn.count !== 1) return res.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'This pending invitation could not be found.' } })
    return res.status(204).end()
  } catch {
    console.error('Invitation could not be withdrawn')
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not withdraw the invitation.' } })
  }
})

export default router
