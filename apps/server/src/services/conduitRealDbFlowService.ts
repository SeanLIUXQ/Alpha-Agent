interface ConduitArticle {
  slug: string;
  title: string;
  description: string;
  status?: string;
}

interface ConduitUser {
  email: string;
  username: string;
  token: string;
}

interface StepResult {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ConduitRealDbFlowResult {
  success: boolean;
  previewMode: boolean;
  username: string;
  publishedSlug: string;
  draftSlug: string;
  steps: StepResult[];
}

const conduitApiBaseUrl = process.env.CONDUIT_API_URL ?? 'http://127.0.0.1:3001';

export async function runConduitRealDbFlow(): Promise<ConduitRealDbFlowResult> {
  const suffix = Date.now().toString(36);
  const username = `aa_real_${suffix}`;
  const email = `${username}@example.com`;
  const password = 'Password123!';
  const steps: StepResult[] = [];

  const health = await request<{ previewMode: boolean }>('/health');
  pushStep(steps, 'health', health.previewMode === false, `previewMode=${health.previewMode}`);
  if (health.previewMode !== false) {
    throw new Error('Conduit backend is still in preview mode; real PostgreSQL flow is not active.');
  }

  const signup = await request<{ user: ConduitUser }>('/api/users', {
    method: 'POST',
    body: { user: { username, email, password } }
  });
  pushStep(steps, 'register', Boolean(signup.user.token), `registered ${signup.user.username}`);

  const login = await request<{ user: ConduitUser }>('/api/users/login', {
    method: 'POST',
    body: { user: { email, password } }
  });
  const token = login.user.token;
  pushStep(steps, 'login', Boolean(token), `token length=${token.length}`);

  const headers = { Authorization: `Token ${token}` };
  const published = await request<{ article: ConduitArticle }>('/api/articles', {
    method: 'POST',
    headers,
    body: {
      article: {
        title: `Real DB Published ${suffix}`,
        description: 'Published article created through the real PostgreSQL API flow.',
        body: 'This article proves the demo is using the database-backed Conduit API.',
        coverImage: '',
        status: 'published',
        tagList: ['realdb', 'published']
      }
    }
  });
  pushStep(steps, 'create-published', Boolean(published.article.slug), published.article.slug);

  const draft = await request<{ article: ConduitArticle }>('/api/articles', {
    method: 'POST',
    headers,
    body: {
      article: {
        title: `Real DB Draft ${suffix}`,
        description: 'Draft article created through the real PostgreSQL API flow.',
        body: 'Draft body before edit.',
        coverImage: '',
        status: 'draft',
        tagList: ['realdb', 'draft']
      }
    }
  });
  pushStep(steps, 'create-draft', draft.article.status === 'draft', `${draft.article.slug}:${draft.article.status}`);

  const editedDraft = await request<{ article: ConduitArticle }>(`/api/articles/${draft.article.slug}`, {
    method: 'PUT',
    headers,
    body: {
      article: {
        description: 'Edited draft description through the real API.',
        body: 'Draft body after edit.',
        status: 'draft'
      }
    }
  });
  pushStep(steps, 'edit-draft', editedDraft.article.description.includes('Edited draft'), editedDraft.article.description);

  const publicList = await request<{ articles: ConduitArticle[] }>(
    `/api/articles?limit=20&offset=0`,
    { headers },
  );
  const publicHasPublished = publicList.articles.some((article) => article.slug === published.article.slug);
  const publicHasDraft = publicList.articles.some((article) => article.slug === draft.article.slug);
  pushStep(
    steps,
    'public-list-filter',
    publicHasPublished && !publicHasDraft,
    `published=${publicHasPublished}; draft=${publicHasDraft}`,
  );

  const draftList = await request<{ articles: ConduitArticle[] }>(
    `/api/articles?author=${encodeURIComponent(username)}&status=draft&limit=20&offset=0`,
    { headers },
  );
  const draftListHasDraft = draftList.articles.some((article) => article.slug === draft.article.slug);
  pushStep(steps, 'draft-list-filter', draftListHasDraft, `draft=${draftListHasDraft}`);

  return {
    success: steps.every((step) => step.ok),
    previewMode: health.previewMode,
    username,
    publishedSlug: published.article.slug,
    draftSlug: draft.article.slug,
    steps
  };
}

function pushStep(steps: StepResult[], name: string, ok: boolean, detail: string) {
  steps.push({ name, ok, detail });
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT';
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<T> {
  const response = await fetch(`${conduitApiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...options.headers,
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Conduit ${options.method ?? 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload as T;
}
