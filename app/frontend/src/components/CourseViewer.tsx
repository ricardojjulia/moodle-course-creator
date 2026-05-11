/**
 * Shared read-only (and optionally editable) course content viewer.
 * Used by Library (read-only) and Course Studio Review (editable).
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Accordion, Badge, Box, Button, Checkbox, Group, Loader,
  Modal, ScrollArea, Stack, Table, Text, ActionIcon,
  TypographyStylesProvider, Divider, Textarea, Select, TextInput, NumberInput, Paper,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconExternalLink, IconRefresh, IconPencil, IconCheck, IconX, IconTrash, IconPlus, IconDeviceFloppy, IconSearch, IconArrowUp, IconArrowDown, IconUpload, IconDownload } from '@tabler/icons-react'
import { api, type LlmModel, type QuizQuestion, type BibleRef } from '../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivitySnap {
  id: number
  name: string
  modname: string
  content_html?: string
}

interface GlossaryEntry { term: string; definition?: string }

interface ModuleItem {
  number: number
  title: string
  objective?: string
  key_topics?: string[]
}

interface ModuleContent {
  module_num: number
  lecture_html?: string
  glossary_terms?: string[]
  glossary?: GlossaryEntry[]          // present for generated courses
  forum_question?: string
  discussion_question?: string        // alias used by older generated courses
  activities_snapshot?: ActivitySnap[]
}

// ── Activity detail modal ─────────────────────────────────────────────────────

const MOD_COLOR: Record<string, string> = {
  page: 'blue', assign: 'orange', forum: 'teal',
  quiz: 'red', resource: 'gray', label: 'gray',
}

function ActivityModal({ activity, moodleCourseId, onClose }: {
  activity: ActivitySnap | null
  moodleCourseId?: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [html,    setHtml]  = useState<string | null>(null)
  const [loading, setLoad]  = useState(false)
  const [tried,   setTried] = useState(false)

  useEffect(() => {
    if (!activity) return
    setHtml(null); setTried(false)
    if (activity.content_html?.trim()) { setHtml(activity.content_html); setTried(true) }
  }, [activity?.id])

  if (!activity) return null

  const fetchFromMoodle = async () => {
    if (!moodleCourseId) return
    setLoad(true)
    try {
      const res = await api.moodle.moduleContent(moodleCourseId, activity.id)
      setHtml(res.content_html || '<em>No content available.</em>')
    } catch (e: any) {
      setHtml(`<em>Could not load: ${e.message}</em>`)
    } finally { setLoad(false); setTried(true) }
  }

  return (
    <Modal opened={!!activity} onClose={onClose} size="xl"
           scrollAreaComponent={ScrollArea.Autosize}
           title={<Group gap="xs">
             <Badge color={MOD_COLOR[activity.modname] ?? 'gray'}>{activity.modname}</Badge>
             <Text fw={600} size="sm" lineClamp={2}>{activity.name}</Text>
           </Group>}>
      {!tried && !loading && (
        <Stack align="center" py="xl" gap="sm">
          <Text size="sm" c="dimmed">
            {moodleCourseId ? t('cv.not_stored_local') : t('cv.not_stored_activity')}
          </Text>
          {moodleCourseId && (
            <Button size="sm" variant="light" leftSection={<IconExternalLink size={14} />}
                    onClick={fetchFromMoodle}>{t('cv.load_from_moodle')}</Button>
          )}
        </Stack>
      )}
      {loading && <Stack align="center" py="xl"><Loader /><Text size="sm" c="dimmed">{t('cv.loading')}</Text></Stack>}
      {tried && !loading && html && (
        html.trim().startsWith('<')
          ? <TypographyStylesProvider><div dangerouslySetInnerHTML={{ __html: html }} /></TypographyStylesProvider>
          : <Text size="sm">{html}</Text>
      )}
    </Modal>
  )
}

// ── Quiz editor ───────────────────────────────────────────────────────────────

const EMPTY_QUESTION = (): QuizQuestion => ({
  question: '', options: ['', '', '', ''], correct_index: 0, explanation: '',
})

function QuizEditor({
  questions: initial, onSave, onCancel,
}: {
  questions: QuizQuestion[]
  onSave: (qs: QuizQuestion[]) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [qs,     setQs]     = useState<QuizQuestion[]>(() =>
    initial.map(q => ({ ...q, options: [...(q.options ?? ['','','',''])] }))
  )
  const [saving, setSaving] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const update = (i: number, patch: Partial<QuizQuestion>) =>
    setQs(prev => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q))

  const updateOption = (qi: number, oi: number, val: string) =>
    setQs(prev => prev.map((q, idx) => {
      if (idx !== qi) return q
      const opts = [...q.options]
      opts[oi] = val
      return { ...q, options: opts }
    }))

  const moveUp   = (i: number) => setQs(prev => {
    if (i === 0) return prev
    const next = [...prev]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next
  })
  const moveDown = (i: number) => setQs(prev => {
    if (i === prev.length - 1) return prev
    const next = [...prev]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next
  })

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(qs, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'quiz_questions.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        const items: QuizQuestion[] = Array.isArray(parsed) ? parsed : []
        const valid = items.filter(q =>
          typeof q.question === 'string' &&
          Array.isArray(q.options) && q.options.length >= 2 &&
          typeof q.correct_index === 'number'
        )
        setQs(prev => [...prev, ...valid.map(q => ({ ...q, options: [...q.options] }))])
      } catch {
        // silently ignore malformed JSON
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(qs) } finally { setSaving(false) }
  }

  return (
    <Stack gap="sm">
      <input ref={importRef} type="file" accept=".json" title="Import quiz questions JSON" aria-label="Import quiz questions JSON" hidden onChange={handleImport} />
      <Group justify="space-between" wrap="wrap">
        <Text size="sm" fw={600}>{t('cv.n_questions', { count: qs.length })}</Text>
        <Group gap="xs">
          <Button size="xs" variant="subtle" leftSection={<IconUpload size={12} />}
                  onClick={() => importRef.current?.click()}>
            {t('cv.import_quiz')}
          </Button>
          <Button size="xs" variant="subtle" leftSection={<IconDownload size={12} />}
                  onClick={handleExport} disabled={qs.length === 0}>
            {t('cv.export_quiz')}
          </Button>
          <Button size="xs" variant="subtle" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button size="xs" color="green" leftSection={<IconDeviceFloppy size={13} />}
                  loading={saving} onClick={handleSave}>
            {t('cv.save_quiz')}
          </Button>
        </Group>
      </Group>

      <ScrollArea mah={520} offsetScrollbars>
        <Stack gap="md">
          {qs.map((q, qi) => (
            <Paper key={qi} withBorder p="sm" radius="sm"
                   style={{ borderLeft: '3px solid var(--mantine-color-orange-4)' }}>
              <Group justify="space-between" mb="xs">
                <Group gap={2}>
                  <Badge size="xs" color="orange" variant="light">Q{qi + 1}</Badge>
                  <ActionIcon size="xs" variant="subtle" color="gray"
                              disabled={qi === 0} onClick={() => moveUp(qi)}>
                    <IconArrowUp size={11} />
                  </ActionIcon>
                  <ActionIcon size="xs" variant="subtle" color="gray"
                              disabled={qi === qs.length - 1} onClick={() => moveDown(qi)}>
                    <IconArrowDown size={11} />
                  </ActionIcon>
                </Group>
                <ActionIcon size="xs" color="red" variant="subtle"
                            onClick={() => setQs(prev => prev.filter((_, i) => i !== qi))}>
                  <IconTrash size={12} />
                </ActionIcon>
              </Group>

              <Textarea
                size="xs" label={t('cv.question_label')} minRows={2} autosize mb="xs"
                value={q.question}
                onChange={e => update(qi, { question: e.currentTarget.value })}
              />

              <Stack gap={4} mb="xs">
                {q.options.map((opt, oi) => (
                  <Group key={oi} gap="xs" wrap="nowrap">
                    <Text size="xs" fw={600} w={16} style={{ flexShrink: 0, color: oi === q.correct_index ? 'var(--mantine-color-green-6)' : undefined }}>
                      {String.fromCharCode(65 + oi)}
                    </Text>
                    <TextInput
                      size="xs"
                      style={{ flex: 1 }}
                      value={opt}
                      onChange={e => updateOption(qi, oi, e.currentTarget.value)}
                      styles={oi === q.correct_index
                        ? { input: { borderColor: 'var(--mantine-color-green-5)', background: 'rgba(74,222,128,0.07)' } }
                        : undefined
                      }
                    />
                    <ActionIcon
                      size="xs"
                      variant={oi === q.correct_index ? 'filled' : 'subtle'}
                      color="green"
                      onClick={() => update(qi, { correct_index: oi })}
                    >
                      <IconCheck size={11} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>

              <TextInput
                size="xs" label={t('cv.explanation_optional')}
                value={q.explanation ?? ''}
                onChange={e => update(qi, { explanation: e.currentTarget.value })}
              />
            </Paper>
          ))}

          <Button
            variant="dashed" color="orange" size="xs" fullWidth
            leftSection={<IconPlus size={13} />}
            onClick={() => setQs(prev => [...prev, EMPTY_QUESTION()])}
          >
            {t('cv.add_question_btn')}
          </Button>
        </Stack>
      </ScrollArea>
    </Stack>
  )
}

// ── Bible Reference Validator panel ──────────────────────────────────────────

const STATUS_COLOR: Record<BibleRef['status'], string> = {
  valid:                'green',
  unknown_book:         'red',
  chapter_out_of_range: 'red',
  verse_out_of_range:   'orange',
}

type TFn = (key: string, opts?: Record<string, unknown>) => string

function statusLabel(status: BibleRef['status'], t: TFn): string {
  switch (status) {
    case 'valid':                return t('cv.valid')
    case 'unknown_book':         return t('cv.unknown_book')
    case 'chapter_out_of_range': return t('cv.ch_oor')
    case 'verse_out_of_range':   return t('cv.verse_oor')
  }
}

function BibleRefsPanel({ shortname, versionId }: { shortname: string; versionId: number }) {
  const { t } = useTranslation()
  const [refs,    setRefs]    = useState<BibleRef[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const scan = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.courses.bibleRefs(shortname, versionId)
      setRefs(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const valid   = refs?.filter(r => r.status === 'valid').length ?? 0
  const flagged = refs?.filter(r => r.status !== 'valid').length ?? 0

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        {refs === null ? (
          <Text size="xs" c="dimmed">{t('cv.scan_prompt')}</Text>
        ) : (
          <Group gap="xs">
            <Badge size="xs" color="gray"   variant="light">{t('cv.n_refs', { count: refs.length })}</Badge>
            <Badge size="xs" color="green"  variant="light">{t('cv.n_valid', { count: valid })}</Badge>
            {flagged > 0 && <Badge size="xs" color="red" variant="light">{t('cv.n_flagged', { count: flagged })}</Badge>}
          </Group>
        )}
        <Button
          size="xs" variant="light" color="indigo"
          leftSection={loading ? <Loader size={12} /> : <IconSearch size={13} />}
          onClick={scan}
          loading={loading}
        >
          {refs === null ? t('cv.scan') : t('cv.rescan')}
        </Button>
      </Group>

      {error && <Text size="xs" c="red">{error}</Text>}

      {refs && refs.length === 0 && (
        <Text size="xs" c="dimmed" ta="center" py="xs">{t('cv.no_bible_refs')}</Text>
      )}

      {refs && refs.length > 0 && (
        <ScrollArea mah={340} offsetScrollbars>
          <Table withTableBorder={false} withRowBorders highlightOnHover fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('cv.th_reference')}</Table.Th>
                <Table.Th>{t('cv.th_book')}</Table.Th>
                <Table.Th>{t('cv.th_source')}</Table.Th>
                <Table.Th>{t('cv.th_status')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {refs.map((r, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <Text size="xs" fw={600}>{r.ref_text}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">{r.book_canonical}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                      {r.source_field}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={STATUS_COLOR[r.status]} variant="light">
                      {statusLabel(r.status, t as TFn)}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Stack>
  )
}

// ── Module panel ──────────────────────────────────────────────────────────────

function ModulePanel({ mod, mc, moodleCourseId, editProps, onFieldEdit }: {
  mod: ModuleItem
  mc?: ModuleContent
  moodleCourseId?: number
  editProps?: EditProps & { moduleNum: number }
  onFieldEdit?: (moduleNum: number, field: string, value: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [activeActivity,  setActiveActivity]  = useState<ActivitySnap | null>(null)
  const [regenOpen,       setRegenOpen]       = useState(false)
  const [instructions,    setInstructions]    = useState('')
  const [regenerating,    setRegenerating]    = useState(false)
  const [regenModel,      setRegenModel]      = useState<string>('')
  const [customPrompt,    setCustomPrompt]    = useState<string>('')
  const [modelOptions,    setModelOptions]    = useState<{ value: string; label: string }[]>([])
  const [promptMode,      setPromptMode]      = useState<'instructions' | 'custom'>('instructions')

  // Inline editing state
  const [localOverrides,  setLocalOverrides]  = useState<Partial<ModuleContent>>({})
  const [editingField,    setEditingField]    = useState<string | null>(null)
  const [fieldDraft,      setFieldDraft]      = useState('')
  const [savingField,     setSavingField]     = useState(false)

  const activities   = mc?.activities_snapshot ?? []
  const lectureHtml  = (localOverrides.lecture_html  ?? mc?.lecture_html  ?? '').trim()
  const forumQ       = (localOverrides.forum_question ?? mc?.forum_question ?? mc?.discussion_question ?? '').trim()
  const hasLecture   = !!lectureHtml

  // Glossary: prefer rich {term,definition} array; fall back to string[] terms
  const glossaryRich: GlossaryEntry[] = mc?.glossary?.length
    ? mc.glossary
    : (mc?.glossary_terms ?? []).map(t => ({ term: t }))

  // Activity toggles (only for editable mode)
  const hwSpec     = editProps?.hwSpec ?? {}
  const modHw      = hwSpec[mod.number] ?? null   // 'assign' | 'forum' | null
  const isEditable = !!(editProps?.shortname && editProps?.versionId)

  const buildDefaultPrompt = () => {
    const topics = (mod.key_topics ?? []).join(', ')
    const courseName = editProps?.courseName ?? ''
    return `Genera el contenido académico completo para este módulo de teología.\n\nCurso: ${courseName}\nMódulo ${mod.number}: ${mod.title}\nObjetivo: ${mod.objective ?? ''}\nTemas: ${topics}\n\nDevuelve EXACTAMENTE este JSON:\n{\n  "glossary": [\n    {"term": "término", "definition": "definición de 20-30 palabras"}\n  ],\n  "sections": [\n    {\n      "heading": "Título de la sección",\n      "text": "Desarrollo académico de mínimo 250 palabras. Usar párrafos separados por doble salto de línea."\n    }\n  ],\n  "discussion_question": "Pregunta de discusión reflexiva relacionada con el módulo"\n}\n\nIncluye exactamente 10 términos en glossary y entre 5 y 7 secciones.`
  }

  const openRegenModal = () => {
    setRegenModel(editProps?.defaultModelId ?? '')
    setInstructions('')
    setPromptMode('instructions')
    setCustomPrompt(buildDefaultPrompt())
    // Load models from evaluation cache, falling back to plain model list
    const buildOptions = (models: LlmModel[], ranked: boolean) =>
      models.map((m, i) => {
        let label = m.id
        if (ranked && m.final_score !== undefined) {
          label = `#${i + 1}  ${m.id}  · ${m.final_score.toFixed(1)} pts`
          if (m.elapsed_s !== undefined) label += `  · ${m.elapsed_s}s`
        }
        return { value: m.id, label }
      })
    api.llm.evaluationCache()
      .then(cache => {
        if (cache.results?.length) {
          setModelOptions(buildOptions(cache.results, cache.results[0].final_score !== undefined))
        } else {
          api.llm.models().then(ms => setModelOptions(buildOptions(ms, false))).catch(() => {})
        }
      })
      .catch(() => {
        api.llm.models().then(ms => setModelOptions(buildOptions(ms, false))).catch(() => {})
      })
    setRegenOpen(true)
  }

  const handleRegenerate = async () => {
    if (!editProps?.shortname || !editProps?.versionId) return
    setRegenOpen(false)
    setRegenerating(true)
    try {
      const res = await api.courses.regenerateModule(
        editProps.shortname, editProps.versionId, mod.number, {
          instructions: promptMode === 'instructions' ? instructions : '',
          model_id:     regenModel,
          custom_prompt: promptMode === 'custom' ? customPrompt : '',
        })
      editProps.onModuleRegenerated(mod.number, res.module_content as any)
      notifications.show({ title: t('cv.notif_regen_done'), message: mod.title, color: 'green' })
      setInstructions('')
    } catch (e: any) {
      notifications.show({ title: t('cv.notif_regen_fail'), message: e.message, color: 'red' })
    } finally {
      setRegenerating(false)
    }
  }

  const setActivity = async (type: 'assign' | 'forum' | null) => {
    if (!editProps?.shortname || !editProps?.versionId) return
    const next = { ...hwSpec }
    if (type === null) { delete next[mod.number] } else { next[mod.number] = type }
    try {
      const updated = await api.courses.patch(
        editProps.shortname, editProps.versionId,
        { homework_spec: Object.fromEntries(Object.entries(next).map(([k, v]) => [String(k), v])) }
      )
      editProps.onHwSpecChanged(updated.content as any)
    } catch (e: any) {
      notifications.show({ title: t('cv.notif_update_fail'), message: e.message, color: 'red' })
    }
  }

  const startEdit = (field: string, current: string) => {
    setEditingField(field)
    setFieldDraft(current)
  }

  const cancelEdit = () => { setEditingField(null); setFieldDraft('') }

  const saveField = async () => {
    if (!onFieldEdit || !editingField) return
    setSavingField(true)
    try {
      await onFieldEdit(mod.number, editingField, fieldDraft)
      setLocalOverrides(prev => ({ ...prev, [editingField]: fieldDraft }))
      setEditingField(null)
      setFieldDraft('')
      notifications.show({ title: t('cv.notif_saved'), message: `${mod.title} updated`, color: 'green' })
    } catch (e: any) {
      notifications.show({ title: t('cv.notif_save_fail'), message: e.message, color: 'red' })
    } finally {
      setSavingField(false)
    }
  }

  return (
    <>
      <Accordion.Item value={String(mod.number)}>
        <Accordion.Control>
          <Group justify="space-between" wrap="nowrap" pr="md">
            <Text size="sm" fw={600} lineClamp={1}>{mod.number}. {mod.title}</Text>
            <Group gap={4} style={{ flexShrink: 0 }}>
              {activities.length > 0 && (
                <Badge size="xs" variant="outline" color="gray">
                  {t('cv.n_activities', { count: activities.length })}
                </Badge>
              )}
              {glossaryRich.length > 0 && <Badge size="xs" variant="outline" color="teal">{t('cv.n_terms', { count: glossaryRich.length })}</Badge>}
              {forumQ && <Badge size="xs" variant="outline" color="blue">{t('cv.badge_forum')}</Badge>}
              {hasLecture && <Badge size="xs" variant="outline" color="violet">{t('cv.badge_lecture')}</Badge>}
              {modHw === 'assign' && <Badge size="xs" variant="filled" color="orange">{t('cv.badge_assignment')}</Badge>}
              {modHw === 'forum'  && <Badge size="xs" variant="filled" color="teal">{t('cv.badge_hw_forum')}</Badge>}
            </Group>
          </Group>
        </Accordion.Control>

        <Accordion.Panel>
          <Stack gap="sm">

            {/* Objective + key topics */}
            {mod.objective && <Text size="xs" c="dimmed">{mod.objective}</Text>}
            {mod.key_topics && mod.key_topics.length > 0 && (
              <Group gap={4} wrap="wrap">
                {mod.key_topics.map(t => <Badge key={t} size="xs" variant="light" color="gray">{t}</Badge>)}
              </Group>
            )}

            {/* Lecture */}
            {hasLecture && (
              <Box>
                {editingField === 'lecture_html' ? (
                  <Stack gap="xs">
                    <Textarea
                      autosize minRows={6}
                      value={fieldDraft}
                      onChange={e => setFieldDraft(e.currentTarget.value)}
                      styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
                    />
                    <Group gap="xs">
                      <ActionIcon size="sm" color="green" variant="filled" loading={savingField} onClick={saveField}>
                        <IconCheck size={12} />
                      </ActionIcon>
                      <ActionIcon size="sm" color="gray" variant="subtle" onClick={cancelEdit}>
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                  </Stack>
                ) : (
                  <Box
                    p="xs"
                    style={{ position: 'relative', background: 'var(--mantine-color-gray-0)', borderRadius: 6, fontSize: 13, lineHeight: 1.6 }}
                  >
                    {onFieldEdit && (
                      <ActionIcon
                        size="xs" variant="subtle" color="gray"
                        style={{ position: 'absolute', top: 6, right: 6 }}
                        onClick={() => startEdit('lecture_html', lectureHtml)}
                      >
                        <IconPencil size={12} />
                      </ActionIcon>
                    )}
                    <TypographyStylesProvider>
                      <div dangerouslySetInnerHTML={{ __html: lectureHtml }} />
                    </TypographyStylesProvider>
                  </Box>
                )}
              </Box>
            )}

            {/* Forum question */}
            {forumQ && (
              <Box p="xs" style={{ background: 'var(--mantine-color-blue-0)', borderRadius: 6, borderLeft: '3px solid var(--mantine-color-blue-4)' }}>
                <Group gap={4} mb={4} align="center">
                  <Text size="xs" fw={600} c="blue">{t('cv.forum_discussion_q')}</Text>
                  {onFieldEdit && editingField !== 'forum_question' && (
                    <ActionIcon size="xs" variant="subtle" color="blue"
                      onClick={() => startEdit('forum_question', forumQ)}>
                      <IconPencil size={12} />
                    </ActionIcon>
                  )}
                </Group>
                {editingField === 'forum_question' ? (
                  <Stack gap="xs">
                    <Textarea
                      autosize minRows={3}
                      value={fieldDraft}
                      onChange={e => setFieldDraft(e.currentTarget.value)}
                    />
                    <Group gap="xs">
                      <ActionIcon size="sm" color="green" variant="filled" loading={savingField} onClick={saveField}>
                        <IconCheck size={12} />
                      </ActionIcon>
                      <ActionIcon size="sm" color="gray" variant="subtle" onClick={cancelEdit}>
                        <IconX size={12} />
                      </ActionIcon>
                    </Group>
                  </Stack>
                ) : (
                  <Text size="xs">{forumQ}</Text>
                )}
              </Box>
            )}

            {/* Glossary with definitions */}
            {glossaryRich.length > 0 && (
              <Box p="xs" style={{ background: 'var(--mantine-color-teal-0)', borderRadius: 6, borderLeft: '3px solid var(--mantine-color-teal-4)' }}>
                <Text size="xs" fw={600} c="teal" mb={6}>{t('cv.glossary_n', { count: glossaryRich.length })}</Text>
                <Stack gap={4}>
                  {glossaryRich.map(({ term, definition }) => (
                    <Group key={term} gap="xs" align="flex-start" wrap="nowrap">
                      <Text size="xs" fw={600} style={{ flexShrink: 0 }}>{term}</Text>
                      {definition && <>
                        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>—</Text>
                        <Text size="xs" c="dimmed">{definition}</Text>
                      </>}
                    </Group>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Activities snapshot (for .mbz imports) */}
            {activities.length > 0 && (
              <Table withTableBorder={false} withRowBorders highlightOnHover>
                <Table.Tbody>
                  {activities.map((a, i) => (
                    <Table.Tr key={`${a.id}-${i}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setActiveActivity(a)}>
                      <Table.Td w={80}><Badge size="xs" variant="outline">{a.modname}</Badge></Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {a.name || <Text span size="xs" c="dimmed" fs="italic">untitled</Text>}
                        </Text>
                      </Table.Td>
                      <Table.Td w={24}>
                        <ActionIcon size="xs" variant="subtle" color={a.content_html ? 'blue' : 'gray'}>
                          <IconExternalLink size={11} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}

            {/* ── Edit controls ─────────────────────────────────────────── */}
            {isEditable && (
              <>
                <Divider />
                <Group justify="space-between" wrap="nowrap">
                  {/* Activity toggles */}
                  <Group gap="sm">
                    <Text size="xs" c="dimmed" fw={500}>{t('cv.extra_activity')}</Text>
                    <Checkbox
                      size="xs"
                      label={t('cv.assignment')}
                      checked={modHw === 'assign'}
                      onChange={e => setActivity(e.currentTarget.checked ? 'assign' : null)}
                    />
                    <Checkbox
                      size="xs"
                      label={t('cv.forum')}
                      checked={modHw === 'forum'}
                      onChange={e => setActivity(e.currentTarget.checked ? 'forum' : null)}
                    />
                  </Group>

                  {/* Regenerate button → opens instruction modal */}
                  <Button
                    size="xs"
                    variant="light"
                    color="violet"
                    leftSection={regenerating ? <Loader size="xs" /> : <IconRefresh size={13} />}
                    onClick={openRegenModal}
                    disabled={regenerating}
                  >
                    {regenerating ? t('cv.regenerating') : t('cv.regenerate')}
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      <ActivityModal
        activity={activeActivity}
        moodleCourseId={moodleCourseId}
        onClose={() => setActiveActivity(null)}
      />

      {/* Regeneration modal */}
      <Modal
        opened={regenOpen}
        onClose={() => setRegenOpen(false)}
        title={<Text fw={600} size="sm">{t('cv.regen_modal_title', { title: mod.title })}</Text>}
        size="lg"
      >
        <Stack gap="sm">
          {/* Model selector */}
          <Select
            label={t('cv.model_label')}
            description={t('cv.model_desc')}
            placeholder={editProps?.defaultModelId ?? 'default'}
            data={modelOptions}
            value={regenModel || null}
            onChange={v => setRegenModel(v ?? '')}
            clearable
            searchable
          />

          <Divider label={t('cv.prompt_divider')} labelPosition="left" />

          {/* Mode toggle */}
          <Group gap="xs">
            <Button
              size="xs"
              variant={promptMode === 'instructions' ? 'filled' : 'light'}
              color="violet"
              onClick={() => setPromptMode('instructions')}
            >{t('cv.instructions_btn')}</Button>
            <Button
              size="xs"
              variant={promptMode === 'custom' ? 'filled' : 'light'}
              color="violet"
              onClick={() => setPromptMode('custom')}
            >{t('cv.full_prompt_btn')}</Button>
          </Group>

          {promptMode === 'instructions' && (
            <Textarea
              placeholder={t('cv.instructions_placeholder')}
              description={t('cv.instructions_desc')}
              minRows={4}
              autosize
              value={instructions}
              onChange={e => setInstructions(e.currentTarget.value)}
            />
          )}

          {promptMode === 'custom' && (
            <Textarea
              description={t('cv.custom_prompt_desc')}
              minRows={10}
              autosize
              value={customPrompt}
              onChange={e => setCustomPrompt(e.currentTarget.value)}
              styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
            />
          )}

          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={() => setRegenOpen(false)}>{t('common.cancel')}</Button>
            <Button
              color="violet"
              leftSection={<IconRefresh size={14} />}
              onClick={handleRegenerate}
            >
              {t('cv.regenerate')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}

// ── Edit props (passed only in Course Studio Review) ──────────────────────────

interface EditProps {
  shortname: string
  versionId: number
  hwSpec: Record<number, string>
  defaultModelId: string
  courseName: string
  onModuleRegenerated: (moduleNum: number, newMc: ModuleContent) => void
  onHwSpecChanged: (newContent: Record<string, any>) => void
}

// ── Public viewer ─────────────────────────────────────────────────────────────

interface CourseViewerProps {
  content: Record<string, any>
  moodleCourseId?: number
  editProps?: EditProps
  onFieldEdit?: (moduleNum: number, field: string, value: string) => Promise<void>
  onQuizSave?: (questions: QuizQuestion[]) => Promise<void>
  bibleValidation?: { shortname: string; versionId: number }
}

export function CourseViewer({ content, moodleCourseId, editProps, onFieldEdit, onQuizSave, bibleValidation }: CourseViewerProps) {
  const { t } = useTranslation()
  const modules: ModuleItem[]    = content?.course_structure?.modules ?? []
  const mcs: ModuleContent[]     = content?.module_contents ?? []
  const quizQuestions: QuizQuestion[] = content?.quiz_questions ?? []

  const [quizEditing, setQuizEditing] = useState(false)

  if (!modules.length) {
    return <Text size="sm" c="dimmed" ta="center" py="xl">{t('cv.no_content')}</Text>
  }

  return (
    <Stack gap={0}>
      <Accordion chevronPosition="left" multiple>
        {modules.map(mod => {
          const mc = mcs.find(m => m.module_num === mod.number)
              ?? (mcs[mod.number - 1]?.module_num === undefined ? mcs[mod.number - 1] : undefined)
          return (
            <ModulePanel
              key={mod.number}
              mod={mod}
              mc={mc}
              moodleCourseId={moodleCourseId}
              editProps={editProps ? { ...editProps, moduleNum: mod.number } : undefined}
              onFieldEdit={onFieldEdit}
            />
          )
        })}
      </Accordion>

      {/* Bible Reference Validator — shown when shortname+versionId are supplied */}
      {bibleValidation && (
        <Box mt="sm">
          <Accordion chevronPosition="left">
            <Accordion.Item value="bible-refs">
              <Accordion.Control>
                <Text size="sm" fw={600}>{t('cv.bible_refs')}</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <BibleRefsPanel
                  shortname={bibleValidation.shortname}
                  versionId={bibleValidation.versionId}
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Box>
      )}

      {/* Quiz section — always visible when editing is available, or when questions exist */}
      {(quizQuestions.length > 0 || onQuizSave) && (
        <Box mt="sm">
          <Accordion chevronPosition="left">
            <Accordion.Item value="quiz">
              <Accordion.Control>
                <Group gap="xs">
                  <Text size="sm" fw={600}>{t('cv.quiz_bank')}</Text>
                  <Badge size="xs" color={quizQuestions.length > 0 ? 'orange' : 'gray'} variant="light">
                    {t('cv.n_questions', { count: quizQuestions.length })}
                  </Badge>
                  {onQuizSave && !quizEditing && (
                    <Badge
                      size="xs" color="violet" variant="outline"
                      style={{ cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); setQuizEditing(true) }}
                    >
                      {t('cv.edit_badge')}
                    </Badge>
                  )}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                {quizEditing && onQuizSave ? (
                  <QuizEditor
                    questions={quizQuestions}
                    onSave={async qs => {
                      await onQuizSave(qs)
                      setQuizEditing(false)
                      notifications.show({ title: t('cv.quiz_saved'), message: t('cv.n_questions', { count: qs.length }), color: 'green' })
                    }}
                    onCancel={() => setQuizEditing(false)}
                  />
                ) : quizQuestions.length === 0 ? (
                  <Stack align="center" py="md" gap="xs">
                    <Text size="sm" c="dimmed">{t('cv.no_quiz_yet')}</Text>
                    {onQuizSave && (
                      <Button size="xs" variant="light" color="orange"
                              leftSection={<IconPlus size={13} />}
                              onClick={() => setQuizEditing(true)}>
                        {t('cv.add_questions_btn')}
                      </Button>
                    )}
                  </Stack>
                ) : (
                  <Stack gap="sm">
                    {quizQuestions.map((q, i) => (
                      <Box key={i} p="xs" style={{ borderLeft: '2px solid var(--mantine-color-orange-3)', paddingLeft: 10 }}>
                        <Text size="xs" fw={500} mb={4}>{i + 1}. {q.question}</Text>
                        <Stack gap={2}>
                          {(q.options ?? []).map((opt, oi) => (
                            <Text
                              key={oi} size="xs"
                              c={oi === q.correct_index ? 'green' : 'dimmed'}
                              fw={oi === q.correct_index ? 600 : 400}
                            >
                              {String.fromCharCode(65 + oi)}) {opt}
                              {oi === q.correct_index && ' ✓'}
                            </Text>
                          ))}
                        </Stack>
                        {q.explanation && <Text size="xs" c="dimmed" mt={4} fs="italic">{q.explanation}</Text>}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Box>
      )}
    </Stack>
  )
}
