import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Stack, Title, TextInput, Textarea, Button, Group,
  Paper, Text, Badge, Table, Loader, Stepper, Box,
  Select, NumberInput, Progress, ThemeIcon,
  SimpleGrid, Collapse, Autocomplete, ActionIcon,
  SegmentedControl, ScrollArea, NavLink,
  RingProgress, Center, Modal, Divider, Anchor, Alert,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import '@mantine/dates/styles.css'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconCheck, IconX, IconBolt, IconBrain,
  IconChevronDown, IconChevronRight, IconCalendar,
  IconEye, IconPlus, IconBook2, IconCategory,
  IconSparkles, IconClipboardList, IconLayoutGrid,
  IconCloudUpload, IconExternalLink,
} from '@tabler/icons-react'
import { api, type LlmModel, type Course, type CourseVersion } from '../api/client'

// ── LLM provider config (mirrors Settings.tsx) ────────────────────────────────

const PROVIDER_META: Record<string, { label: string; color: string }> = {
  local:      { label: 'Local LLM',  color: 'gray'   },
  openai:     { label: 'OpenAI',     color: 'green'  },
  openrouter: { label: 'OpenRouter', color: 'violet' },
  anthropic:  { label: 'Claude',     color: 'orange' },
  custom:     { label: 'Custom',     color: 'blue'   },
}

const PROVIDER_MODELS: Record<string, string[]> = {
  openai:     ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4-turbo'],
  openrouter: ['anthropic/claude-opus-4-7', 'anthropic/claude-sonnet-4-6', 'openai/gpt-4o', 'google/gemini-2.5-pro', 'meta-llama/llama-3.3-70b-instruct'],
  anthropic:  ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
}

function detectProvider(llmUrl: string): string {
  if (llmUrl === 'https://api.openai.com/v1')    return 'openai'
  if (llmUrl === 'https://openrouter.ai/api/v1') return 'openrouter'
  if (llmUrl === 'https://api.anthropic.com/v1') return 'anthropic'
  return 'local'
}
import { CourseViewer } from '../components/CourseViewer'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onCreated: () => void
  onGeneratingChange?: (generating: boolean, label?: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type TFn = (key: string, opts?: Record<string, unknown>) => string

function relativeTime(iso: string, t: TFn): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return t('common.just_now')
  if (mins  < 60)  return t('common.ago_mins',  { count: mins })
  if (hours < 24)  return t('common.ago_hours', { count: hours })
  return t('common.ago_days', { count: days })
}

// ── Review panel ──────────────────────────────────────────────────────────────

function ReviewPanel() {
  const { t } = useTranslation()
  const [libCourses, setLibCourses]   = useState<Course[]>([])
  const [pickedCat,  setPickedCat]    = useState<string | null>(null)
  const [pickedSn,   setPickedSn]     = useState<string | null>(null)
  const [versions,   setVersions]     = useState<CourseVersion[]>([])
  const [selVid,     setSelVid]       = useState<string | null>(null)
  const [content,    setContent]      = useState<Record<string, any> | null>(null)
  const [loadingV,   setLoadingV]     = useState(false)
  const [loadingC,   setLoadingC]     = useState(false)
  const [forking,    setForking]      = useState(false)
  const [deployOpen,   setDeployOpen]   = useState(false)
  const [deploying,    setDeploying]    = useState(false)
  const [deployResult, setDeployResult] = useState<{ moodle_course_id: number; url: string; sections_pushed: number; forums_seeded: number; mbz_url: string | null; restore_url: string } | null>(null)
  const [moodleCats,   setMoodleCats]   = useState<{ id: number; name: string }[]>([])
  const [deployCatId,  setDeployCatId]  = useState<string | null>(null)
  const [deployStart,  setDeployStart]  = useState('')
  const [deployEnd,    setDeployEnd]    = useState('')

  useEffect(() => {
    api.courses.list().then(setLibCourses).catch(() => {})
  }, [])

  const categoryMap = useMemo(() => {
    const map: Record<string, Course[]> = {}
    libCourses.forEach(c => {
      const cat = c.category?.trim() || 'Uncategorized'
      if (!map[cat]) map[cat] = []
      map[cat].push(c)
    })
    return map
  }, [libCourses])

  const categoryOptions = useMemo(() =>
    Object.keys(categoryMap).sort().map(cat => ({
      value: cat,
      label: `${cat}  (${categoryMap[cat].length})`,
    })),
    [categoryMap]
  )

  const coursesInCat = pickedCat ? (categoryMap[pickedCat] ?? []) : []

  // When course picked → load versions
  useEffect(() => {
    if (!pickedSn) { setVersions([]); setSelVid(null); setContent(null); return }
    setLoadingV(true)
    api.courses.versions(pickedSn)
      .then(vers => {
        setVersions(vers)
        setSelVid(vers.length ? String(vers[0].id) : null)
      })
      .catch(() => {})
      .finally(() => setLoadingV(false))
  }, [pickedSn])

  // When version picked → load content
  useEffect(() => {
    if (!pickedSn || !selVid) { setContent(null); return }
    setLoadingC(true)
    api.courses.version(pickedSn, Number(selVid))
      .then(v => setContent((v.content as any) ?? {}))
      .catch(() => setContent({}))
      .finally(() => setLoadingC(false))
  }, [pickedSn, selVid])

  const versionOptions  = versions.map(v => ({
    value: String(v.id),
    label: `v${v.version_num} · ${v.model_used || 'import'} · ${v.start_date || '—'}`,
  }))

  const selectedCourse  = libCourses.find(c => c.shortname === pickedSn)
  const selectedVersion = versions.find(v => v.id === Number(selVid))

  const handleFork = async () => {
    if (!pickedSn || !selVid) return
    setForking(true)
    try {
      const newVer  = await api.courses.fork(pickedSn, Number(selVid))
      const updated = await api.courses.versions(pickedSn)
      setVersions(updated)
      setSelVid(String(newVer.id))
      notifications.show({ title: t('nc.rev_fork_done'), message: t('nc.rev_fork_msg', { n: newVer.version_num, sn: pickedSn }), color: 'green' })
    } catch (e: any) {
      notifications.show({ title: t('nc.rev_fork_fail'), message: e.message, color: 'red' })
    } finally {
      setForking(false)
    }
  }

  const openDeploy = () => {
    setDeployResult(null)
    setDeployCatId(null)
    setDeployStart(selectedVersion?.start_date ?? '')
    setDeployEnd(selectedVersion?.end_date ?? '')
    api.moodle.categories().then(setMoodleCats).catch(() => {})
    setDeployOpen(true)
  }

  const handleDeploy = async () => {
    if (!pickedSn || !selVid || !deployCatId) return
    setDeploying(true)
    try {
      const res = await api.moodle.deploy({
        version_id:  Number(selVid),
        shortname:   pickedSn,
        fullname:    selectedCourse?.fullname ?? pickedSn,
        category_id: Number(deployCatId),
        start_date:  deployStart || undefined,
        end_date:    deployEnd   || undefined,
      })
      setDeployResult(res)
    } catch (e: any) {
      notifications.show({ title: t('nc.rev_deploy_fail'), message: e.message, color: 'red' })
    } finally {
      setDeploying(false)
    }
  }

  return (
    <Stack gap="md">

      {/* Step 1 — Category */}
      <Paper withBorder p="md" radius="md" style={{ borderLeft: '3px solid var(--mantine-color-violet-5)' }}>
        <Group gap="xs" mb="xs">
          <ThemeIcon size="sm" color="violet" variant="light"><IconCategory size={14} /></ThemeIcon>
          <Text size="sm" fw={600} c="violet">{t('nc.rev_step_category')}</Text>
          {pickedCat && (
            <Text size="xs" c="dimmed">{t('nc.rev_n_courses', { count: coursesInCat.length })}</Text>
          )}
        </Group>
        <Select
          placeholder={t('nc.rev_cat_placeholder')}
          data={categoryOptions}
          value={pickedCat}
          onChange={v => { setPickedCat(v); setPickedSn(null) }}
          searchable
          clearable
          size="sm"
        />
      </Paper>

      {/* Step 2 — Course list */}
      {pickedCat && (
        <Paper withBorder p="md" radius="md" style={{ borderLeft: '3px solid var(--mantine-color-blue-5)' }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon size="sm" color="blue" variant="light"><IconBook2 size={14} /></ThemeIcon>
            <Text size="sm" fw={600} c="blue">{t('nc.rev_step_course')}</Text>
          </Group>
          <ScrollArea h={220} type="auto" offsetScrollbars>
            <Stack gap={2}>
              {coursesInCat.map(c => (
                <NavLink
                  key={c.shortname}
                  active={pickedSn === c.shortname}
                  label={
                    <Group justify="space-between" wrap="nowrap">
                      <Text
                        size="sm"
                        fw={pickedSn === c.shortname ? 600 : 400}
                        truncate
                        style={{ maxWidth: 340 }}
                      >
                        {c.fullname}
                      </Text>
                      <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                        <Badge size="xs" variant="outline" color="gray">{c.shortname}</Badge>
                        <Badge size="xs" color={pickedSn === c.shortname ? 'blue' : 'gray'}>{c.version_count}v</Badge>
                      </Group>
                    </Group>
                  }
                  onClick={() => setPickedSn(c.shortname)}
                  style={{ borderRadius: 6 }}
                />
              ))}
            </Stack>
          </ScrollArea>
        </Paper>
      )}

      {/* Step 3 — Version & fork */}
      {pickedSn && selectedCourse && (
        <Paper withBorder p="md" radius="md" style={{ borderLeft: '3px solid var(--mantine-color-teal-5)' }}>
          <Group justify="space-between" align="flex-start" mb="sm">
            <Stack gap={3}>
              <Text fw={700} size="sm">{selectedCourse.fullname}</Text>
              <Group gap="xs">
                <Badge size="xs" variant="light" color="teal">{selectedCourse.shortname}</Badge>
                {selectedCourse.professor && <Text size="xs" c="dimmed">{selectedCourse.professor}</Text>}
                {selectedCourse.instance  && <Badge size="xs" variant="dot" color="gray">{selectedCourse.instance}</Badge>}
              </Group>
            </Stack>
            {selVid && (
              <Group gap="xs">
                <Button
                  size="xs" variant="light" color="green"
                  leftSection={forking ? <Loader size="xs" /> : <IconPlus size={12} />}
                  onClick={handleFork}
                  disabled={forking}
                >
                  {forking ? t('nc.rev_saving') : t('nc.rev_fork_btn', { n: (selectedVersion?.version_num ?? 0) + 1 })}
                </Button>
                <Button
                  size="xs" variant="light" color="blue"
                  leftSection={<IconCloudUpload size={12} />}
                  onClick={openDeploy}
                >
                  {t('nc.rev_deploy_btn')}
                </Button>
              </Group>
            )}
          </Group>
          {loadingV
            ? <Group gap="xs"><Loader size="xs" /><Text size="xs" c="dimmed">{t('nc.rev_loading_versions')}</Text></Group>
            : versions.length > 0
              ? <Select label={t('nc.rev_version')} data={versionOptions} value={selVid} onChange={setSelVid} size="sm" />
              : <Text size="xs" c="dimmed">{t('nc.rev_no_versions')}</Text>
          }
        </Paper>
      )}

      {loadingC && (
        <Stack align="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">{t('nc.rev_loading_content')}</Text>
        </Stack>
      )}

      {!loadingC && content && pickedSn && selVid && (
        <CourseViewer
          content={content}
          moodleCourseId={content.moodle_course_id}
          editProps={{
            shortname:       pickedSn,
            versionId:       Number(selVid),
            defaultModelId:  versions.find(v => v.id === Number(selVid))?.model_used ?? '',
            courseName:      selectedCourse?.fullname ?? pickedSn,
            hwSpec:          Object.fromEntries(
              Object.entries((content.homework_spec ?? {}) as Record<string, string>)
                .map(([k, v]) => [Number(k), v])
            ),
            onModuleRegenerated: (moduleNum, newMc) => {
              setContent(prev => {
                if (!prev) return prev
                const mcs: any[] = [...(prev.module_contents ?? [])]
                const idx = mcs.findIndex((m: any) => m.module_num === moduleNum)
                if (idx >= 0) mcs[idx] = newMc; else mcs.push(newMc)
                return { ...prev, module_contents: mcs }
              })
            },
            onHwSpecChanged: newContent => setContent(newContent),
          }}
        />
      )}

      {!pickedCat && !pickedSn && (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          {t('nc.rev_hint')}
        </Text>
      )}

      {/* Deploy modal */}
      <Modal
        opened={deployOpen}
        onClose={() => setDeployOpen(false)}
        title={
          <Group gap="xs">
            <IconCloudUpload size={16} />
            <Text fw={600} size="sm">{t('nc.deploy_title', { fullname: selectedCourse?.fullname ?? pickedSn })}</Text>
          </Group>
        }
        size="md"
      >
        {deployResult ? (
          <Stack gap="sm">
            <Text size="sm" c="green" fw={500}>
              {t('nc.rev_deploy_success', { sections: deployResult.sections_pushed, forums: deployResult.forums_seeded })}
            </Text>
            <Text size="sm">{t('nc.rev_moodle_id')} <strong>{deployResult.moodle_course_id}</strong></Text>
            <Anchor href={deployResult.url} target="_blank" size="sm">
              <Group gap={4}><IconExternalLink size={14} />{t('cv.open_moodle')}</Group>
            </Anchor>

            <Alert color="blue" title={t('nc.full_restore')} variant="light">
              <Text size="xs" c="dimmed" mb="xs">
                {t('nc.full_restore_desc')}
              </Text>
              <Group gap="xs">
                {deployResult.mbz_url && (
                  <Button
                    size="xs"
                    variant="outline"
                    component="a"
                    href={deployResult.mbz_url}
                    leftSection={<IconCloudUpload size={12} />}
                  >
                    {t('nc.download_mbz')}
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="outline"
                  color="gray"
                  component="a"
                  href={deployResult.restore_url}
                  target="_blank"
                  leftSection={<IconExternalLink size={12} />}
                >
                  {t('nc.open_restore')}
                </Button>
              </Group>
              <Text size="xs" c="dimmed" mt="xs">
                {t('nc.restore_note')}
              </Text>
            </Alert>

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setDeployOpen(false)}>{t('nc.rev_close')}</Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="sm">
            <Select
              label={t('nc.rev_deploy_cat')}
              placeholder={t('nc.rev_deploy_cat_ph')}
              data={moodleCats.map(c => ({ value: String(c.id), label: c.name }))}
              value={deployCatId}
              onChange={setDeployCatId}
              searchable
              required
            />
            <Divider label={t('nc.rev_dates_optional')} labelPosition="left" />
            <Group grow>
              <TextInput
                label={t('nc.start_date')}
                type="date"
                value={deployStart}
                onChange={e => setDeployStart(e.currentTarget.value)}
              />
              <TextInput
                label={t('nc.end_date')}
                type="date"
                value={deployEnd}
                onChange={e => setDeployEnd(e.currentTarget.value)}
              />
            </Group>
            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" onClick={() => setDeployOpen(false)}>{t('common.cancel')}</Button>
              <Button
                color="blue"
                leftSection={deploying ? <Loader size="xs" /> : <IconCloudUpload size={14} />}
                onClick={handleDeploy}
                disabled={!deployCatId || deploying}
              >
                {deploying ? t('common.deploying') : t('lib.deploy_btn')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

    </Stack>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CourseStudioPage({ onCreated, onGeneratingChange }: Props) {
  const { t } = useTranslation()
  const [mode, setMode]               = useState<'new' | 'review'>('new')
  const [provider, setProvider]       = useState<string>('local')
  const [modelOpen, setModelOpen]     = useState(false)
  const [models, setModels]           = useState<LlmModel[]>([])
  const [evaluating, setEvaluating]   = useState(false)
  const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null)
  const [selectedModel, setModel]     = useState<string>('')
  const [generating, setGenerating]   = useState(false)
  const [genStep, setGenStep]         = useState(0)
  const [categories, setCategories]   = useState<string[]>([])
  const [hwSpec, setHwSpec]           = useState<Record<number, string | null>>({})

  const form = useForm<{
    shortname:     string
    fullname:      string
    professor:     string
    category:      string
    prompt:        string
    start_date:    Date | null
    end_date:      Date | null
    num_questions: number
    module_count:  number
    language:      string
  }>({
    initialValues: {
      shortname:     '',
      fullname:      '',
      professor:     '',
      category:      '',
      prompt:        '',
      start_date:    null,
      end_date:      null,
      num_questions: 50,
      module_count:  5,
      language:      'es',
    },
    validate: {
      shortname: (v: string) => v.trim() ? null : 'Required',
      fullname:  (v: string) => v.trim() ? null : 'Required',
      prompt:    (v: string) => v.trim() ? null : 'Required',
    },
  })

  const loadLocalModels = () => {
    api.llm.evaluationCache().then(cache => {
      if (cache.results.length) {
        setModels(cache.results); setEvaluatedAt(cache.evaluated_at); setModel(cache.results[0].id)
      } else {
        api.llm.models().then(m => { setModels(m); if (m.length) setModel(m[0].id) }).catch(() => {})
      }
    }).catch(() => {
      api.llm.models().then(m => { setModels(m); if (m.length) setModel(m[0].id) }).catch(() => {})
    })
  }

  useEffect(() => {
    api.settings.get()
      .then(s => {
        const p = detectProvider(s.llm_url)
        setProvider(p)
        if (PROVIDER_MODELS[p]) {
          setModel(PROVIDER_MODELS[p][0])  // pre-fill first suggested model for cloud
        } else {
          loadLocalModels()
        }
      })
      .catch(() => loadLocalModels())  // settings unavailable → assume local

    api.moodle.categories().then(cats => setCategories(cats.map(c => c.name))).catch(() => {})
  }, [])

  const runEvaluation = async () => {
    setEvaluating(true); setModels([])
    try {
      const cache = await api.llm.evaluate()
      setModels(cache.results); setEvaluatedAt(cache.evaluated_at)
      if (cache.results.length) setModel(cache.results[0].id)
      notifications.show({ title: t('nc.notif_eval_done'), message: t('nc.notif_eval_best', { id: cache.results[0]?.id }), color: 'green' })
    } catch (e: any) {
      notifications.show({ title: t('nc.notif_eval_fail'), message: e.message, color: 'red' })
    } finally { setEvaluating(false) }
  }

  const toDateStr  = (d: Date | null) => d ? d.toISOString().slice(0, 10) : ''
  const scoreColor = (s: number)      => s >= 8 ? 'green' : s >= 6 ? 'yellow' : 'red'
  const hasHomework = Object.values(hwSpec).some(v => v !== null)
  const totalSteps  = hasHomework ? 5 : 4
  const top3        = models.slice(0, 3)
  const rest        = models.slice(3)

  const generate = form.onSubmit(async values => {
    if (!selectedModel) {
      notifications.show({ title: t('nc.notif_no_model'), message: t('nc.notif_no_model_desc'), color: 'orange' })
      return
    }
    setGenerating(true)
    onGeneratingChange?.(true, values.shortname)
    setGenStep(1)
    try {
      const timer = setInterval(() => setGenStep(s => Math.min(s + 1, totalSteps)), 30000)
      const hw: Record<string, string> = {}
      Object.entries(hwSpec).forEach(([k, v]) => { if (v) hw[k] = v })
      await api.courses.generate({
        ...values,
        start_date:    toDateStr(values.start_date),
        end_date:      toDateStr(values.end_date),
        model_id:      selectedModel,
        homework_spec: hw,
        module_count:  values.module_count,
        language:      values.language,
      })
      clearInterval(timer)
      setGenStep(totalSteps)
      onGeneratingChange?.(false)
      notifications.show({ title: t('nc.notif_created'), message: values.shortname, color: 'green', icon: <IconCheck /> })
      onCreated()
    } catch (e: any) {
      notifications.show({ title: t('nc.notif_gen_fail'), message: e.message, color: 'red', icon: <IconX /> })
      setGenerating(false)
      onGeneratingChange?.(false)
      setGenStep(0)
    }
  })

  return (
    <Stack maw={800}>
      <Group justify="space-between" align="center">
        <Title order={3}>{t('nc.title')}</Title>
        <SegmentedControl
          value={mode}
          onChange={v => setMode(v as 'new' | 'review')}
          data={[
            { value: 'new',    label: <Group gap={6} wrap="nowrap"><IconPlus size={14} /><span>{t('nc.new_course')}</span></Group> },
            { value: 'review', label: <Group gap={6} wrap="nowrap"><IconEye size={14} /><span>{t('nc.review')}</span></Group> },
          ]}
        />
      </Group>

      {/* ── Review mode ──────────────────────────────────────────────────── */}
      {mode === 'review' && <ReviewPanel />}

      {/* ── New Course mode ──────────────────────────────────────────────── */}
      {mode === 'new' && (
        <Stack gap="md">

          {/* 1. Language Model — cloud vs local */}
          {(() => {
            const isCloud = !!PROVIDER_MODELS[provider]
            const meta    = PROVIDER_META[provider] ?? PROVIDER_META.local
            const accentColor = isCloud ? meta.color : 'blue'

            return (
              <Paper withBorder p="md" radius="md"
                     style={{ borderLeft: `3px solid var(--mantine-color-${accentColor}-5)` }}>
                <Group justify="space-between" align="center" mb="sm">
                  <Group gap="xs">
                    <ThemeIcon size="sm" color={accentColor} variant="light"><IconLayoutGrid size={14} /></ThemeIcon>
                    <Text size="sm" fw={600} c={accentColor}>{t('nc.lm_label')}</Text>
                    {isCloud && <Badge size="xs" color={meta.color} variant="light">{meta.label}</Badge>}
                    {!isCloud && evaluatedAt && <Text size="xs" c="dimmed">{t('nc.lm_evaluated', { time: relativeTime(evaluatedAt, t as TFn) })}</Text>}
                  </Group>
                  {!isCloud && (
                    <Button
                      size="xs" variant="light" color="blue"
                      leftSection={evaluating ? <Loader size="xs" /> : <IconBolt size={14} />}
                      onClick={runEvaluation}
                      disabled={evaluating}
                    >
                      {evaluating ? t('nc.lm_evaluating') : evaluatedAt ? t('nc.lm_re_evaluate') : t('nc.lm_evaluate')}
                    </Button>
                  )}
                </Group>

                {/* ── Cloud provider: simple model picker ── */}
                {isCloud && (
                  <Stack gap="xs">
                    <Autocomplete
                      label={t('nc.lm_model_id')}
                      description={t('nc.lm_model_id_desc')}
                      placeholder={PROVIDER_MODELS[provider][0]}
                      data={PROVIDER_MODELS[provider]}
                      value={selectedModel}
                      onChange={setModel}
                    />
                    <Text size="xs" c="dimmed">
                      {t('nc.lm_cloud_billed', { provider: meta.label })}
                    </Text>
                  </Stack>
                )}

                {/* ── Local provider: evaluate + model cards ── */}
                {!isCloud && (
                  <>
                    {evaluating && (
                      <Stack align="center" py="sm">
                        <Loader size="sm" />
                        <Text size="xs" c="dimmed">{t('nc.lm_running')}</Text>
                      </Stack>
                    )}

                    {!evaluating && top3.length > 0 && (
                      <SimpleGrid cols={3} spacing="sm" mb={rest.length > 0 ? 'xs' : 0}>
                        {top3.map((m, i) => (
                          <Paper
                            key={m.id}
                            withBorder p="sm" radius="md"
                            style={{
                              cursor: 'pointer',
                              borderColor: selectedModel === m.id ? 'var(--mantine-color-blue-5)' : undefined,
                              background:  selectedModel === m.id ? 'var(--mantine-color-blue-0)' : undefined,
                              transition:  'all 0.15s',
                            }}
                            onClick={() => setModel(m.id)}
                          >
                            {m.final_score !== undefined ? (
                              <Center mb="xs">
                                <RingProgress
                                  size={72} thickness={7} roundCaps
                                  sections={[{ value: m.final_score * 10, color: scoreColor(m.final_score) }]}
                                  label={
                                    <Stack gap={0} align="center">
                                      <Text size="xs" fw={800} lh={1}>{m.final_score.toFixed(1)}</Text>
                                      {i === 0 && <Text size="xs" c="yellow.6" lh={1}>★</Text>}
                                    </Stack>
                                  }
                                />
                              </Center>
                            ) : (
                              <Center mb="xs" h={72}>
                                <ThemeIcon size="xl" variant="light" color="gray"><IconBrain size={24} /></ThemeIcon>
                              </Center>
                            )}
                            <Text size="xs" fw={600} ta="center" truncate mb={4}>{m.id}</Text>
                            <Group gap={4} justify="center">
                              {m.size_b > 0 && <Badge size="xs" variant="outline" color="gray">{m.size_b}B</Badge>}
                              {m.quant && m.quant !== 'unknown' && <Badge size="xs" variant="outline" color="gray">{m.quant}</Badge>}
                            </Group>
                            {selectedModel === m.id && (
                              <Group justify="center" mt="xs" gap={4}>
                                <ThemeIcon size="xs" color="blue"><IconCheck size={10} /></ThemeIcon>
                                <Text size="xs" c="blue" fw={600}>{t('nc.lm_selected')}</Text>
                              </Group>
                            )}
                          </Paper>
                        ))}
                      </SimpleGrid>
                    )}

                    {!evaluating && models.length === 0 && (
                      <Text size="sm" c="dimmed" ta="center" py="sm">
                        {t('nc.lm_no_models')}
                      </Text>
                    )}

                    {rest.length > 0 && (
                      <>
                        <Button
                          variant="subtle" size="xs" fullWidth mt="xs"
                          rightSection={modelOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                          onClick={() => setModelOpen(o => !o)}
                        >
                          {modelOpen ? t('nc.lm_hide') : t('nc.lm_show_all', { count: models.length })}
                        </Button>
                        <Collapse in={modelOpen}>
                          <Table striped highlightOnHover withTableBorder mt="xs">
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th></Table.Th>
                                <Table.Th>{t('nc.lm_th_model')}</Table.Th>
                                <Table.Th>{t('nc.lm_th_size')}</Table.Th>
                                <Table.Th>{t('nc.lm_th_quant')}</Table.Th>
                                {models[0]?.final_score !== undefined && <Table.Th>{t('nc.lm_th_score')}</Table.Th>}
                                {models[0]?.elapsed_s   !== undefined && <Table.Th>{t('nc.lm_th_speed')}</Table.Th>}
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {models.map((m, i) => (
                                <Table.Tr
                                  key={m.id}
                                  style={{ cursor: 'pointer', background: selectedModel === m.id ? 'var(--mantine-color-blue-0)' : undefined }}
                                  onClick={() => setModel(m.id)}
                                >
                                  <Table.Td>
                                    {selectedModel === m.id && <ThemeIcon size="xs" color="blue"><IconCheck size={10} /></ThemeIcon>}
                                    {i === 0 && m.final_score !== undefined && <Badge size="xs" color="yellow" ml={4}>★</Badge>}
                                  </Table.Td>
                                  <Table.Td><Text size="xs" fw={500}>{m.id}</Text></Table.Td>
                                  <Table.Td><Text size="xs">{m.size_b > 0 ? `${m.size_b}B` : '—'}</Text></Table.Td>
                                  <Table.Td><Text size="xs">{m.quant && m.quant !== 'unknown' ? m.quant : '—'}</Text></Table.Td>
                                  {m.final_score !== undefined && (
                                    <Table.Td><Badge size="xs" color={scoreColor(m.final_score)}>{m.final_score.toFixed(1)}</Badge></Table.Td>
                                  )}
                                  {m.elapsed_s !== undefined && (
                                    <Table.Td><Text size="xs">{m.elapsed_s}s</Text></Table.Td>
                                  )}
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </Collapse>
                      </>
                    )}
                  </>
                )}
              </Paper>
            )
          })()}

          {/* ── All course-building sections share one <form> ── */}
          <form onSubmit={generate}>
            <Stack gap="md">

              {/* 2. Course Identity & Dates */}
              <Paper withBorder p="md" radius="md"
                style={{ borderLeft: '3px solid var(--mantine-color-teal-5)' }}>
                <Group gap="xs" mb="sm">
                  <ThemeIcon size="sm" color="teal" variant="light"><IconBook2 size={14} /></ThemeIcon>
                  <Text size="sm" fw={600} c="teal">{t('nc.form_identity')}</Text>
                </Group>
                <Stack gap="sm">
                  <Group grow>
                    <TextInput label={t('nc.form_shortname')} placeholder={t('nc.form_shortname_ph')} {...form.getInputProps('shortname')} />
                    <TextInput label={t('nc.form_fullname')}  placeholder={t('nc.form_fullname_ph')}  {...form.getInputProps('fullname')} />
                  </Group>
                  <Group grow>
                    <TextInput label={t('nc.professor')} placeholder={t('nc.form_professor_ph')} {...form.getInputProps('professor')} />
                    <Autocomplete
                      label={t('nc.category')}
                      placeholder={t('nc.form_category_ph')}
                      data={categories}
                      {...form.getInputProps('category')}
                    />
                  </Group>
                  <Group grow>
                    <DatePickerInput
                      label={t('nc.start_date')} placeholder={t('nc.pick_date')}
                      leftSection={<IconCalendar size={14} />}
                      valueFormat="YYYY-MM-DD" clearable
                      {...form.getInputProps('start_date')}
                    />
                    <DatePickerInput
                      label={t('nc.end_date')} placeholder={t('nc.pick_date')}
                      leftSection={<IconCalendar size={14} />}
                      valueFormat="YYYY-MM-DD" clearable
                      {...form.getInputProps('end_date')}
                    />
                  </Group>
                  <Group grow>
                    <NumberInput
                      label={t('nc.form_modules')}
                      description={t('nc.form_modules_desc')}
                      min={3} max={12} step={1}
                      {...form.getInputProps('module_count')}
                    />
                    <Select
                      label={t('nc.form_language')}
                      description={t('nc.form_language_desc')}
                      data={[
                        { value: 'es', label: t('nc.lang_es') },
                        { value: 'en', label: t('nc.lang_en') },
                        { value: 'pt', label: t('nc.lang_pt') },
                        { value: 'fr', label: t('nc.lang_fr') },
                        { value: 'de', label: t('nc.lang_de') },
                      ]}
                      {...form.getInputProps('language')}
                    />
                  </Group>
                </Stack>
              </Paper>

              {/* 3. Assessment — quiz + homework */}
              <Paper withBorder p="md" radius="md"
                style={{ borderLeft: '3px solid var(--mantine-color-orange-5)' }}>
                <Group gap="xs" mb="sm">
                  <ThemeIcon size="sm" color="orange" variant="light"><IconClipboardList size={14} /></ThemeIcon>
                  <Text size="sm" fw={600} c="orange">{t('nc.form_assessment')}</Text>
                </Group>
                <Stack gap="sm">
                  <NumberInput
                    label={t('nc.form_quiz')}
                    description={t('nc.form_quiz_desc')}
                    min={10} max={100} step={5}
                    {...form.getInputProps('num_questions')}
                  />

                  {/* Homework pill toggles */}
                  <div>
                    <Text size="sm" fw={500} mb={4}>{t('nc.form_hw')} <Text span size="xs" c="dimmed">{t('nc.form_hw_opt')}</Text></Text>
                    <Text size="xs" c="dimmed" mb="sm">{t('nc.form_hw_desc')}</Text>
                    <Group gap="sm" mb="xs" wrap="wrap">
                      {Array.from({ length: form.values.module_count }, (_, i) => i + 1).map(n => (
                        <Paper
                          key={n}
                          withBorder px="md" py={6} radius="xl"
                          data-active={hwSpec[n] != null || undefined}
                          onClick={() => setHwSpec(prev => ({ ...prev, [n]: prev[n] != null ? null : 'assign' }))}
                          style={{
                            cursor: 'pointer', minWidth: 72, textAlign: 'center',
                            userSelect: 'none', transition: 'all 0.12s',
                            ...(hwSpec[n] != null ? {
                              borderColor: 'var(--mantine-color-orange-5)',
                              background: 'var(--mantine-color-orange-light)',
                            } : {}),
                          }}
                        >
                          <Text size="xs" fw={hwSpec[n] != null ? 700 : 400}
                                c={hwSpec[n] != null ? 'orange' : 'dimmed'}>
                            {t('nc.mod_n', { n })}
                          </Text>
                        </Paper>
                      ))}
                    </Group>
                    {hasHomework && (
                      <SimpleGrid cols={Math.min(5, form.values.module_count)} spacing="xs">
                        {Array.from({ length: form.values.module_count }, (_, i) => i + 1)
                          .filter(n => hwSpec[n] != null).map(n => (
                          <Select
                            key={n} size="xs" label={`Mod ${n}`}
                            value={hwSpec[n]}
                            onChange={v => setHwSpec(prev => ({ ...prev, [n]: v }))}
                            data={[{ value: 'assign', label: t('cv.assignment') }, { value: 'forum', label: t('cv.forum') }]}
                          />
                        ))}
                      </SimpleGrid>
                    )}
                  </div>
                </Stack>
              </Paper>

              {/* 4. Course Prompt */}
              <Paper withBorder p="md" radius="md"
                style={{ borderLeft: '3px solid var(--mantine-color-blue-5)' }}>
                <Group gap="xs" mb="sm">
                  <ThemeIcon size="sm" color="blue" variant="light"><IconSparkles size={14} /></ThemeIcon>
                  <Text size="sm" fw={600} c="blue">{t('nc.form_prompt_label')}</Text>
                </Group>
                <Textarea
                  placeholder={t('nc.form_prompt_ph')}
                  description={t('nc.form_prompt_desc')}
                  minRows={6} autosize
                  {...form.getInputProps('prompt')}
                />
              </Paper>

              {/* Generation progress */}
              {generating && (
                <Paper withBorder p="md" radius="md"
                  style={{ borderLeft: '3px solid var(--mantine-color-violet-5)' }}>
                  <Group gap="xs" mb="sm">
                    <Loader size="xs" color="violet" />
                    <Text size="sm" fw={600} c="violet">
                      {t('nc.gen_progress', { step: genStep, total: totalSteps })}
                    </Text>
                  </Group>
                  <Stack gap={3}>
                    {[
                      { step: 1, label: t('nc.step_structure', { count: form.values.module_count }) },
                      { step: 2, label: t('nc.gen_step_content') },
                      { step: 3, label: t('nc.gen_step_syllabus') },
                      { step: 4, label: t('nc.gen_step_quiz', { count: form.values.num_questions }) },
                      ...(hasHomework ? [{ step: 5, label: t('nc.gen_step_hw') }] : []),
                    ].map(({ step, label }) => {
                      const status = genStep > step ? 'done' : genStep === step ? 'running' : 'pending'
                      return (
                        <Group key={step} gap="xs" wrap="nowrap"
                          style={{
                            padding: '5px 10px', borderRadius: 6,
                            background: status === 'done'    ? 'rgba(74,222,128,0.13)'
                                      : status === 'running' ? 'rgba(167,139,250,0.18)'
                                      : 'rgba(255,255,255,0.03)',
                            borderLeft: `3px solid ${
                              status === 'done'    ? 'var(--mantine-color-green-5)'
                            : status === 'running' ? 'var(--mantine-color-violet-5)'
                            : 'transparent'}`,
                          }}
                        >
                          {status === 'done'    && <ThemeIcon size={16} color="green"  variant="filled" radius="xl"><IconCheck size={10} /></ThemeIcon>}
                          {status === 'running' && <Loader size={16} color="violet" />}
                          {status === 'pending' && <Box w={16} h={16} style={{ borderRadius: '50%', border: '1.5px solid var(--mantine-color-gray-6)', flexShrink: 0 }} />}
                          <Text size="xs" fw={status === 'running' ? 700 : 400}
                                c={status === 'done' ? 'green' : status === 'running' ? undefined : 'dimmed'}>
                            {label}
                          </Text>
                        </Group>
                      )
                    })}
                  </Stack>
                  <Text size="xs" c="dimmed" ta="center" mt="sm">
                    {t('nc.gen_eta')}
                  </Text>
                </Paper>
              )}

              {/* Generate CTA */}
              <Button
                type="submit"
                variant="gradient"
                gradient={{ from: 'blue', to: 'violet', deg: 135 }}
                leftSection={generating ? <Loader size="xs" color="white" /> : <IconSparkles size={18} />}
                disabled={generating || !selectedModel}
                size="lg"
                fullWidth
              >
                {generating ? t('nc.generating_course') : t('nc.generate_btn')}
              </Button>

            </Stack>
          </form>

        </Stack>
      )}
    </Stack>
  )
}
