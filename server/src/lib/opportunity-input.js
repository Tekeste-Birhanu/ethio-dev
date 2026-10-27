export const opportunityCategories = [
  'WEB',
  'MOBILE',
  'DESKTOP',
  'DATA_AI',
  'GAMES',
  'DEVELOPER_TOOLS_OPEN_SOURCE',
  'HARDWARE_IOT',
  'OTHER',
]

export const opportunityWorkSetups = ['REMOTE', 'IN_PERSON', 'HYBRID']
export const experienceLevels = ['BEGINNER', 'JUNIOR', 'INTERMEDIATE', 'SENIOR']

export function parseOpportunityInput(body) {
  const errors = {}
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const experienceSought = body.experienceSought ?? null
  const workSetup = body.workSetup ?? null
  const rawWorkCity = body.workCity ?? ''
  const workCity = typeof rawWorkCity === 'string' ? rawWorkCity.trim() : ''
  const rawCategories = body.categories ?? []
  const rawSkills = body.skillsSought ?? []

  if (!description) errors.description = 'Write a description for the opportunity.'

  if (experienceSought !== null && !experienceLevels.includes(experienceSought)) {
    errors.experienceSought = 'Choose a listed experience level.'
  }

  if (workSetup !== null && !opportunityWorkSetups.includes(workSetup)) {
    errors.workSetup = 'Choose Remote, In-person, or Hybrid.'
  }

  if (typeof rawWorkCity !== 'string' || workCity.length > 100) {
    errors.workCity = 'City must be 100 characters or fewer.'
  } else if (['IN_PERSON', 'HYBRID'].includes(workSetup) && !workCity) {
    errors.workCity = 'Enter a city for in-person or hybrid work.'
  } else if (workSetup !== 'IN_PERSON' && workSetup !== 'HYBRID' && workCity) {
    errors.workCity = 'City is only used for in-person or hybrid work.'
  }

  const categories = []
  if (!Array.isArray(rawCategories)) {
    errors.categories = 'Choose categories from the available list.'
  } else {
    for (const category of rawCategories) {
      if (typeof category !== 'string' || !opportunityCategories.includes(category)) {
        errors.categories = 'Choose categories from the available list.'
        break
      }
      if (!categories.includes(category)) categories.push(category)
    }
  }

  const skillsSought = []
  if (!Array.isArray(rawSkills)) {
    errors.skillsSought = 'Enter skills as a list.'
  } else {
    for (const rawSkill of rawSkills) {
      if (typeof rawSkill !== 'string') {
        errors.skillsSought = 'Enter skills as a list.'
        break
      }
      const skill = rawSkill.trim().toLowerCase()
      if (!skill) continue
      if (skill.length > 40) {
        errors.skillsSought = 'Each skill must be 40 characters or fewer.'
        break
      }
      if (!skillsSought.includes(skill)) skillsSought.push(skill)
    }
    if (skillsSought.length > 20) {
      errors.skillsSought = 'Add up to 20 skills.'
    }
  }

  return {
    errors,
    opportunity: {
      description,
      experienceSought,
      workSetup,
      workCity: workCity || null,
      categories,
      skillsSought,
    },
  }
}
