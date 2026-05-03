import { useState } from 'react'
import { AppShell, Tabs, Title, Group, Text, Badge } from '@mantine/core'
import {
  IconBooks, IconPlus, IconCloud, IconSettings,
} from '@tabler/icons-react'
import LibraryPage     from './pages/Library'
import NewCoursePage   from './pages/NewCourse'
import MoodlePage      from './pages/MoodleCourses'
import SettingsPage    from './pages/Settings'

type Tab = 'library' | 'new' | 'moodle' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('library')

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header px="md" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Group gap="xs">
          <IconBooks size={24} color="#1c7ed6" />
          <div>
            <Title order={5} style={{ lineHeight: 1 }}>Moodle Course Creator</Title>
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
            <Tabs.Tab value="new"      leftSection={<IconPlus size={16} />}>
              New Course
            </Tabs.Tab>
            <Tabs.Tab value="moodle"   leftSection={<IconCloud size={16} />}>
              Moodle Courses
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              Settings
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {tab === 'library'  && <LibraryPage />}
        {tab === 'new'      && <NewCoursePage onCreated={() => setTab('library')} />}
        {tab === 'moodle'   && <MoodlePage />}
        {tab === 'settings' && <SettingsPage />}
      </AppShell.Main>
    </AppShell>
  )
}
