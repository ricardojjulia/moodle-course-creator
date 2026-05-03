import { useEffect, useState } from 'react'
import {
  Stack, TextInput, PasswordInput, Button, Group,
  Title, Text, Alert, Badge, Divider, Paper, Loader,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconX, IconWifi } from '@tabler/icons-react'
import { api, type AppSettings } from '../api/client'

export default function SettingsPage() {
  const [loading, setLoading]   = useState(true)
  const [testing, setTesting]   = useState(false)
  const [pingResult, setPing]   = useState<{ ok: boolean; msg: string } | null>(null)

  const form = useForm({
    initialValues: {
      moodle_url:   '',
      moodle_token: '',
      llm_url:      '',
    },
  })

  useEffect(() => {
    api.settings.get().then(s => {
      form.setValues({
        moodle_url:   s.moodle_url,
        moodle_token: '',   // never pre-fill token for security
        llm_url:      s.llm_url,
      })
      setLoading(false)
    })
  }, [])

  const save = form.onSubmit(async values => {
    try {
      await api.settings.save(values)
      notifications.show({ title: 'Saved', message: 'Settings updated.', color: 'green', icon: <IconCheck /> })
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red', icon: <IconX /> })
    }
  })

  const testMoodle = async () => {
    setTesting(true)
    setPing(null)
    try {
      const res = await api.moodle.ping()
      setPing({ ok: true, msg: `Connected as ${res.fullname} · ${res.site_name} · ${res.moodle_version}` })
    } catch (e: any) {
      setPing({ ok: false, msg: e.message })
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <Loader />

  return (
    <Stack maw={560}>
      <Title order={3}>Settings</Title>

      <form onSubmit={save}>
        <Stack gap="md">
          <Paper withBorder p="md" radius="md">
            <Title order={5} mb="sm">Moodle Connection</Title>
            <TextInput
              label="Moodle URL"
              placeholder="https://biblos.moodlecloud.com"
              {...form.getInputProps('moodle_url')}
              mb="sm"
            />
            <PasswordInput
              label="Web Service Token"
              description="Site admin → Plugins → Web services → Manage tokens"
              placeholder="Leave blank to keep existing token"
              {...form.getInputProps('moodle_token')}
              mb="sm"
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
                mt="sm"
                color={pingResult.ok ? 'green' : 'red'}
                icon={pingResult.ok ? <IconCheck /> : <IconX />}
              >
                {pingResult.msg}
              </Alert>
            )}
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Title order={5} mb="sm">LLM Server</Title>
            <TextInput
              label="LM Studio URL"
              placeholder="http://192.168.86.41:1234/v1"
              {...form.getInputProps('llm_url')}
            />
          </Paper>

          <Button type="submit" leftSection={<IconCheck size={16} />}>
            Save Settings
          </Button>
        </Stack>
      </form>
    </Stack>
  )
}
