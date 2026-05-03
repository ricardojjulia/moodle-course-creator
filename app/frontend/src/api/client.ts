const BASE = '/api'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
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

export interface MoodleBackupFile {
  filename: string
  size_kb: number
  modified: number
  download_url: string
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
    build:         (sn: string, vid: number) =>
                     post<{ filename: string; size_kb: number }>(`/courses/${sn}/versions/${vid}/build`),
    downloadUrl:   (sn: string, vid: number) =>
                     `${BASE}/courses/${sn}/versions/${vid}/download`,
    deleteCourse:  (sn: string) =>
                     del<{ deleted: string }>(`/courses/${sn}`),
    deleteVersion: (sn: string, vid: number) =>
                     del<{ deleted: number }>(`/courses/${sn}/versions/${vid}`),
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
    courses:       ()              => get<MoodleCourse[]>('/moodle/courses'),
    contents:      (id: number)    => get<MoodleSection[]>(`/moodle/courses/${id}/contents`),
    updateMeta:    (id: number, body: unknown) => post(`/moodle/courses/${id}/meta`, body),
    updateSection: (body: unknown) => post('/moodle/sections/summary', body),
    addDiscussion: (body: unknown) => post('/moodle/forum/discussion', body),
    capabilities:  ()              => get<{ modname: string; can_push: boolean; note: string }[]>('/moodle/capabilities'),
    importCourse:  (id: number, body: {
      shortname: string; fullname: string;
      start_date?: string; end_date?: string;
      professor?: string; category?: string;
      instance?: string;
    }) => post<CourseVersion>(`/moodle/courses/${id}/import`, body),
    checkBackups:  (id: number)    => get<{ files: MoodleBackupFile[] }>(`/moodle/courses/${id}/backups`),
  },
}
