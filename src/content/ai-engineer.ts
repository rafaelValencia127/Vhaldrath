import { classSchema, type ClassDef } from '../domain/schema';

// Official course library from the roadmap. Links are used as given; none are invented.
const R = {
  cs50p: { title: 'CS50P — Introduction to Programming with Python', url: 'https://cs50.harvard.edu/python/' },
  pandas: { title: 'Kaggle Learn — Pandas', url: 'https://www.kaggle.com/learn/pandas' },
  introMl: { title: 'Kaggle Learn — Intro to Machine Learning', url: 'https://www.kaggle.com/learn/intro-to-machine-learning' },
  mlcc: { title: 'Google Machine Learning Crash Course', url: 'https://developers.google.com/machine-learning/crash-course' },
  hfLlm: { title: 'Hugging Face LLM Course', url: 'https://huggingface.co/learn/llm-course/chapter1/1' },
  fsdl: { title: 'Full Stack Deep Learning — LLM Bootcamp', url: 'https://fullstackdeeplearning.com/llm-bootcamp/' },
  fastapi: { title: 'FastAPI tutorial', url: 'https://fastapi.tiangolo.com/tutorial/' },
  docker: { title: 'Docker Get Started', url: 'https://docs.docker.com/get-started/' },
  terraform: { title: 'HashiCorp Terraform AWS tutorials', url: 'https://developer.hashicorp.com/terraform/tutorials/aws-get-started' },
  skillBuilder: { title: 'AWS Skill Builder', url: 'https://skillbuilder.aws/' },
  zoomcamp: { title: 'MLOps Zoomcamp', url: 'https://github.com/DataTalksClub/mlops-zoomcamp' },
  saa: { title: 'AWS Solutions Architect Associate — official', url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/' },
  mlea: { title: 'AWS ML Engineer Associate — official', url: 'https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/' },
} as const;

const CH = {
  c1: 'ch1-python-initiate',
  c2: 'ch2-llm-artificer',
  c3: 'ch3-cloud-ranger',
  c4: 'ch4-mlops-architect',
  c5: 'endgame-job-hunt',
} as const;

type Row = [week: number, chapter: string, stat: string, title: string, evidenceHint: string, resources: { title: string; url: string }[]];

const BOSS_WEEKS = new Set([9, 18, 26, 34, 36]);

// Titles are the roadmap's exact definitions of done; they are the acceptance criteria.
const rows: Row[] = [
  [1, CH.c1, 'CODE', 'Set up Python, uv or venv, Git repo and pytest; run green sample tests.', 'Commit link to the repo plus a screenshot or log of pytest passing.', [R.cs50p]],
  [2, CH.c1, 'CODE', 'Write file-processing scripts with type hints and basic exceptions; add README.', 'Commit link with the scripts and README.', [R.cs50p]],
  [3, CH.c1, 'CODE', 'Build a FastAPI GET/POST endpoint with validation and tests.', 'Commit link showing the endpoints and their passing tests.', [R.cs50p, R.fastapi]],
  [4, CH.c1, 'DATA', 'Complete pandas exercises; clean a CSV and publish a notebook.', 'Link to the published notebook (or the course progress page).', [R.pandas]],
  [5, CH.c1, 'INT', 'Train a scikit-learn baseline and document train/test split.', 'Commit or notebook link with the baseline and a short split explanation.', [R.introMl]],
  [6, CH.c1, 'INT', 'Compare models using an appropriate metric; describe leakage risks.', 'Notebook link plus a written reflection on the leakage risks you found.', [R.introMl]],
  [7, CH.c1, 'INT', 'Study gradient descent, classification and overfitting; implement examples.', 'Commit link to the examples, or a written explanation in your own words.', [R.mlcc]],
  [8, CH.c1, 'INT', 'Write an evaluation report including error slices and confusion matrix.', 'Link to the report (Markdown, notebook or PDF).', [R.mlcc]],
  [9, CH.c1, 'CODE', 'BOSS: deploy or package an ML prediction API with tests and reproducible setup.', 'Repo link with setup instructions anyone can follow, plus passing tests; demo URL if deployed.', [R.mlcc, R.fastapi]],
  [10, CH.c2, 'CODE', 'Use a model API; implement structured JSON outputs and graceful errors.', 'Commit link showing schema-validated output and error handling.', [R.hfLlm]],
  [11, CH.c2, 'INT', 'Experiment with embeddings and semantic similarity; write retrieval tests.', 'Notebook or commit link plus at least one passing retrieval test.', [R.hfLlm]],
  [12, CH.c2, 'DATA', 'Build document parsing and chunking pipeline with metadata.', 'Commit link to the pipeline with sample output.', [R.hfLlm]],
  [13, CH.c2, 'DATA', 'Index documents in PostgreSQL + pgvector and retrieve relevant passages.', 'Commit link plus a screenshot of a query returning relevant passages.', [R.hfLlm]],
  [14, CH.c2, 'INT', 'Build citation-grounded question answering and an evaluation dataset.', 'Commit link to the QA flow and the evaluation dataset.', [R.fsdl]],
  [15, CH.c2, 'OPS', 'Study LLM system design; protect against prompt injection and unsafe file types.', 'Commit link to the protections plus a short write-up of the threats covered.', [R.fsdl, R.fastapi]],
  [16, CH.c2, 'CODE', 'Build Next.js UI with upload, query history and explicit citations.', 'Commit link or screenshot of upload, history and citations working.', []],
  [17, CH.c2, 'OPS', 'Add authentication, document ownership and cost/latency instrumentation.', 'Commit link plus a screenshot of the latency/cost numbers.', []],
  [18, CH.c2, 'CHA', 'BOSS: demo the completed AI Document Intelligence app with architecture README.', 'Demo link or recording plus the architecture README. Public/synthetic docs only; measured p95 latency and per-query cost; no fabricated benchmarks.', []],
  [19, CH.c3, 'CLOUD', 'Dockerize API and frontend; run local stack via Compose.', 'Commit link with Dockerfiles and compose file.', [R.docker, R.skillBuilder]],
  [20, CH.c3, 'CLOUD', 'Learn Linux/networking basics; explain HTTP, DNS, TLS, IAM and VPC.', 'Written explanation in your own words (a reflection is valid evidence).', [R.docker, R.skillBuilder]],
  [21, CH.c3, 'CLOUD', 'Set up AWS IAM least privilege, budgets and alerts before deployment.', 'Screenshot of the budget alert and a note on the IAM policies (no secrets).', [R.terraform, R.skillBuilder]],
  [22, CH.c3, 'CLOUD', 'Provision a minimal AWS environment with Terraform and destroy safely.', 'Commit link to the Terraform code plus apply/destroy output.', [R.terraform, R.skillBuilder]],
  [23, CH.c3, 'CLOUD', 'Deploy a backend on ECS or another suitable managed container service.', 'Deployed URL or screenshot of the running service.', [R.skillBuilder]],
  [24, CH.c3, 'OPS', 'Create GitHub Actions lint/test/build/deploy pipeline; protect secrets.', 'Link to a green pipeline run.', [R.skillBuilder]],
  [25, CH.c3, 'OPS', 'Add metrics, logs, load tests, cost report and rollback runbook.', 'Links to the dashboards/report and the runbook.', [R.skillBuilder]],
  [26, CH.c3, 'CHA', 'BOSS: production-style public demo (or recorded proof) + architecture review.', 'Public demo URL or recording plus the architecture review document.', [R.skillBuilder, R.saa]],
  [27, CH.c4, 'DATA', 'Choose public/synthetic dataset; write validation and model baseline.', 'Commit link with data validation and the baseline.', [R.zoomcamp]],
  [28, CH.c4, 'OPS', 'Track experiments and parameters with MLflow.', 'Screenshot of tracked MLflow runs.', [R.zoomcamp]],
  [29, CH.c4, 'DATA', 'Version datasets/configuration; make training reproducible.', 'Commit link plus the one command that reproduces training.', [R.zoomcamp]],
  [30, CH.c4, 'OPS', 'Automate data preparation and model training pipeline.', 'Link to a pipeline run.', [R.zoomcamp]],
  [31, CH.c4, 'OPS', 'Use a registry or artifact store; define model promotion criteria.', 'Screenshot of the registry plus the written promotion criteria.', [R.zoomcamp]],
  [32, CH.c4, 'CODE', 'Serve model through FastAPI; write contract tests and Docker image.', 'Commit link with contract tests and Dockerfile.', [R.zoomcamp, R.fastapi]],
  [33, CH.c4, 'OPS', 'Measure inference latency, drift signals and error handling.', 'Link to the measurements (report or dashboard).', [R.zoomcamp]],
  [34, CH.c4, 'CHA', 'BOSS: document working retrain-to-deploy workflow and rollback.', 'Documentation link: reproducible training from CLI, tracked runs, promotion, tested endpoint, measured latency, monitoring and rollback notes.', [R.zoomcamp, R.mlea]],
  [35, CH.c5, 'CHA', 'Publish English READMEs, two architecture diagrams, metrics and case studies.', 'Links to the published READMEs and case studies.', []],
  [36, CH.c5, 'CHA', 'BOSS: rehearse 2 system design interviews; tailor CV and start applying.', 'Written reflection on both rehearsals plus the tailored CV (file) and a count of applications sent.', []],
];

// Skills each week trains (ids from src/content/skills.ts).
const TAGS: Record<number, string[]> = {
  1: ['python', 'testing'],
  2: ['python', 'docs'],
  3: ['python', 'apis', 'testing'],
  4: ['python', 'data'],
  5: ['python', 'ml'],
  6: ['ml', 'data'],
  7: ['ml'],
  8: ['ml', 'docs'],
  9: ['python', 'apis', 'ml', 'testing'],
  10: ['llm', 'apis'],
  11: ['llm', 'ml'],
  12: ['llm', 'data'],
  13: ['llm', 'data'],
  14: ['llm', 'ml'],
  15: ['llm', 'security'],
  16: ['llm', 'apis'],
  17: ['apis', 'security'],
  18: ['llm', 'architecture', 'docs'],
  19: ['cloud', 'devops'],
  20: ['cloud', 'security'],
  21: ['cloud', 'security'],
  22: ['cloud', 'devops'],
  23: ['cloud', 'devops'],
  24: ['devops', 'security'],
  25: ['devops', 'docs'],
  26: ['cloud', 'architecture', 'docs'],
  27: ['mlops', 'data'],
  28: ['mlops'],
  29: ['mlops', 'data'],
  30: ['mlops', 'devops'],
  31: ['mlops'],
  32: ['mlops', 'apis', 'testing'],
  33: ['mlops'],
  34: ['mlops', 'architecture', 'docs'],
  35: ['english', 'docs', 'architecture'],
  36: ['english'],
};

function tagsFor(week: number): string[] {
  const tags = TAGS[week];
  if (!tags) throw new Error(`Missing skill tags for week ${week}`);
  return tags;
}

const id = (week: number) => `week-${String(week).padStart(2, '0')}`;

export const aiEngineerClass: ClassDef = classSchema.parse({
  id: 'ai-engineer',
  name: 'AI Engineer',
  icon: '⚙️',
  xpPerLevel: 220,
  titles: [
    { level: 5, title: 'Python Adept' },
    { level: 10, title: 'AI Builder' },
    { level: 15, title: 'Cloud Ranger' },
    { level: 20, title: 'MLOps Architect' },
  ],
  stats: [
    { id: 'INT', name: 'Intelligence', description: 'ML theory, statistics and evaluation' },
    { id: 'CODE', name: 'Engineering', description: 'Python, TypeScript, APIs and tests' },
    { id: 'CLOUD', name: 'Infrastructure', description: 'AWS, networking, containers and IaC' },
    { id: 'DATA', name: 'Data mastery', description: 'SQL, pandas, datasets and pipelines' },
    { id: 'OPS', name: 'Reliability', description: 'CI/CD, monitoring, observability' },
    { id: 'CHA', name: 'Communication', description: 'Technical English, docs, customer reasoning' },
  ],
  chapters: [
    { id: CH.c1, name: 'The Python Initiate', subtitle: 'Weeks 1–9 · Python, data, ML foundations', biome: 'meadow' },
    { id: CH.c2, name: 'The LLM Artificer', subtitle: 'Weeks 10–18 · LLMs, RAG, product engineering', biome: 'forest' },
    { id: CH.c3, name: 'The Cloud Ranger', subtitle: 'Weeks 19–26 · Infrastructure, security, production', biome: 'peaks' },
    { id: CH.c4, name: 'The MLOps Architect', subtitle: 'Weeks 27–34 · Tracking, pipelines, monitoring', biome: 'citadel' },
    { id: CH.c5, name: 'International Job Hunt', subtitle: 'Weeks 35–36 · Evidence, interviews, applications', biome: 'harbor' },
  ],
  quests: rows.map(([week, chapterId, stat, title, evidenceHint, resources]) => ({
    id: id(week),
    chapterId,
    week,
    title,
    stat,
    xp: BOSS_WEEKS.has(week) ? 300 : 100,
    boss: BOSS_WEEKS.has(week),
    side: false,
    estimatedHours: 10,
    prerequisites: week === 1 ? [] : [id(week - 1)],
    acceptance: title.replace(/^BOSS: /, ''),
    evidenceHint,
    resources,
    skills: tagsFor(week),
  })),
});

export const builtInClasses: ClassDef[] = [aiEngineerClass];
