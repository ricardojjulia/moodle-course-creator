import { useEffect, useState } from 'react'
import {
  Stack, Title, Text, Badge, Group, Button, Select,
  Paper, Loader, Alert, Divider, Table, ActionIcon,
  Tooltip, Modal, Textarea, Accordion,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconRefresh, IconCloud, IconCheck, IconX,
  IconSend, IconLock, IconLockOpen, IconChevronDown,
} from '@tabler/icons-react'
import {
  api, type MoodleCourse, type MoodleSection,
  type MoodleActivity, type CourseVersion,
} from '../api/client'

function capBadge(canPush: boolean) {
  return canPush
    ? <Badge size="xs" color="green" leftSection={<IconLockOpen size={10} />}>API</Badge>
    : <Badge size="xs" color="gray"  leftSection={<IconLock size={10} />}>.mbz</Badge>
}

interface PushForumModalProps {
  activity: MoodleActivity
  versions: CourseVersion[]
  onClose: () => void
}

function PushForumModal({ activity, versions, onClose }: PushForumModalProps) {
  const [versionId, setVersionId] = useState<string | null>(null)
  const [moduleNum, setModuleNum] = useState<string | null>(null)
  const [subject, setSubject]     = useState('')
  const [message, setMessage]     = useState('')
  const [pushing, setPushing]     = useState(false)

  const versionOptions = versions.map(v => ({
    value: String(v.id),
    label: `v${v.version_num} — ${v.model_used || 'imported'} (${v.created_at.slice(0,10)})`,
  }))

  const moduleOptions = ['1','2','3','4','5'].map(n => ({
    value: n, label: `Module ${n}`,
  }))

  const loadPrompt = async () => {
    if (!versionId || !moduleNum) return
    try {
      const allVersions = versions
      const v = allVersions.find(v => v.id === Number(versionId))
      if (!v) return
      const full = await api.courses.version(v.shortname, v.id)
      const mc = (full.content as any)?.module_contents
      if (mc && mc[Number(moduleNum) - 1]) {
        const q = mc[Number(moduleNum) - 1].forum_question ?? ''
        setSubject(`Discusión — Módulo ${moduleNum}`)
        setMessage(q)
      }
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    }
  }

  const push = async () => {
    setPushing(true)
    try {
      await api.moodle.addDiscussion({ forum_id: activity.id, subject, message })
      notifications.show({ title: 'Posted!', message: `Discussion added to ${activity.name}`, color: 'green' })
      onClose()
    } catch (e: any) {
      notifications.show({ title: 'Failed', message: e.message, color: 'red' })
    } finally {
      setPushing(false)
    }
  }

  return (
    <Stack>
      <Text size="sm">Posting to: <strong>{activity.name}</strong></Text>
      <Group grow>
        <Select label="Library version" data={versionOptions} value={versionId} onChange={setVersionId} />
        <Select label="Module" data={moduleOptions} value={moduleNum} onChange={setModuleNum} />
      </Group>
      <Button size="xs" variant="light" onClick={loadPrompt} disabled={!versionId || !moduleNum}>
        Load prompt from library
      </Button>
      <Textarea label="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
      <Textarea label="Message" minRows={4} autosize value={message} onChange={e => setMessage(e.target.value)} />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button leftSection={pushing ? <Loader size="xs" /> : <IconSend size={14} />}
                onClick={push} disabled={pushing || !subject || !message}>
          Post Discussion
        </Button>
      </Group>
    </Stack>
  )
}

interface SectionPanelProps {
  section: MoodleSection
  courseId: number
  versions: CourseVersion[]
}

function SectionPanel({ section, courseId, versions }: SectionPanelProps) {
  const [forumModal, setForumModal] = useState<MoodleActivity | null>(null)
  const [pushingMeta, setPushingMeta] = useState(false)

  const pushSectionSummary = async (mod: MoodleActivity, versionId: string, moduleNum: string) => {
    // placeholder — full implementation would load content and push
    notifications.show({ title: 'Not yet', message: 'Section summary push coming soon', color: 'blue' })
  }

  return (
    <>
      <Paper withBorder p="sm" radius="md">
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm">
            {section.section === 0 ? '📌 General' : `Week ${section.section}`} · {section.name}
          </Text>
        </Group>
        <Table withTableBorder={false}>
          <Table.Tbody>
            {section.activities.map(act => (
              <Table.Tr key={act.id}>
                <Table.Td w={160}>
                  <Group gap={4}>
                    {capBadge(act.api_updatable)}
                    <Badge size="xs" variant="outline">{act.modname}</Badge>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{act.name}</Text>
                </Table.Td>
                <Table.Td w={80}>
                  {act.modname === 'forum' && (
                    <Tooltip label="Post discussion from library">
                      <ActionIcon size="xs" variant="light" color="blue"
                                  onClick={() => setForumModal(act)}>
                        <IconSend size={12} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {!act.api_updatable && (
                    <Tooltip label="Requires .mbz restore">
                      <ActionIcon size="xs" variant="subtle" color="gray" disabled>
                        <IconLock size={12} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={!!forumModal} onClose={() => setForumModal(null)}
             title="Post Discussion to Forum" size="lg">
        {forumModal && (
          <PushForumModal
            activity={forumModal}
            versions={versions}
            onClose={() => setForumModal(null)}
          />
        )}
      </Modal>
    </>
  )
}

export default function MoodleCoursesPage() {
  const [courses, setCourses]   = useState<MoodleCourse[]>([])
  const [selected, setSelected] = useState<MoodleCourse | null>(null)
  const [sections, setSections] = useState<MoodleSection[]>([])
  const [libVersions, setLibVersions] = useState<CourseVersion[]>([])
  const [loading, setLoading]   = useState(false)
  const [loadingSec, setLoadingSec] = useState(false)

  const loadCourses = () => {
    setLoading(true)
    api.moodle.courses()
      .then(setCourses)
      .catch(e => notifications.show({ title: 'Moodle error', message: e.message, color: 'red' }))
      .finally(() => setLoading(false))
  }

  useEffect(loadCourses, [])

  const selectCourse = async (c: MoodleCourse) => {
    setSelected(c)
    setSections([])
    setLoadingSec(true)
    try {
      const [secs, libCourses] = await Promise.all([
        api.moodle.contents(c.id),
        api.courses.list(),
      ])
      setSections(secs)
      // find matching course in library by shortname
      const match = libCourses.find(lc => lc.shortname === c.shortname)
      if (match) {
        const vers = await api.courses.versions(match.shortname)
        setLibVersions(vers)
      } else {
        setLibVersions([])
      }
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setLoadingSec(false)
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Moodle Courses</Title>
        <Button variant="subtle" leftSection={<IconRefresh size={16} />} onClick={loadCourses}>
          Refresh
        </Button>
      </Group>

      {loading && <Loader />}

      {!loading && courses.length === 0 && (
        <Alert color="orange" title="No courses found">
          Check your Moodle token in Settings, or verify the connection.
        </Alert>
      )}

      <Group align="flex-start" wrap="nowrap">
        {/* Course list */}
        <Stack w={280} style={{ flexShrink: 0 }}>
          {courses.map(c => (
            <Paper
              key={c.id}
              withBorder p="sm" radius="md"
              style={{
                cursor: 'pointer',
                background: selected?.id === c.id ? 'var(--mantine-color-blue-0)' : undefined,
              }}
              onClick={() => selectCourse(c)}
            >
              <Text size="sm" fw={500}>{c.fullname}</Text>
              <Text size="xs" c="dimmed">{c.shortname}</Text>
            </Paper>
          ))}
        </Stack>

        {/* Sections */}
        {selected && (
          <Stack style={{ flex: 1 }}>
            <Group justify="space-between">
              <Title order={5}>{selected.fullname}</Title>
              {libVersions.length > 0 && (
                <Badge color="green">
                  {libVersions.length} library version{libVersions.length > 1 ? 's' : ''}
                </Badge>
              )}
              {libVersions.length === 0 && (
                <Badge color="gray">Not in library</Badge>
              )}
            </Group>

            <Alert color="blue" icon={<IconCloud size={14} />}>
              <Group gap="xs">
                {capBadge(true)} can be updated via API &nbsp;·&nbsp;
                {capBadge(false)} requires .mbz restore
              </Group>
            </Alert>

            {loadingSec && <Loader />}
            {sections.map(sec => (
              <SectionPanel
                key={sec.id}
                section={sec}
                courseId={selected.id}
                versions={libVersions}
              />
            ))}
          </Stack>
        )}
      </Group>
    </Stack>
  )
}
