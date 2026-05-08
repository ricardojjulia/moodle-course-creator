import { useState, useCallback } from 'react'
import { AppShell, Tabs, Title, Group, Text, Loader, Badge, Box } from '@mantine/core'
import {
  IconBooks, IconWand, IconCloud, IconSettings, IconShieldCheck,
} from '@tabler/icons-react'
import LibraryPage          from './pages/Library'
import NewCoursePage        from './pages/NewCourse'
import MoodlePage           from './pages/MoodleCourses'
import SettingsPage         from './pages/Settings'
import AutonomousReviewPage from './pages/AutonomousReview'

type Tab = 'library' | 'new' | 'moodle' | 'review' | 'settings'

export default function App() {
  const [tab, setTab]                 = useState<Tab>('library')
  const [generating, setGenerating]   = useState(false)
  const [genLabel, setGenLabel]       = useState<string>('')

  const handleGeneratingChange = useCallback((v: boolean, label?: string) => {
    setGenerating(v)
    if (label) setGenLabel(label)
    else if (!v) setGenLabel('')
  }, [])

  const handleCreated = useCallback(() => setTab('library'), [])

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header px="md" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Group gap="xs">
          <IconBooks size={24} color="#1c7ed6" />
          <div>
            <Title order={5} style={{ lineHeight: 1 }}>Moodle Course Administrator</Title>
            <Text size="xs" c="dimmed" style={{ lineHeight: 1 }}>Colegio Teológico Biblos</Text>
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
            <Tabs.Tab value="moodle"   leftSection={<IconCloud size={16} />}>
              Instance Course Catalog
            </Tabs.Tab>
            <Tabs.Tab value="review" leftSection={<IconShieldCheck size={16} />}>
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

        {tab === 'moodle'   && <MoodlePage />}
        {tab === 'review'   && <AutonomousReviewPage />}
        {tab === 'settings' && <SettingsPage />}
      </AppShell.Main>
    </AppShell>
  )
}
