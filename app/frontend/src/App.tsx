import { useState, useCallback, useEffect } from 'react'
import {
  AppShell, Tabs, Title, Group, Text, Loader, Badge, Box,
  Modal, PasswordInput, Button, Stack, Alert, TextInput, Stepper, Anchor,
  SegmentedControl,
} from '@mantine/core'
import {
  IconBooks, IconWand, IconCloud, IconSettings, IconShieldCheck, IconMap2, IconLock,
  IconCheck, IconPlugConnected, IconRocket,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import i18n from './i18n/config'
import LibraryPage          from './pages/Library'
import NewCoursePage        from './pages/NewCourse'
import MoodlePage           from './pages/MoodleCourses'
import CanvasPage           from './pages/CanvasCourses'
import SettingsPage         from './pages/Settings'
import AutonomousReviewPage from './pages/AutonomousReview'
import CurriculumPage       from './pages/Curriculum'
import { api, tokenStore }  from './api/client'

type Tab = 'library' | 'new' | 'moodle' | 'canvas' | 'curriculum' | 'review' | 'settings'

export default function App() {
  const { t } = useTranslation()
  const [tab, setTab]               = useState<Tab>('library')
  const [generating, setGenerating] = useState(false)
  const [genLabel, setGenLabel]     = useState<string>('')
  const [jumpCourse, setJumpCourse] = useState<string | null>(null)
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
    if (!wizardUrl.trim()) { setWizardError(t('app.wizard_url_required')); return }
    setWizardTesting(true)
    setWizardError('')
    setWizardOk(false)
    try {
      await api.settings.save({ llm_url: wizardUrl.trim() } as never)
      await api.llm.models(wizardUrl.trim())
      setWizardOk(true)
      setWizardError('')
    } catch {
      setWizardError(t('app.wizard_url_error'))
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
      setLoginError(t('app.auth_invalid'))
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
        title={<Group gap="xs"><IconRocket size={18} /><Text fw={600}>{t('app.wizard_title')}</Text></Group>}
        size="md"
        centered
      >
        <Stepper active={wizardStep} onStepClick={setWizardStep} size="sm" mb="md">
          <Stepper.Step label={t('app.wizard_step_connect')} description={t('app.wizard_step_connect_desc')} icon={<IconPlugConnected size={16} />} />
          <Stepper.Step label={t('app.wizard_step_ready')} description={t('app.wizard_step_ready_desc')} icon={<IconCheck size={16} />} />
        </Stepper>

        {wizardStep === 0 && (
          <Stack gap="sm">
            <Text size="sm">{t('app.wizard_enter_url')}</Text>
            <TextInput
              label={t('app.wizard_llm_endpoint')}
              placeholder="http://localhost:1234/v1"
              value={wizardUrl}
              onChange={e => { setWizardUrl(e.currentTarget.value); setWizardOk(false) }}
              onKeyDown={e => e.key === 'Enter' && wizardTestConnection()}
            />
            <Text size="xs" c="dimmed">
              {t('app.wizard_lm_studio')} <code>http://localhost:1234/v1</code>
              &nbsp;·&nbsp;
              {t('app.wizard_ollama')} <code>http://localhost:11434/v1</code>
            </Text>
            {wizardError && <Alert color="red">{wizardError}</Alert>}
            {wizardOk && <Alert color="green" icon={<IconCheck size={14} />}>{t('app.wizard_connected')}</Alert>}
            <Group>
              <Button
                variant="light" loading={wizardTesting}
                leftSection={<IconPlugConnected size={14} />}
                onClick={wizardTestConnection}
              >
                {t('common.test_conn')}
              </Button>
              <Button
                disabled={!wizardOk}
                rightSection={<IconCheck size={14} />}
                onClick={() => setWizardStep(1)}
              >
                {t('common.next')}
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              {t('app.wizard_cloud_provider')}{' '}
              <Anchor size="xs" onClick={() => { setWizardOpen(false); }} href="#settings">
                {t('app.wizard_cloud_settings')}
              </Anchor>
            </Text>
          </Stack>
        )}

        {wizardStep === 1 && (
          <Stack gap="sm">
            <Alert color="green" icon={<IconCheck size={14} />} title={t('app.wizard_all_set_title')}>
              {t('app.wizard_all_set_desc')}
            </Alert>
            <Text size="sm" c="dimmed">
              {t('app.wizard_tip')}
            </Text>
            <Group>
              <Button
                onClick={() => { setWizardOpen(false); setTab('new') }}
                leftSection={<IconWand size={14} />}
              >
                {t('app.wizard_open_studio')}
              </Button>
              <Button variant="subtle" onClick={() => setWizardOpen(false)}>
                {t('common.dismiss')}
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
        title={<Group gap="xs"><IconLock size={18} /><Text fw={600}>{t('app.auth_required')}</Text></Group>}
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">{t('app.auth_enter_token')}</Text>
          {loginError && <Alert color="red">{loginError}</Alert>}
          <PasswordInput
            placeholder={t('app.auth_placeholder')}
            value={loginToken}
            onChange={e => setLoginToken(e.currentTarget.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
          <Button onClick={handleLogin} loading={loginBusy} disabled={!loginToken.trim()}>
            {t('app.auth_sign_in')}
          </Button>
        </Stack>
      </Modal>

      <AppShell.Header px="md" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Group gap="xs" style={{ flex: 1 }}>
          <IconBooks size={24} color="#1c7ed6" />
          <div>
            <Title order={5} style={{ lineHeight: 1 }}>{t('app.title')}</Title>
            <Text size="xs" c="dimmed" style={{ lineHeight: 1 }}>{t('app.subtitle')}</Text>
          </div>
        </Group>
        <SegmentedControl
          size="xs"
          value={i18n.language.startsWith('es') ? 'es' : 'en'}
          onChange={v => i18n.changeLanguage(v)}
          data={[{ label: 'EN', value: 'en' }, { label: 'ES', value: 'es' }]}
        />
      </AppShell.Header>

      <AppShell.Main>
        <Tabs value={tab} onChange={v => setTab(v as Tab)} mb="md">
          <Tabs.List>
            <Tabs.Tab value="library"  leftSection={<IconBooks size={16} />}>
              {t('app.tab_library')}
            </Tabs.Tab>
            <Tabs.Tab value="new" leftSection={generating ? <Loader size={14} /> : <IconWand size={16} />}>
              <Group gap={6} wrap="nowrap">
                {t('app.tab_studio')}
                {generating && (
                  <Badge size="xs" color="blue" variant="filled">
                    {genLabel || t('common.generating')}
                  </Badge>
                )}
              </Group>
            </Tabs.Tab>
            <Tabs.Tab value="moodle"     leftSection={<IconCloud size={16} />}>
              {t('app.tab_moodle')}
            </Tabs.Tab>
            <Tabs.Tab value="canvas"     leftSection={<IconCloud size={16} />}>
              Canvas
            </Tabs.Tab>
            <Tabs.Tab value="curriculum" leftSection={<IconMap2 size={16} />}>
              {t('app.tab_curriculum')}
            </Tabs.Tab>
            <Tabs.Tab value="review"     leftSection={<IconShieldCheck size={16} />}>
              {t('app.tab_review')}
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              {t('app.tab_settings')}
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {tab === 'library'  && <LibraryPage initialShortname={jumpCourse} onJumped={() => setJumpCourse(null)} />}

        {/* Always mounted so generation survives tab switches */}
        <Box display={tab === 'new' ? 'block' : 'none'}>
          <NewCoursePage
            onCreated={handleCreated}
            onGeneratingChange={handleGeneratingChange}
          />
        </Box>

        {tab === 'moodle'      && <MoodlePage />}
        {tab === 'canvas'      && <CanvasPage />}
        {tab === 'curriculum'  && <CurriculumPage />}
        {tab === 'review'      && <AutonomousReviewPage onLoadCourse={sn => { setJumpCourse(sn); setTab('library') }} />}
        {tab === 'settings'    && <SettingsPage />}
      </AppShell.Main>
    </AppShell>
  )
}
