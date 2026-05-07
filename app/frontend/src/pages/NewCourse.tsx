import { useEffect, useState } from 'react'
import {
  Stack, Title, TextInput, Textarea, Button, Group,
  Paper, Text, Badge, Table, Loader, Stepper,
  Select, NumberInput, Progress, ThemeIcon, Checkbox,
  SimpleGrid, Collapse, Autocomplete, ActionIcon,
  SegmentedControl, Divider, ScrollArea,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import '@mantine/dates/styles.css'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconCheck, IconX, IconBolt, IconBrain,
  IconChevronDown, IconChevronRight, IconCalendar,
  IconEye, IconPlus,
} from '@tabler/icons-react'
import { api, type LlmModel, type Course, type CourseVersion } from '../api/client'
import { CourseViewer } from '../components/CourseViewer'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onCreated: () => void
  onGeneratingChange?: (generating: boolean, label?: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

// ── Review panel ──────────────────────────────────────────────────────────────

function ReviewPanel() {
  const [libCourses, setLibCourses]   = useState<Course[]>([])
  const [pickedSn,   setPickedSn]     = useState<string | null>(null)
  const [versions,   setVersions]     = useState<CourseVersion[]>([])
  const [selVid,     setSelVid]       = useState<string | null>(null)
  const [content,    setContent]      = useState<Record<string, any> | null>(null)
  const [loadingV,   setLoadingV]     = useState(false)
  const [loadingC,   setLoadingC]     = useState(false)
  const [forking,    setForking]      = useState(false)

  useEffect(() => {
    api.courses.list().then(setLibCourses).catch(() => {})
  }, [])

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

  const courseOptions = libCourses.map(c => ({
    value: c.shortname,
    label: `${c.shortname} — ${c.fullname}`,
  }))

  const versionOptions = versions.map(v => ({
    value: String(v.id),
    label: `v${v.version_num} · ${v.model_used || 'import'} · ${v.start_date || '—'}`,
  }))

  const selectedCourse  = libCourses.find(c => c.shortname === pickedSn)
  const selectedVersion = versions.find(v => v.id === Number(selVid))

  const handleFork = async () => {
    if (!pickedSn || !selVid) return
    setForking(true)
    try {
      const newVer = await api.courses.fork(pickedSn, Number(selVid))
      // Reload versions and switch to the new one
      const updated = await api.courses.versions(pickedSn)
      setVersions(updated)
      setSelVid(String(newVer.id))
      notifications.show({
        title: 'Saved as new version',
        message: `v${newVer.version_num} created for ${pickedSn}`,
        color: 'green',
      })
    } catch (e: any) {
      notifications.show({ title: 'Save failed', message: e.message, color: 'red' })
    } finally {
      setForking(false)
    }
  }

  return (
    <Stack gap="sm">
      <Paper withBorder p="md" radius="md">
        <Group grow align="flex-end">
          <Select
            label="Course"
            placeholder="Pick a course from the library…"
            data={courseOptions}
            value={pickedSn}
            onChange={setPickedSn}
            searchable
            clearable
          />
          {versions.length > 0 && (
            <Select
              label="Version"
              data={versionOptions}
              value={selVid}
              onChange={setSelVid}
            />
          )}
          {loadingV && <Loader size="sm" />}
          {selVid && (
            <Button
              variant="light"
              color="green"
              leftSection={forking ? <Loader size="xs" /> : <IconPlus size={14} />}
              onClick={handleFork}
              disabled={forking}
              style={{ flexShrink: 0, flexGrow: 0 }}
            >
              {forking ? 'Saving…' : `Save as v${(selectedVersion?.version_num ?? 0) + 1}`}
            </Button>
          )}
        </Group>

        {selectedCourse && (
          <Group gap="xs" mt="xs">
            <Text size="xs" c="dimmed">{selectedCourse.professor || '—'}</Text>
            <Text size="xs" c="dimmed">·</Text>
            <Text size="xs" c="dimmed">{selectedCourse.category || '—'}</Text>
            <Text size="xs" c="dimmed">·</Text>
            <Badge size="xs" variant="light">{selectedCourse.version_count} version{selectedCourse.version_count !== 1 ? 's' : ''}</Badge>
          </Group>
        )}
      </Paper>

      {loadingC && <Stack align="center" py="xl"><Loader /><Text size="sm" c="dimmed">Loading content…</Text></Stack>}

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
            onHwSpecChanged: (newContent) => {
              setContent(newContent)
            },
          }}
        />
      )}

      {!pickedSn && (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          Select a course above to review its content.
        </Text>
      )}
    </Stack>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CourseStudioPage({ onCreated, onGeneratingChange }: Props) {
  const [mode, setMode]               = useState<'new' | 'review'>('new')
  const [modelOpen, setModelOpen]     = useState(false)
  const [models, setModels]           = useState<LlmModel[]>([])
  const [evaluating, setEvaluating]   = useState(false)
  const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null)
  const [selectedModel, setModel]     = useState<string>('')
  const [generating, setGenerating]   = useState(false)
  const [genStep, setGenStep]         = useState(0)
  const [categories, setCategories]   = useState<string[]>([])
  const [hwSpec, setHwSpec]           = useState<Record<number, string | null>>({
    1: null, 2: null, 3: null, 4: null, 5: null,
  })

  const form = useForm<{
    shortname:     string
    fullname:      string
    professor:     string
    category:      string
    prompt:        string
    start_date:    Date | null
    end_date:      Date | null
    num_questions: number
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
    },
    validate: {
      shortname: (v: string) => v.trim() ? null : 'Required',
      fullname:  (v: string) => v.trim() ? null : 'Required',
      prompt:    (v: string) => v.trim() ? null : 'Required',
    },
  })

  useEffect(() => {
    api.llm.evaluationCache().then(cache => {
      if (cache.results.length) {
        setModels(cache.results)
        setEvaluatedAt(cache.evaluated_at)
        setModel(cache.results[0].id)
      } else {
        api.llm.models().then(m => { setModels(m); if (m.length) setModel(m[0].id) }).catch(() => {})
      }
    }).catch(() => {
      api.llm.models().then(m => { setModels(m); if (m.length) setModel(m[0].id) }).catch(() => {})
    })

    api.moodle.categories().then(cats => setCategories(cats.map(c => c.name))).catch(() => {})
  }, [])

  const runEvaluation = async () => {
    setEvaluating(true); setModels([])
    try {
      const cache = await api.llm.evaluate()
      setModels(cache.results); setEvaluatedAt(cache.evaluated_at)
      if (cache.results.length) setModel(cache.results[0].id)
      notifications.show({ title: 'Evaluation done', message: `Best: ${cache.results[0]?.id}`, color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Evaluation failed', message: e.message, color: 'red' })
    } finally { setEvaluating(false) }
  }

  const toDateStr = (d: Date | null) => d ? d.toISOString().slice(0, 10) : ''

  const generate = form.onSubmit(async values => {
    if (!selectedModel) {
      notifications.show({ title: 'No model', message: 'Select a model first.', color: 'orange' })
      return
    }
    setGenerating(true)
    onGeneratingChange?.(true, values.shortname)
    setGenStep(1)
    try {
      const hasHomework = Object.values(hwSpec).some(v => v !== null)
      const totalSteps  = hasHomework ? 5 : 4
      const timer = setInterval(() => setGenStep(s => Math.min(s + 1, totalSteps)), 30000)
      const hw: Record<string, string> = {}
      Object.entries(hwSpec).forEach(([k, v]) => { if (v) hw[k] = v })
      await api.courses.generate({
        ...values,
        start_date:    toDateStr(values.start_date),
        end_date:      toDateStr(values.end_date),
        model_id:      selectedModel,
        homework_spec: hw,
      })
      clearInterval(timer)
      setGenStep(totalSteps)
      onGeneratingChange?.(false)
      notifications.show({ title: 'Course created!', message: values.shortname, color: 'green', icon: <IconCheck /> })
      onCreated()
    } catch (e: any) {
      notifications.show({ title: 'Generation failed', message: e.message, color: 'red', icon: <IconX /> })
      setGenerating(false)
      onGeneratingChange?.(false)
      setGenStep(0)
    }
  })

  const scoreColor = (s: number) => s >= 8 ? 'green' : s >= 6 ? 'yellow' : 'red'
  const modelLabel = selectedModel
    ? (models.find(m => m.id === selectedModel)?.id ?? selectedModel)
    : 'None selected'

  return (
    <Stack maw={800}>
      <Group justify="space-between" align="center">
        <Title order={3}>Course Studio</Title>
        <SegmentedControl
          value={mode}
          onChange={v => setMode(v as 'new' | 'review')}
          data={[
            { value: 'new',    label: <Group gap={6} wrap="nowrap"><IconPlus size={14} /><span>New Course</span></Group> },
            { value: 'review', label: <Group gap={6} wrap="nowrap"><IconEye size={14} /><span>Review</span></Group> },
          ]}
        />
      </Group>

      {/* ── Review mode ──────────────────────────────────────────────────── */}
      {mode === 'review' && <ReviewPanel />}

      {/* ── New Course mode ──────────────────────────────────────────────── */}
      {mode === 'new' && (
        <Stack gap="md">

          {/* Model picker */}
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" wrap="nowrap" style={{ cursor: 'pointer' }}
                   onClick={() => setModelOpen(o => !o)}>
              <div>
                <Title order={5}>1 · Language Model</Title>
                <Text size="xs" c="dimmed">
                  {modelLabel}
                  {evaluatedAt && ` · evaluated ${relativeTime(evaluatedAt)}`}
                </Text>
              </div>
              <Group gap={6} wrap="nowrap">
                <Button
                  size="xs" variant="light"
                  leftSection={evaluating ? <Loader size="xs" /> : <IconBolt size={14} />}
                  onClick={e => { e.stopPropagation(); runEvaluation() }}
                  disabled={evaluating}
                >
                  {evaluating ? 'Evaluating…' : evaluatedAt ? 'Re-evaluate' : 'Evaluate'}
                </Button>
                <ActionIcon variant="subtle" size="sm">
                  {modelOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                </ActionIcon>
              </Group>
            </Group>

            <Collapse in={modelOpen} mt="sm">
              {models.length === 0 && !evaluating && (
                <Text size="sm" c="dimmed">No evaluation cached — click <strong>Evaluate</strong> to score all models.</Text>
              )}
              {models.length > 0 && (
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th></Table.Th>
                      <Table.Th>Model</Table.Th>
                      <Table.Th>Size</Table.Th>
                      <Table.Th>Quant</Table.Th>
                      {models[0].final_score !== undefined && <Table.Th>Score</Table.Th>}
                      {models[0].elapsed_s  !== undefined && <Table.Th>Speed</Table.Th>}
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
                          {selectedModel === m.id
                            ? <ThemeIcon size="xs" color="blue"><IconCheck size={10} /></ThemeIcon>
                            : <span />}
                          {i === 0 && m.final_score !== undefined && <Badge size="xs" color="green" ml={4}>★ Best</Badge>}
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
              )}
            </Collapse>
          </Paper>

          {/* Course details form */}
          <Paper withBorder p="md" radius="md">
            <Title order={5} mb="sm">2 · Course Details</Title>
            <form onSubmit={generate}>
              <Stack gap="sm">
                <Group grow>
                  <TextInput label="Short name" placeholder="Short name" {...form.getInputProps('shortname')} />
                  <TextInput label="Full name"  placeholder="Full name"  {...form.getInputProps('fullname')} />
                </Group>
                <Group grow>
                  <TextInput label="Professor"  placeholder="Professor"  {...form.getInputProps('professor')} />
                  <Autocomplete
                    label="Category"
                    placeholder="Category"
                    data={categories}
                    {...form.getInputProps('category')}
                  />
                </Group>
                <Group grow>
                  <DatePickerInput
                    label="Start date" placeholder="Start date"
                    leftSection={<IconCalendar size={14} />}
                    valueFormat="YYYY-MM-DD" clearable
                    {...form.getInputProps('start_date')}
                  />
                  <DatePickerInput
                    label="End date" placeholder="End date"
                    leftSection={<IconCalendar size={14} />}
                    valueFormat="YYYY-MM-DD" clearable
                    {...form.getInputProps('end_date')}
                  />
                </Group>
                <NumberInput
                  label="Quiz questions" min={10} max={100} step={5}
                  {...form.getInputProps('num_questions')}
                />

                <Paper withBorder p="sm" radius="sm">
                  <Text size="sm" fw={500} mb="xs">Homework (optional)</Text>
                  <Text size="xs" c="dimmed" mb="sm">Select which modules include extra homework and choose the type.</Text>
                  <SimpleGrid cols={5} spacing="xs">
                    {([1, 2, 3, 4, 5] as const).map(n => (
                      <Stack key={n} gap={4} align="center">
                        <Checkbox
                          label={`Mod ${n}`}
                          checked={hwSpec[n] !== null}
                          onChange={e => setHwSpec(prev => ({ ...prev, [n]: e.currentTarget.checked ? 'assign' : null }))}
                        />
                        {hwSpec[n] !== null && (
                          <Select
                            size="xs" value={hwSpec[n]}
                            onChange={v => setHwSpec(prev => ({ ...prev, [n]: v }))}
                            data={[{ value: 'assign', label: 'Assignment' }, { value: 'forum', label: 'Forum' }]}
                          />
                        )}
                      </Stack>
                    ))}
                  </SimpleGrid>
                </Paper>

                <Textarea
                  label="Course content prompt"
                  description="Describe the course: topic, audience, theological focus, key themes."
                  placeholder="Curso de hermenéutica bíblica para estudiantes de teología evangélica…"
                  minRows={5} autosize
                  {...form.getInputProps('prompt')}
                />

                {generating && (
                  <Stack gap="xs">
                    <Stepper active={genStep} size="xs">
                      <Stepper.Step label="Structure"  description="5 modules" />
                      <Stepper.Step label="Content"    description="Glossary + lectures" />
                      <Stepper.Step label="Prontuario" description="Syllabus" />
                      <Stepper.Step label="Quiz"       description="Questions" />
                      {Object.values(hwSpec).some(v => v !== null) && (
                        <Stepper.Step label="Homework" description="Assignments/forums" />
                      )}
                    </Stepper>
                    <Progress value={(genStep / (Object.values(hwSpec).some(v => v !== null) ? 5 : 4)) * 100} animated />
                    <Text size="xs" c="dimmed" ta="center">Generating… this takes 5–15 minutes.</Text>
                  </Stack>
                )}

                <Button
                  type="submit"
                  leftSection={generating ? <Loader size="xs" /> : <IconBrain size={16} />}
                  disabled={generating || !selectedModel}
                  size="md"
                >
                  {generating ? 'Generating…' : 'Generate Course'}
                </Button>
              </Stack>
            </form>
          </Paper>
        </Stack>
      )}
    </Stack>
  )
}
