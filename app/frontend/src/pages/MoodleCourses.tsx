import { useEffect, useState } from 'react'
import {
  Stack, Title, Text, Badge, Group, Button, Select,
  Paper, Loader, Alert, Table, ActionIcon,
  Tooltip, Modal, Textarea, ScrollArea, Divider,
  ThemeIcon, Checkbox, Progress, Box,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconRefresh, IconCloud, IconCheck, IconX,
  IconSend, IconLock, IconLockOpen, IconDownload,
  IconDatabaseImport, IconArchive, IconSquareCheck,
} from '@tabler/icons-react'
import {
  api, type MoodleCourse, type MoodleSection,
  type MoodleActivity, type CourseVersion, type MoodleBackupFile,
} from '../api/client'

const ts2date = (ts: number) => ts ? new Date(ts * 1000).toISOString().slice(0, 10) : ''

function capBadge(canPush: boolean) {
  return canPush
    ? <Badge size="xs" color="green" leftSection={<IconLockOpen size={10} />}>API</Badge>
    : <Badge size="xs" color="gray"  leftSection={<IconLock size={10} />}>.mbz</Badge>
}

// ── Forum push modal ──────────────────────────────────────────────────────────

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

  const loadPrompt = async () => {
    if (!versionId || !moduleNum) return
    try {
      const v = versions.find(v => v.id === Number(versionId))
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
        <Select label="Module" data={['1','2','3','4','5'].map(n => ({ value: n, label: `Module ${n}` }))}
                value={moduleNum} onChange={setModuleNum} />
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

// ── Section panel ─────────────────────────────────────────────────────────────

interface SectionPanelProps {
  section: MoodleSection
  courseId: number
  versions: CourseVersion[]
}

function SectionPanel({ section, courseId, versions }: SectionPanelProps) {
  const [forumModal, setForumModal] = useState<MoodleActivity | null>(null)

  return (
    <>
      <Paper withBorder p="sm" radius="md">
        <Text fw={600} size="sm" mb="xs">
          {section.section === 0 ? '📌 General' : `Week ${section.section}`} · {section.name}
        </Text>
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
                <Table.Td w={36}>
                  {act.modname === 'forum' ? (
                    <Tooltip label="Post discussion from library">
                      <ActionIcon size="xs" variant="light" color="blue"
                                  onClick={() => setForumModal(act)}>
                        <IconSend size={12} />
                      </ActionIcon>
                    </Tooltip>
                  ) : !act.api_updatable ? (
                    <Tooltip label="Requires .mbz restore">
                      <ActionIcon size="xs" variant="subtle" color="gray" disabled>
                        <IconLock size={12} />
                      </ActionIcon>
                    </Tooltip>
                  ) : null}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={!!forumModal} onClose={() => setForumModal(null)}
             title="Post Discussion to Forum" size="lg">
        {forumModal && (
          <PushForumModal activity={forumModal} versions={versions}
                          onClose={() => setForumModal(null)} />
        )}
      </Modal>
    </>
  )
}

// ── Batch import status types ─────────────────────────────────────────────────

type BatchStatus = 'pending' | 'running' | 'done' | 'error'

interface BatchItem {
  course: MoodleCourse
  status: BatchStatus
  error?: string
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MoodleCoursesPage() {
  const [siteName, setSiteName]         = useState<string | null>(null)
  const [courses, setCourses]           = useState<MoodleCourse[]>([])
  const [selected, setSelected]         = useState<MoodleCourse | null>(null)
  const [sections, setSections]         = useState<MoodleSection[]>([])
  const [libVersions, setLibVersions]   = useState<CourseVersion[]>([])
  const [loading, setLoading]           = useState(false)
  const [loadingSec, setLoadingSec]     = useState(false)
  const [importing, setImporting]       = useState(false)
  const [backupFiles, setBackupFiles]   = useState<MoodleBackupFile[] | null>(null)
  const [checkingBackup, setCheckingBackup] = useState(false)
  const [addingBackup, setAddingBackup] = useState<string | null>(null)

  // Multi-select state
  const [checkedIds, setCheckedIds]     = useState<Set<number>>(new Set())
  const [batchItems, setBatchItems]     = useState<BatchItem[]>([])
  const [batching, setBatching]         = useState(false)

  const loadCourses = () => {
    setLoading(true)
    setCheckedIds(new Set())
    api.moodle.ping()
      .then(info => setSiteName(info.site_name))
      .catch(() => {})
    api.moodle.courses()
      .then(setCourses)
      .catch(e => notifications.show({ title: 'Moodle error', message: e.message, color: 'red' }))
      .finally(() => setLoading(false))
  }

  useEffect(loadCourses, [])

  const selectCourse = async (c: MoodleCourse) => {
    setSelected(c)
    setSections([])
    setBackupFiles(null)
    setLoadingSec(true)
    try {
      const [secs, libCourses] = await Promise.all([
        api.moodle.contents(c.id),
        api.courses.list(),
      ])
      setSections(secs)
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

  const importToLibrary = async () => {
    if (!selected) return
    setImporting(true)
    try {
      await api.moodle.importCourse(selected.id, {
        shortname:  selected.shortname,
        fullname:   selected.fullname,
        start_date: ts2date(selected.startdate),
        end_date:   ts2date(selected.enddate),
        instance:   siteName || 'Moodle',
      })
      notifications.show({
        title: 'Imported!',
        message: `${selected.shortname} added to library`,
        color: 'green',
        icon: <IconCheck />,
      })
      const vers = await api.courses.versions(selected.shortname)
      setLibVersions(vers)
    } catch (e: any) {
      notifications.show({ title: 'Import failed', message: e.message, color: 'red', icon: <IconX /> })
    } finally {
      setImporting(false)
    }
  }

  const checkBackups = async () => {
    if (!selected) return
    setCheckingBackup(true)
    try {
      const result = await api.moodle.checkBackups(selected.id)
      setBackupFiles(result.files)
      if (result.files.length === 0) {
        notifications.show({ title: 'No backups found', message: 'No automated .mbz files in this course\'s backup area.', color: 'blue' })
      }
    } catch (e: any) {
      notifications.show({ title: 'Check failed', message: e.message, color: 'red' })
    } finally {
      setCheckingBackup(false)
    }
  }

  const addBackupToLibrary = async (file: MoodleBackupFile) => {
    setAddingBackup(file.filename)
    try {
      await api.courses.importMbz({
        download_url: file.download_url,
        filename:     file.filename,
        shortname:    selected?.shortname,
        fullname:     selected?.fullname,
        instance:     siteName || 'Moodle',
      })
      notifications.show({
        title: 'Added to library!',
        message: `${file.filename} imported as a new version`,
        color: 'green',
        icon: <IconCheck />,
      })
      if (selected) {
        const vers = await api.courses.versions(selected.shortname)
        setLibVersions(vers)
      }
    } catch (e: any) {
      notifications.show({ title: 'Import failed', message: e.message, color: 'red', icon: <IconX /> })
    } finally {
      setAddingBackup(null)
    }
  }

  // ── Batch import ────────────────────────────────────────────────────────────

  const toggleCheck = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (checkedIds.size === courses.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(courses.map(c => c.id)))
    }
  }

  const runBatchImport = async () => {
    const selected_courses = courses.filter(c => checkedIds.has(c.id))
    const items: BatchItem[] = selected_courses.map(c => ({ course: c, status: 'pending' }))
    setBatchItems(items)
    setBatching(true)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      setBatchItems(prev => prev.map((it, idx) =>
        idx === i ? { ...it, status: 'running' } : it
      ))
      try {
        await api.moodle.importCourse(item.course.id, {
          shortname:  item.course.shortname,
          fullname:   item.course.fullname,
          start_date: ts2date(item.course.startdate),
          end_date:   ts2date(item.course.enddate),
          instance:   siteName || 'Moodle',
        })
        setBatchItems(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'done' } : it
        ))
      } catch (e: any) {
        setBatchItems(prev => prev.map((it, idx) =>
          idx === i ? { ...it, status: 'error', error: e.message } : it
        ))
      }
    }

    setBatching(false)
    setCheckedIds(new Set())
    notifications.show({
      title: 'Batch import complete',
      message: `${items.length} course${items.length !== 1 ? 's' : ''} processed`,
      color: 'green',
    })
  }

  const batchDone  = batchItems.filter(i => i.status === 'done').length
  const batchTotal = batchItems.length

  const PANEL_HEIGHT = 'calc(100vh - 170px)'

  return (
    <Stack gap="sm" style={{ height: PANEL_HEIGHT, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <Group justify="space-between" wrap="nowrap" style={{ flexShrink: 0 }}>
        <div>
          <Title order={3}>Moodle Courses</Title>
          {siteName && (
            <Group gap={6} mt={2}>
              <ThemeIcon size="xs" color="blue" variant="light">
                <IconCloud size={10} />
              </ThemeIcon>
              <Text size="xs" c="dimmed">{siteName}</Text>
            </Group>
          )}
        </div>
        <Button variant="subtle" size="xs"
                leftSection={loading ? <Loader size="xs" /> : <IconRefresh size={16} />}
                onClick={loadCourses} disabled={loading}>
          Refresh
        </Button>
      </Group>

      {/* ── Batch action bar ──────────────────────────────────────────── */}
      {(checkedIds.size > 0 || batching) && (
        <Paper withBorder p="xs" radius="md"
               style={{ background: 'var(--mantine-color-blue-0)', flexShrink: 0 }}>
          {batching ? (
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Importing {batchDone} / {batchTotal}…
                </Text>
                <Text size="xs" c="dimmed">
                  {batchItems.filter(i => i.status === 'error').length} errors
                </Text>
              </Group>
              <Progress value={(batchDone / batchTotal) * 100} animated size="sm" />
              <Group gap={6} wrap="wrap">
                {batchItems.map(item => (
                  <Badge
                    key={item.course.id}
                    size="xs"
                    color={item.status === 'done' ? 'green' : item.status === 'error' ? 'red' : item.status === 'running' ? 'blue' : 'gray'}
                  >
                    {item.status === 'running' && <Loader size={8} color="white" style={{ marginRight: 4 }} />}
                    {item.course.shortname}
                  </Badge>
                ))}
              </Group>
            </Stack>
          ) : (
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {checkedIds.size} course{checkedIds.size !== 1 ? 's' : ''} selected
              </Text>
              <Group gap="xs">
                <Button size="xs" variant="subtle" onClick={toggleAll}>
                  {checkedIds.size === courses.length ? 'Deselect all' : 'Select all'}
                </Button>
                <Button
                  size="xs"
                  leftSection={<IconDatabaseImport size={14} />}
                  onClick={runBatchImport}
                >
                  Import selected to library
                </Button>
              </Group>
            </Group>
          )}
        </Paper>
      )}

      {!loading && courses.length === 0 && (
        <Alert color="orange" title="No courses found">
          Check your Moodle token in Settings, or verify the connection.
        </Alert>
      )}

      {/* ── Two-panel split ───────────────────────────────────────────── */}
      <Group align="flex-start" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }} gap="sm">

        {/* Left: scrollable course list with checkboxes */}
        <ScrollArea style={{ width: 280, flexShrink: 0, height: '100%' }} pr={4}>
          <Stack gap="xs">
            {loading && <Loader size="sm" />}
            {courses.length > 1 && !loading && (
              <Group gap="xs" px={4}>
                <Checkbox
                  size="xs"
                  checked={checkedIds.size === courses.length}
                  indeterminate={checkedIds.size > 0 && checkedIds.size < courses.length}
                  onChange={toggleAll}
                  label={<Text size="xs" c="dimmed">Select all</Text>}
                />
              </Group>
            )}
            {courses.map(c => (
              <Paper
                key={c.id}
                withBorder p="sm" radius="md"
                style={{
                  cursor: 'pointer',
                  background: selected?.id === c.id
                    ? 'var(--mantine-color-blue-0)'
                    : undefined,
                  borderColor: selected?.id === c.id
                    ? 'var(--mantine-color-blue-4)'
                    : undefined,
                }}
                onClick={() => selectCourse(c)}
              >
                <Group gap="xs" wrap="nowrap" align="flex-start">
                  <Checkbox
                    size="xs"
                    checked={checkedIds.has(c.id)}
                    onChange={() => {}}
                    onClick={e => toggleCheck(c.id, e)}
                    style={{ marginTop: 2 }}
                  />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} lineClamp={2}>{c.fullname}</Text>
                    <Text size="xs" c="dimmed">{c.shortname}</Text>
                  </Box>
                </Group>
              </Paper>
            ))}
          </Stack>
        </ScrollArea>

        {/* Right: course detail + sections */}
        <ScrollArea style={{ flex: 1, height: '100%' }}>
          {!selected && !loading && courses.length > 0 && (
            <Text size="sm" c="dimmed" mt="xl" ta="center">
              Select a course on the left to view its structure.
            </Text>
          )}

          {selected && (
            <Stack gap="sm" pr={4}>
              {/* Course header */}
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between" wrap="nowrap" mb="xs">
                  <div>
                    <Text fw={700}>{selected.fullname}</Text>
                    <Text size="xs" c="dimmed">
                      {selected.shortname}
                      {selected.startdate ? ` · ${ts2date(selected.startdate)} → ${ts2date(selected.enddate)}` : ''}
                    </Text>
                  </div>
                  <Badge color={libVersions.length > 0 ? 'green' : 'gray'} variant="light">
                    {libVersions.length > 0
                      ? `${libVersions.length} version${libVersions.length > 1 ? 's' : ''} in library`
                      : 'Not in library'}
                  </Badge>
                </Group>

                <Divider my="xs" />

                <Group gap="xs">
                  <Tooltip label="Pull section structure from Moodle API and save as a new library version">
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      leftSection={importing ? <Loader size="xs" /> : <IconDatabaseImport size={14} />}
                      onClick={importToLibrary}
                      disabled={importing}
                    >
                      {importing ? 'Importing…' : 'Import to Library'}
                    </Button>
                  </Tooltip>

                  <Tooltip label="Check Moodle's automated backup area for existing .mbz files">
                    <Button
                      size="xs"
                      variant="light"
                      color="violet"
                      leftSection={checkingBackup ? <Loader size="xs" /> : <IconArchive size={14} />}
                      onClick={checkBackups}
                      disabled={checkingBackup}
                    >
                      {checkingBackup ? 'Checking…' : 'Check for Backup'}
                    </Button>
                  </Tooltip>
                </Group>

                {/* Backup files list */}
                {backupFiles !== null && backupFiles.length > 0 && (
                  <Stack gap={4} mt="sm">
                    <Text size="xs" fw={500} c="violet">Backup files found:</Text>
                    {backupFiles.map(f => (
                      <Group key={f.filename} gap="xs" justify="space-between" wrap="nowrap">
                        <Text size="xs" style={{ flex: 1 }} lineClamp={1}>{f.filename}</Text>
                        <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                          <Text size="xs" c="dimmed">{f.size_kb} KB</Text>
                          <Text size="xs" c="dimmed">
                            {f.modified ? new Date(f.modified * 1000).toLocaleDateString() : ''}
                          </Text>
                          <Tooltip label="Download .mbz">
                            <ActionIcon
                              size="xs" color="green" variant="light"
                              component="a" href={f.download_url} download={f.filename}
                            >
                              <IconDownload size={12} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Parse this .mbz and save as a library version">
                            <ActionIcon
                              size="xs" color="blue" variant="light"
                              loading={addingBackup === f.filename}
                              onClick={() => addBackupToLibrary(f)}
                            >
                              <IconDatabaseImport size={12} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                )}

                {backupFiles !== null && backupFiles.length === 0 && (
                  <Text size="xs" c="dimmed" mt="xs">No automated backup files found in this course.</Text>
                )}
              </Paper>

              {/* Legend */}
              <Alert color="blue" icon={<IconCloud size={14} />} py="xs">
                <Group gap="xs">
                  {capBadge(true)} can be updated via API &nbsp;·&nbsp;
                  {capBadge(false)} requires .mbz restore
                </Group>
              </Alert>

              {/* Sections */}
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
        </ScrollArea>
      </Group>
    </Stack>
  )
}
