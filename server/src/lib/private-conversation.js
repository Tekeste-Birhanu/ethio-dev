const publicUserSelect = { id: true, name: true, username: true }

export async function findOrCreatePrivateConversation(transaction, firstUserId, secondUserId) {
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
      participants: { select: { user: { select: publicUserSelect } } },
    },
  })
  if (conversation) {
    if (conversation.participants.length !== 2) throw new Error('Private conversation must have exactly two participants.')
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
      participants: { select: { user: { select: publicUserSelect } } },
    },
  })
}
