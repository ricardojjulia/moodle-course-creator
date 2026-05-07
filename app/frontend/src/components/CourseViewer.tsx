/**
 * Shared read-only (and optionally editable) course content viewer.
 * Used by Library (read-only) and Course Studio Review (editable).
 */
import { useEffect, useState } from 'react'
import {
  Accordion, Badge, Box, Button, Checkbox, Group, Loader,
  Modal, ScrollArea, Stack, Table, Text, ActionIcon,
  TypographyStylesProvider, Divider, Textarea, Select,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconExternalLink, IconRefresh } from '@tabler/icons-react'
import { api, type LlmModel } from '../api/client'

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
            {moodleCourseId ? 'Content not stored locally.' : 'No content stored for this activity.'}
          </Text>
          {moodleCourseId && (
            <Button size="sm" variant="light" leftSection={<IconExternalLink size={14} />}
                    onClick={fetchFromMoodle}>Load from Moodle</Button>
          )}
        </Stack>
      )}
      {loading && <Stack align="center" py="xl"><Loader /><Text size="sm" c="dimmed">Loading…</Text></Stack>}
      {tried && !loading && html && (
        html.trim().startsWith('<')
          ? <TypographyStylesProvider><div dangerouslySetInnerHTML={{ __html: html }} /></TypographyStylesProvider>
          : <Text size="sm">{html}</Text>
      )}
    </Modal>
  )
}

// ── Module panel ──────────────────────────────────────────────────────────────

function ModulePanel({ mod, mc, moodleCourseId, editProps }: {
  mod: ModuleItem
  mc?: ModuleContent
  moodleCourseId?: number
  editProps?: EditProps & { moduleNum: number }
}) {
  const [activeActivity,  setActiveActivity]  = useState<ActivitySnap | null>(null)
  const [regenOpen,       setRegenOpen]       = useState(false)
  const [instructions,    setInstructions]    = useState('')
  const [regenerating,    setRegenerating]    = useState(false)
  const [regenModel,      setRegenModel]      = useState<string>('')
  const [customPrompt,    setCustomPrompt]    = useState<string>('')
  const [modelOptions,    setModelOptions]    = useState<{ value: string; label: string }[]>([])
  const [promptMode,      setPromptMode]      = useState<'instructions' | 'custom'>('instructions')

  const activities   = mc?.activities_snapshot ?? []
  const hasLecture   = !!(mc?.lecture_html?.trim())
  const forumQ       = mc?.forum_question?.trim() || mc?.discussion_question?.trim() || ''

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
      notifications.show({ title: 'Module regenerated', message: mod.title, color: 'green' })
      setInstructions('')
    } catch (e: any) {
      notifications.show({ title: 'Regeneration failed', message: e.message, color: 'red' })
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
      notifications.show({ title: 'Update failed', message: e.message, color: 'red' })
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
                  {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
                </Badge>
              )}
              {glossaryRich.length > 0 && <Badge size="xs" variant="outline" color="teal">{glossaryRich.length} terms</Badge>}
              {forumQ && <Badge size="xs" variant="outline" color="blue">forum</Badge>}
              {hasLecture && <Badge size="xs" variant="outline" color="violet">lecture</Badge>}
              {modHw === 'assign' && <Badge size="xs" variant="filled" color="orange">assignment</Badge>}
              {modHw === 'forum'  && <Badge size="xs" variant="filled" color="teal">hw forum</Badge>}
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
              <Box p="xs" style={{ background: 'var(--mantine-color-gray-0)', borderRadius: 6, fontSize: 13, lineHeight: 1.6 }}>
                <TypographyStylesProvider>
                  <div dangerouslySetInnerHTML={{ __html: mc!.lecture_html! }} />
                </TypographyStylesProvider>
              </Box>
            )}

            {/* Forum question */}
            {forumQ && (
              <Box p="xs" style={{ background: 'var(--mantine-color-blue-0)', borderRadius: 6, borderLeft: '3px solid var(--mantine-color-blue-4)' }}>
                <Text size="xs" fw={600} c="blue" mb={4}>Forum Discussion Question</Text>
                <Text size="xs">{forumQ}</Text>
              </Box>
            )}

            {/* Glossary with definitions */}
            {glossaryRich.length > 0 && (
              <Box p="xs" style={{ background: 'var(--mantine-color-teal-0)', borderRadius: 6, borderLeft: '3px solid var(--mantine-color-teal-4)' }}>
                <Text size="xs" fw={600} c="teal" mb={6}>Glossary ({glossaryRich.length} terms)</Text>
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
                              style={{ cursor: a.content_html ? 'pointer' : 'default' }}
                              onClick={() => a.content_html ? setActiveActivity(a) : undefined}>
                      <Table.Td w={80}><Badge size="xs" variant="outline">{a.modname}</Badge></Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {a.name || <Text span size="xs" c="dimmed" fs="italic">untitled</Text>}
                        </Text>
                      </Table.Td>
                      <Table.Td w={24}>
                        {a.content_html && (
                          <ActionIcon size="xs" variant="subtle" color="blue">
                            <IconExternalLink size={11} />
                          </ActionIcon>
                        )}
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
                    <Text size="xs" c="dimmed" fw={500}>Extra activity:</Text>
                    <Checkbox
                      size="xs"
                      label="Assignment"
                      checked={modHw === 'assign'}
                      onChange={e => setActivity(e.currentTarget.checked ? 'assign' : null)}
                    />
                    <Checkbox
                      size="xs"
                      label="Forum"
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
                    {regenerating ? 'Regenerating…' : 'Regenerate'}
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
        title={<Text fw={600} size="sm">Regenerate — {mod.title}</Text>}
        size="lg"
      >
        <Stack gap="sm">
          {/* Model selector */}
          <Select
            label="Model"
            description="Leave blank to use the model that generated this version"
            placeholder={editProps?.defaultModelId ?? 'default'}
            data={modelOptions}
            value={regenModel || null}
            onChange={v => setRegenModel(v ?? '')}
            clearable
            searchable
          />

          <Divider label="Prompt" labelPosition="left" />

          {/* Mode toggle */}
          <Group gap="xs">
            <Button
              size="xs"
              variant={promptMode === 'instructions' ? 'filled' : 'light'}
              color="violet"
              onClick={() => setPromptMode('instructions')}
            >Instructions</Button>
            <Button
              size="xs"
              variant={promptMode === 'custom' ? 'filled' : 'light'}
              color="violet"
              onClick={() => setPromptMode('custom')}
            >Full prompt</Button>
          </Group>

          {promptMode === 'instructions' && (
            <Textarea
              placeholder="e.g. Focus more on practical examples. Add a section on historical context. Keep definitions under 20 words."
              description="Appended to the default prompt as additional instructions"
              minRows={4}
              autosize
              value={instructions}
              onChange={e => setInstructions(e.currentTarget.value)}
            />
          )}

          {promptMode === 'custom' && (
            <Textarea
              description="Replaces the entire default prompt — the model receives exactly this text"
              minRows={10}
              autosize
              value={customPrompt}
              onChange={e => setCustomPrompt(e.currentTarget.value)}
              styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
            />
          )}

          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={() => setRegenOpen(false)}>Cancel</Button>
            <Button
              color="violet"
              leftSection={<IconRefresh size={14} />}
              onClick={handleRegenerate}
            >
              Regenerate
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
}

export function CourseViewer({ content, moodleCourseId, editProps }: CourseViewerProps) {
  const modules: ModuleItem[] = content?.course_structure?.modules ?? []
  const mcs: ModuleContent[]  = content?.module_contents ?? []

  if (!modules.length) {
    return <Text size="sm" c="dimmed" ta="center" py="xl">No module content stored for this version.</Text>
  }

  return (
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
          />
        )
      })}
    </Accordion>
  )
}
