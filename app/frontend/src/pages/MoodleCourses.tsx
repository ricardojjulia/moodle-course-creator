import { useEffect, useState } from 'react'
import {
  Stack, Title, Text, Badge, Group, Button, Select,
  Paper, Loader, Alert, Table, ActionIcon,
  Tooltip, Modal, Textarea, ScrollArea, Divider,
  ThemeIcon, Checkbox, Progress, Box, Collapse,
  SegmentedControl, SimpleGrid, RingProgress, Center,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconRefresh, IconCloud, IconCheck, IconX,
  IconSend, IconLock, IconLockOpen, IconDownload,
  IconDatabaseImport, IconArchive,
  IconChevronDown, IconChevronRight,
  IconReportAnalytics,
  IconBook2, IconCategory, IconClock, IconUsers,
  IconFileCheck, IconFileX, IconMagnet,
} from '@tabler/icons-react'
import {
  api, type MoodleCourse, type MoodleSection,
  type MoodleActivity, type CourseVersion, type MoodleBackupFile,
  type GradeReport, type GradeColumn, type GradeCell,
} from '../api/client'

const ts2date = (ts: number) => ts ? new Date(ts * 1000).toISOString().slice(0, 10) : ''

function capBadge(canPush: boolean) {
  return canPush
    ? <Badge size="xs" color="green" leftSection={<IconLockOpen size={10} />}>API</Badge>
    : <Badge size="xs" color="gray"  leftSection={<IconLock size={10} />}>.mbz</Badge>
}

// ── Shared stat card ─────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  color: string
  sub?: string
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon size="lg" variant="light" color={color} style={{ flexShrink: 0 }}>
          {icon}
        </ThemeIcon>
        <Box>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" lts={0.5}>{label}</Text>
          <Text fw={700} size="xl" lh={1.2}>{value}</Text>
          {sub && <Text size="xs" c="dimmed" mt={2}>{sub}</Text>}
        </Box>
      </Group>
    </Paper>
  )
}

// ── Moodle instance dashboard modal ──────────────────────────────────────────

function MoodleInstanceDashboard({ siteName, courses, catGroups, opened, onClose }: {
  siteName: string
  courses: MoodleCourse[]
  catGroups: Record<string, MoodleCourse[]>
  opened: boolean
  onClose: () => void
}) {
  const [libShortnames, setLibShortnames] = useState<Set<string>>(new Set())
  const [avgUsers,      setAvgUsers]      = useState<number | null>(null)
  const [loading,       setLoading]       = useState(false)

  useEffect(() => {
    if (!opened) return
    setLoading(true)
    Promise.all([
      api.courses.list().then(list => setLibShortnames(new Set(list.map(c => c.shortname)))),
      api.moodle.stats().then(s => {
        if (s.total_users != null && courses.length > 0)
          setAvgUsers(Math.round(s.total_users / courses.length))
      }).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [opened])

  const totalCourses     = courses.length
  const totalCategories  = Object.keys(catGroups).length
  const inLibrary        = courses.filter(c => libShortnames.has(c.shortname)).length
  const notInLibrary     = totalCourses - inLibrary
  const libPct           = totalCourses > 0 ? Math.round((inLibrary / totalCourses) * 100) : 0

  const coursesWithDates = courses.filter(c => c.startdate && c.enddate && c.enddate > c.startdate)
  const avgDays = coursesWithDates.length > 0
    ? Math.round(coursesWithDates.reduce((s, c) => s + (c.enddate - c.startdate) / 86400, 0) / coursesWithDates.length)
    : null

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color="blue">
            <IconCloud size={14} />
          </ThemeIcon>
          <Text fw={600} size="sm">{siteName} — Course Evaluator</Text>
        </Group>
      }
      size="lg"
    >
      {loading && <Center py="xl"><Loader size="sm" /></Center>}

      {!loading && (
        <Stack gap="md">
          <SimpleGrid cols={2} spacing="sm">
            <StatCard
              icon={<IconBook2 size={16} />}
              label="Total Courses"
              value={totalCourses}
              color="blue"
            />
            <StatCard
              icon={<IconCategory size={16} />}
              label="Total Categories"
              value={totalCategories}
              color="teal"
            />
            <StatCard
              icon={<IconClock size={16} />}
              label="Avg Course Duration"
              value={avgDays !== null ? `${avgDays}d` : '—'}
              color="violet"
              sub={avgDays !== null
                ? `≈ ${Math.round(avgDays / 7)} weeks`
                : 'No date data available'}
            />
            <StatCard
              icon={<IconUsers size={16} />}
              label="Avg Users / Course"
              value={avgUsers !== null ? avgUsers : '—'}
              color="orange"
              sub={avgUsers !== null ? 'Site users ÷ total courses' : 'Could not retrieve'}
            />
          </SimpleGrid>

          <Divider label="Library Coverage" labelPosition="center" />

          <Group grow align="flex-start" gap="sm">
            <StatCard
              icon={<IconFileCheck size={16} />}
              label="Imported to Library"
              value={inLibrary}
              color="green"
              sub={`${libPct}% of total`}
            />
            <StatCard
              icon={<IconFileX size={16} />}
              label="Not in Library"
              value={notInLibrary}
              color="red"
              sub={`${100 - libPct}% of total`}
            />
          </Group>

          {totalCourses > 0 && (
            <Paper withBorder p="sm" radius="md">
              <Group gap="md" align="center">
                <RingProgress
                  size={72}
                  thickness={8}
                  sections={[
                    { value: libPct,       color: 'green' },
                    { value: 100 - libPct, color: 'red'   },
                  ]}
                  label={<Text ta="center" size="xs" fw={700}>{libPct}%</Text>}
                />
                <Box>
                  <Text size="sm" fw={500}>Library Coverage</Text>
                  <Text size="xs" c="dimmed">
                    {inLibrary} of {totalCourses} courses have been imported to the local library
                  </Text>
                </Box>
              </Group>
            </Paper>
          )}
        </Stack>
      )}
    </Modal>
  )
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

// ── Grades panel ─────────────────────────────────────────────────────────────

function gradeColor(pct: number | null): string {
  if (pct === null) return 'gray'
  if (pct >= 90)   return 'green'
  if (pct >= 70)   return 'blue'
  if (pct >= 50)   return 'yellow'
  return 'red'
}

function GradesPanel({ courseId }: { courseId: number }) {
  const [report,  setReport]  = useState<GradeReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.moodle.grades(courseId)
      .then(setReport)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading) return <Stack align="center" py="xl"><Loader /><Text size="sm" c="dimmed">Loading grades…</Text></Stack>
  if (error)   return <Alert color="red" title="Could not load grades">{error}</Alert>
  if (!report || report.rows.length === 0)
    return <Text size="sm" c="dimmed" ta="center" py="xl">No grade data available for this course.</Text>

  const nonTotal = report.columns.filter(c => !c.is_total)
  const total    = report.columns.find(c => c.is_total)

  const CellBadge = ({ cell }: { cell: GradeCell }) => (
    <Badge
      size="sm"
      variant={cell.raw === null ? 'outline' : 'light'}
      color={gradeColor(cell.percentage)}
      style={{ minWidth: 60, fontWeight: 500 }}
    >
      {cell.formatted === '-' ? '—' : cell.formatted}
    </Badge>
  )

  return (
    <ScrollArea>
      <Table withTableBorder withColumnBorders highlightOnHover style={{ minWidth: 600 }}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ minWidth: 160, position: 'sticky', left: 0, background: 'var(--mantine-color-body)', zIndex: 1 }}>
              Student
            </Table.Th>
            {nonTotal.map(col => (
              <Table.Th key={col.id} style={{ minWidth: 110, textAlign: 'center' }}>
                <Text size="xs" fw={600} lineClamp={2}>{col.name}</Text>
                {col.module && <Badge size="xs" variant="dot" color="gray">{col.module}</Badge>}
              </Table.Th>
            ))}
            {total && (
              <Table.Th style={{ minWidth: 110, textAlign: 'center', background: 'var(--mantine-color-gray-0)' }}>
                <Text size="xs" fw={700}>Total</Text>
              </Table.Th>
            )}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {report.rows.map(row => {
            const nonTotalCells = row.cells.slice(0, nonTotal.length)
            const totalCell     = total ? row.cells[nonTotal.length] : null
            return (
              <Table.Tr key={row.userid}>
                <Table.Td style={{ position: 'sticky', left: 0, background: 'var(--mantine-color-body)', zIndex: 1 }}>
                  <Text size="xs" fw={500}>{row.fullname}</Text>
                </Table.Td>
                {nonTotalCells.map((cell, i) => (
                  <Table.Td key={i} style={{ textAlign: 'center' }}>
                    <CellBadge cell={cell} />
                  </Table.Td>
                ))}
                {totalCell && (
                  <Table.Td style={{ textAlign: 'center', background: 'var(--mantine-color-gray-0)' }}>
                    <CellBadge cell={totalCell} />
                  </Table.Td>
                )}
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}

// ── Category group in the left panel ─────────────────────────────────────────

interface MoodleCategoryGroupProps {
  name: string
  courses: MoodleCourse[]
  selected: MoodleCourse | null
  checkedIds: Set<number>
  onSelect: (c: MoodleCourse) => void
  onToggleId: (id: number) => void
  onToggleSet: (ids: number[], on: boolean) => void
}

function MoodleCategoryGroup({
  name, courses, selected, checkedIds,
  onSelect, onToggleId, onToggleSet,
}: MoodleCategoryGroupProps) {
  const [open, setOpen] = useState(false)
  const checkedHere = courses.filter(c => checkedIds.has(c.id)).length
  const allChecked  = checkedHere === courses.length && courses.length > 0
  const someChecked = checkedHere > 0 && !allChecked
  const ids = courses.map(c => c.id)

  return (
    <Box>
      <Group
        gap="xs" mt={4} mb={2} px={4} pl={8}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <Checkbox
          size="xs"
          checked={allChecked}
          indeterminate={someChecked}
          onClick={e => e.stopPropagation()}
          onChange={e => onToggleSet(ids, e.currentTarget.checked)}
        />
        <Text size="xs" fw={500} c="dimmed" style={{ flex: 1 }} lineClamp={1}>{name}</Text>
        <Badge size="xs" variant="dot" color="gray">{courses.length}</Badge>
        <ActionIcon size="xs" variant="subtle" color="gray">
          {open ? <IconChevronDown size={10} /> : <IconChevronRight size={10} />}
        </ActionIcon>
      </Group>

      <Collapse in={open}>
        <Stack gap={2} pl={12}>
          {courses.map(c => (
            <Group key={c.id} gap={4} wrap="nowrap">
              <Checkbox
                size="xs"
                checked={checkedIds.has(c.id)}
                onChange={() => onToggleId(c.id)}
                onClick={e => e.stopPropagation()}
              />
              <Paper
                withBorder px="sm" py={6} radius="sm"
                style={{
                  cursor: 'pointer', flex: 1,
                  background: selected?.id === c.id
                    ? 'var(--mantine-color-blue-0)' : undefined,
                  borderColor: selected?.id === c.id
                    ? 'var(--mantine-color-blue-4)' : undefined,
                }}
                onClick={() => onSelect(c)}
              >
                <Box miw={0}>
                  <Text size="xs" fw={500} lineClamp={2}>{c.fullname}</Text>
                  <Text size="xs" c="dimmed">{c.shortname}</Text>
                </Box>
              </Paper>
            </Group>
          ))}
        </Stack>
      </Collapse>
    </Box>
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
  const [instanceOpen, setInstanceOpen] = useState(true)
  const [dashOpen, setDashOpen]         = useState(false)

  // Detail view mode
  const [viewMode, setViewMode]         = useState<'structure' | 'grades'>('structure')

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
    setViewMode('structure')
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
        category:   selected.category_name,
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

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSet = (ids: number[], on: boolean) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      ids.forEach(id => on ? next.add(id) : next.delete(id))
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

  const [detectingMissing, setDetectingMissing] = useState(false)

  const selectMissing = async () => {
    setDetectingMissing(true)
    try {
      const libCourses = await api.courses.list()
      const libShortnames = new Set(libCourses.map(c => c.shortname))
      const missingIds = courses
        .filter(c => !libShortnames.has(c.shortname))
        .map(c => c.id)
      setCheckedIds(new Set(missingIds))
      if (missingIds.length === 0) {
        notifications.show({ title: 'All caught up', message: 'Every course is already in the library.', color: 'green' })
      } else {
        notifications.show({
          title: `${missingIds.length} missing course${missingIds.length !== 1 ? 's' : ''} selected`,
          message: 'Ready to import — click "Import selected to library"',
          color: 'blue',
        })
      }
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setDetectingMissing(false)
    }
  }

  // Group by category for left-panel hierarchy
  const catGroups = courses.reduce<Record<string, MoodleCourse[]>>((acc, c) => {
    const cat = c.category_name || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(c)
    return acc
  }, {})

  const sortedCats = Object.keys(catGroups).sort((a, b) => {
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })

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
          category:   item.course.category_name,
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
    // Don't clear batchItems — keep failures visible until user dismisses
    const finalItems = items  // captured before state update
    const errCount = finalItems.filter(i => i.status === 'error').length
    notifications.show({
      title: errCount > 0 ? `Import complete — ${errCount} failed` : 'Batch import complete',
      message: errCount > 0
        ? `${finalItems.length - errCount} imported, ${errCount} failed — see error list below`
        : `${finalItems.length} course${finalItems.length !== 1 ? 's' : ''} imported`,
      color: errCount > 0 ? 'orange' : 'green',
    })
  }

  const batchDone    = batchItems.filter(i => i.status === 'done').length
  const batchErrors  = batchItems.filter(i => i.status === 'error')
  const batchTotal   = batchItems.length

  const PANEL_HEIGHT = 'calc(100vh - 170px)'

  return (
    <Stack gap="sm" style={{ height: PANEL_HEIGHT, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <Group justify="space-between" wrap="nowrap" style={{ flexShrink: 0 }}>
        <div>
          <Title order={3}>Instance Course Catalog</Title>
          {siteName && (
            <Group gap={6} mt={2}>
              <ThemeIcon size="xs" color="blue" variant="light">
                <IconCloud size={10} />
              </ThemeIcon>
              <Text size="xs" c="dimmed">{siteName}</Text>
            </Group>
          )}
        </div>
        <Group gap="xs">
          {courses.length > 0 && (
            <Tooltip label="Auto-select courses not yet in the library">
              <Button
                variant="light" size="xs" color="teal"
                leftSection={detectingMissing ? <Loader size="xs" /> : <IconMagnet size={16} />}
                onClick={selectMissing}
                disabled={detectingMissing || loading}
              >
                Select Missing
              </Button>
            </Tooltip>
          )}
          <Button variant="subtle" size="xs"
                  leftSection={loading ? <Loader size="xs" /> : <IconRefresh size={16} />}
                  onClick={loadCourses} disabled={loading}>
            Refresh
          </Button>
        </Group>
      </Group>

      {/* ── Batch action bar ──────────────────────────────────────────── */}
      {(checkedIds.size > 0 || batching || batchErrors.length > 0) && (
        <Paper withBorder p="xs" radius="md"
               style={{
                 background: batchErrors.length > 0 && !batching
                   ? 'var(--mantine-color-orange-0)'
                   : 'var(--mantine-color-blue-0)',
                 flexShrink: 0,
               }}>
          {batching ? (
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Importing {batchDone} / {batchTotal}…
                </Text>
                <Text size="xs" c="dimmed">
                  {batchErrors.length} errors
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
          ) : batchErrors.length > 0 && checkedIds.size === 0 ? (
            <Stack gap={6}>
              <Group justify="space-between">
                <Text size="sm" fw={600} c="orange">
                  {batchErrors.length} course{batchErrors.length !== 1 ? 's' : ''} failed to import
                </Text>
                <Group gap="xs">
                  <Button
                    size="xs" variant="light" color="orange"
                    leftSection={<IconDatabaseImport size={14} />}
                    onClick={() => {
                      setCheckedIds(new Set(batchErrors.map(i => i.course.id)))
                      setBatchItems([])
                    }}
                  >
                    Retry failed
                  </Button>
                  <Button size="xs" variant="subtle" onClick={() => setBatchItems([])}>
                    Dismiss
                  </Button>
                </Group>
              </Group>
              <Group gap={4} wrap="wrap">
                {batchErrors.map(item => (
                  <Tooltip key={item.course.id} label={item.error || 'Unknown error'} withArrow>
                    <Badge size="xs" color="red" style={{ cursor: 'default' }}>
                      {item.course.shortname}
                    </Badge>
                  </Tooltip>
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

        {/* Left: instance → category → course hierarchy */}
        <ScrollArea style={{ width: 300, flexShrink: 0, height: '100%' }} pr={4}>
          <Stack gap={2}>
            {loading && <Loader size="sm" />}

            {!loading && courses.length > 0 && (
              <Box>
                {/* Instance header */}
                <Group
                  gap="xs" mt="xs" mb={2} px={4}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setInstanceOpen(o => !o)}
                >
                  <Checkbox
                    size="xs"
                    checked={checkedIds.size === courses.length && courses.length > 0}
                    indeterminate={checkedIds.size > 0 && checkedIds.size < courses.length}
                    onClick={e => e.stopPropagation()}
                    onChange={toggleAll}
                  />
                  <ThemeIcon size="sm" variant="light" color="blue">
                    <IconCloud size={12} />
                  </ThemeIcon>
                  <Tooltip label="View instance stats" position="right" withArrow>
                    <Text
                      fw={600} size="sm" c="blue"
                      style={{ flex: 1, cursor: 'pointer', textDecoration: 'underline dotted' }}
                      lineClamp={1}
                      onClick={e => { e.stopPropagation(); setDashOpen(true) }}
                    >
                      {siteName || 'Moodle'}
                    </Text>
                  </Tooltip>
                  <Badge size="xs" variant="outline" color="blue">{courses.length}</Badge>
                  <ActionIcon size="xs" variant="subtle" color="gray">
                    {instanceOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                  </ActionIcon>
                </Group>

                <MoodleInstanceDashboard
                  siteName={siteName || 'Moodle'}
                  courses={courses}
                  catGroups={catGroups}
                  opened={dashOpen}
                  onClose={() => setDashOpen(false)}
                />

                {/* Category groups */}
                <Collapse in={instanceOpen}>
                  <Stack gap={0}>
                    {sortedCats.map(cat => (
                      <MoodleCategoryGroup
                        key={cat}
                        name={cat}
                        courses={catGroups[cat]}
                        selected={selected}
                        checkedIds={checkedIds}
                        onSelect={selectCourse}
                        onToggleId={toggleCheck}
                        onToggleSet={toggleSet}
                      />
                    ))}
                  </Stack>
                </Collapse>
              </Box>
            )}
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

              {/* View toggle */}
              <SegmentedControl
                size="xs"
                value={viewMode}
                onChange={v => setViewMode(v as 'structure' | 'grades')}
                data={[
                  { value: 'structure', label: 'Structure' },
                  { value: 'grades',    label: <Group gap={4}><IconReportAnalytics size={13} />Grades</Group> },
                ]}
              />

              {/* Structure view */}
              {viewMode === 'structure' && (
                <>
                  <Alert color="blue" icon={<IconCloud size={14} />} py="xs">
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
                </>
              )}

              {/* Grades view */}
              {viewMode === 'grades' && (
                <GradesPanel courseId={selected.id} />
              )}
            </Stack>
          )}
        </ScrollArea>
      </Group>
    </Stack>
  )
}
