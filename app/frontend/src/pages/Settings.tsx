import { useEffect, useState } from 'react'
import {
  Stack, TextInput, PasswordInput, Button, Group,
  Title, Text, Alert, Badge, Divider, Paper, Loader,
  ActionIcon, Tooltip, ThemeIcon,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconCheck, IconX, IconWifi, IconCloud, IconTrash,
  IconPlayerPlay, IconPlus,
} from '@tabler/icons-react'
import { api, type AppSettings, type MoodleInstance } from '../api/client'

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

  const form = useForm({
    initialValues: { moodle_url: '', moodle_token: '', llm_url: '' },
  })

  const loadAll = async () => {
    const [s, insts] = await Promise.all([
      api.settings.get(),
      api.settings.listInstances().catch(() => [] as MoodleInstance[]),
    ])
    form.setValues({ moodle_url: s.moodle_url, moodle_token: '', llm_url: s.llm_url })
    setInstances(insts)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // ── Test current form values ────────────────────────────────────────────────
  const testMoodle = async () => {
    setTesting(true)
    setPing(null)
    // Save URL/token first so the ping uses the form values
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
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setDeleting(null)
    }
  }

  // ── Save LLM URL ────────────────────────────────────────────────────────────
  const saveLlm = async () => {
    try {
      await api.settings.save({ llm_url: form.values.llm_url } as any)
      notifications.show({ title: 'Saved', message: 'LLM server URL updated.', color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    }
  }

  if (loading) return <Loader />

  return (
    <Stack maw={580}>
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
                withBorder
                p="sm"
                radius="sm"
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
                    {!inst.active && (
                      <Tooltip label="Use this connection">
                        <ActionIcon
                          size="sm"
                          variant="light"
                          color="blue"
                          loading={activating === inst.name}
                          onClick={() => activateInstance(inst.name)}
                        >
                          <IconPlayerPlay size={12} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <Tooltip label="Remove">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
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
            placeholder="https://biblos.moodlecloud.com"
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
                    size="xs"
                    variant="light"
                    color="green"
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

      {/* ── LLM Server ────────────────────────────────────────────────── */}
      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="sm">LLM Server</Title>
        <Stack gap="sm">
          <TextInput
            label="Server URL"
            placeholder="http://192.168.86.41:1234/v1"
            {...form.getInputProps('llm_url')}
          />
          <Group>
            <Button
              variant="light"
              leftSection={<IconCheck size={16} />}
              onClick={saveLlm}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  )
}
