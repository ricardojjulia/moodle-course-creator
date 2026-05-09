const BASE = '/api'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isFormData = body instanceof FormData
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body && !isFormData ? { 'Content-Type': 'application/json' } : {},
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? res.statusText)
  }
  return res.json()
}

const get    = <T>(path: string)                => req<T>('GET',    path)
const post   = <T>(path: string, body?: unknown) => req<T>('POST',   path, body)
const put    = <T>(path: string, body?: unknown) => req<T>('PUT',    path, body)
const del    = <T>(path: string)                => req<T>('DELETE', path)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Course {
  shortname: string
  fullname: string
  professor: string
  category: string
  prompt: string
  instance: string
  created_at: string
  version_count: number
  latest_version: number | null
}

export interface CourseVersion {
  id: number
  shortname: string
  version_num: number
  model_used: string
  start_date: string
  end_date: string
  created_at: string
  build_count: number
  content?: Record<string, unknown>
}

export interface LlmModel {
  id: string
  arch: string
  size_b: number
  quant: string
  ctx_k: number
  size_score: number
  quant_score: number
  arch_score: number
  // evaluation fields (present after /evaluate)
  accuracy?: number
  speed?: number
  model_quality?: number
  final_score?: number
  json_valid?: boolean
  elapsed_s?: number
}

export interface MoodleCourse {
  id: number
  shortname: string
  fullname: string
  summary: string
  startdate: number
  enddate: number
  visible: number
  category: number
  category_name: string
}

export interface MoodleSection {
  id: number
  section: number
  name: string
  summary: string
  activities: MoodleActivity[]
}

export interface MoodleActivity {
  id: number
  name: string
  modname: string
  visible: number
  url: string
  api_updatable: boolean
}

export interface MoodleStats {
  site_name?: string
  release?: string
  current_user_fullname?: string
  current_user_is_admin?: boolean
  mobile_service_enabled?: boolean
  api_functions_count?: number
  total_courses?: number
  visible_courses?: number
  hidden_courses?: number
  active_courses?: number
  total_categories?: number
  courses_per_category?: Record<string, number>
  total_users?: number
  active_30d?: number
  never_logged_in?: number
  suspended_users?: number
  auth_methods?: Record<string, number>
  site_error?: string
  courses_error?: string
  categories_error?: string
  users_error?: string
}

export interface GradeColumn {
  id: number
  name: string
  module: string
  is_total: boolean
  max: number
}

export interface GradeCell {
  formatted: string
  raw: number | null
  percentage: number | null
  feedback: string
}

export interface GradeRow {
  userid: number
  fullname: string
  cells: GradeCell[]
}

export interface GradeReport {
  columns: GradeColumn[]
  rows: GradeRow[]
}

export interface MoodleBackupFile {
  filename: string
  size_kb: number
  modified: number
  download_url: string
}

export interface InstanceStats {
  total_courses: number
  total_categories: number
  avg_versions: number | null
  last_activity_at: string | null
  v1_count: number
  v2_count: number
  v3plus_count: number
}

export interface ReviewCheckItem {
  label:  string
  status: 'Passed' | 'Needs Revision' | 'Missing'
  note:   string
}

export interface ReviewSection {
  title: string
  items: ReviewCheckItem[]
}

export interface CourseReviewResult {
  shortname:   string
  version_num: number | null
  overall:     'Passed' | 'Needs Revision' | 'Incomplete'
  score:       number
  summary:     string
  sections:    ReviewSection[]
  error?:      string   // set by frontend when request fails
}

export interface QuizQuestion {
  question:      string
  options:       string[]
  correct_index: number
  explanation?:  string
}

export interface PersistedReview extends CourseReviewResult {
  id:          number
  version_id:  number | null
  agent_id:    string
  agent_label: string
  agent_color: string
  run_at:      string
}

export interface MoodleDeploy {
  id: number
  version_id: number
  shortname: string
  moodle_course_id: number
  moodle_url: string
  sections_pushed: number
  forums_seeded: number
  deployed_at: string
}

export interface BibleRef {
  ref_text: string
  book_canonical: string
  chapter: number
  verse: number
  source_field: string
  context: string
  status: 'valid' | 'unknown_book' | 'chapter_out_of_range' | 'verse_likely_ok'
}

export interface CourseAnalytics {
  enrollment: {
    total: number
    active_30d: number
    never_accessed: number
    suspended: number
  }
  grade_distribution: { A: number; B: number; C: number; D: number; F: number }
  avg_grade: number | null
  pass_rate: number | null
  student_count: number
  quizzes: Array<{
    id: number
    name: string
    attempt_count: number
    avg_grade: number | null
    pass_rate: number | null
  }>
  enrollment_error?: string
  grades_error?: string
  quizzes_error?: string
}

export interface CurriculumEntry {
  shortname: string
  fullname: string
  category: string
  instance: string
  module_count: number
  domains: Record<string, number>
}

export interface CurriculumMap {
  courses: CurriculumEntry[]
  domains: string[]
}

export interface ReviewSchedule {
  id: number
  shortname: string
  version_id: number | null
  agent_id: string
  agent_label: string
  agent_color: string
  agent_context: string
  model_id: string
  frequency: string
  next_run_at: string
  last_run_at: string | null
  enabled: number
  created_at: string
}

export interface EvaluationCache {
  results:      LlmModel[]
  evaluated_at: string | null
  llm_url:      string | null
}

export interface AppSettings {
  moodle_url: string
  moodle_token: string
  moodle_token_masked: string
  llm_url: string
  llm_api_key_masked: string
  last_model: string
  active_instance: string
}

export interface MoodleInstance {
  name: string
  url: string
  token_masked: string
  active: boolean
  added_at: string
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const api = {
  settings: {
    get:              ()                    => get<AppSettings>('/settings'),
    save:             (s: Partial<AppSettings>) => put<AppSettings>('/settings', s),
    saveLlm:          (llm_url: string, llm_api_key: string) =>
                        put<AppSettings>('/settings', { llm_url, llm_api_key }),
    listInstances:    ()                    => get<MoodleInstance[]>('/settings/instances'),
    saveInstance:     (b: { name: string; url: string; token: string }) =>
                        post<{ ok: boolean; updated: boolean }>('/settings/instances', b),
    activateInstance: (name: string)        => post<{ ok: boolean }>(`/settings/instances/${encodeURIComponent(name)}/activate`),
    deleteInstance:   (name: string)        => del<{ ok: boolean }>(`/settings/instances/${encodeURIComponent(name)}`),
  },

  // ── Library ────────────────────────────────────────────────────────────────
  courses: {
    list:       ()              => get<Course[]>('/courses'),
    versions:   (sn: string)   => get<CourseVersion[]>(`/courses/${sn}/versions`),
    version:    (sn: string, vid: number) =>
                                   get<CourseVersion>(`/courses/${sn}/versions/${vid}`),
    generate:      (body: unknown) => post<CourseVersion>('/courses/generate', body),
    importMbz:     (body: { download_url: string; filename?: string; shortname?: string; fullname?: string; instance?: string }) =>
                     post<CourseVersion>('/courses/import-mbz', body),
    uploadMbz:     (file: File) => {
                     const fd = new FormData(); fd.append('file', file)
                     return req<CourseVersion>('POST', '/courses/upload-mbz', fd)
                   },
    patch:         (sn: string, vid: number, body: { homework_spec?: Record<string, string> }) =>
                     req<CourseVersion>('PATCH', `/courses/${sn}/versions/${vid}`, body),
    regenerateModule: (sn: string, vid: number, moduleNum: number, opts?: {
                       instructions?: string; model_id?: string; custom_prompt?: string
                     }) =>
                     post<{ ok: boolean; module_content: Record<string, unknown> }>(
                       `/courses/${sn}/versions/${vid}/modules/${moduleNum}/regenerate`,
                       { instructions: opts?.instructions ?? '', model_id: opts?.model_id ?? '', custom_prompt: opts?.custom_prompt ?? '' }),
    fork:          (sn: string, vid: number) =>
                     post<CourseVersion>(`/courses/${sn}/versions/${vid}/fork`),
    build:         (sn: string, vid: number) =>
                     post<{ filename: string; size_kb: number }>(`/courses/${sn}/versions/${vid}/build`),
    downloadUrl:   (sn: string, vid: number) =>
                     `${BASE}/courses/${sn}/versions/${vid}/download`,
    deleteCourse:  (sn: string) =>
                     del<{ deleted: string }>(`/courses/${sn}`),
    deleteVersion: (sn: string, vid: number) =>
                     del<{ deleted: number }>(`/courses/${sn}/versions/${vid}`),
    bulkDelete:    (shortnames: string[]) =>
                     post<{ deleted: string[]; not_found: string[] }>('/courses/bulk-delete', { shortnames }),
    stats:         (instance: string)    =>
                     get<InstanceStats>(`/courses/stats?instance=${encodeURIComponent(instance)}`),
    review: (sn: string, body: { agent_context: string; model_id: string; version_id?: number; agent_id?: string; agent_label?: string; agent_color?: string }) =>
              post<CourseReviewResult>(`/courses/${encodeURIComponent(sn)}/review`, body),
    applyReview: (sn: string, body: { reviews: CourseReviewResult[]; model_id: string }) =>
              post<CourseVersion>(`/courses/${encodeURIComponent(sn)}/regenerate-from-review`, body),
    finalizeReview: (sn: string, vid: number, body: { reviews: CourseReviewResult[]; model_id: string }) =>
              post<CourseVersion>(`/courses/${encodeURIComponent(sn)}/versions/${vid}/finalize-review`, body),
    patchField: (sn: string, vid: number, body: { module_num?: number; field: string; value: string }) =>
              req<{ ok: boolean }>('PATCH', `/courses/${encodeURIComponent(sn)}/versions/${vid}/field`, body),
    saveQuiz:   (sn: string, vid: number, questions: QuizQuestion[]) =>
              put<{ ok: boolean; count: number }>(`/courses/${encodeURIComponent(sn)}/versions/${vid}/quiz`, { questions }),
    exportHtmlUrl: (sn: string, vid: number) =>
              `${BASE}/courses/${encodeURIComponent(sn)}/versions/${vid}/export-html`,
    listReviews: (sn: string, version_id?: number) =>
              get<PersistedReview[]>(`/courses/${encodeURIComponent(sn)}/reviews${version_id != null ? `?version_id=${version_id}` : ''}`),
    deleteReview: (sn: string, rid: number) =>
              del<{ deleted: number }>(`/courses/${encodeURIComponent(sn)}/reviews/${rid}`),
    bibleRefs:  (sn: string, vid: number) =>
              get<BibleRef[]>(`/courses/${encodeURIComponent(sn)}/versions/${vid}/bible-refs`),
  },

  // ── Curriculum mapper ────────────────────────────────────────────────────
  curriculum: () => get<CurriculumMap>('/courses/curriculum'),

  // ── Review schedules ─────────────────────────────────────────────────────
  schedules: {
    list:       ()                 => get<ReviewSchedule[]>('/courses/schedules'),
    create:     (body: {
                  shortname: string; version_id?: number; agent_id: string;
                  agent_label: string; agent_color: string; agent_context: string;
                  model_id: string; frequency: string
                })                 => post<ReviewSchedule>('/courses/schedules', body),
    delete:     (id: number)       => del<{ deleted: number }>(`/courses/schedules/${id}`),
    runOverdue: ()                 => post<{ triggered: number; errors: string[] }>('/courses/schedules/run-overdue', {}),
  },

  // ── Reviews ───────────────────────────────────────────────────────────────
  reviews: {
    recent: (limit = 100) => get<PersistedReview[]>(`/courses/reviews/recent?limit=${limit}`),
  },

  // ── LLM ───────────────────────────────────────────────────────────────────
  llm: {
    models:          (llm_url?: string) =>
                       get<LlmModel[]>(`/llm/models${llm_url ? `?llm_url=${encodeURIComponent(llm_url)}` : ''}`),
    evaluationCache: () =>
                       get<EvaluationCache>('/llm/evaluation'),
    evaluate:        (llm_url?: string) =>
                       post<EvaluationCache>('/llm/evaluate', { llm_url: llm_url ?? '' }),
  },

  // ── Moodle ────────────────────────────────────────────────────────────────
  moodle: {
    ping:          ()              => get<{ ok: boolean; site_name: string; moodle_version: string; fullname: string }>('/moodle/ping'),
    stats:         ()              => get<MoodleStats>('/moodle/stats'),
    categories:    ()              => get<{ id: number; name: string }[]>('/moodle/categories'),
    courses:       ()              => get<MoodleCourse[]>('/moodle/courses'),
    contents:      (id: number)    => get<MoodleSection[]>(`/moodle/courses/${id}/contents`),
    updateMeta:    (id: number, body: unknown) => post(`/moodle/courses/${id}/meta`, body),
    updateSection: (body: unknown) => post('/moodle/sections/summary', body),
    addDiscussion: (body: unknown) => post('/moodle/forum/discussion', body),
    grades:        (id: number)    => get<GradeReport>(`/moodle/courses/${id}/grades`),
    capabilities:  ()              => get<{ modname: string; can_push: boolean; note: string }[]>('/moodle/capabilities'),
    deploys:       (version_id: number) => get<MoodleDeploy[]>(`/moodle/deploys?version_id=${version_id}`),
    analytics:     (id: number) => get<CourseAnalytics>(`/moodle/courses/${id}/analytics`),
    deploy:        (body: { version_id: number; shortname: string; fullname: string; category_id: number; start_date?: string; end_date?: string }) =>
                     post<{ moodle_course_id: number; url: string; sections_pushed: number; forums_seeded: number }>('/moodle/deploy', body),
    importCourse:  (id: number, body: {
      shortname: string; fullname: string;
      start_date?: string; end_date?: string;
      professor?: string; category?: string;
      instance?: string;
    }) => post<CourseVersion>(`/moodle/courses/${id}/import`, body),
    checkBackups:  (id: number)    => get<{ files: MoodleBackupFile[] }>(`/moodle/courses/${id}/backups`),
    moduleContent: (courseId: number, cmid: number) =>
                     get<{ id: number; name: string; modname: string; content_html: string; url: string }>(
                       `/moodle/courses/${courseId}/modules/${cmid}`
                     ),
  },
}
