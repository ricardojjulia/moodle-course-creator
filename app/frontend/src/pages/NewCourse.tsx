import { useEffect, useState } from 'react'
import {
  Stack, Title, TextInput, Textarea, Button, Group,
  Paper, Text, Badge, Table, Alert, Loader, Stepper,
  Select, NumberInput, Progress, ThemeIcon, Checkbox,
  SimpleGrid,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconRobot, IconCheck, IconX, IconPlayerPlay,
  IconBolt, IconBrain,
} from '@tabler/icons-react'
import { api, type LlmModel } from '../api/client'

interface Props { onCreated: () => void }

type Step = 'model' | 'details' | 'generating'

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

export default function NewCoursePage({ onCreated }: Props) {
  const [step, setStep]             = useState<Step>('model')
  const [models, setModels]         = useState<LlmModel[]>([])
  const [evaluating, setEvaluating] = useState(false)
  const [evaluatedAt, setEvaluatedAt] = useState<string | null>(null)
  const [selectedModel, setModel]   = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [genStep, setGenStep]       = useState(0)
  // homework_spec: {module_num: 'assign'|'forum'|null}
  const [hwSpec, setHwSpec]         = useState<Record<number, string | null>>({
    1: null, 2: null, 3: null, 4: null, 5: null,
  })

  const form = useForm({
    initialValues: {
      shortname:  '',
      fullname:   '',
      professor:  'Ricardo Julia',
      category:   '2025 - 2026 Spring Term',
      prompt:     '',
      start_date: '',
      end_date:   '',
      num_questions: 50,
    },
    validate: {
      shortname: (v: string) => v.trim() ? null : 'Required',
      fullname:  (v: string) => v.trim() ? null : 'Required',
      prompt:    (v: string) => v.trim() ? null : 'Required',
    },
  })

  // On mount: load cached evaluation, fall back to plain model list
  useEffect(() => {
    api.llm.evaluationCache().then(cache => {
      if (cache.results.length) {
        setModels(cache.results)
        setEvaluatedAt(cache.evaluated_at)
        setModel(cache.results[0].id)
      } else {
        api.llm.models().then(m => {
          setModels(m)
          if (m.length) setModel(m[0].id)
        }).catch(() => {})
      }
    }).catch(() => {
      api.llm.models().then(m => {
        setModels(m)
        if (m.length) setModel(m[0].id)
      }).catch(() => {})
    })
  }, [])

  const runEvaluation = async () => {
    setEvaluating(true)
    setModels([])
    try {
      const cache = await api.llm.evaluate()
      setModels(cache.results)
      setEvaluatedAt(cache.evaluated_at)
      if (cache.results.length) setModel(cache.results[0].id)
      notifications.show({ title: 'Evaluation done', message: `Best: ${cache.results[0]?.id}`, color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Evaluation failed', message: e.message, color: 'red' })
    } finally {
      setEvaluating(false)
    }
  }

  const generate = form.onSubmit(async values => {
    if (!selectedModel) {
      notifications.show({ title: 'No model', message: 'Select a model first.', color: 'orange' })
      return
    }
    setGenerating(true)
    setGenStep(1)
    try {
      // The backend runs all 4–5 steps; animate stepper while waiting
      const hasHomework = Object.values(hwSpec).some(v => v !== null)
      const totalSteps  = hasHomework ? 5 : 4
      const timer = setInterval(() => setGenStep(s => Math.min(s + 1, totalSteps)), 30000)
      const hw: Record<string, string> = {}
      Object.entries(hwSpec).forEach(([k, v]) => { if (v) hw[k] = v })
      await api.courses.generate({ ...values, model_id: selectedModel, homework_spec: hw })
      clearInterval(timer)
      setGenStep(totalSteps)
      notifications.show({ title: 'Course created!', message: values.shortname, color: 'green', icon: <IconCheck /> })
      onCreated()
    } catch (e: any) {
      notifications.show({ title: 'Generation failed', message: e.message, color: 'red', icon: <IconX /> })
      setGenerating(false)
      setGenStep(0)
    }
  })

  const scoreColor = (s: number) => s >= 8 ? 'green' : s >= 6 ? 'yellow' : 'red'

  return (
    <Stack maw={700}>
      <Title order={3}>New Course</Title>

      {/* ── Step 1: Model ─────────────────────────────────────────────── */}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="sm" wrap="nowrap">
          <div>
            <Title order={5}>1 · Select Language Model</Title>
            {evaluatedAt && (
              <Text size="xs" c="dimmed">
                Last evaluated: {relativeTime(evaluatedAt)}
              </Text>
            )}
          </div>
          <Button
            size="xs"
            variant="light"
            leftSection={evaluating ? <Loader size="xs" /> : <IconBolt size={14} />}
            onClick={runEvaluation}
            disabled={evaluating}
          >
            {evaluating ? 'Evaluating…' : evaluatedAt ? 'Re-evaluate' : 'Run Evaluation'}
          </Button>
        </Group>

        {models.length === 0 && !evaluating && (
          <Text size="sm" c="dimmed">
            No evaluation cached yet — click <strong>Run Evaluation</strong> to score all models.
          </Text>
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
                    <Table.Td>
                      <Badge size="xs" color={scoreColor(m.final_score)}>{m.final_score.toFixed(1)}</Badge>
                    </Table.Td>
                  )}
                  {m.elapsed_s !== undefined && (
                    <Table.Td><Text size="xs">{m.elapsed_s}s</Text></Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* ── Step 2: Course details ─────────────────────────────────────── */}
      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="sm">2 · Course Details</Title>
        <form onSubmit={generate}>
          <Stack gap="sm">
            <Group grow>
              <TextInput label="Short name" placeholder="TH310-2026_1" {...form.getInputProps('shortname')} />
              <TextInput label="Full name"  placeholder="TH 310 - HERMENEUTICA" {...form.getInputProps('fullname')} />
            </Group>
            <Group grow>
              <TextInput label="Professor"  {...form.getInputProps('professor')} />
              <TextInput label="Category"   {...form.getInputProps('category')} />
            </Group>
            <Group grow>
              <TextInput label="Start date" placeholder="2026-04-20" {...form.getInputProps('start_date')} />
              <TextInput label="End date"   placeholder="2026-06-15" {...form.getInputProps('end_date')} />
            </Group>
            <NumberInput
              label="Quiz questions"
              min={10} max={100} step={5}
              {...form.getInputProps('num_questions')}
            />

            {/* Homework selector */}
            <Paper withBorder p="sm" radius="sm">
              <Text size="sm" fw={500} mb="xs">Homework (optional)</Text>
              <Text size="xs" c="dimmed" mb="sm">
                Select which modules include extra homework and choose the type.
              </Text>
              <SimpleGrid cols={5} spacing="xs">
                {([1, 2, 3, 4, 5] as const).map(n => (
                  <Stack key={n} gap={4} align="center">
                    <Checkbox
                      label={`Mod ${n}`}
                      checked={hwSpec[n] !== null}
                      onChange={e => {
                        const checked = e.currentTarget.checked
                        setHwSpec(prev => ({ ...prev, [n]: checked ? 'assign' : null }))
                      }}
                    />
                    {hwSpec[n] !== null && (
                      <Select
                        size="xs"
                        value={hwSpec[n]}
                        onChange={v => setHwSpec(prev => ({ ...prev, [n]: v }))}
                        data={[
                          { value: 'assign', label: 'Assignment' },
                          { value: 'forum',  label: 'Forum' },
                        ]}
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
              minRows={5}
              autosize
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
  )
}
