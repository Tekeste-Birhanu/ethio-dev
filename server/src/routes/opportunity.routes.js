import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { parseOpportunityInput } from '../lib/opportunity-input.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireSameOrigin } from '../middleware/require-same-origin.js'
import { findOrCreatePrivateConversation } from '../lib/private-conversation.js'

const router = Router()

const opportunitySelect = {
  id: true,
  description: true,
  experienceSought: true,
  city: true,
  status: true,
  commentsEnabled: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true, username: true } },
  categories: { select: { category: true } },
  skillsSought: { select: { skill: { select: { name: true } } } },
  _count: { select: { comments: true } },
}

function toOpportunity(opportunity) {
  const { _count, ...record } = opportunity
  return {
    ...record,
    categories: record.categories.map(({ category }) => category),
    skillsSought: record.skillsSought.map(({ skill }) => skill.name),
    commentCount: _count.comments,
  }
}

const commentSelect = {
  id: true,
  text: true,
  createdAt: true,
  author: { select: { id: true, name: true, username: true } },
}

export function createCollaborationRequestHandler(database) {
  return async (req, res) => {
    const opportunityId = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    const rawMessage = req.body?.message
    if (!opportunityId || opportunityId.length > 100) {
      return res.status(400).json({
        error: { code: 'INVALID_OPPORTUNITY', message: 'Choose an opportunity to request.' },
      })
    }
    if (rawMessage !== undefined && rawMessage !== null && typeof rawMessage !== 'string') {
      return res.status(400).json({
        error: { code: 'INVALID_MESSAGE', message: 'The optional message must be text up to 1,000 characters.' },
      })
    }
    const message = typeof rawMessage === 'string' ? rawMessage.trim() || null : null
    if (message && message.length > 1000) {
      return res.status(400).json({
        error: { code: 'INVALID_MESSAGE', message: 'The optional message must be text up to 1,000 characters.' },
      })
    }
    if (!req.auth.user.name || !req.auth.user.username) {
      return res.status(403).json({
        error: { code: 'PROFILE_INCOMPLETE', message: 'Complete your profile before sending a collaboration request.' },
      })
    }

    try {
      const request = await database.$transaction(async (transaction) => {
        const opportunity = await transaction.opportunity.findFirst({
          where: { id: opportunityId, deletedAt: null },
          select: {
            id: true,
            description: true,
            ownerId: true,
            status: true,
            owner: { select: { id: true, name: true, username: true } },
          },
        })
        if (!opportunity) return { error: 'NOT_FOUND' }
        if (opportunity.status !== 'OPEN') return { error: 'NOT_OPEN' }
        if (opportunity.ownerId === req.auth.user.id) return { error: 'SELF_REQUEST' }

        const existingRequest = await transaction.request.findFirst({
          where: {
            senderId: req.auth.user.id,
            opportunityId: opportunity.id,
            type: 'COLLABORATION_REQUEST',
            status: { in: ['PENDING', 'ACCEPTED', 'DECLINED'] },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, status: true },
        })
        if (existingRequest?.status === 'DECLINED') return { error: 'REQUEST_DECLINED' }
        if (existingRequest?.status === 'PENDING') return { error: 'REQUEST_PENDING' }
        if (existingRequest?.status === 'ACCEPTED') return { error: 'REQUEST_ACCEPTED' }

        const created = await transaction.request.create({
          data: {
            senderId: req.auth.user.id,
            recipientId: opportunity.ownerId,
            type: 'COLLABORATION_REQUEST',
            opportunityId: opportunity.id,
            message,
          },
          select: {
            id: true,
            status: true,
            message: true,
            createdAt: true,
          },
        })
        return {
          request: {
            ...created,
            opportunity: { id: opportunity.id, description: opportunity.description },
            recipient: opportunity.owner,
          },
        }
      }, { isolationLevel: 'Serializable' })

      if (request.error === 'NOT_FOUND') {
        return res.status(404).json({
          error: { code: 'OPPORTUNITY_NOT_FOUND', message: 'This opportunity could not be found.' },
        })
      }
      if (request.error === 'SELF_REQUEST') {
        return res.status(400).json({
          error: { code: 'SELF_REQUEST', message: 'You cannot send a collaboration request for your own opportunity.' },
        })
      }
      if (request.error === 'NOT_OPEN') {
        return res.status(409).json({
          error: { code: 'OPPORTUNITY_NOT_OPEN', message: 'This opportunity is not accepting new requests.' },
        })
      }
      if (request.error === 'REQUEST_PENDING') {
        return res.status(409).json({
          error: { code: 'REQUEST_PENDING', message: 'You already have a pending request for this opportunity.' },
        })
      }
      if (request.error === 'REQUEST_DECLINED') {
        return res.status(409).json({
          error: { code: 'REQUEST_DECLINED', message: 'This request was declined. You cannot send another collaboration request for this opportunity.' },
        })
      }
      if (request.error === 'REQUEST_ACCEPTED') {
        return res.status(409).json({
          error: { code: 'REQUEST_ACCEPTED', message: 'This opportunity request has already been accepted.' },
        })
      }
      return res.status(201).json({ request: request.request })
    } catch (error) {
      if (error?.code === 'P2002') {
        return res.status(409).json({
          error: { code: 'REQUEST_PENDING', message: 'You already have a pending request for this opportunity.' },
        })
      }
      if (error?.code === 'P2034') {
        return res.status(409).json({
          error: { code: 'REQUEST_CHANGED', message: 'The opportunity changed. Refresh and try again.' },
        })
      }
      console.error('Collaboration request could not be created')
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Could not send the collaboration request.' },
      })
    }
  }
}

export function resolveCollaborationRequestHandler(database) {
  return async (req, res) => {
    const status = typeof req.body?.status === 'string'
      ? req.body.status.trim().toUpperCase()
      : ''
    if (!['ACCEPTED', 'DECLINED'].includes(status)) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST_STATUS', message: 'Choose accept or decline.' },
      })
    }
    const destination = req.body?.destination
    if (status === 'ACCEPTED' && !['PRIVATE_CHAT', 'COLLABSPACE', 'CREATE_COLLABSPACE'].includes(destination?.type)) {
      return res.status(400).json({
        error: { code: 'INVALID_DESTINATION', message: 'Choose private chat or a Collabspace for acceptance.' },
      })
    }
    if (status === 'ACCEPTED' && destination.type === 'COLLABSPACE'
      && (typeof destination.workspaceId !== 'string' || !destination.workspaceId.trim())) {
      return res.status(400).json({
        error: { code: 'INVALID_DESTINATION', message: 'Choose a Collabspace.' },
      })
    }
    const newSpaceName = typeof destination?.name === 'string' ? destination.name.trim() : ''
    if (status === 'ACCEPTED' && destination.type === 'CREATE_COLLABSPACE'
      && (!newSpaceName || newSpaceName.length > 100)) {
      return res.status(400).json({
        error: { code: 'INVALID_SPACE_NAME', message: 'Enter a Collabspace name up to 100 characters.' },
      })
    }

    try {
      const result = await database.$transaction(async (transaction) => {
        const request = await transaction.request.findFirst({
          where: {
            id: req.params.id,
            recipientId: req.auth.user.id,
            type: 'COLLABORATION_REQUEST',
          },
          select: {
            id: true,
            status: true,
            senderId: true,
            workspaceId: true,
            opportunity: { select: { id: true, ownerId: true, status: true, deletedAt: true } },
          },
        })
        if (!request || request.opportunity?.ownerId !== req.auth.user.id) return { error: 'NOT_FOUND' }
        if (request.status !== 'PENDING') return { error: 'RESOLVED' }
        if (!request.opportunity || request.opportunity.deletedAt || request.opportunity.status === 'COMPLETED') {
          return { error: 'OPPORTUNITY_CLOSED' }
        }

        let conversation = null
        let workspaceId = null
        if (status === 'ACCEPTED' && destination.type === 'PRIVATE_CHAT') {
          conversation = await findOrCreatePrivateConversation(transaction, req.auth.user.id, request.senderId)
        } else if (status === 'ACCEPTED' && destination.type === 'COLLABSPACE') {
          const space = await transaction.workspace.findFirst({
            where: {
              id: destination.workspaceId.trim(),
              memberships: {
                some: {
                  userId: req.auth.user.id,
                  status: 'ACTIVE',
                  role: { in: ['OWNER', 'ADMIN'] },
                },
              },
            },
            select: { id: true },
          })
          if (!space) return { error: 'SPACE_NOT_AVAILABLE' }
          workspaceId = space.id
        } else if (status === 'ACCEPTED' && destination.type === 'CREATE_COLLABSPACE') {
          const space = await transaction.workspace.create({
            data: { name: newSpaceName },
            select: { id: true },
          })
          await transaction.membership.create({
            data: { workspaceId: space.id, userId: req.auth.user.id, role: 'OWNER', status: 'ACTIVE' },
          })
          workspaceId = space.id
        }

        if (workspaceId) {
          const membership = await transaction.membership.findUnique({
            where: { workspaceId_userId: { workspaceId, userId: request.senderId } },
            select: { id: true, status: true },
          })
          if (membership?.status === 'ACTIVE') {
            // Existing access already satisfies the acceptance destination.
          } else if (membership) {
            await transaction.membership.update({
              where: { id: membership.id },
              data: { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date(), endedAt: null, lastReadAt: null },
            })
          } else {
            await transaction.membership.create({
              data: { workspaceId, userId: request.senderId, role: 'MEMBER', status: 'ACTIVE' },
            })
          }
        }

        const resolvedAt = new Date()
        const updated = await transaction.request.updateMany({
          where: {
            id: request.id,
            recipientId: req.auth.user.id,
            status: 'PENDING',
          },
          data: { status, resolvedAt, workspaceId },
        })
        if (updated.count !== 1) return { error: 'RESOLVED' }

        if (status === 'ACCEPTED') {
          await transaction.notification.upsert({
            where: { requestId: request.id },
            update: {},
            create: {
              recipientId: request.senderId,
              type: 'COLLABORATION_REQUEST_ACCEPTED',
              requestId: request.id,
            },
          })
        }
        return { id: request.id, status, workspaceId, conversationId: conversation?.id ?? null }
      }, { isolationLevel: 'Serializable' })

      if (result.error === 'NOT_FOUND') {
        return res.status(404).json({
          error: { code: 'REQUEST_NOT_FOUND', message: 'This collaboration request is no longer available.' },
        })
      }
      if (result.error === 'OPPORTUNITY_CLOSED') {
        return res.status(409).json({
          error: { code: 'OPPORTUNITY_CLOSED', message: 'This opportunity is no longer accepting requests.' },
        })
      }
      if (result.error === 'RESOLVED') {
        return res.status(409).json({
          error: { code: 'REQUEST_ALREADY_RESOLVED', message: 'This collaboration request has already been resolved.' },
        })
      }
      if (result.error === 'SPACE_NOT_AVAILABLE') {
        return res.status(404).json({
          error: { code: 'COLLABSPACE_NOT_AVAILABLE', message: 'Choose a Collabspace you currently own or administer.' },
        })
      }
      return res.json({ request: result })
    } catch (error) {
      if (error?.code === 'P2034') {
        return res.status(409).json({
          error: { code: 'REQUEST_ALREADY_RESOLVED', message: 'This collaboration request is being handled. Refresh and try again.' },
        })
      }
      console.error('Collaboration request could not be resolved')
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Could not update the collaboration request.' },
      })
    }
  }
}

router.post('/:id/requests', requireSameOrigin, authenticate, createCollaborationRequestHandler(prisma))

router.patch('/requests/:id', requireSameOrigin, authenticate, resolveCollaborationRequestHandler(prisma))

router.get('/requests', authenticate, async (req, res) => {
  try {
    const requests = await prisma.request.findMany({
      where: {
        senderId: req.auth.user.id,
        type: 'COLLABORATION_REQUEST',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        recipient: { select: { id: true, name: true, username: true } },
        opportunity: { select: { id: true, description: true, status: true, deletedAt: true } },
      },
    })

    return res.json({
      requests: requests.map((request) => ({
        ...request,
        opportunity: request.opportunity
          ? {
              id: request.opportunity.id,
              description: request.opportunity.description,
              status: request.opportunity.status,
              isDeleted: Boolean(request.opportunity.deletedAt),
            }
          : null,
      })),
    })
  } catch {
    console.error('Outgoing collaboration requests could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load your sent requests.' },
    })
  }
})

export function createIncomingCollaborationRequestsHandler(database) {
  return async (req, res) => {
    try {
      const requests = await database.request.findMany({
        where: {
          recipientId: req.auth.user.id,
          type: 'COLLABORATION_REQUEST',
          OR: [
            {
              status: 'PENDING',
              opportunity: {
                ownerId: req.auth.user.id,
                deletedAt: null,
                status: { in: ['OPEN', 'PAUSED'] },
              },
            },
            {
              status: { in: ['ACCEPTED', 'DECLINED'] },
              opportunity: { ownerId: req.auth.user.id },
            },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          status: true,
          message: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              city: true,
              experience: true,
              description: true,
              skills: { select: { skill: { select: { name: true } } } },
            },
          },
          opportunity: { select: { id: true, description: true, status: true } },
        },
      })

      return res.json({
        requests: requests.map((request) => ({
          ...request,
          sender: {
            ...request.sender,
            skills: request.sender.skills.map(({ skill }) => skill.name),
          },
        })),
      })
    } catch {
      console.error('Incoming collaboration requests could not be loaded')
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Could not load incoming collaboration requests.' },
      })
    }
  }
}

router.get('/requests/incoming', authenticate, createIncomingCollaborationRequestsHandler(prisma))

router.get('/requests/statuses', authenticate, async (req, res) => {
  try {
    const requests = await prisma.request.findMany({
      where: {
        senderId: req.auth.user.id,
        type: 'COLLABORATION_REQUEST',
        status: { in: ['PENDING', 'ACCEPTED', 'DECLINED'] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      distinct: ['opportunityId'],
      select: { opportunityId: true, status: true },
    })
    return res.json({ requests: requests.filter(({ opportunityId }) => opportunityId) })
  } catch {
    console.error('Outgoing collaboration request statuses could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not check your collaboration requests.' },
    })
  }
})

router.post('/', requireSameOrigin, authenticate, async (req, res) => {
  if (!req.auth.user.name || !req.auth.user.username) {
    return res.status(403).json({
      error: {
        code: 'PROFILE_INCOMPLETE',
        message: 'Complete your name and username before posting an opportunity.',
      },
    })
  }

  const { errors, opportunity: input } = parseOpportunityInput(req.body ?? {})
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the opportunity details and try again.',
        fields: errors,
      },
    })
  }

  try {
    const opportunity = await prisma.$transaction(async (transaction) => {
      const created = await transaction.opportunity.create({
        data: {
          ownerId: req.auth.user.id,
          description: input.description,
          experienceSought: input.experienceSought,
          city: input.city,
          categories: { create: input.categories.map((category) => ({ category })) },
        },
        select: { id: true },
      })

      for (const name of input.skillsSought) {
        const skill = await transaction.skill.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true },
        })
        await transaction.opportunitySkill.create({
          data: { opportunityId: created.id, skillId: skill.id },
        })
      }

      return transaction.opportunity.findUnique({
        where: { id: created.id },
        select: opportunitySelect,
      })
    })

    return res.status(201).json({ opportunity: toOpportunity(opportunity) })
  } catch {
    console.error('Opportunity creation failed')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not publish the opportunity.' },
    })
  }
})

router.get('/', async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
    const skill = typeof req.query.skill === 'string' ? req.query.skill.trim().slice(0, 60) : ''
    const city = typeof req.query.city === 'string' ? req.query.city.trim().slice(0, 60) : ''
    const experience = typeof req.query.experience === 'string'
      ? req.query.experience.trim().toUpperCase()
      : ''
    const experienceValues = ['BEGINNER', 'JUNIOR', 'INTERMEDIATE', 'SENIOR']
    if (experience && !experienceValues.includes(experience)) {
      return res.status(400).json({
        error: { code: 'INVALID_FILTER', message: 'Choose a valid experience level.' },
      })
    }
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor.length > 0
      ? req.query.cursor
      : undefined
    const pageSize = 20
    const opportunities = await prisma.opportunity.findMany({
      where: {
        deletedAt: null,
        status: { in: ['OPEN', 'PAUSED', 'COMPLETED'] },
        ...(query ? {
          OR: [
            { description: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
            { owner: { name: { contains: query, mode: 'insensitive' } } },
            { owner: { username: { contains: query, mode: 'insensitive' } } },
            { owner: { city: { contains: query, mode: 'insensitive' } } },
            { owner: { skills: { some: { skill: { name: { contains: query, mode: 'insensitive' } } } } } },
            { skillsSought: { some: { skill: { name: { contains: query, mode: 'insensitive' } } } } },
          ],
        } : {}),
        ...(skill ? { skillsSought: { some: { skill: { name: { contains: skill, mode: 'insensitive' } } } } } : {}),
        ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
        ...(experience ? { experienceSought: experience } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: pageSize + 1,
      select: opportunitySelect,
    })

    const hasMore = opportunities.length > pageSize
    const page = opportunities.slice(0, pageSize)
    return res.json({
      opportunities: page.map(toOpportunity),
      hasMore,
      nextCursor: hasMore ? page.at(-1).id : null,
    })
  } catch {
    console.error('Opportunities could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load opportunities.' },
    })
  }
})

router.get('/saved', authenticate, async (req, res) => {
  try {
    const saved = await prisma.$queryRaw`
      SELECT "opportunityId", "savedAt"
      FROM "SavedOpportunity"
      WHERE "userId" = ${req.auth.user.id}
      ORDER BY "savedAt" DESC
    `
    const opportunities = saved.length === 0 ? [] : await prisma.opportunity.findMany({
      where: { id: { in: saved.map(({ opportunityId }) => opportunityId) }, deletedAt: null },
      select: opportunitySelect,
    })
    const opportunitiesById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]))

    return res.json({
      opportunities: saved.flatMap(({ opportunityId, savedAt }) => {
        const opportunity = opportunitiesById.get(opportunityId)
        return opportunity ? [{ ...toOpportunity(opportunity), savedAt }] : []
      }),
    })
  } catch {
    console.error('Saved opportunities could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load saved opportunities.' },
    })
  }
})

router.post('/:id/save', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true },
    })
    if (!opportunity) {
      return res.status(404).json({
        error: { code: 'OPPORTUNITY_NOT_FOUND', message: 'This opportunity could not be found.' },
      })
    }

    await prisma.$executeRaw`
      INSERT INTO "SavedOpportunity" ("userId", "opportunityId")
      VALUES (${req.auth.user.id}, ${req.params.id})
      ON CONFLICT ("userId", "opportunityId") DO NOTHING
    `
    return res.json({ saved: true })
  } catch {
    console.error('Opportunity could not be saved')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not save this opportunity.' },
    })
  }
})

router.delete('/:id/save', requireSameOrigin, authenticate, async (req, res) => {
  try {
    await prisma.$executeRaw`
      DELETE FROM "SavedOpportunity"
      WHERE "userId" = ${req.auth.user.id} AND "opportunityId" = ${req.params.id}
    `
    return res.status(204).end()
  } catch {
    console.error('Opportunity could not be removed from saved items')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not remove this saved opportunity.' },
    })
  }
})

router.get('/mine', authenticate, async (req, res) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: { ownerId: req.auth.user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: opportunitySelect,
    })

    return res.json({ opportunities: opportunities.map(toOpportunity) })
  } catch {
    console.error('Member opportunities could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load your opportunities.' },
    })
  }
})

router.get('/user/:username', async (req, res) => {
  try {
    const username = req.params.username.trim().toLowerCase()
    const owner = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    })

    if (!owner) {
      return res.status(404).json({
        error: { code: 'PROFILE_NOT_FOUND', message: 'This profile could not be found.' },
      })
    }

    const opportunities = await prisma.opportunity.findMany({
      where: { ownerId: owner.id, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: opportunitySelect,
    })

    return res.json({ opportunities: opportunities.map(toOpportunity) })
  } catch {
    console.error('Public profile opportunities could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load this developer’s opportunities.' },
    })
  }
})

router.patch('/:id', requireSameOrigin, authenticate, async (req, res) => {
  const { errors, opportunity: input } = parseOpportunityInput(req.body ?? {})
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the opportunity details and try again.',
        fields: errors,
      },
    })
  }

  try {
    const opportunity = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.opportunity.updateMany({
        where: { id: req.params.id, ownerId: req.auth.user.id, deletedAt: null },
        data: {
          description: input.description,
          experienceSought: input.experienceSought,
          city: input.city,
        },
      })

      if (updated.count === 0) return null

      await transaction.opportunityCategory.deleteMany({ where: { opportunityId: req.params.id } })
      if (input.categories.length > 0) {
        await transaction.opportunityCategory.createMany({
          data: input.categories.map((category) => ({ opportunityId: req.params.id, category })),
        })
      }

      await transaction.opportunitySkill.deleteMany({ where: { opportunityId: req.params.id } })
      for (const name of input.skillsSought) {
        const skill = await transaction.skill.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true },
        })
        await transaction.opportunitySkill.create({
          data: { opportunityId: req.params.id, skillId: skill.id },
        })
      }

      return transaction.opportunity.findUnique({
        where: { id: req.params.id },
        select: opportunitySelect,
      })
    })

    if (!opportunity) {
      return res.status(404).json({
        error: { code: 'OPPORTUNITY_NOT_FOUND', message: 'This opportunity could not be found.' },
      })
    }

    return res.json({ opportunity: toOpportunity(opportunity) })
  } catch {
    console.error('Opportunity update failed')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not update the opportunity.' },
    })
  }
})

router.patch('/:id/status', requireSameOrigin, authenticate, async (req, res) => {
  const { status } = req.body ?? {}
  const validStatuses = ['OPEN', 'PAUSED', 'COMPLETED']
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Choose a valid opportunity status action.' },
    })
  }

  try {
    const opportunity = await prisma.$transaction(async (transaction) => {
      const current = await transaction.opportunity.findFirst({
        where: { id: req.params.id, ownerId: req.auth.user.id, deletedAt: null },
        select: { status: true },
      })
      if (!current) return null

      const allowedTransitions = {
        OPEN: ['PAUSED', 'COMPLETED'],
        PAUSED: ['OPEN', 'COMPLETED'],
        COMPLETED: [],
      }
      if (!allowedTransitions[current.status]?.includes(status)) {
        return { invalidTransition: true }
      }
      const updated = await transaction.opportunity.updateMany({
        where: {
          id: req.params.id,
          ownerId: req.auth.user.id,
          deletedAt: null,
          status: current.status,
        },
        data: { status },
      })
      if (updated.count === 0) return { invalidTransition: true }

      if (status === 'COMPLETED') {
        await transaction.request.updateMany({
          where: {
            opportunityId: req.params.id,
            type: { in: ['COLLABORATION_REQUEST', 'CHAT_INVITATION'] },
            status: 'PENDING',
          },
          data: { status: 'CANCELED', resolvedAt: new Date() },
        })
      }

      return transaction.opportunity.findUnique({
        where: { id: req.params.id },
        select: opportunitySelect,
      })
    })

    if (!opportunity) {
      return res.status(404).json({
        error: { code: 'OPPORTUNITY_NOT_FOUND', message: 'This opportunity could not be found.' },
      })
    }
    if (opportunity.invalidTransition) {
      return res.status(400).json({
        error: { code: 'INVALID_STATUS_TRANSITION', message: 'That status change is not available.' },
      })
    }
    return res.json({ opportunity: toOpportunity(opportunity) })
  } catch (error) {
    if (error?.code === 'P2034') {
      return res.status(409).json({
        error: { code: 'OPPORTUNITY_CHANGED', message: 'The opportunity changed. Refresh and try again.' },
      })
    }
    console.error('Opportunity status could not be updated')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not update the opportunity status.' },
    })
  }
})

router.delete('/:id', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const deleted = await prisma.$transaction(async (transaction) => {
      const result = await transaction.opportunity.updateMany({
        where: { id: req.params.id, ownerId: req.auth.user.id, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      if (result.count === 1) {
        await transaction.request.updateMany({
          where: {
            opportunityId: req.params.id,
            type: { in: ['COLLABORATION_REQUEST', 'CHAT_INVITATION'] },
            status: 'PENDING',
          },
          data: { status: 'CANCELED', resolvedAt: new Date() },
        })
      }
      return result
    }, { isolationLevel: 'Serializable' })

    if (deleted.count === 0) {
      return res.status(404).json({
        error: { code: 'OPPORTUNITY_NOT_FOUND', message: 'This opportunity could not be found.' },
      })
    }

    return res.status(204).end()
  } catch (error) {
    if (error?.code === 'P2034') {
      return res.status(409).json({
        error: { code: 'OPPORTUNITY_CHANGED', message: 'The opportunity changed. Refresh and try again.' },
      })
    }
    console.error('Opportunity deletion failed')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not delete the opportunity.' },
    })
  }
})

router.get('/:id/comments', async (req, res) => {
  try {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { commentsEnabled: true },
    })

    if (!opportunity) {
      return res.status(404).json({
        error: { code: 'OPPORTUNITY_NOT_FOUND', message: 'This opportunity could not be found.' },
      })
    }

    const comments = await prisma.comment.findMany({
      where: { opportunityId: req.params.id },
      orderBy: { createdAt: 'asc' },
      select: commentSelect,
    })

    return res.json({ comments, commentsEnabled: opportunity.commentsEnabled })
  } catch {
    console.error('Opportunity comments could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load comments.' },
    })
  }
})

router.post('/:id/comments', requireSameOrigin, authenticate, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
  if (!text || text.length > 1000) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Write a comment up to 1,000 characters.',
        fields: { text: 'Write a comment up to 1,000 characters.' },
      },
    })
  }

  try {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { commentsEnabled: true },
    })

    if (!opportunity) {
      return res.status(404).json({
        error: { code: 'OPPORTUNITY_NOT_FOUND', message: 'This opportunity could not be found.' },
      })
    }
    if (!opportunity.commentsEnabled) {
      return res.status(403).json({
        error: { code: 'COMMENTS_DISABLED', message: 'The owner has turned off comments for this opportunity.' },
      })
    }

    const comment = await prisma.comment.create({
      data: { opportunityId: req.params.id, authorId: req.auth.user.id, text },
      select: commentSelect,
    })

    return res.status(201).json({ comment })
  } catch {
    console.error('Opportunity comment could not be created')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not post your comment.' },
    })
  }
})

router.delete('/:id/comments/:commentId', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const comment = await prisma.comment.findFirst({
      where: { id: req.params.commentId, opportunityId: req.params.id },
      select: { authorId: true, opportunity: { select: { ownerId: true } } },
    })

    if (!comment) {
      return res.status(404).json({
        error: { code: 'COMMENT_NOT_FOUND', message: 'This comment could not be found.' },
      })
    }
    if (comment.authorId !== req.auth.user.id && comment.opportunity.ownerId !== req.auth.user.id) {
      return res.status(404).json({
        error: { code: 'COMMENT_NOT_FOUND', message: 'This comment could not be found.' },
      })
    }

    await prisma.comment.delete({ where: { id: req.params.commentId } })
    return res.status(204).end()
  } catch {
    console.error('Opportunity comment could not be deleted')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not delete the comment.' },
    })
  }
})

router.patch('/:id/comments/:commentId', requireSameOrigin, authenticate, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
  if (!text || text.length > 1000) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Write a comment up to 1,000 characters.',
        fields: { text: 'Write a comment up to 1,000 characters.' },
      },
    })
  }

  try {
    const updated = await prisma.comment.updateMany({
      where: {
        id: req.params.commentId,
        opportunityId: req.params.id,
        authorId: req.auth.user.id,
      },
      data: { text },
    })

    if (updated.count === 0) {
      return res.status(404).json({
        error: { code: 'COMMENT_NOT_FOUND', message: 'This comment could not be found.' },
      })
    }

    const comment = await prisma.comment.findUnique({
      where: { id: req.params.commentId },
      select: commentSelect,
    })
    return res.json({ comment })
  } catch {
    console.error('Opportunity comment could not be updated')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not update the comment.' },
    })
  }
})

router.patch('/:id/comments', requireSameOrigin, authenticate, async (req, res) => {
  const { commentsEnabled } = req.body ?? {}
  if (typeof commentsEnabled !== 'boolean') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Choose whether comments are enabled.',
        fields: { commentsEnabled: 'Choose whether comments are enabled.' },
      },
    })
  }

  try {
    const updated = await prisma.opportunity.updateMany({
      where: { id: req.params.id, ownerId: req.auth.user.id, deletedAt: null },
      data: { commentsEnabled },
    })

    if (updated.count === 0) {
      return res.status(404).json({
        error: { code: 'OPPORTUNITY_NOT_FOUND', message: 'This opportunity could not be found.' },
      })
    }

    return res.json({ commentsEnabled })
  } catch {
    console.error('Opportunity comment setting could not be updated')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not update the comment setting.' },
    })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const opportunity = await prisma.opportunity.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: opportunitySelect,
    })

    if (!opportunity) {
      return res.status(404).json({
        error: { code: 'OPPORTUNITY_NOT_FOUND', message: 'This opportunity could not be found.' },
      })
    }

    return res.json({ opportunity: toOpportunity(opportunity) })
  } catch {
    console.error('Opportunity could not be loaded')
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load this opportunity.' },
    })
  }
})

export default router
