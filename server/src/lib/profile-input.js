export const experienceLevels = ['BEGINNER', 'JUNIOR', 'INTERMEDIATE', 'SENIOR']

export function parseProfileInput(body) {
  const errors = {}
  const city = typeof body.city === 'string' ? body.city.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const experience = typeof body.experience === 'string' ? body.experience : ''
  const rawSkills = Array.isArray(body.skills)
    ? body.skills
    : typeof body.skills === 'string'
      ? body.skills.split(',')
      : []

  if (city.length > 100) errors.city = 'City must be 100 characters or fewer.'
  if (description.length > 2000) {
    errors.description = 'Description must be 2,000 characters or fewer.'
  }
  if (experience && !experienceLevels.includes(experience)) {
    errors.experience = 'Choose a listed experience level.'
  }

  const skills = []
  for (const rawSkill of rawSkills) {
    if (typeof rawSkill !== 'string') {
      errors.skills = 'Enter skills as a comma-separated list.'
      break
    }

    const name = rawSkill.trim().toLowerCase()
    if (!name) continue
    if (name.length > 40) {
      errors.skills = 'Each skill must be 40 characters or fewer.'
      break
    }
    if (!skills.includes(name)) skills.push(name)
  }

  if (skills.length > 20) errors.skills = 'Add up to 20 skills.'

  return {
    errors,
    profile: {
      city: city || null,
      description: description || null,
      experience: experience || null,
      skills,
    },
  }
}

export async function syncUserSkills(transaction, userId, skillNames) {
  for (const name of skillNames) {
    const skill = await transaction.skill.upsert({
      where: { name },
      update: {},
      create: { name },
      select: { id: true },
    })

    await transaction.userSkill.create({
      data: { userId, skillId: skill.id },
    })
  }
}
