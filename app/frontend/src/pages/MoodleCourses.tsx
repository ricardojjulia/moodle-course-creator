import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  IconChartBar, IconAlertTriangle, IconUserCheck, IconUserOff,
} from '@tabler/icons-react'
import {
  api, type MoodleCourse, type MoodleSection,
  type MoodleActivity, type CourseVersion, type MoodleBackupFile,
  type GradeReport, type GradeColumn, type GradeCell,
  type CourseAnalytics,
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
  const { t } = useTranslation()
  const [libShortnames, setLibShortnames] = useState<Set<string>>(new Set())
  const [siteUsers,     setSiteUsers]     = useState<number | null>(null)
  const [activeUsers,   setActiveUsers]   = useState<number | null>(null)
  const [loading,       setLoading]       = useState(false)

  useEffect(() => {
    if (!opened) return
    setLoading(true)
    Promise.all([
      api.courses.list().then(list => setLibShortnames(new Set(list.map(c => c.shortname)))),
      api.moodle.stats().then(s => {
        if (s.total_users != null) setSiteUsers(s.total_users)
        if (s.active_30d  != null) setActiveUsers(s.active_30d)
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
          <Text fw={600} size="sm">{t('moodle.dash_title', { site: siteName })}</Text>
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
              label={t('moodle.dash_total_courses')}
              value={totalCourses}
              color="blue"
            />
            <StatCard
              icon={<IconCategory size={16} />}
              label={t('moodle.dash_total_cats')}
              value={totalCategories}
              color="teal"
            />
            <StatCard
              icon={<IconClock size={16} />}
              label={t('moodle.dash_avg_duration')}
              value={avgDays !== null ? `${avgDays}d` : '—'}
              color="violet"
              sub={avgDays !== null
                ? t('moodle.dash_weeks', { n: Math.round(avgDays / 7) })
                : t('moodle.dash_no_dates')}
            />
            <StatCard
              icon={<IconUsers size={16} />}
              label={t('moodle.dash_site_users')}
              value={siteUsers !== null ? siteUsers : '—'}
              color="orange"
              sub={siteUsers !== null
                ? t('moodle.dash_active_30', { n: activeUsers ?? '?' })
                : t('moodle.dash_no_users')}
            />
          </SimpleGrid>

          <Divider label={t('moodle.dash_lib_coverage')} labelPosition="center" />

          <Group grow align="flex-start" gap="sm">
            <StatCard
              icon={<IconFileCheck size={16} />}
              label={t('moodle.dash_imported')}
              value={inLibrary}
              color="green"
              sub={t('moodle.dash_pct_total', { pct: libPct })}
            />
            <StatCard
              icon={<IconFileX size={16} />}
              label={t('moodle.dash_not_imported')}
              value={notInLibrary}
              color="red"
              sub={t('moodle.dash_pct_total', { pct: 100 - libPct })}
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
                  <Text size="sm" fw={500}>{t('moodle.dash_lib_coverage')}</Text>
                  <Text size="xs" c="dimmed">
                    {t('moodle.dash_coverage_desc', { n: inLibrary, total: totalCourses })}
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
  const { t } = useTranslation()
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
      notifications.show({ title: t('common.error'), message: e.message, color: 'red' })
    }
  }

  const push = async () => {
    setPushing(true)
    try {
      await api.moodle.addDiscussion({ forum_id: activity.id, subject, message })
      notifications.show({ title: t('common.posted'), message: t('moodle.notif_forum_posted', { name: activity.name }), color: 'green' })
      onClose()
    } catch (e: any) {
      notifications.show({ title: t('common.failed'), message: e.message, color: 'red' })
    } finally {
      setPushing(false)
    }
  }

  return (
    <Stack>
      <Text size="sm">{t('moodle.forum_posting_to')} <strong>{activity.name}</strong></Text>
      <Group grow>
        <Select label={t('moodle.forum_lib_version')} data={versionOptions} value={versionId} onChange={setVersionId} />
        <Select label={t('moodle.forum_module')} data={['1','2','3','4','5'].map(n => ({ value: n, label: t('moodle.forum_module_n', { n }) }))}
                value={moduleNum} onChange={setModuleNum} />
      </Group>
      <Button size="xs" variant="light" onClick={loadPrompt} disabled={!versionId || !moduleNum}>
        {t('moodle.forum_load_prompt')}
      </Button>
      <Textarea label={t('moodle.forum_subject')} value={subject} onChange={e => setSubject(e.target.value)} />
      <Textarea label={t('moodle.forum_message')} minRows={4} autosize value={message} onChange={e => setMessage(e.target.value)} />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onClose}>{t('common.cancel')}</Button>
        <Button leftSection={pushing ? <Loader size="xs" /> : <IconSend size={14} />}
                onClick={push} disabled={pushing || !subject || !message}>
          {t('moodle.forum_post')}
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
  const { t } = useTranslation()
  const [forumModal, setForumModal] = useState<MoodleActivity | null>(null)

  return (
    <>
      <Paper withBorder p="sm" radius="md">
        <Text fw={600} size="sm" mb="xs">
          {section.section === 0 ? t('moodle.general_section') : t('moodle.week_n', { n: section.section })} · {section.name}
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
                    <Tooltip label={t('moodle.tt_post_discussion')}>
                      <ActionIcon size="xs" variant="light" color="blue"
                                  onClick={() => setForumModal(act)}>
                        <IconSend size={12} />
                      </ActionIcon>
                    </Tooltip>
                  ) : !act.api_updatable ? (
                    <Tooltip label={t('moodle.tt_requires_mbz')}>
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
             title={t('moodle.forum_modal_title')} size="lg">
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
  const { t } = useTranslation()
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

  if (loading) return <Stack align="center" py="xl"><Loader /><Text size="sm" c="dimmed">{t('moodle.grades_loading')}</Text></Stack>
  if (error)   return <Alert color="red" title={t('moodle.grades_error')}>{error}</Alert>
  if (!report || report.rows.length === 0)
    return <Text size="sm" c="dimmed" ta="center" py="xl">{t('moodle.grades_empty')}</Text>

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
              {t('moodle.grades_student')}
            </Table.Th>
            {nonTotal.map(col => (
              <Table.Th key={col.id} style={{ minWidth: 110, textAlign: 'center' }}>
                <Text size="xs" fw={600} lineClamp={2}>{col.name}</Text>
                {col.module && <Badge size="xs" variant="dot" color="gray">{col.module}</Badge>}
              </Table.Th>
            ))}
            {total && (
              <Table.Th style={{ minWidth: 110, textAlign: 'center', background: 'var(--mantine-color-gray-0)' }}>
                <Text size="xs" fw={700}>{t('moodle.grades_total')}</Text>
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

// ── Analytics panel ───────────────────────────────────────────────────────────

function AnalyticsPanel({ courseId, shortname }: { courseId: number; shortname: string }) {
  const { t } = useTranslation()
  const [data,    setData]    = useState<CourseAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.moodle.analytics(courseId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [courseId])

  if (loading) return <Stack align="center" py="xl"><Loader /><Text size="sm" c="dimmed">{t('moodle.analytics_loading')}</Text></Stack>
  if (error)   return <Alert color="red" title={t('moodle.analytics_error')} icon={<IconAlertTriangle size={14} />}>{error}</Alert>
  if (!data)   return null

  const enr = data.enrollment
  const dist = data.grade_distribution
  const total = Object.values(dist).reduce((a, b) => a + b, 0)

  const GRADE_COLORS: Record<string, string> = {
    A: 'green', B: 'teal', C: 'blue', D: 'yellow', F: 'red',
  }

  const weakQuizzes = (data.quizzes || []).filter(q => q.pass_rate !== null && q.pass_rate < 70)

  return (
    <Stack gap="md">
      {/* Enrollment stats */}
      <SimpleGrid cols={4} spacing="sm">
        <StatCard
          icon={<IconUsers size={16} />}
          label={t('moodle.enrolled')}
          value={enr.total}
          color="blue"
        />
        <StatCard
          icon={<IconUserCheck size={16} />}
          label={t('moodle.active_30d')}
          value={enr.active_30d}
          color="green"
          sub={enr.total > 0 ? `${Math.round(enr.active_30d / enr.total * 100)}%` : undefined}
        />
        <StatCard
          icon={<IconChartBar size={16} />}
          label={t('moodle.pass_rate')}
          value={data.pass_rate !== null ? `${data.pass_rate}%` : '—'}
          color={data.pass_rate !== null && data.pass_rate >= 70 ? 'green' : 'red'}
          sub={data.avg_grade !== null ? t('moodle.avg_pct', { n: data.avg_grade }) : undefined}
        />
        <StatCard
          icon={<IconUserOff size={16} />}
          label={t('moodle.never_accessed')}
          value={enr.never_accessed}
          color={enr.never_accessed > 0 ? 'orange' : 'gray'}
        />
      </SimpleGrid>

      {/* Grade distribution */}
      {total > 0 && (
        <Paper withBorder p="md" radius="md">
          <Text size="sm" fw={600} mb="sm">{t('moodle.grade_dist', { count: data.student_count })}</Text>
          <Stack gap={6}>
            {(['A','B','C','D','F'] as const).map(letter => {
              const count = dist[letter]
              const pct   = total > 0 ? Math.round(count / total * 100) : 0
              return (
                <Group key={letter} gap="sm" wrap="nowrap">
                  <Badge size="sm" color={GRADE_COLORS[letter]} w={28} ta="center">{letter}</Badge>
                  <Box style={{ flex: 1 }}>
                    <Progress value={pct} color={GRADE_COLORS[letter]} size="md" />
                  </Box>
                  <Text size="xs" w={60} ta="right">{count} ({pct}%)</Text>
                </Group>
              )
            })}
          </Stack>
        </Paper>
      )}

      {data.grades_error && (
        <Alert color="orange" title={t('moodle.grades_unavail')} py="xs">{data.grades_error}</Alert>
      )}

      {/* Quiz performance */}
      {(data.quizzes || []).length > 0 && (
        <Paper withBorder p="md" radius="md">
          <Text size="sm" fw={600} mb="sm">{t('moodle.quiz_perf')}</Text>
          <Table withTableBorder highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('moodle.quiz_name')}</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>{t('moodle.quiz_attempts')}</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>{t('moodle.quiz_avg_grade')}</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>{t('moodle.quiz_pass_rate')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(data.quizzes || []).map(q => (
                <Table.Tr key={q.id}>
                  <Table.Td><Text size="xs">{q.name}</Text></Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Text size="xs">{q.attempt_count}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge size="sm" color={q.avg_grade !== null && q.avg_grade >= 70 ? 'green' : 'red'} variant="light">
                      {q.avg_grade !== null ? `${q.avg_grade}%` : '—'}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge size="sm" color={q.pass_rate !== null && q.pass_rate >= 70 ? 'green' : 'orange'} variant="light">
                      {q.pass_rate !== null ? `${q.pass_rate}%` : '—'}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Weak areas */}
      {weakQuizzes.length > 0 && (
        <Alert color="orange" title={t('moodle.weak_areas', { count: weakQuizzes.length })}
               icon={<IconAlertTriangle size={14} />}>
          <Text size="xs">
            {t('moodle.weak_desc')}{' '}
            {weakQuizzes.map(q => q.name).join(', ')}
          </Text>
          {shortname && (
            <Text size="xs" mt={4} c="dimmed">
              {t('moodle.weak_regen')}
            </Text>
          )}
        </Alert>
      )}

      {data.enrollment_error && (
        <Alert color="orange" title={t('moodle.enrollment_unavail')} py="xs">{data.enrollment_error}</Alert>
      )}
      {data.quizzes_error && (
        <Alert color="orange" title={t('moodle.quiz_unavail')} py="xs">{data.quizzes_error}</Alert>
      )}
    </Stack>
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
  const { t } = useTranslation()
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
  const [viewMode, setViewMode]         = useState<'structure' | 'grades' | 'analytics'>('structure')

  const loadCourses = () => {
    setLoading(true)
    setCheckedIds(new Set())
    api.moodle.ping()
      .then(info => setSiteName(info.site_name))
      .catch(() => {})
    api.moodle.courses()
      .then(setCourses)
      .catch(e => notifications.show({ title: t('moodle.notif_moodle_error'), message: e.message, color: 'red' }))
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
      notifications.show({ title: t('common.error'), message: e.message, color: 'red' })
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
        title: t('common.imported'),
        message: t('moodle.notif_imported', { shortname: selected.shortname }),
        color: 'green',
        icon: <IconCheck />,
      })
      const vers = await api.courses.versions(selected.shortname)
      setLibVersions(vers)
    } catch (e: any) {
      notifications.show({ title: t('moodle.notif_import_failed'), message: e.message, color: 'red', icon: <IconX /> })
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
        notifications.show({ title: t('moodle.notif_no_backups'), message: t('moodle.notif_no_backups_desc'), color: 'blue' })
      }
    } catch (e: any) {
      notifications.show({ title: t('moodle.notif_check_failed'), message: e.message, color: 'red' })
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
        title: t('moodle.notif_backup_added_title'),
        message: t('moodle.notif_backup_added', { filename: file.filename }),
        color: 'green',
        icon: <IconCheck />,
      })
      if (selected) {
        const vers = await api.courses.versions(selected.shortname)
        setLibVersions(vers)
      }
    } catch (e: any) {
      notifications.show({ title: t('moodle.notif_import_failed'), message: e.message, color: 'red', icon: <IconX /> })
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
        notifications.show({ title: t('common.all_caught_up'), message: t('moodle.notif_all_in_library'), color: 'green' })
      } else {
        notifications.show({
          title: t('moodle.notif_missing_selected', { count: missingIds.length }),
          message: t('moodle.notif_missing_desc'),
          color: 'blue',
        })
      }
    } catch (e: any) {
      notifications.show({ title: t('common.error'), message: e.message, color: 'red' })
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
      title: errCount > 0 ? t('moodle.notif_batch_partial', { n: errCount }) : t('moodle.notif_batch_complete'),
      message: errCount > 0
        ? t('moodle.notif_batch_partial_desc', { imported: finalItems.length - errCount, failed: errCount })
        : t('moodle.notif_batch_done', { count: finalItems.length }),
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
          <Title order={3}>{t('moodle.title')}</Title>
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
            <Tooltip label={t('moodle.select_missing_tt')}>
              <Button
                variant="light" size="xs" color="teal"
                leftSection={detectingMissing ? <Loader size="xs" /> : <IconMagnet size={16} />}
                onClick={selectMissing}
                disabled={detectingMissing || loading}
              >
                {t('moodle.select_missing')}
              </Button>
            </Tooltip>
          )}
          <Button variant="subtle" size="xs"
                  leftSection={loading ? <Loader size="xs" /> : <IconRefresh size={16} />}
                  onClick={loadCourses} disabled={loading}>
            {t('common.refresh')}
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
                  {t('moodle.importing_progress', { done: batchDone, total: batchTotal })}
                </Text>
                <Text size="xs" c="dimmed">
                  {t('moodle.errors_count', { count: batchErrors.length })}
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
                  {t('moodle.failed_to_import', { count: batchErrors.length })}
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
                    {t('moodle.retry_failed')}
                  </Button>
                  <Button size="xs" variant="subtle" onClick={() => setBatchItems([])}>
                    {t('common.dismiss')}
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
                {t('moodle.n_selected', { count: checkedIds.size })}
              </Text>
              <Group gap="xs">
                <Button size="xs" variant="subtle" onClick={toggleAll}>
                  {checkedIds.size === courses.length ? t('moodle.deselect_all') : t('moodle.select_all')}
                </Button>
                <Button
                  size="xs"
                  leftSection={<IconDatabaseImport size={14} />}
                  onClick={runBatchImport}
                >
                  {t('moodle.import_selected')}
                </Button>
              </Group>
            </Group>
          )}
        </Paper>
      )}

      {!loading && courses.length === 0 && (
        <Alert color="orange" title={t('moodle.no_courses_title')}>
          {t('moodle.no_courses_desc')}
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
                  <Tooltip label={t('moodle.view_instance_stats')} position="right" withArrow>
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
              {t('moodle.select_to_view')}
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
                      ? t('moodle.in_library', { count: libVersions.length })
                      : t('moodle.not_in_library')}
                  </Badge>
                </Group>

                <Divider my="xs" />

                <Group gap="xs">
                  <Tooltip label={t('moodle.tt_import_to_lib')}>
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      leftSection={importing ? <Loader size="xs" /> : <IconDatabaseImport size={14} />}
                      onClick={importToLibrary}
                      disabled={importing}
                    >
                      {importing ? t('common.importing') : t('moodle.import_btn')}
                    </Button>
                  </Tooltip>

                  <Tooltip label={t('moodle.tt_check_backup')}>
                    <Button
                      size="xs"
                      variant="light"
                      color="violet"
                      leftSection={checkingBackup ? <Loader size="xs" /> : <IconArchive size={14} />}
                      onClick={checkBackups}
                      disabled={checkingBackup}
                    >
                      {checkingBackup ? t('common.checking') : t('moodle.check_backup')}
                    </Button>
                  </Tooltip>
                </Group>

                {/* Backup files list */}
                {backupFiles !== null && backupFiles.length > 0 && (
                  <Stack gap={4} mt="sm">
                    <Text size="xs" fw={500} c="violet">{t('moodle.backup_files')}</Text>
                    {backupFiles.map(f => (
                      <Group key={f.filename} gap="xs" justify="space-between" wrap="nowrap">
                        <Text size="xs" style={{ flex: 1 }} lineClamp={1}>{f.filename}</Text>
                        <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                          <Text size="xs" c="dimmed">{f.size_kb} KB</Text>
                          <Text size="xs" c="dimmed">
                            {f.modified ? new Date(f.modified * 1000).toLocaleDateString() : ''}
                          </Text>
                          <Tooltip label={t('moodle.tt_download_mbz')}>
                            <ActionIcon
                              size="xs" color="green" variant="light"
                              component="a" href={f.download_url} download={f.filename}
                            >
                              <IconDownload size={12} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t('moodle.tt_parse_mbz')}>
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
                  <Text size="xs" c="dimmed" mt="xs">{t('moodle.no_backup')}</Text>
                )}
              </Paper>

              {/* View toggle */}
              <SegmentedControl
                size="xs"
                value={viewMode}
                onChange={v => setViewMode(v as 'structure' | 'grades' | 'analytics')}
                data={[
                  { value: 'structure', label: t('moodle.view_structure') },
                  { value: 'grades',    label: <Group gap={4}><IconReportAnalytics size={13} />{t('moodle.view_grades')}</Group> },
                  { value: 'analytics', label: <Group gap={4}><IconChartBar size={13} />{t('moodle.view_analytics')}</Group> },
                ]}
              />

              {/* Structure view */}
              {viewMode === 'structure' && (
                <>
                  <Alert color="blue" icon={<IconCloud size={14} />} py="xs">
                    <Group gap="xs">
                      {capBadge(true)} {t('moodle.api_note')} &nbsp;·&nbsp;
                      {capBadge(false)} {t('moodle.mbz_note')}
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

              {/* Analytics view */}
              {viewMode === 'analytics' && (
                <AnalyticsPanel courseId={selected.id} shortname={selected.shortname} />
              )}
            </Stack>
          )}
        </ScrollArea>
      </Group>
    </Stack>
  )
}
