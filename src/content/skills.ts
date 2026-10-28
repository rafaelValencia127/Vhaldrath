import { skillCatalogSchema, type SkillCatalog } from '../domain/schema';

// Global skills shared by every class. Areas are the broad stats on the character sheet.
export const builtInCatalog: SkillCatalog = skillCatalogSchema.parse({
  areas: [
    { id: 'engineering', name: 'Engineering' },
    { id: 'arts', name: 'Arts' },
    { id: 'languages', name: 'Languages' },
    { id: 'finance', name: 'Finance' },
  ],
  skills: [
    { id: 'python', name: 'Python', areaId: 'engineering' },
    { id: 'apis', name: 'APIs', areaId: 'engineering' },
    { id: 'data', name: 'Data', areaId: 'engineering' },
    { id: 'ml', name: 'Machine Learning', areaId: 'engineering' },
    { id: 'llm', name: 'LLMs', areaId: 'engineering' },
    { id: 'cloud', name: 'Cloud', areaId: 'engineering' },
    { id: 'devops', name: 'DevOps', areaId: 'engineering' },
    { id: 'mlops', name: 'MLOps', areaId: 'engineering' },
    { id: 'testing', name: 'Testing', areaId: 'engineering' },
    { id: 'docs', name: 'Documentation', areaId: 'engineering' },
    { id: 'architecture', name: 'Architecture', areaId: 'engineering' },
    { id: 'security', name: 'Security', areaId: 'engineering' },
    { id: 'english', name: 'English', areaId: 'languages' },
  ],
  titles: [
    { skillId: 'python', level: 5, title: 'Python Adept' },
    { skillId: 'llm', level: 5, title: 'AI Builder' },
    { skillId: 'cloud', level: 5, title: 'Cloud Ranger' },
    { skillId: 'mlops', level: 5, title: 'MLOps Architect' },
  ],
});
