import { useEffect, useState } from 'react'
import {
  Stack, TextInput, PasswordInput, Button, Group,
  Title, Text, Alert, Badge, Paper, Loader,
  ActionIcon, Tooltip, ThemeIcon, SimpleGrid, Progress,
  Box, Divider, Select, Collapse, CopyButton, Code,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconCheck, IconX, IconWifi, IconCloud, IconTrash,
  IconPlayerPlay, IconPlus, IconBook, IconCategory,
  IconUsers, IconUserCheck, IconUserOff, IconUserX,
  IconEyeOff, IconShield, IconDeviceMobile,
  IconApi, IconRefresh, IconSchool, IconRobot,
  IconBrain, IconServer, IconExternalLink,
  IconClock, IconCalendarEvent, IconLock, IconLockOpen, IconCopy,
} from '@tabler/icons-react'
import { api, type AppSettings, type MoodleInstance, type MoodleStats, type ReviewSchedule, tokenStore } from '../api/client'

// ── LLM provider presets ──────────────────────────────────────────────────────

const LLM_PROVIDERS = [
  { id: 'local',      label: 'Local LLM',  url: '',                              needsKey: false, icon: <IconServer  size={14} />, color: 'gray'   },
  { id: 'openai',     label: 'OpenAI',     url: 'https://api.openai.com/v1',     needsKey: true,  icon: <IconBrain   size={14} />, color: 'green'  },
  { id: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/api/v1',  needsKey: true,  icon: <IconRobot   size={14} />, color: 'violet' },
  { id: 'anthropic',  label: 'Claude',     url: 'https://api.anthropic.com/v1',  needsKey: true,  icon: <IconBrain   size={14} />, color: 'orange' },
  { id: 'custom',     label: 'Custom',     url: '',                              needsKey: true,  icon: <IconApi     size={14} />, color: 'blue'   },
] as const

const PROVIDER_MODELS: Record<string, string[]> = {
  openai:     ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-4-turbo'],
  openrouter: ['anthropic/claude-opus-4-7', 'anthropic/claude-sonnet-4-6', 'openai/gpt-4o', 'google/gemini-2.5-pro', 'meta-llama/llama-3.3-70b-instruct'],
  anthropic:  ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color = 'blue', icon }: {
  label: string
  value: number | string | undefined | null
  color?: string
  icon: React.ReactNode
}) {
  return (
    <Paper withBorder p="sm" radius="md" ta="center">
      <ThemeIcon size="lg" radius="md" color={color} variant="light" mx="auto" mb={6}>
        {icon}
      </ThemeIcon>
      <Text fw={700} size="xl" c={color} lh={1}>
        {value ?? '—'}
      </Text>
      <Text size="xs" c="dimmed" mt={4} lh={1.2}>{label}</Text>
    </Paper>
  )
}

// ── Site overview panel ───────────────────────────────────────────────────────

function SiteOverview({ stats, loading }: { stats: MoodleStats | null; loading: boolean }) {
  if (loading) {
    return (
      <Paper withBorder p="md" radius="md">
        <Group gap="sm">
          <Loader size="sm" />
          <Text size="sm" fw={500}>Loading site metrics…</Text>
        </Group>
      </Paper>
    )
  }

  if (!stats) return null

  const maxCourses = Math.max(...Object.values(stats.courses_per_category ?? {}), 1)

  return (
    <Paper withBorder p="md" radius="md">

      {/* Header */}
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <div>
          <Group gap="xs">
            <ThemeIcon size="sm" color="blue" variant="light"><IconCloud size={12} /></ThemeIcon>
            <Title order={5}>{stats.site_name || 'Site Overview'}</Title>
            {stats.current_user_is_admin && (
              <Badge size="xs" color="red" leftSection={<IconShield size={9} />}>Admin</Badge>
            )}
            {stats.mobile_service_enabled && (
              <Badge size="xs" color="teal" leftSection={<IconDeviceMobile size={9} />}>Mobile</Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed" mt={2}>
            {stats.release}
            {stats.current_user_fullname ? ` · connected as ${stats.current_user_fullname}` : ''}
            {stats.api_functions_count ? ` · ${stats.api_functions_count} API functions` : ''}
          </Text>
        </div>
      </Group>

      <Divider mb="sm" />

      {/* Row 1 — Course & Category stats */}
      <Text size="xs" fw={600} c="dimmed" mb={6} tt="uppercase">Courses</Text>
      <SimpleGrid cols={4} spacing="xs" mb="md">
        <StatCard
          label="Total Courses"
          value={stats.total_courses}
          color="blue"
          icon={<IconBook size={16} />}
        />
        <StatCard
          label="Visible"
          value={stats.visible_courses}
          color="green"
          icon={<IconBook size={16} />}
        />
        <StatCard
          label="Hidden"
          value={stats.hidden_courses}
          color="orange"
          icon={<IconEyeOff size={16} />}
        />
        <StatCard
          label="Categories"
          value={stats.total_categories}
          color="teal"
          icon={<IconCategory size={16} />}
        />
      </SimpleGrid>

      {/* Row 2 — User stats */}
      <Text size="xs" fw={600} c="dimmed" mb={6} tt="uppercase">Users</Text>
      <SimpleGrid cols={4} spacing="xs" mb="md">
        <StatCard
          label="Total Users"
          value={stats.total_users}
          color="blue"
          icon={<IconUsers size={16} />}
        />
        <StatCard
          label="Active (30 days)"
          value={stats.active_30d}
          color="green"
          icon={<IconUserCheck size={16} />}
        />
        <StatCard
          label="Suspended"
          value={stats.suspended_users}
          color="orange"
          icon={<IconUserX size={16} />}
        />
        <StatCard
          label="Never Logged In"
          value={stats.never_logged_in}
          color="red"
          icon={<IconUserOff size={16} />}
        />
      </SimpleGrid>

      {/* Row 3 — Misc */}
      <SimpleGrid cols={4} spacing="xs" mb="md">
        <StatCard
          label="Currently Active"
          value={stats.active_courses ?? '—'}
          color="violet"
          icon={<IconSchool size={16} />}
        />
        <StatCard
          label="Mobile Service"
          value={stats.mobile_service_enabled ? 'Enabled' : 'Disabled'}
          color={stats.mobile_service_enabled ? 'teal' : 'gray'}
          icon={<IconDeviceMobile size={16} />}
        />
        <StatCard
          label="API Functions"
          value={stats.api_functions_count}
          color="grape"
          icon={<IconApi size={16} />}
        />
        <StatCard
          label="Activity Rate"
          value={stats.total_users
            ? `${Math.round(((stats.active_30d ?? 0) / stats.total_users) * 100)}%`
            : '—'}
          color="cyan"
          icon={<IconUserCheck size={16} />}
        />
      </SimpleGrid>

      {/* Courses per category */}
      {stats.courses_per_category && Object.keys(stats.courses_per_category).length > 0 && (
        <>
          <Divider mb="sm" />
          <Text size="xs" fw={600} c="dimmed" mb={8} tt="uppercase">Courses per Category</Text>
          <Stack gap={6}>
            {Object.entries(stats.courses_per_category).map(([cat, count]) => (
              <div key={cat}>
                <Group justify="space-between" mb={2}>
                  <Text size="xs" lineClamp={1} style={{ flex: 1 }}>{cat}</Text>
                  <Badge size="xs" variant="outline" color="blue">{count}</Badge>
                </Group>
                <Progress
                  value={(count / maxCourses) * 100}
                  size="sm"
                  color="blue"
                  radius="xl"
                />
              </div>
            ))}
          </Stack>
        </>
      )}

      {/* Auth methods */}
      {stats.auth_methods && Object.keys(stats.auth_methods).length > 0 && (
        <>
          <Divider mt="sm" mb="sm" />
          <Text size="xs" fw={600} c="dimmed" mb={6} tt="uppercase">Authentication Methods</Text>
          <Group gap={6} wrap="wrap">
            {Object.entries(stats.auth_methods).map(([method, count]) => (
              <Badge key={method} size="sm" variant="light" color="gray">
                {method}: {count}
              </Badge>
            ))}
          </Group>
        </>
      )}

      {/* Partial error notices */}
      {(stats.site_error || stats.courses_error || stats.categories_error || stats.users_error) && (
        <>
          <Divider mt="sm" mb="xs" />
          <Text size="xs" c="dimmed">
            Some metrics unavailable:{' '}
            {[stats.site_error, stats.courses_error, stats.categories_error, stats.users_error]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </>
      )}
    </Paper>
  )
}

// ── Scheduled reviews section ─────────────────────────────────────────────────

const SCHED_AGENTS = [
  {
    id: 'theological-reviewer', label: 'Theological Reviewer', color: 'violet',
    context: `# Role: Evangelical Theological Course Reviewer\nYou are a senior academic auditor for a conservative Protestant/Evangelical theological college. Audit the course for biblical soundness, academic rigor, structural completeness (syllabus, glossary, bibliography, 5 modules, 30+ quiz questions, discussion forums), and Evangelical alignment.`,
  },
  {
    id: 'student-critic', label: 'Student Critic', color: 'orange',
    context: `# Role: Evangelical Student & Content Critic\nYou are a high-achieving, critical-thinking student at an Evangelical Theological College. Stress-test the course content for theological depth, modern relevance, practical application, and assignment fairness.`,
  },
]

function ScheduledReviewsSection({ defaultModel }: { defaultModel: string }) {
  const [schedules,   setSchedules]   = useState<ReviewSchedule[]>([])
  const [courses,     setCourses]     = useState<{ value: string; label: string }[]>([])
  const [loading,     setLoading]     = useState(false)
  const [running,     setRunning]     = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [deleting,    setDeleting]    = useState<number | null>(null)
  const [newShort,    setNewShort]    = useState<string | null>(null)
  const [newAgent,    setNewAgent]    = useState<string>(SCHED_AGENTS[0].id)
  const [newFreq,     setNewFreq]     = useState<string>('weekly')
  const [newModel,    setNewModel]    = useState(defaultModel)
  const [saving,      setSaving]      = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.schedules.list(),
      api.courses.list(),
    ]).then(([scheds, libCourses]) => {
      setSchedules(scheds)
      setCourses(libCourses.map(c => ({ value: c.shortname, label: `${c.shortname} — ${c.fullname}` })))
    }).catch(e => notifications.show({ title: 'Error', message: e.message, color: 'red' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const overdueCount = schedules.filter(s =>
    s.enabled && new Date(s.next_run_at + 'Z') <= new Date()
  ).length

  const runOverdue = async () => {
    setRunning(true)
    try {
      const res = await api.schedules.runOverdue()
      notifications.show({
        title: `${res.triggered} review${res.triggered !== 1 ? 's' : ''} completed`,
        message: res.errors.length > 0 ? `Errors: ${res.errors.join(', ')}` : 'All scheduled reviews ran successfully.',
        color: res.errors.length > 0 ? 'orange' : 'green',
      })
      load()
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setRunning(false)
    }
  }

  const createSchedule = async () => {
    if (!newShort) return
    const agent = SCHED_AGENTS.find(a => a.id === newAgent)!
    setSaving(true)
    try {
      await api.schedules.create({
        shortname:     newShort,
        agent_id:      agent.id,
        agent_label:   agent.label,
        agent_color:   agent.color,
        agent_context: agent.context,
        model_id:      newModel,
        frequency:     newFreq,
      })
      notifications.show({ title: 'Schedule created', message: `${newShort} will be reviewed ${newFreq}`, color: 'green' })
      setShowForm(false)
      load()
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  const removeSchedule = async (id: number) => {
    setDeleting(id)
    try {
      await api.schedules.delete(id)
      setSchedules(prev => prev.filter(s => s.id !== id))
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setDeleting(null)
    }
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="sm">
          <ThemeIcon size="sm" color="violet" variant="light">
            <IconCalendarEvent size={12} />
          </ThemeIcon>
          <Title order={5}>Scheduled Reviews</Title>
          {overdueCount > 0 && (
            <Badge size="xs" color="orange">{overdueCount} overdue</Badge>
          )}
        </Group>
        <Group gap="xs">
          {overdueCount > 0 && (
            <Button
              size="xs" color="orange" variant="light"
              leftSection={running ? <Loader size="xs" /> : <IconPlayerPlay size={14} />}
              onClick={runOverdue}
              disabled={running}
            >
              Run {overdueCount} overdue
            </Button>
          )}
          <Button
            size="xs" variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowForm(f => !f)}
          >
            {showForm ? 'Cancel' : 'Add Schedule'}
          </Button>
        </Group>
      </Group>

      {/* Add schedule form */}
      <Collapse in={showForm}>
        <Paper withBorder p="sm" radius="sm" mb="sm" bg="var(--mantine-color-gray-0)">
          <Stack gap="sm">
            <Group grow gap="sm">
              <Select
                label="Course"
                placeholder="Select a course"
                data={courses}
                value={newShort}
                onChange={setNewShort}
                searchable
                size="xs"
              />
              <Select
                label="Agent"
                data={SCHED_AGENTS.map(a => ({ value: a.id, label: a.label }))}
                value={newAgent}
                onChange={v => setNewAgent(v ?? SCHED_AGENTS[0].id)}
                size="xs"
              />
            </Group>
            <Group grow gap="sm">
              <Select
                label="Frequency"
                data={[
                  { value: 'daily',   label: 'Daily' },
                  { value: 'weekly',  label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                ]}
                value={newFreq}
                onChange={v => setNewFreq(v ?? 'weekly')}
                size="xs"
              />
              <TextInput
                label="Model ID"
                placeholder="e.g. local-model or gpt-4o"
                value={newModel}
                onChange={e => setNewModel(e.currentTarget.value)}
                size="xs"
              />
            </Group>
            <Group justify="flex-end">
              <Button
                size="xs"
                leftSection={saving ? <Loader size="xs" /> : <IconCheck size={14} />}
                onClick={createSchedule}
                disabled={!newShort || saving}
              >
                Save Schedule
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Collapse>

      {/* Schedule list */}
      {loading && <Loader size="sm" />}
      {!loading && schedules.length === 0 && (
        <Text size="xs" c="dimmed" ta="center" py="md">
          No schedules yet — add one to auto-review courses periodically.
        </Text>
      )}
      {schedules.map(s => {
        const isOverdue = s.enabled === 1 && new Date(s.next_run_at + 'Z') <= new Date()
        return (
          <Paper key={s.id} withBorder p="sm" radius="sm" mb="xs"
                 style={{ borderColor: isOverdue ? 'var(--mantine-color-orange-4)' : undefined }}>
            <Group justify="space-between" wrap="nowrap">
              <Box>
                <Group gap={6} mb={2}>
                  <Text size="sm" fw={600}>{s.shortname}</Text>
                  <Badge size="xs" color={SCHED_AGENTS.find(a => a.id === s.agent_id)?.color || 'gray'}>
                    {s.agent_label}
                  </Badge>
                  <Badge size="xs" variant="outline">{s.frequency}</Badge>
                  {isOverdue && <Badge size="xs" color="orange">overdue</Badge>}
                </Group>
                <Group gap={8}>
                  <Group gap={4}>
                    <IconClock size={11} />
                    <Text size="xs" c="dimmed">Next: {fmtDate(s.next_run_at)}</Text>
                  </Group>
                  {s.last_run_at && (
                    <Text size="xs" c="dimmed">Last: {fmtDate(s.last_run_at)}</Text>
                  )}
                </Group>
              </Box>
              <Tooltip label="Delete schedule" withArrow>
                <ActionIcon
                  size="sm" color="red" variant="subtle"
                  loading={deleting === s.id}
                  onClick={() => removeSchedule(s.id)}
                >
                  <IconTrash size={13} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Paper>
        )
      })}
    </Paper>
  )
}

// ── Settings page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [loading, setLoading]       = useState(true)
  const [testing, setTesting]       = useState(false)
  const [savingInst, setSavingInst] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [instances, setInstances]   = useState<MoodleInstance[]>([])
  const [pingResult, setPing]       = useState<{
    ok: boolean; msg: string; siteName?: string
  } | null>(null)
  const [stats, setStats]           = useState<MoodleStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const [llmProvider, setLlmProvider]   = useState<string>('local')
  const [llmApiKey,   setLlmApiKey]     = useState('')
  const [llmKeyMask,  setLlmKeyMask]    = useState('')
  const [savingLlm,   setSavingLlm]     = useState(false)
  const [lastModel,   setLastModel]     = useState('')

  const form = useForm({
    initialValues: { moodle_url: '', moodle_token: '', llm_url: '' },
  })

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const s = await api.moodle.stats()
      setStats(s)
    } catch {
      setStats(null)
    } finally {
      setLoadingStats(false)
    }
  }

  const loadAll = async () => {
    const [s, insts] = await Promise.all([
      api.settings.get(),
      api.settings.listInstances().catch(() => [] as MoodleInstance[]),
    ])
    form.setValues({ moodle_url: s.moodle_url, moodle_token: '', llm_url: s.llm_url })
    setLlmKeyMask(s.llm_api_key_masked || '')
    setLastModel(s.last_model || '')
    // Detect provider from saved URL
    const savedUrl = s.llm_url || ''
    const matched = LLM_PROVIDERS.find(p => p.id !== 'local' && p.id !== 'custom' && p.url && savedUrl.startsWith(p.url))
    if (matched) setLlmProvider(matched.id)
    else if (!savedUrl || savedUrl.includes('192.168') || savedUrl.includes('localhost') || savedUrl.includes('127.0')) setLlmProvider('local')
    else setLlmProvider('custom')
    setInstances(insts)
    setLoading(false)
    if (s.active_instance || s.moodle_url) loadStats()
  }

  useEffect(() => { loadAll() }, [])

  // ── Test current form values ────────────────────────────────────────────────
  const testMoodle = async () => {
    setTesting(true)
    setPing(null)
    try {
      await api.settings.save({
        moodle_url:   form.values.moodle_url,
        moodle_token: form.values.moodle_token || undefined,
        llm_url:      form.values.llm_url,
      } as any)
      const res = await api.moodle.ping()
      setPing({
        ok: true,
        msg: `Connected as ${res.fullname} · ${res.moodle_version}`,
        siteName: res.site_name,
      })
      loadStats()
    } catch (e: any) {
      setPing({ ok: false, msg: e.message })
    } finally {
      setTesting(false)
    }
  }

  // ── Save as named instance (after successful ping) ──────────────────────────
  const saveAsInstance = async () => {
    if (!pingResult?.siteName) return
    setSavingInst(true)
    try {
      await api.settings.saveInstance({
        name:  pingResult.siteName,
        url:   form.values.moodle_url,
        token: form.values.moodle_token,
      })
      notifications.show({
        title: 'Instance saved',
        message: `"${pingResult.siteName}" added to your connections`,
        color: 'green',
        icon: <IconCheck />,
      })
      const insts = await api.settings.listInstances()
      setInstances(insts)
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setSavingInst(false)
    }
  }

  // ── Activate a saved instance ───────────────────────────────────────────────
  const activateInstance = async (name: string) => {
    setActivating(name)
    try {
      await api.settings.activateInstance(name)
      const [s, insts] = await Promise.all([
        api.settings.get(),
        api.settings.listInstances(),
      ])
      form.setValues({ moodle_url: s.moodle_url, moodle_token: '', llm_url: form.values.llm_url })
      setInstances(insts)
      setPing(null)
      notifications.show({ title: 'Activated', message: `Now connected to "${name}"`, color: 'blue' })
      loadStats()
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setActivating(null)
    }
  }

  // ── Delete a saved instance ─────────────────────────────────────────────────
  const deleteInstance = async (name: string) => {
    setDeleting(name)
    try {
      await api.settings.deleteInstance(name)
      setInstances(prev => prev.filter(i => i.name !== name))
      const remaining = instances.filter(i => i.name !== name)
      if (!remaining.some(i => i.active)) setStats(null)
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setDeleting(null)
    }
  }

  // ── Save LLM settings ───────────────────────────────────────────────────────
  const saveLlm = async () => {
    setSavingLlm(true)
    try {
      await api.settings.saveLlm(form.values.llm_url, llmApiKey)
      if (llmApiKey) setLlmKeyMask('••••' + llmApiKey.slice(-4))
      setLlmApiKey('')
      notifications.show({ title: 'Saved', message: 'LLM settings updated.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setSavingLlm(false)
    }
  }

  const selectProvider = (id: string) => {
    setLlmProvider(id)
    const p = LLM_PROVIDERS.find(p => p.id === id)
    if (p && p.url) form.setFieldValue('llm_url', p.url)
    else if (id === 'local') form.setFieldValue('llm_url', 'http://192.168.86.41:1234/v1')
  }

  if (loading) return <Loader />

  return (
    <Group align="flex-start" gap="md" wrap="nowrap">
      <Stack w={480} gap="sm" style={{ flexShrink: 0 }}>
        <Title order={3}>Settings</Title>

        {/* ── Saved Moodle Instances ─────────────────────────────────────── */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="sm">
            <Title order={5}>Moodle Instances</Title>
            {instances.length === 0 && (
              <Text size="xs" c="dimmed">No saved connections yet</Text>
            )}
          </Group>

          {instances.length > 0 && (
            <Stack gap="xs">
              {instances.map(inst => (
                <Paper
                  key={inst.name}
                  withBorder p="sm" radius="sm"
                  style={{
                    background: inst.active ? 'var(--mantine-color-blue-0)' : undefined,
                    borderColor: inst.active ? 'var(--mantine-color-blue-4)' : undefined,
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon size="sm" color={inst.active ? 'blue' : 'gray'} variant="light">
                        <IconCloud size={12} />
                      </ThemeIcon>
                      <div>
                        <Group gap={6}>
                          <Text size="sm" fw={600}>{inst.name}</Text>
                          {inst.active && <Badge size="xs" color="blue">active</Badge>}
                        </Group>
                        <Text size="xs" c="dimmed">{inst.url}</Text>
                        <Text size="xs" c="dimmed">{inst.token_masked}</Text>
                      </div>
                    </Group>
                    <Group gap={4} wrap="nowrap">
                      {inst.active && (
                        <Tooltip label="Refresh metrics">
                          <ActionIcon
                            size="sm" variant="light" color="blue"
                            loading={loadingStats}
                            onClick={loadStats}
                          >
                            <IconRefresh size={12} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {!inst.active && (
                        <Tooltip label="Use this connection">
                          <ActionIcon
                            size="sm" variant="light" color="blue"
                            loading={activating === inst.name}
                            onClick={() => activateInstance(inst.name)}
                          >
                            <IconPlayerPlay size={12} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      <Tooltip label="Remove">
                        <ActionIcon
                          size="sm" variant="subtle" color="red"
                          loading={deleting === inst.name}
                          onClick={() => deleteInstance(inst.name)}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        {/* ── Add / Test Connection ──────────────────────────────────────── */}
        <Paper withBorder p="md" radius="md">
          <Title order={5} mb="sm">
            {instances.length === 0 ? 'Moodle Connection' : 'Add / Update Connection'}
          </Title>
          <Stack gap="sm">
            <TextInput
              label="Moodle URL"
              placeholder="https://your-moodle.example.com"
              {...form.getInputProps('moodle_url')}
            />
            <PasswordInput
              label="Web Service Token"
              description="Site admin → Plugins → Web services → Manage tokens"
              placeholder="Leave blank to keep existing token"
              {...form.getInputProps('moodle_token')}
            />
            <Group>
              <Button
                variant="light"
                leftSection={testing ? <Loader size="xs" /> : <IconWifi size={16} />}
                onClick={testMoodle}
                disabled={testing}
              >
                Test Connection
              </Button>
            </Group>

            {pingResult && (
              <Alert
                color={pingResult.ok ? 'green' : 'red'}
                icon={pingResult.ok ? <IconCheck /> : <IconX />}
              >
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    {pingResult.siteName && (
                      <Text size="sm" fw={600}>{pingResult.siteName}</Text>
                    )}
                    <Text size="sm">{pingResult.msg}</Text>
                  </div>
                  {pingResult.ok && pingResult.siteName && (
                    <Button
                      size="xs" variant="light" color="green"
                      loading={savingInst}
                      leftSection={<IconPlus size={12} />}
                      onClick={saveAsInstance}
                    >
                      Save connection
                    </Button>
                  )}
                </Group>
              </Alert>
            )}
          </Stack>
        </Paper>

        {/* ── LLM Provider ──────────────────────────────────────────────── */}
        <Paper withBorder p="md" radius="md">
          <Title order={5} mb="xs">LLM Provider</Title>
          <Text size="xs" c="dimmed" mb="sm">
            Select a provider or use your local LLM server.
          </Text>

          {/* Provider preset buttons */}
          <Group gap="xs" mb="sm" wrap="wrap">
            {LLM_PROVIDERS.map(p => (
              <Button
                key={p.id}
                size="xs"
                variant={llmProvider === p.id ? 'filled' : 'light'}
                color={p.color}
                leftSection={p.icon}
                onClick={() => selectProvider(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </Group>

          <Stack gap="sm">
            <TextInput
              label="API Endpoint URL"
              placeholder="http://192.168.86.41:1234/v1"
              {...form.getInputProps('llm_url')}
            />

            {llmProvider !== 'local' && (
              <PasswordInput
                label="API Key"
                placeholder={llmKeyMask || 'Enter API key…'}
                description={
                  llmProvider === 'openrouter'
                    ? 'Get a free key at openrouter.ai — supports Claude, GPT, Gemini & more'
                    : llmProvider === 'openai'
                    ? 'platform.openai.com → API keys'
                    : llmProvider === 'anthropic'
                    ? 'console.anthropic.com → API keys'
                    : 'Your provider API key'
                }
                value={llmApiKey}
                onChange={e => setLlmApiKey(e.currentTarget.value)}
                rightSection={
                  llmKeyMask ? (
                    <Tooltip label="Key saved">
                      <ThemeIcon size="xs" color="green" variant="subtle">
                        <IconCheck size={10} />
                      </ThemeIcon>
                    </Tooltip>
                  ) : null
                }
              />
            )}

            {/* Suggested models for selected provider */}
            {PROVIDER_MODELS[llmProvider] && (
              <Box>
                <Text size="xs" c="dimmed" mb={4}>Suggested model IDs for this provider:</Text>
                <Group gap={4} wrap="wrap">
                  {PROVIDER_MODELS[llmProvider].map(m => (
                    <Badge key={m} size="xs" variant="outline" color="gray"
                           style={{ cursor: 'default', fontFamily: 'monospace' }}>
                      {m}
                    </Badge>
                  ))}
                </Group>
              </Box>
            )}

            {llmProvider === 'openrouter' && (
              <Alert color="violet" py="xs" icon={<IconExternalLink size={14} />}>
                <Text size="xs">
                  OpenRouter gives one key access to Claude, GPT-4o, Gemini, Llama and 100+ models.
                  Free tier available.
                </Text>
              </Alert>
            )}

            <Group>
              <Button
                variant="light"
                leftSection={savingLlm ? <Loader size="xs" /> : <IconCheck size={16} />}
                onClick={saveLlm}
                disabled={savingLlm}
              >
                Save LLM Settings
              </Button>
            </Group>
          </Stack>
        </Paper>

        <ScheduledReviewsSection defaultModel={lastModel} />

        <SecuritySection />
      </Stack>

      {/* ── Site Overview (right column, fills remaining width) ───────── */}
      {(loadingStats || stats) && (
        <Box style={{ flex: 1, minWidth: 0 }}>
          <SiteOverview stats={stats} loading={loadingStats} />
        </Box>
      )}
    </Group>
  )
}


// ── Security Section ──────────────────────────────────────────────────────────

function SecuritySection() {
  const [enabled, setEnabled]         = useState(false)
  const [loading, setLoading]         = useState(true)
  const [newToken, setNewToken]       = useState<string | null>(null)
  const [busy, setBusy]               = useState(false)
  const [customToken, setCustomToken] = useState('')
  const [showCustom, setShowCustom]   = useState(false)

  useEffect(() => {
    api.auth.status()
      .then(s => setEnabled(s.enabled))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const generate = async () => {
    setBusy(true)
    try {
      const r = await api.auth.generate()
      setNewToken(r.token)
      tokenStore.set(r.token)
      setEnabled(true)
      notifications.show({ color: 'green', message: 'New token generated and saved' })
    } catch (e: unknown) {
      notifications.show({ color: 'red', message: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const saveCustom = async () => {
    if (!customToken.trim()) return
    setBusy(true)
    try {
      await api.auth.setToken(customToken.trim())
      tokenStore.set(customToken.trim())
      setEnabled(true)
      setShowCustom(false)
      setCustomToken('')
      notifications.show({ color: 'green', message: 'Token saved' })
    } catch (e: unknown) {
      notifications.show({ color: 'red', message: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const disableAuth = async () => {
    setBusy(true)
    try {
      await api.auth.clear()
      tokenStore.clear()
      setEnabled(false)
      setNewToken(null)
      notifications.show({ color: 'yellow', message: 'Authentication disabled' })
    } catch (e: unknown) {
      notifications.show({ color: 'red', message: String(e) })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader size="xs" />

  return (
    <Paper withBorder p="md" radius="md">
      <Group mb="sm" gap="xs">
        {enabled ? <IconLock size={16} color="var(--mantine-color-green-6)" /> : <IconLockOpen size={16} color="var(--mantine-color-gray-5)" />}
        <Title order={5}>Security</Title>
        <Badge color={enabled ? 'green' : 'gray'} variant="light" size="sm">
          {enabled ? 'Auth enabled' : 'No auth'}
        </Badge>
      </Group>

      <Text size="xs" c="dimmed" mb="md">
        When a token is set, every API request must include it as a Bearer token.
        The app will prompt for the token on first load. Leave disabled for local-only use.
      </Text>

      <Stack gap="sm">
        {newToken && (
          <Alert color="green" icon={<IconCheck size={14} />} title="New token — copy it now">
            <Code block style={{ wordBreak: 'break-all', fontSize: 12 }}>{newToken}</Code>
            <CopyButton value={newToken}>
              {({ copied, copy }) => (
                <Button
                  mt="xs" size="xs" leftSection={<IconCopy size={12} />}
                  color={copied ? 'teal' : 'green'} variant="light"
                  onClick={copy}
                >
                  {copied ? 'Copied!' : 'Copy token'}
                </Button>
              )}
            </CopyButton>
          </Alert>
        )}

        <Group>
          <Button
            size="xs" leftSection={busy ? <Loader size="xs" /> : <IconRefresh size={14} />}
            onClick={generate} loading={busy} variant="filled" color="blue"
          >
            {enabled ? 'Rotate token' : 'Enable auth (generate token)'}
          </Button>

          <Button
            size="xs" variant="light" color="gray"
            leftSection={<IconApi size={14} />}
            onClick={() => setShowCustom(v => !v)}
          >
            Set custom token
          </Button>

          {enabled && (
            <Button
              size="xs" variant="subtle" color="red"
              leftSection={<IconLockOpen size={14} />}
              onClick={disableAuth} loading={busy}
            >
              Disable auth
            </Button>
          )}
        </Group>

        {showCustom && (
          <Group align="flex-end">
            <PasswordInput
              style={{ flex: 1 }}
              label="Custom token"
              placeholder="Paste your token"
              value={customToken}
              onChange={e => setCustomToken(e.currentTarget.value)}
            />
            <Button size="sm" onClick={saveCustom} loading={busy} disabled={!customToken.trim()}>
              Save
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  )
}
