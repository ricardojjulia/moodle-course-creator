import { useEffect, useState } from 'react'
import {
  Stack, Title, Text, Badge, Group, Button,
  Table, Loader, Alert, ActionIcon, Tooltip, Paper,
  ThemeIcon, Divider, ScrollArea, Accordion, Box,
  Modal, TypographyStylesProvider, Checkbox, Collapse,
  Progress,
} from '@mantine/core'
import {
  IconDownload, IconBuildingArch,
  IconRefresh, IconTrash, IconCheck, IconX,
  IconCloud, IconHome, IconExternalLink,
  IconChevronDown, IconChevronRight,
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

// ── Activity detail modal ─────────────────────────────────────────────────────

interface ActivitySnap {
  id: number
  name: string
  modname: string
  content_html?: string
}

interface ActivityModalProps {
  activity: ActivitySnap | null
  moodleCourseId?: number
  onClose: () => void
}

function ActivityDetailModal({ activity, moodleCourseId, onClose }: ActivityModalProps) {
  const [html,    setHtml]    = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tried,   setTried]   = useState(false)

  useEffect(() => {
    if (!activity) return
    setHtml(null)
    setTried(false)
    // If content is already stored locally, use it
    if (activity.content_html?.trim()) {
      setHtml(activity.content_html)
      setTried(true)
    }
  }, [activity?.id])

  const fetchFromMoodle = async () => {
    if (!activity || !moodleCourseId) return
    setLoading(true)
    try {
      const res = await api.moodle.moduleContent(moodleCourseId, activity.id)
      setHtml(res.content_html || '<em>No content available for this activity.</em>')
    } catch (e: any) {
      setHtml(`<em>Could not load from Moodle: ${e.message}</em>`)
    } finally {
      setLoading(false)
      setTried(true)
    }
  }

  if (!activity) return null

  const modColor: Record<string, string> = {
    page: 'blue', assign: 'orange', forum: 'teal',
    quiz: 'red', resource: 'gray', label: 'gray',
  }

  return (
    <Modal
      opened={!!activity}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Badge color={modColor[activity.modname] ?? 'gray'}>{activity.modname}</Badge>
          <Text fw={600} size="sm" lineClamp={2}>{activity.name}</Text>
        </Group>
      }
      size="xl"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      {!tried && !loading && (
        <Stack align="center" py="xl" gap="sm">
          <Text size="sm" c="dimmed">Content not stored locally.</Text>
          {moodleCourseId ? (
            <Button
              size="sm"
              variant="light"
              leftSection={<IconExternalLink size={14} />}
              onClick={fetchFromMoodle}
            >
              Load from Moodle
            </Button>
          ) : (
            <Text size="xs" c="dimmed">No Moodle source available for this version.</Text>
          )}
        </Stack>
      )}

      {loading && (
        <Stack align="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">Fetching from Moodle…</Text>
        </Stack>
      )}

      {tried && !loading && html && (
        html.trim().startsWith('<') ? (
          <TypographyStylesProvider>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </TypographyStylesProvider>
        ) : (
          <Text size="sm">{html}</Text>
        )
      )}
    </Modal>
  )
}

// ── Module detail panel ───────────────────────────────────────────────────────

interface ModuleProps {
  mod: { number: number; title: string; objective?: string; key_topics?: string[] }
  mc?: {
    lecture_html?: string
    glossary_terms?: string[]
    forum_question?: string
    activities_snapshot?: ActivitySnap[]
  }
  moodleCourseId?: number
}

function ModulePanel({ mod, mc, moodleCourseId }: ModuleProps) {
  const [activeActivity, setActiveActivity] = useState<ActivitySnap | null>(null)

  const glossaryCount = mc?.glossary_terms?.length ?? 0
  const activities    = mc?.activities_snapshot ?? []
  const hasLecture    = !!(mc?.lecture_html?.trim())

  return (
    <>
      <Accordion.Item value={String(mod.number)}>
        <Accordion.Control>
          <Group justify="space-between" wrap="nowrap" pr="md">
            <Text size="sm" fw={600} lineClamp={1}>
              {mod.number}. {mod.title}
            </Text>
            <Group gap={4} style={{ flexShrink: 0 }}>
              {activities.length > 0 && (
                <Badge size="xs" variant="outline" color="gray">
                  {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
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
              <Table withTableBorder={false} withRowBorders highlightOnHover>
                <Table.Tbody>
                  {activities.map(a => (
                    <Table.Tr
                      key={a.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActiveActivity(a)}
                    >
                      <Table.Td w={80}>
                        <Badge size="xs" variant="outline">{a.modname}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{a.name}</Text>
                      </Table.Td>
                      <Table.Td w={24}>
                        <ActionIcon size="xs" variant="subtle" color="blue">
                          <IconExternalLink size={11} />
                        </ActionIcon>
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

      <ActivityDetailModal
        activity={activeActivity}
        moodleCourseId={moodleCourseId}
        onClose={() => setActiveActivity(null)}
      />
    </>
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
              moodleCourseId={content.moodle_course_id}
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

// ── Instance group (collapsible, with checkboxes) ─────────────────────────────

interface InstanceGroupProps {
  name: string
  courses: Course[]
  selected: Course | null
  checkedShortnames: Set<string>
  onSelect: (c: Course) => void
  onToggle: (shortname: string) => void
  onToggleAll: (instance: string, checked: boolean) => void
}

function InstanceGroup({
  name, courses, selected, checkedShortnames,
  onSelect, onToggle, onToggleAll,
}: InstanceGroupProps) {
  const [open, setOpen] = useState(true)
  const isLocal       = name === 'Local'
  const totalVers     = courses.reduce((s, c) => s + c.version_count, 0)
  const checkedHere   = courses.filter(c => checkedShortnames.has(c.shortname)).length
  const allChecked    = checkedHere === courses.length
  const someChecked   = checkedHere > 0 && !allChecked

  return (
    <Box>
      {/* Instance header row */}
      <Group
        gap="xs"
        mt="xs"
        mb={2}
        px={4}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <Checkbox
          size="xs"
          checked={allChecked}
          indeterminate={someChecked}
          onClick={e => e.stopPropagation()}
          onChange={e => onToggleAll(name, e.currentTarget.checked)}
        />
        <ThemeIcon size="sm" variant="light" color={isLocal ? 'gray' : 'blue'}>
          {isLocal ? <IconHome size={12} /> : <IconCloud size={12} />}
        </ThemeIcon>
        <Text fw={600} size="sm" c={isLocal ? 'dimmed' : 'blue'} style={{ flex: 1 }}>{name}</Text>
        <Badge size="xs" variant="outline" color={isLocal ? 'gray' : 'blue'}>
          {courses.length}
        </Badge>
        <Badge size="xs" variant="outline" color="gray">
          {totalVers}v
        </Badge>
        <ActionIcon size="xs" variant="subtle" color="gray">
          {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        </ActionIcon>
      </Group>

      {/* Course list */}
      <Collapse in={open}>
        <Stack gap={2} pl={4}>
          {courses.map(c => (
            <Group key={c.shortname} gap={4} wrap="nowrap">
              <Checkbox
                size="xs"
                checked={checkedShortnames.has(c.shortname)}
                onChange={() => onToggle(c.shortname)}
                onClick={e => e.stopPropagation()}
              />
              <Paper
                withBorder
                px="sm"
                py={6}
                radius="sm"
                style={{
                  cursor: 'pointer', flex: 1,
                  background: selected?.shortname === c.shortname
                    ? 'var(--mantine-color-blue-0)' : undefined,
                  borderColor: selected?.shortname === c.shortname
                    ? 'var(--mantine-color-blue-4)' : undefined,
                }}
                onClick={() => onSelect(c)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Box miw={0}>
                    <Text size="xs" fw={500} lineClamp={1}>{c.fullname}</Text>
                    <Text size="xs" c="dimmed">{c.shortname}</Text>
                  </Box>
                  <Badge size="xs" color="blue" variant="light" style={{ flexShrink: 0 }}>
                    {c.version_count}v
                  </Badge>
                </Group>
              </Paper>
            </Group>
          ))}
        </Stack>
      </Collapse>
    </Box>
  )
}

// ── Library page ──────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [courses,  setCourses]  = useState<Course[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Course | null>(null)
  const [checked,  setChecked]  = useState<Set<string>>(new Set())
  const [bulking,  setBulking]  = useState(false)
  const [bulkDone, setBulkDone] = useState(0)
  const [confirmBulk, setConfirmBulk] = useState(false)

  const load = () => {
    setLoading(true)
    setChecked(new Set())
    api.courses.list()
      .then(c => { setCourses(c); setLoading(false) })
      .catch(e => {
        notifications.show({ title: 'Error', message: e.message, color: 'red' })
        setLoading(false)
      })
  }

  useEffect(load, [])

  const handleDeleted = () => { setSelected(null); load() }

  const toggleOne = (sn: string) =>
    setChecked(prev => { const n = new Set(prev); n.has(sn) ? n.delete(sn) : n.add(sn); return n })

  const toggleAll = (instance: string, checked: boolean) => {
    const group = groups[instance] ?? []
    setChecked(prev => {
      const n = new Set(prev)
      group.forEach(c => checked ? n.add(c.shortname) : n.delete(c.shortname))
      return n
    })
  }

  const runBulkDelete = async () => {
    const list = [...checked]
    setBulking(true)
    setBulkDone(0)
    setConfirmBulk(false)
    try {
      const res = await api.courses.bulkDelete(list)
      setBulkDone(res.deleted.length)
      notifications.show({
        title: 'Deleted',
        message: `${res.deleted.length} course${res.deleted.length !== 1 ? 's' : ''} removed`,
        color: 'orange',
      })
      if (selected && res.deleted.includes(selected.shortname)) setSelected(null)
      load()
    } catch (e: any) {
      notifications.show({ title: 'Bulk delete failed', message: e.message, color: 'red' })
    } finally {
      setBulking(false)
    }
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

      {/* Bulk action bar */}
      {(checked.size > 0 || bulking) && (
        <Paper withBorder p="xs" radius="md"
               style={{ background: 'var(--mantine-color-red-0)', flexShrink: 0 }}>
          {bulking ? (
            <Stack gap={4}>
              <Text size="sm" fw={500}>Deleting {bulkDone} / {checked.size}…</Text>
              <Progress value={(bulkDone / checked.size) * 100} animated size="sm" color="red" />
            </Stack>
          ) : confirmBulk ? (
            <Group justify="space-between">
              <Text size="sm" fw={500} c="red">
                Delete {checked.size} course{checked.size !== 1 ? 's' : ''} and all their versions?
              </Text>
              <Group gap="xs">
                <Button size="xs" color="red" onClick={runBulkDelete}>Yes, delete</Button>
                <Button size="xs" variant="subtle" onClick={() => setConfirmBulk(false)}>Cancel</Button>
              </Group>
            </Group>
          ) : (
            <Group justify="space-between">
              <Text size="sm" fw={500}>{checked.size} selected</Text>
              <Group gap="xs">
                <Button size="xs" variant="subtle" onClick={() => setChecked(new Set())}>
                  Clear
                </Button>
                <Button
                  size="xs" color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => setConfirmBulk(true)}
                >
                  Delete selected
                </Button>
              </Group>
            </Group>
          )}
        </Paper>
      )}

      {!loading && courses.length === 0 && (
        <Alert color="blue" title="No courses yet">
          Use the <strong>New Course</strong> tab to generate your first course,
          or import from the <strong>Moodle Courses</strong> tab.
        </Alert>
      )}

      {/* Two-panel split */}
      <Group align="flex-start" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }} gap="sm">

        {/* Left: collapsible instance groups */}
        <ScrollArea style={{ width: 300, flexShrink: 0, height: '100%' }} pr={4}>
          <Stack gap={2}>
            {loading && <Loader size="sm" />}
            {sortedInstances.map(instance => (
              <InstanceGroup
                key={instance}
                name={instance}
                courses={groups[instance]}
                selected={selected}
                checkedShortnames={checked}
                onSelect={setSelected}
                onToggle={toggleOne}
                onToggleAll={toggleAll}
              />
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
