import { useEffect, useState } from 'react'
import {
  Stack, Title, Text, Badge, Group, Button,
  Table, Loader, Alert, ActionIcon, Tooltip, Paper,
  ThemeIcon, Divider, ScrollArea, Accordion, Box,
} from '@mantine/core'
import {
  IconDownload, IconBook, IconBuildingArch,
  IconRefresh, IconTrash, IconCheck, IconX,
  IconCloud, IconHome,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api, type Course, type CourseVersion } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel, loading }: {
  onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <Group gap={4}>
      <ActionIcon size="sm" color="red" variant="filled" loading={loading} onClick={onConfirm}>
        <IconCheck size={12} />
      </ActionIcon>
      <ActionIcon size="sm" variant="subtle" onClick={onCancel}>
        <IconX size={12} />
      </ActionIcon>
    </Group>
  )
}

// ── Module detail panel ───────────────────────────────────────────────────────

interface ModuleProps {
  mod: { number: number; title: string; objective?: string; key_topics?: string[] }
  mc?: {
    lecture_html?: string
    glossary_terms?: string[]
    forum_question?: string
    activities_snapshot?: { id: number; name: string; modname: string }[]
  }
}

function ModulePanel({ mod, mc }: ModuleProps) {
  const glossaryCount = mc?.glossary_terms?.length ?? 0
  const activities    = mc?.activities_snapshot ?? []
  const hasLecture    = !!(mc?.lecture_html?.trim())

  return (
    <Accordion.Item value={String(mod.number)}>
      <Accordion.Control>
        <Group justify="space-between" wrap="nowrap" pr="md">
          <Text size="sm" fw={600} lineClamp={1}>
            {mod.number}. {mod.title}
          </Text>
          <Group gap={4} style={{ flexShrink: 0 }}>
            {activities.length > 0 && (
              <Badge size="xs" variant="outline" color="gray">
                {activities.length} activities
              </Badge>
            )}
            {glossaryCount > 0 && (
              <Badge size="xs" variant="outline" color="teal">
                {glossaryCount} terms
              </Badge>
            )}
            {mc?.forum_question && (
              <Badge size="xs" variant="outline" color="blue">forum</Badge>
            )}
            {hasLecture && (
              <Badge size="xs" variant="outline" color="violet">lecture</Badge>
            )}
          </Group>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="xs">
          {mod.objective && (
            <Text size="xs" c="dimmed">{mod.objective}</Text>
          )}
          {mod.key_topics && mod.key_topics.length > 0 && (
            <Group gap={4} wrap="wrap">
              {mod.key_topics.map(t => (
                <Badge key={t} size="xs" variant="light" color="gray">{t}</Badge>
              ))}
            </Group>
          )}
          {activities.length > 0 && (
            <Table withTableBorder={false} withRowBorders={false}>
              <Table.Tbody>
                {activities.map(a => (
                  <Table.Tr key={a.id}>
                    <Table.Td w={80}>
                      <Badge size="xs" variant="outline">{a.modname}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{a.name}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {mc?.forum_question && (
            <Text size="xs" c="blue">
              <strong>Forum: </strong>{mc.forum_question.slice(0, 200)}
              {mc.forum_question.length > 200 ? '…' : ''}
            </Text>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  )
}

// ── Course detail panel ───────────────────────────────────────────────────────

function CourseDetail({ course, onDeleted }: { course: Course; onDeleted: () => void }) {
  const [versions,   setVersions]   = useState<CourseVersion[]>([])
  const [selVid,     setSelVid]     = useState<number | null>(null)
  const [content,    setContent]    = useState<Record<string, any> | null>(null)
  const [loadingV,   setLoadingV]   = useState(false)
  const [building,   setBuilding]   = useState(false)
  const [confirmDel, setConfirmDel] = useState<number | null>(null)
  const [deleting,   setDeleting]   = useState(false)
  const [confirmCourse, setConfirmCourse] = useState(false)
  const [deletingCourse, setDeletingCourse] = useState(false)

  // Load versions when course changes
  useEffect(() => {
    setVersions([])
    setContent(null)
    setSelVid(null)
    setLoadingV(true)
    api.courses.versions(course.shortname)
      .then(vers => {
        setVersions(vers)
        if (vers.length) setSelVid(vers[0].id)
      })
      .catch(e => notifications.show({ title: 'Error', message: e.message, color: 'red' }))
      .finally(() => setLoadingV(false))
  }, [course.shortname])

  // Load full content when selected version changes
  useEffect(() => {
    if (!selVid) return
    setContent(null)
    api.courses.version(course.shortname, selVid)
      .then(v => setContent((v.content as any) ?? {}))
      .catch(() => setContent({}))
  }, [selVid, course.shortname])

  const selectedVersion = versions.find(v => v.id === selVid)

  const handleBuild = async () => {
    if (!selVid) return
    setBuilding(true)
    try {
      const res = await api.courses.build(course.shortname, selVid)
      notifications.show({ title: 'Built', message: `${res.filename} — ${res.size_kb} KB`, color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Build failed', message: e.message, color: 'red' })
    } finally {
      setBuilding(false)
    }
  }

  const handleDeleteVersion = async () => {
    if (!confirmDel) return
    setDeleting(true)
    try {
      await api.courses.deleteVersion(course.shortname, confirmDel)
      const vers = await api.courses.versions(course.shortname)
      setVersions(vers)
      setSelVid(vers.length ? vers[0].id : null)
      if (vers.length === 0) onDeleted()
      setConfirmDel(null)
    } catch (e: any) {
      notifications.show({ title: 'Delete failed', message: e.message, color: 'red' })
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteCourse = async () => {
    setDeletingCourse(true)
    try {
      await api.courses.deleteCourse(course.shortname)
      onDeleted()
    } catch (e: any) {
      notifications.show({ title: 'Delete failed', message: e.message, color: 'red' })
      setConfirmCourse(false)
    } finally {
      setDeletingCourse(false)
    }
  }

  const modules  = content?.course_structure?.modules  ?? []
  const mcList   = content?.module_contents             ?? []
  const quizQ    = content?.quiz_questions              ?? []
  const hwSpec   = content?.homework_spec               ?? {}
  const hwCount  = Object.keys(hwSpec).length

  const mcByNum = Object.fromEntries(
    (mcList as any[]).map((mc: any) => [mc.module_num, mc])
  )

  return (
    <Stack gap="sm" pr={4}>
      {/* Course header */}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" wrap="nowrap" mb="xs">
          <Box miw={0}>
            <Text fw={700} lineClamp={2}>{course.fullname}</Text>
            <Group gap="xs" mt={2}>
              <Text size="xs" c="dimmed">{course.shortname}</Text>
              {course.professor && <>
                <Text size="xs" c="dimmed">·</Text>
                <Text size="xs" c="dimmed">{course.professor}</Text>
              </>}
            </Group>
          </Box>
          <Group gap={4} style={{ flexShrink: 0 }}>
            {confirmCourse ? (
              <DeleteConfirm
                onConfirm={handleDeleteCourse}
                onCancel={() => setConfirmCourse(false)}
                loading={deletingCourse}
              />
            ) : (
              <Tooltip label="Delete course and all versions">
                <ActionIcon size="sm" variant="subtle" color="red"
                            onClick={() => setConfirmCourse(true)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {loadingV && <Loader size="xs" />}

        {/* Version tabs */}
        {versions.length > 0 && (
          <>
            <Divider mb="xs" />
            <Group gap="xs" justify="space-between" wrap="nowrap">
              <Group gap={4}>
                {versions.map(v => (
                  <Badge
                    key={v.id}
                    variant={selVid === v.id ? 'filled' : 'light'}
                    color="blue"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelVid(v.id)}
                  >
                    v{v.version_num}
                    <Text span size="xs" c={selVid === v.id ? 'white' : 'dimmed'} ml={4}>
                      {v.model_used || 'import'}
                    </Text>
                  </Badge>
                ))}
              </Group>
              {selectedVersion && (
                <Group gap={4} style={{ flexShrink: 0 }}>
                  <Tooltip label="Build .mbz">
                    <ActionIcon size="sm" variant="light" loading={building} onClick={handleBuild}>
                      <IconBuildingArch size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Download .mbz">
                    <ActionIcon
                      size="sm" variant="light" color="green"
                      component="a"
                      href={api.courses.downloadUrl(course.shortname, selectedVersion.id)}
                      download
                    >
                      <IconDownload size={14} />
                    </ActionIcon>
                  </Tooltip>
                  {confirmDel === selectedVersion.id ? (
                    <DeleteConfirm
                      onConfirm={handleDeleteVersion}
                      onCancel={() => setConfirmDel(null)}
                      loading={deleting}
                    />
                  ) : (
                    <Tooltip label="Delete this version">
                      <ActionIcon size="sm" variant="subtle" color="red"
                                  onClick={() => setConfirmDel(selectedVersion.id)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              )}
            </Group>

            {selectedVersion && (
              <Group gap="xs" mt="xs">
                <Text size="xs" c="dimmed">
                  {selectedVersion.start_date || '—'} → {selectedVersion.end_date || '—'}
                </Text>
                <Text size="xs" c="dimmed">·</Text>
                <Text size="xs" c="dimmed">
                  Created {new Date(selectedVersion.created_at).toLocaleDateString()}
                </Text>
              </Group>
            )}
          </>
        )}
      </Paper>

      {/* Content stats */}
      {content && modules.length > 0 && (
        <Group gap="xs">
          <Badge size="sm" variant="light" color="blue">{modules.length} modules</Badge>
          {quizQ.length > 0 && (
            <Badge size="sm" variant="light" color="orange">{quizQ.length} quiz questions</Badge>
          )}
          {hwCount > 0 && (
            <Badge size="sm" variant="light" color="grape">{hwCount} homework modules</Badge>
          )}
          {content.moodle_import && (
            <Badge size="sm" variant="light" color="teal">Moodle import</Badge>
          )}
          {content.mbz_import && (
            <Badge size="sm" variant="light" color="violet">.mbz import</Badge>
          )}
        </Group>
      )}

      {/* Module accordion */}
      {content && modules.length > 0 && (
        <Accordion variant="separated" radius="md">
          {(modules as any[]).map((mod: any) => (
            <ModulePanel
              key={mod.number}
              mod={mod}
              mc={mcByNum[mod.number]}
            />
          ))}
        </Accordion>
      )}

      {content && modules.length === 0 && (
        <Text size="sm" c="dimmed">No module content stored for this version.</Text>
      )}

      {!content && selVid && <Loader size="sm" />}
    </Stack>
  )
}

// ── Instance group header ─────────────────────────────────────────────────────

function InstanceHeader({ name, courses }: { name: string; courses: Course[] }) {
  const isLocal     = name === 'Local'
  const totalVers   = courses.reduce((s, c) => s + c.version_count, 0)

  return (
    <Group gap="xs" mt="xs" mb={2}>
      <ThemeIcon size="sm" variant="light" color={isLocal ? 'gray' : 'blue'}>
        {isLocal ? <IconHome size={12} /> : <IconCloud size={12} />}
      </ThemeIcon>
      <Text fw={600} size="sm" c={isLocal ? 'dimmed' : 'blue'}>{name}</Text>
      <Badge size="xs" variant="outline" color={isLocal ? 'gray' : 'blue'}>
        {courses.length} course{courses.length !== 1 ? 's' : ''}
      </Badge>
      <Badge size="xs" variant="outline" color="gray">
        {totalVers} version{totalVers !== 1 ? 's' : ''}
      </Badge>
    </Group>
  )
}

// ── Library page ──────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [courses,  setCourses]  = useState<Course[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Course | null>(null)

  const load = () => {
    setLoading(true)
    api.courses.list()
      .then(c => { setCourses(c); setLoading(false) })
      .catch(e => {
        notifications.show({ title: 'Error', message: e.message, color: 'red' })
        setLoading(false)
      })
  }

  useEffect(load, [])

  const handleDeleted = () => {
    setSelected(null)
    load()
  }

  // Group by instance; Local first
  const groups = courses.reduce<Record<string, Course[]>>((acc, c) => {
    const key = c.instance || 'Local'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const sortedInstances = Object.keys(groups).sort((a, b) => {
    if (a === 'Local') return -1
    if (b === 'Local') return 1
    return a.localeCompare(b)
  })

  const PANEL_HEIGHT = 'calc(100vh - 170px)'

  return (
    <Stack gap="sm" style={{ height: PANEL_HEIGHT, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <Group justify="space-between" style={{ flexShrink: 0 }}>
        <Title order={3}>Course Library</Title>
        <Button variant="subtle" size="xs"
                leftSection={loading ? <Loader size="xs" /> : <IconRefresh size={16} />}
                onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Group>

      {!loading && courses.length === 0 && (
        <Alert color="blue" title="No courses yet">
          Use the <strong>New Course</strong> tab to generate your first course,
          or import from the <strong>Moodle Courses</strong> tab.
        </Alert>
      )}

      {/* Two-panel split */}
      <Group align="flex-start" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }} gap="sm">

        {/* Left: course list grouped by instance */}
        <ScrollArea style={{ width: 280, flexShrink: 0, height: '100%' }} pr={4}>
          <Stack gap={2}>
            {loading && <Loader size="sm" />}
            {sortedInstances.map(instance => (
              <Box key={instance}>
                <InstanceHeader name={instance} courses={groups[instance]} />
                <Stack gap={2}>
                  {groups[instance].map(c => (
                    <Paper
                      key={c.shortname}
                      withBorder
                      px="sm"
                      py={6}
                      radius="sm"
                      style={{
                        cursor: 'pointer',
                        background: selected?.shortname === c.shortname
                          ? 'var(--mantine-color-blue-0)'
                          : undefined,
                        borderColor: selected?.shortname === c.shortname
                          ? 'var(--mantine-color-blue-4)'
                          : undefined,
                      }}
                      onClick={() => setSelected(c)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text size="xs" fw={500} lineClamp={1}>{c.fullname}</Text>
                          <Text size="xs" c="dimmed">{c.shortname}</Text>
                        </Box>
                        <Badge size="xs" color="blue" variant="light" style={{ flexShrink: 0 }}>
                          {c.version_count}v
                        </Badge>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </ScrollArea>

        {/* Right: course detail */}
        <ScrollArea style={{ flex: 1, height: '100%' }}>
          {!selected && !loading && courses.length > 0 && (
            <Text size="sm" c="dimmed" mt="xl" ta="center">
              Select a course on the left to view its content.
            </Text>
          )}
          {selected && (
            <CourseDetail
              key={selected.shortname}
              course={selected}
              onDeleted={handleDeleted}
            />
          )}
        </ScrollArea>
      </Group>
    </Stack>
  )
}
