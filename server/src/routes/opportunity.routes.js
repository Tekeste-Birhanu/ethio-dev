import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { parseOpportunityInput } from '../lib/opportunity-input.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireSameOrigin } from '../middleware/require-same-origin.js'

const router = Router()

const opportunitySelect = {
  id: true,
  description: true,
  experienceSought: true,
  workSetup: true,
  workCity: true,
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
          workSetup: input.workSetup,
          workCity: input.workCity,
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

router.get('/', async (_req, res) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: {
        deletedAt: null,
        status: { in: ['OPEN', 'PAUSED', 'FILLED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: opportunitySelect,
    })

    return res.json({ opportunities: opportunities.map(toOpportunity) })
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
          workSetup: input.workSetup,
          workCity: input.workCity,
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

router.delete('/:id', requireSameOrigin, authenticate, async (req, res) => {
  try {
    const deleted = await prisma.opportunity.updateMany({
      where: { id: req.params.id, ownerId: req.auth.user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    if (deleted.count === 0) {
      return res.status(404).json({
        error: { code: 'OPPORTUNITY_NOT_FOUND', message: 'This opportunity could not be found.' },
      })
    }

    return res.status(204).end()
  } catch {
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
