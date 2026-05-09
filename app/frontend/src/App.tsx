import { useState, useCallback, useEffect } from 'react'
import {
  AppShell, Tabs, Title, Group, Text, Loader, Badge, Box,
  Modal, PasswordInput, Button, Stack, Alert, TextInput, Stepper, Anchor,
} from '@mantine/core'
import {
  IconBooks, IconWand, IconCloud, IconSettings, IconShieldCheck, IconMap2, IconLock,
  IconCheck, IconPlugConnected, IconRocket,
} from '@tabler/icons-react'
import LibraryPage          from './pages/Library'
import NewCoursePage        from './pages/NewCourse'
import MoodlePage           from './pages/MoodleCourses'
import SettingsPage         from './pages/Settings'
import AutonomousReviewPage from './pages/AutonomousReview'
import CurriculumPage       from './pages/Curriculum'
import { api, tokenStore }  from './api/client'

type Tab = 'library' | 'new' | 'moodle' | 'curriculum' | 'review' | 'settings'

export default function App() {
  const [tab, setTab]               = useState<Tab>('library')
  const [generating, setGenerating] = useState(false)
  const [genLabel, setGenLabel]     = useState<string>('')
  const [loginOpen, setLoginOpen]   = useState(false)
  const [loginToken, setLoginToken] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginBusy, setLoginBusy]   = useState(false)

  // First-run wizard
  const [wizardOpen,  setWizardOpen]  = useState(false)
  const [wizardStep,  setWizardStep]  = useState(0)
  const [wizardUrl,   setWizardUrl]   = useState('')
  const [wizardTesting, setWizardTesting] = useState(false)
  const [wizardError, setWizardError]   = useState('')
  const [wizardOk,    setWizardOk]    = useState(false)

  // On mount: check if auth is enabled and our stored token is valid
  useEffect(() => {
    api.auth.status().then(({ enabled }) => {
      if (!enabled) return
      const stored = tokenStore.get()
      if (!stored) { setLoginOpen(true); return }
      api.auth.verify().catch(() => {
        tokenStore.clear()
        setLoginOpen(true)
      })
    }).catch(() => {})
  }, [])

  // On mount: show wizard if no LLM URL is configured
  useEffect(() => {
    api.settings.get().then(s => {
      if (!s.llm_url) setWizardOpen(true)
    }).catch(() => {})
  }, [])

  const wizardTestConnection = async () => {
    if (!wizardUrl.trim()) { setWizardError('Please enter a URL first.'); return }
    setWizardTesting(true)
    setWizardError('')
    setWizardOk(false)
    try {
      await api.settings.save({ llm_url: wizardUrl.trim() } as never)
      await api.llm.models(wizardUrl.trim())
      setWizardOk(true)
      setWizardError('')
    } catch {
      setWizardError('Could not reach that URL. Make sure your LLM server is running.')
      setWizardOk(false)
    } finally {
      setWizardTesting(false)
    }
  }

  // Intercept 401s from any tab and prompt re-login
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      if ((e.reason as { status?: number })?.status === 401) {
        tokenStore.clear()
        setLoginOpen(true)
        e.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  const handleLogin = async () => {
    setLoginBusy(true)
    setLoginError('')
    tokenStore.set(loginToken.trim())
    try {
      await api.auth.verify()
      setLoginOpen(false)
      setLoginToken('')
    } catch {
      tokenStore.clear()
      setLoginError('Invalid token. Please check the token in Settings → Security.')
    } finally {
      setLoginBusy(false)
    }
  }

  const handleGeneratingChange = useCallback((v: boolean, label?: string) => {
    setGenerating(v)
    if (label) setGenLabel(label)
    else if (!v) setGenLabel('')
  }, [])

  const handleCreated = useCallback(() => setTab('library'), [])

  return (
    <AppShell header={{ height: 56 }} padding="md">
      {/* ── First-run wizard ────────────────────────────────────────────────── */}
      <Modal
        opened={wizardOpen && !loginOpen}
        onClose={() => setWizardOpen(false)}
        title={<Group gap="xs"><IconRocket size={18} /><Text fw={600}>Welcome to Moodle Course Creator</Text></Group>}
        size="md"
        centered
      >
        <Stepper active={wizardStep} onStepClick={setWizardStep} size="sm" mb="md">
          <Stepper.Step label="Connect LLM" description="Point to your LLM server" icon={<IconPlugConnected size={16} />} />
          <Stepper.Step label="Ready" description="Generate your first course" icon={<IconCheck size={16} />} />
        </Stepper>

        {wizardStep === 0 && (
          <Stack gap="sm">
            <Text size="sm">Enter the base URL of your LLM server. Works with LM Studio, Ollama, OpenAI, or any OpenAI-compatible endpoint.</Text>
            <TextInput
              label="LLM API Endpoint"
              placeholder="http://localhost:1234/v1"
              value={wizardUrl}
              onChange={e => { setWizardUrl(e.currentTarget.value); setWizardOk(false) }}
              onKeyDown={e => e.key === 'Enter' && wizardTestConnection()}
            />
            <Text size="xs" c="dimmed">
              LM Studio default: <code>http://localhost:1234/v1</code>
              &nbsp;·&nbsp;
              Ollama default: <code>http://localhost:11434/v1</code>
            </Text>
            {wizardError && <Alert color="red">{wizardError}</Alert>}
            {wizardOk && <Alert color="green" icon={<IconCheck size={14} />}>Connected! Models detected.</Alert>}
            <Group>
              <Button
                variant="light" loading={wizardTesting}
                leftSection={<IconPlugConnected size={14} />}
                onClick={wizardTestConnection}
              >
                Test Connection
              </Button>
              <Button
                disabled={!wizardOk}
                rightSection={<IconCheck size={14} />}
                onClick={() => setWizardStep(1)}
              >
                Next
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              Using a cloud provider?{' '}
              <Anchor size="xs" onClick={() => { setWizardOpen(false); }} href="#settings">
                Set up in Settings instead.
              </Anchor>
            </Text>
          </Stack>
        )}

        {wizardStep === 1 && (
          <Stack gap="sm">
            <Alert color="green" icon={<IconCheck size={14} />} title="You're all set!">
              Your LLM is connected. Head to Course Studio to generate your first course.
            </Alert>
            <Text size="sm" c="dimmed">
              Tip: give the model a rich prompt — include the subject, audience, theological tradition, key themes, and expected learning outcomes.
            </Text>
            <Group>
              <Button
                onClick={() => { setWizardOpen(false); setTab('new') }}
                leftSection={<IconWand size={14} />}
              >
                Open Course Studio
              </Button>
              <Button variant="subtle" onClick={() => setWizardOpen(false)}>
                Dismiss
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={loginOpen}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        title={<Group gap="xs"><IconLock size={18} /><Text fw={600}>Authentication Required</Text></Group>}
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">Enter the access token configured in Settings → Security.</Text>
          {loginError && <Alert color="red">{loginError}</Alert>}
          <PasswordInput
            placeholder="Paste token here"
            value={loginToken}
            onChange={e => setLoginToken(e.currentTarget.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
          <Button onClick={handleLogin} loading={loginBusy} disabled={!loginToken.trim()}>
            Sign In
          </Button>
        </Stack>
      </Modal>

      <AppShell.Header px="md" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Group gap="xs">
          <IconBooks size={24} color="#1c7ed6" />
          <div>
            <Title order={5} style={{ lineHeight: 1 }}>Moodle Course Administrator</Title>
            <Text size="xs" c="dimmed" style={{ lineHeight: 1 }}>Course Authoring Studio</Text>
          </div>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Tabs value={tab} onChange={v => setTab(v as Tab)} mb="md">
          <Tabs.List>
            <Tabs.Tab value="library"  leftSection={<IconBooks size={16} />}>
              Library
            </Tabs.Tab>
            <Tabs.Tab value="new" leftSection={generating ? <Loader size={14} /> : <IconWand size={16} />}>
              <Group gap={6} wrap="nowrap">
                Course Studio
                {generating && (
                  <Badge size="xs" color="blue" variant="filled">
                    {genLabel || 'generating…'}
                  </Badge>
                )}
              </Group>
            </Tabs.Tab>
            <Tabs.Tab value="moodle"     leftSection={<IconCloud size={16} />}>
              Instance Course Catalog
            </Tabs.Tab>
            <Tabs.Tab value="curriculum" leftSection={<IconMap2 size={16} />}>
              Curriculum Map
            </Tabs.Tab>
            <Tabs.Tab value="review"     leftSection={<IconShieldCheck size={16} />}>
              Autonomous Review
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              Settings
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {tab === 'library'  && <LibraryPage />}

        {/* Always mounted so generation survives tab switches */}
        <Box display={tab === 'new' ? 'block' : 'none'}>
          <NewCoursePage
            onCreated={handleCreated}
            onGeneratingChange={handleGeneratingChange}
          />
        </Box>

        {tab === 'moodle'      && <MoodlePage />}
        {tab === 'curriculum'  && <CurriculumPage />}
        {tab === 'review'      && <AutonomousReviewPage />}
        {tab === 'settings'    && <SettingsPage />}
      </AppShell.Main>
    </AppShell>
  )
}
