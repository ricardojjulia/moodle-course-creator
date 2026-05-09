import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Stack, Title, Text, Badge, Group, Button,
  Loader, Alert, ActionIcon, Tooltip, Paper,
  ThemeIcon, Divider, Box, Checkbox, Collapse,
  Progress, ScrollArea, Modal, Select, TextInput, Anchor,
  SimpleGrid, RingProgress, Center, Accordion, Table,
} from '@mantine/core'
import {
  IconDownload, IconBuildingArch,
  IconRefresh, IconTrash, IconCheck, IconX, IconMagnet,
  IconCloud, IconHome,
  IconChevronDown, IconChevronRight, IconUpload,
  IconCloudUpload, IconExternalLink,
  IconBook2, IconCategory, IconClock, IconGitBranch,
  IconStack, IconSearch, IconGitCompare, IconPrinter, IconFileWord,
  IconChartBar, IconArrowUp, IconArrowDown, IconMinus, IconBrain,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api, type Course, type CourseVersion, type InstanceStats, type PersistedReview, type MoodleDeploy } from '../api/client'
import { CourseViewer } from '../components/CourseViewer'
import { VersionDiff } from '../components/VersionDiff'

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

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

// ── Course detail panel ───────────────────────────────────────────────────────

// ── Course Progress Report ────────────────────────────────────────────────────

type CheckStatus = 'Passed' | 'Needs Revision' | 'Missing'
const STATUS_COLOR: Record<CheckStatus, string> = {
  'Passed': 'green', 'Needs Revision': 'orange', 'Missing': 'red',
}

function flatChecks(r: PersistedReview): Map<string, CheckStatus> {
  const map = new Map<string, CheckStatus>()
  for (const sec of r.sections ?? [])
    for (const item of sec.items ?? [])
      map.set(item.label, item.status as CheckStatus)
  return map
}

function CourseProgressReport({ reviews }: { reviews: PersistedReview[] }) {
  const sorted = useMemo(() => [...reviews].sort((a, b) => a.run_at.localeCompare(b.run_at)), [reviews])

  // Group chronologically by agent
  const byAgent = useMemo(() => {
    const map = new Map<string, PersistedReview[]>()
    for (const r of sorted) {
      const key = r.agent_id || r.agent_label
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return map
  }, [sorted])

  // Unique review timestamps (columns in timeline)
  const allDates = useMemo(() => [...new Set(sorted.map(r => r.run_at))], [sorted])

  if (reviews.length === 0) {
    return (
      <Stack align="center" py="xl" gap="xs">
        <Text size="sm" c="dimmed">No reviews stored yet for this course.</Text>
        <Text size="xs" c="dimmed">Run an Autonomous Review — every result is saved automatically.</Text>
      </Stack>
    )
  }

  return (
    <Stack gap="xl">

      {/* ── Score Timeline ── */}
      <Box>
        <Text fw={700} size="sm" mb="sm">Score Timeline</Text>
        <ScrollArea>
          <Table withTableBorder withColumnBorders fz="xs" style={{ minWidth: 420 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ minWidth: 140 }}>Agent</Table.Th>
                {allDates.map(d => (
                  <Table.Th key={d} ta="center">
                    <Text size="xs">{new Date(d + 'Z').toLocaleDateString()}</Text>
                    <Text size="xs" c="dimmed">{new Date(d + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...byAgent.entries()].map(([key, agentReviews]) => {
                const dateMap = new Map(agentReviews.map(r => [r.run_at, r]))
                return (
                  <Table.Tr key={key}>
                    <Table.Td>
                      <Badge size="xs" color={agentReviews[0].agent_color || 'gray'} variant="light">
                        {agentReviews[0].agent_label}
                      </Badge>
                    </Table.Td>
                    {allDates.map(d => {
                      const r = dateMap.get(d)
                      if (!r) return <Table.Td key={d} ta="center"><Text size="xs" c="dimmed">—</Text></Table.Td>
                      const idx    = agentReviews.indexOf(r)
                      const prev   = idx > 0 ? agentReviews[idx - 1] : null
                      const delta  = prev && r.score != null && prev.score != null ? r.score - prev.score : null
                      const overall = r.overall ?? ''
                      return (
                        <Table.Td key={d} ta="center">
                          <Group gap={4} justify="center" wrap="nowrap">
                            <Badge size="xs"
                              color={overall === 'Passed' ? 'green' : overall === 'Needs Revision' ? 'orange' : 'red'}
                              variant="filled">
                              {r.score}/100
                            </Badge>
                            {delta !== null && (
                              delta > 0
                                ? <IconArrowUp size={12} color="green" />
                                : delta < 0
                                  ? <IconArrowDown size={12} color="red" />
                                  : <IconMinus size={12} color="gray" />
                            )}
                          </Group>
                          <Text size="xs" c="dimmed">v{r.version_num}</Text>
                        </Table.Td>
                      )
                    })}
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Box>

      {/* ── Check-level diff (agents with 2+ reviews) ── */}
      {[...byAgent.entries()].filter(([, arr]) => arr.length >= 2).map(([key, agentReviews]) => {
        const first    = agentReviews[0]
        const last     = agentReviews[agentReviews.length - 1]
        const firstMap = flatChecks(first)
        const lastMap  = flatChecks(last)

        const improved:  { label: string; from: CheckStatus; to: CheckStatus }[] = []
        const regressed: { label: string; from: CheckStatus; to: CheckStatus }[] = []
        const unchanged: { label: string; status: CheckStatus }[] = []

        for (const [label, toStatus] of lastMap.entries()) {
          const fromStatus = firstMap.get(label)
          if (!fromStatus || fromStatus === toStatus) {
            unchanged.push({ label, status: toStatus })
          } else if (toStatus === 'Passed') {
            improved.push({ label, from: fromStatus, to: toStatus })
          } else {
            regressed.push({ label, from: fromStatus, to: toStatus })
          }
        }

        return (
          <Box key={key}>
            <Text fw={700} size="sm" mb="sm">
              {agentReviews[0].agent_label} — Progress: v{first.version_num} → v{last.version_num}
              {' '}
              {first.score != null && last.score != null && (
                <Text span size="sm" c={last.score >= first.score ? 'green' : 'red'}>
                  ({first.score} → {last.score})
                </Text>
              )}
            </Text>
            <Stack gap="xs">
              {improved.length > 0 && (
                <Box>
                  <Text size="xs" fw={600} c="green" mb={4}>Improved ({improved.length})</Text>
                  <Stack gap={3}>
                    {improved.map(({ label, from, to }) => (
                      <Group key={label} gap="xs" wrap="nowrap">
                        <IconArrowUp size={13} color="green" style={{ flexShrink: 0 }} />
                        <Text size="xs" style={{ flex: 1 }}>{label}</Text>
                        <Badge size="xs" color={STATUS_COLOR[from]} variant="light">{from}</Badge>
                        <Text size="xs" c="dimmed">→</Text>
                        <Badge size="xs" color={STATUS_COLOR[to]} variant="light">{to}</Badge>
                      </Group>
                    ))}
                  </Stack>
                </Box>
              )}
              {regressed.length > 0 && (
                <Box>
                  <Text size="xs" fw={600} c="red" mb={4}>Regressed ({regressed.length})</Text>
                  <Stack gap={3}>
                    {regressed.map(({ label, from, to }) => (
                      <Group key={label} gap="xs" wrap="nowrap">
                        <IconArrowDown size={13} color="red" style={{ flexShrink: 0 }} />
                        <Text size="xs" style={{ flex: 1 }}>{label}</Text>
                        <Badge size="xs" color={STATUS_COLOR[from]} variant="light">{from}</Badge>
                        <Text size="xs" c="dimmed">→</Text>
                        <Badge size="xs" color={STATUS_COLOR[to]} variant="light">{to}</Badge>
                      </Group>
                    ))}
                  </Stack>
                </Box>
              )}
              {improved.length === 0 && regressed.length === 0 && (
                <Text size="xs" c="dimmed">All {unchanged.length} checks unchanged between these reviews.</Text>
              )}
            </Stack>
          </Box>
        )
      })}

      {/* ── Full Review History ── */}
      <Box>
        <Text fw={700} size="sm" mb="sm">Full History ({sorted.length} {sorted.length === 1 ? 'review' : 'reviews'})</Text>
        <Accordion chevronPosition="left" variant="separated">
          {[...sorted].reverse().map(r => {
            const passed  = (r.sections ?? []).flatMap(s => s.items).filter(i => i.status === 'Passed').length
            const total   = (r.sections ?? []).flatMap(s => s.items).length
            const overall = r.overall ?? ''
            return (
              <Accordion.Item key={r.id} value={String(r.id)}>
                <Accordion.Control>
                  <Group gap="xs" wrap="nowrap">
                    <Badge size="xs" color={r.agent_color || 'gray'} variant="light">
                      {r.agent_label}
                    </Badge>
                    <Text size="xs" c="dimmed">v{r.version_num}</Text>
                    <Badge size="xs"
                      color={overall === 'Passed' ? 'green' : overall === 'Needs Revision' ? 'orange' : 'red'}
                      variant="filled">
                      {r.score}/100
                    </Badge>
                    <Text size="xs" c="dimmed">{passed}/{total} passed</Text>
                    <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
                      {new Date(r.run_at + 'Z').toLocaleString()}
                    </Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    {r.summary && (
                      <Text size="xs" c="dimmed" fs="italic">{r.summary}</Text>
                    )}
                    {(r.sections ?? []).map(sec => {
                      const secPassed = sec.items.filter(i => i.status === 'Passed').length
                      return (
                        <Box key={sec.title}>
                          <Group gap="xs" mb={6}>
                            <Text size="xs" fw={700}>{sec.title}</Text>
                            <Badge size="xs" variant="outline" color="gray">
                              {secPassed}/{sec.items.length}
                            </Badge>
                          </Group>
                          <Stack gap={4}>
                            {sec.items.map(item => (
                              <Group key={item.label} gap="xs" align="flex-start" wrap="nowrap">
                                <Badge size="xs" color={STATUS_COLOR[item.status as CheckStatus] ?? 'gray'}
                                  variant="light" style={{ flexShrink: 0, marginTop: 2 }}>
                                  {item.status}
                                </Badge>
                                <Box>
                                  <Text size="xs" fw={500}>{item.label}</Text>
                                  {item.note && <Text size="xs" c="dimmed">{item.note}</Text>}
                                </Box>
                              </Group>
                            ))}
                          </Stack>
                        </Box>
                      )
                    })}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            )
          })}
        </Accordion>
      </Box>

      <Text size="xs" c="dimmed" ta="center" pb="xs">
        Review tracking active since first stored review · all future reviews saved automatically
      </Text>
    </Stack>
  )
}

// ── Course Detail ─────────────────────────────────────────────────────────────

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
  const [lastReviews,   setLastReviews]   = useState<PersistedReview[]>([])
  const [deploys,       setDeploys]       = useState<MoodleDeploy[]>([])
  const [allReviews,    setAllReviews]    = useState<PersistedReview[]>([])
  const [progressOpen,  setProgressOpen]  = useState(false)
  const [diffOpen,           setDiffOpen]           = useState(false)
  const [evalingCurriculum,  setEvalingCurriculum]  = useState(false)

  // Deploy to Moodle
  const [deployOpen,       setDeployOpen]       = useState(false)
  const [deploying,        setDeploying]         = useState(false)
  const [deployResult,     setDeployResult]      = useState<{ moodle_course_id: number; url: string; sections_pushed: number; forums_seeded: number } | null>(null)
  const [moodleCategories, setMoodleCategories]  = useState<{ value: string; label: string }[]>([])
  const [deploySn,         setDeploySn]          = useState('')
  const [deployFn,         setDeployFn]          = useState('')
  const [deployCatId,      setDeployCatId]       = useState<string | null>(null)
  const [deployStart,      setDeployStart]       = useState('')
  const [deployEnd,        setDeployEnd]         = useState('')

  const openDeploy = (v: CourseVersion) => {
    setDeploySn(course.shortname)
    setDeployFn(course.fullname)
    setDeployStart(v.start_date || '')
    setDeployEnd(v.end_date || '')
    setDeployResult(null)
    setDeployCatId(null)
    api.moodle.categories()
      .then(cats => setMoodleCategories(cats.map(c => ({ value: String(c.id), label: c.name }))))
      .catch(() => {})
    setDeployOpen(true)
  }

  const handleDeploy = async () => {
    if (!selVid || !deployCatId) return
    setDeploying(true)
    try {
      const res = await api.moodle.deploy({
        version_id:  selVid,
        shortname:   deploySn,
        fullname:    deployFn,
        category_id: Number(deployCatId),
        start_date:  deployStart,
        end_date:    deployEnd,
      })
      setDeployResult(res)
      if (selVid) api.moodle.deploys(selVid).then(setDeploys).catch(() => {})
      notifications.show({
        title:   'Deployed to Moodle',
        message: `${deploySn} — ${res.sections_pushed} sections, ${res.forums_seeded} forums seeded`,
        color:   'green',
      })
    } catch (e: any) {
      notifications.show({ title: 'Deploy failed', message: e.message, color: 'red' })
    } finally {
      setDeploying(false)
    }
  }

  const handleEvaluateCurriculum = async () => {
    setEvalingCurriculum(true)
    try {
      await api.evaluateCurriculum(course.shortname)
      notifications.show({ title: 'Curriculum evaluated', message: `${course.shortname} scored across all domains`, color: 'teal' })
    } catch (e: any) {
      notifications.show({ title: 'Evaluation failed', message: e.message, color: 'red' })
    } finally {
      setEvalingCurriculum(false)
    }
  }

  // Load versions + all course-level reviews when course changes
  useEffect(() => {
    setVersions([])
    setContent(null)
    setSelVid(null)
    setLoadingV(true)
    setAllReviews([])
    api.courses.versions(course.shortname)
      .then(vers => {
        setVersions(vers)
        if (vers.length) setSelVid(vers[0].id)
      })
      .catch(e => notifications.show({ title: 'Error', message: e.message, color: 'red' }))
      .finally(() => setLoadingV(false))
    api.courses.listReviews(course.shortname)
      .then(setAllReviews)
      .catch(() => {})
  }, [course.shortname])

  // Load full content when selected version changes
  useEffect(() => {
    if (!selVid) return
    setContent(null)
    setLastReviews([])
    api.courses.version(course.shortname, selVid)
      .then(v => setContent((v.content as any) ?? {}))
      .catch(() => setContent({}))
    api.courses.listReviews(course.shortname, selVid)
      .then(setLastReviews)
      .catch(() => {})
    api.courses.listReviews(course.shortname)
      .then(setAllReviews)
      .catch(() => {})
    api.moodle.deploys(selVid)
      .then(setDeploys)
      .catch(() => setDeploys([]))
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

  const modules = content?.course_structure?.modules ?? []
  const quizQ   = content?.quiz_questions            ?? []
  const hwSpec  = content?.homework_spec             ?? {}
  const hwCount = Object.keys(hwSpec).length

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
            <Tooltip label={`Progress Report (${allReviews.length} reviews)`}>
              <ActionIcon size="sm" variant="light" color="indigo"
                          onClick={() => setProgressOpen(true)}>
                <IconChartBar size={14} />
              </ActionIcon>
            </Tooltip>
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
                  <Tooltip label="Print / Export HTML">
                    <ActionIcon
                      size="sm" variant="light" color="teal"
                      component="a"
                      href={api.courses.exportHtmlUrl(course.shortname, selectedVersion.id)}
                      target="_blank"
                    >
                      <IconPrinter size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Export Word (.docx)">
                    <ActionIcon
                      size="sm" variant="light" color="indigo"
                      component="a"
                      href={api.courses.exportDocxUrl(course.shortname, selectedVersion.id)}
                      download
                    >
                      <IconFileWord size={14} />
                    </ActionIcon>
                  </Tooltip>
                  {versions.length >= 2 && (
                    <Tooltip label="Compare versions">
                      <ActionIcon size="sm" variant="light" color="violet"
                                  onClick={() => setDiffOpen(true)}>
                        <IconGitCompare size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  <Tooltip label="Re-evaluate Curriculum (AI)">
                    <ActionIcon size="sm" variant="light" color="teal"
                                loading={evalingCurriculum}
                                onClick={handleEvaluateCurriculum}>
                      <IconBrain size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Deploy to Moodle">
                    <ActionIcon size="sm" variant="light" color="blue"
                                onClick={() => openDeploy(selectedVersion)}>
                      <IconCloudUpload size={14} />
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
              <Group gap="xs" mt="xs" wrap="wrap">
                <Text size="xs" c="dimmed">
                  {selectedVersion.start_date || '—'} → {selectedVersion.end_date || '—'}
                </Text>
                <Text size="xs" c="dimmed">·</Text>
                <Text size="xs" c="dimmed">
                  Created {new Date(selectedVersion.created_at).toLocaleDateString()}
                </Text>
                {lastReviews.length > 0 && (() => {
                  const worst = [...lastReviews].sort((a, b) => (a.score ?? 100) - (b.score ?? 100))[0]
                  const color = worst.error ? 'red'
                    : worst.overall === 'Passed' ? 'green'
                    : worst.overall === 'Needs Revision' ? 'orange' : 'red'
                  return (
                    <>
                      <Text size="xs" c="dimmed">·</Text>
                      <Badge size="xs" color={color} variant="light">
                        Last review: {worst.overall ?? 'Error'}{worst.score != null ? ` ${worst.score}/100` : ''} · {relativeTime(worst.run_at)}
                      </Badge>
                    </>
                  )
                })()}
                {deploys.length > 0 && (() => {
                  const latest = deploys[0]
                  return (
                    <>
                      <Text size="xs" c="dimmed">·</Text>
                      <Anchor href={latest.moodle_url} target="_blank" size="xs">
                        <Group gap={4} wrap="nowrap">
                          <IconCloudUpload size={11} />
                          Deployed {relativeTime(latest.deployed_at)}
                          {latest.forums_seeded > 0 && ` · ${latest.forums_seeded} forums`}
                          <IconExternalLink size={11} />
                        </Group>
                      </Anchor>
                    </>
                  )
                })()}
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

      {/* Module accordion + quiz */}
      {content && (
        <CourseViewer
          content={content}
          moodleCourseId={content.moodle_course_id}
          bibleValidation={selVid ? { shortname: course.shortname, versionId: selVid } : undefined}
          onFieldEdit={selVid
            ? async (moduleNum, field, value) => {
                await api.courses.patchField(course.shortname, selVid, { module_num: moduleNum, field, value })
              }
            : undefined
          }
          onQuizSave={selVid
            ? async questions => {
                await api.courses.saveQuiz(course.shortname, selVid, questions)
                const v = await api.courses.version(course.shortname, selVid)
                setContent((v.content as any) ?? {})
              }
            : undefined
          }
        />
      )}

      {!content && selVid && <Loader size="sm" />}

      {/* Course Progress Report modal */}
      <Modal
        opened={progressOpen}
        onClose={() => setProgressOpen(false)}
        title={
          <Group gap="xs">
            <IconChartBar size={16} />
            <Text fw={700} size="sm">Course Progress Report — {course.shortname}</Text>
            {allReviews.length > 0 && (
              <Badge size="xs" color="indigo" variant="light">{allReviews.length} reviews</Badge>
            )}
          </Group>
        }
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <CourseProgressReport reviews={allReviews} />
      </Modal>

      {/* Version diff modal */}
      <VersionDiff
        opened={diffOpen}
        onClose={() => setDiffOpen(false)}
        shortname={course.shortname}
        versions={versions}
      />

      {/* Deploy to Moodle modal */}
      <Modal
        opened={deployOpen}
        onClose={() => setDeployOpen(false)}
        title={<Text fw={600} size="sm">Deploy to Moodle — {course.fullname}</Text>}
        size="md"
      >
        {deployResult ? (
          <Stack gap="sm">
            <Text size="sm" c="green" fw={500}>
              Course created successfully!
            </Text>
            <Group gap="xs" wrap="wrap">
              <Badge size="sm" color="blue" variant="light">{deployResult.sections_pushed} sections</Badge>
              {deployResult.forums_seeded > 0 && (
                <Badge size="sm" color="teal" variant="light">{deployResult.forums_seeded} forums seeded</Badge>
              )}
              <Badge size="sm" color="gray" variant="light">ID #{deployResult.moodle_course_id}</Badge>
            </Group>
            <Anchor href={deployResult.url} target="_blank" size="sm">
              <Group gap={4}>
                <IconExternalLink size={14} />
                Open in Moodle
              </Group>
            </Anchor>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setDeployOpen(false)}>Close</Button>
            </Group>
          </Stack>
        ) : (
          <Stack gap="sm">
            <TextInput
              label="Shortname"
              value={deploySn}
              onChange={e => setDeploySn(e.currentTarget.value)}
            />
            <TextInput
              label="Full name"
              value={deployFn}
              onChange={e => setDeployFn(e.currentTarget.value)}
            />
            <Select
              label="Category"
              placeholder="Select a Moodle category…"
              data={moodleCategories}
              value={deployCatId}
              onChange={setDeployCatId}
              searchable
            />
            <Group grow>
              <TextInput
                label="Start date"
                type="date"
                value={deployStart}
                onChange={e => setDeployStart(e.currentTarget.value)}
              />
              <TextInput
                label="End date"
                type="date"
                value={deployEnd}
                onChange={e => setDeployEnd(e.currentTarget.value)}
              />
            </Group>
            <Text size="xs" c="dimmed">
              Creates a new Moodle course and pushes section names, lecture content, and
              forum discussion questions. Enrollments and quiz questions are not included.
            </Text>
            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" onClick={() => setDeployOpen(false)}>Cancel</Button>
              <Button
                color="blue"
                leftSection={deploying ? <Loader size="xs" /> : <IconCloudUpload size={14} />}
                onClick={handleDeploy}
                disabled={deploying || !deployCatId || !deploySn || !deployFn}
              >
                {deploying ? 'Deploying…' : 'Deploy'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}

// ── Category group (collapsible, nested under instance) ───────────────────────

interface CategoryGroupProps {
  name: string
  courses: Course[]
  selected: Course | null
  checkedShortnames: Set<string>
  onSelect: (c: Course) => void
  onToggle: (shortname: string) => void
  onToggleSet: (shortnames: string[], checked: boolean) => void
}

function CategoryGroup({
  name, courses, selected, checkedShortnames,
  onSelect, onToggle, onToggleSet,
}: CategoryGroupProps) {
  const [open, setOpen] = useState(true)
  const checkedHere = courses.filter(c => checkedShortnames.has(c.shortname)).length
  const allChecked  = checkedHere === courses.length
  const someChecked = checkedHere > 0 && !allChecked
  const shortnames  = courses.map(c => c.shortname)

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
          onChange={e => onToggleSet(shortnames, e.currentTarget.checked)}
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
            <Group key={c.shortname} gap={4} wrap="nowrap">
              <Checkbox
                size="xs"
                checked={checkedShortnames.has(c.shortname)}
                onChange={() => onToggle(c.shortname)}
                onClick={e => e.stopPropagation()}
              />
              <Paper
                withBorder px="sm" py={6} radius="sm"
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

// ── Instance dashboard modal ──────────────────────────────────────────────────

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

function InstanceDashboard({ instanceName, opened, onClose }: {
  instanceName: string
  opened: boolean
  onClose: () => void
}) {
  const [stats,   setStats]   = useState<InstanceStats | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStats = () => {
    setStats(null)
    setLoading(true)
    api.courses.stats(instanceName)
      .then(setStats)
      .catch(e => notifications.show({ title: 'Stats error', message: e.message, color: 'red' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!opened) return
    fetchStats()
  }, [opened, instanceName])

  const isLocal = instanceName === 'Local'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon size="sm" variant="light" color={isLocal ? 'gray' : 'blue'}>
            {isLocal ? <IconHome size={14} /> : <IconCloud size={14} />}
          </ThemeIcon>
          <Text fw={600} size="sm">{instanceName} — Course Evaluator</Text>
          <Tooltip label="Refresh stats">
            <ActionIcon size="xs" variant="subtle" color="gray" loading={loading} onClick={fetchStats}>
              <IconRefresh size={12} />
            </ActionIcon>
          </Tooltip>
        </Group>
      }
      size="lg"
    >
      {loading && (
        <Center py="xl"><Loader size="sm" /></Center>
      )}

      {stats && !loading && (
        <Stack gap="md">
          <SimpleGrid cols={2} spacing="sm">
            <StatCard
              icon={<IconBook2 size={16} />}
              label="Total Courses"
              value={stats.total_courses}
              color="blue"
            />
            <StatCard
              icon={<IconCategory size={16} />}
              label="Total Categories"
              value={stats.total_categories}
              color="teal"
            />
            <StatCard
              icon={<IconGitBranch size={16} />}
              label="Avg Versions / Course"
              value={stats.avg_versions !== null ? stats.avg_versions.toFixed(1) : '—'}
              color="violet"
              sub={stats.avg_versions !== null
                ? stats.avg_versions >= 2 ? 'actively iterated' : 'mostly first drafts'
                : 'no versions yet'}
            />
            <StatCard
              icon={<IconClock size={16} />}
              label="Last Activity"
              value={stats.last_activity_at ? relativeTime(stats.last_activity_at) : '—'}
              color="orange"
              sub={stats.last_activity_at
                ? new Date(stats.last_activity_at).toLocaleDateString()
                : 'no versions yet'}
            />
          </SimpleGrid>

          <Divider label="Version Distribution" labelPosition="center" />

          <SimpleGrid cols={3} spacing="sm">
            <StatCard
              icon={<IconStack size={16} />}
              label="V1 — Single Version"
              value={stats.v1_count}
              color="blue"
              sub="exactly 1 version"
            />
            <StatCard
              icon={<IconStack size={16} />}
              label="V2 — Two Versions"
              value={stats.v2_count}
              color="teal"
              sub="exactly 2 versions"
            />
            <StatCard
              icon={<IconStack size={16} />}
              label="V3+ — Mature"
              value={stats.v3plus_count}
              color="violet"
              sub="3 or more versions"
            />
          </SimpleGrid>

          {stats.total_courses > 0 && (
            <Paper withBorder p="sm" radius="md">
              {(() => {
                const total = stats.v1_count + stats.v2_count + stats.v3plus_count || 1
                const v1pct = Math.round((stats.v1_count     / total) * 100)
                const v2pct = Math.round((stats.v2_count     / total) * 100)
                const v3pct = 100 - v1pct - v2pct
                return (
                  <Stack gap={6}>
                    <Text size="xs" fw={500} c="dimmed">Distribution</Text>
                    <Group gap={0} style={{ borderRadius: 4, overflow: 'hidden', height: 12 }}>
                      {v1pct > 0 && <Box style={{ width: `${v1pct}%`, background: 'var(--mantine-color-blue-5)' }} />}
                      {v2pct > 0 && <Box style={{ width: `${v2pct}%`, background: 'var(--mantine-color-teal-5)' }} />}
                      {v3pct > 0 && <Box style={{ width: `${v3pct}%`, background: 'var(--mantine-color-violet-5)' }} />}
                    </Group>
                    <Group gap="md">
                      <Group gap={4}><Box w={10} h={10} style={{ borderRadius: 2, background: 'var(--mantine-color-blue-5)', flexShrink: 0 }} /><Text size="xs" c="dimmed">V1 {v1pct}%</Text></Group>
                      <Group gap={4}><Box w={10} h={10} style={{ borderRadius: 2, background: 'var(--mantine-color-teal-5)', flexShrink: 0 }} /><Text size="xs" c="dimmed">V2 {v2pct}%</Text></Group>
                      <Group gap={4}><Box w={10} h={10} style={{ borderRadius: 2, background: 'var(--mantine-color-violet-5)', flexShrink: 0 }} /><Text size="xs" c="dimmed">V3+ {v3pct}%</Text></Group>
                    </Group>
                  </Stack>
                )
              })()}
            </Paper>
          )}
        </Stack>
      )}
    </Modal>
  )
}

// ── Instance group (collapsible, with category sub-groups) ────────────────────

interface InstanceGroupProps {
  name: string
  categories: Record<string, Course[]>
  selected: Course | null
  checkedShortnames: Set<string>
  onSelect: (c: Course) => void
  onToggle: (shortname: string) => void
  onToggleSet: (shortnames: string[], checked: boolean) => void
}

function InstanceGroup({
  name, categories, selected, checkedShortnames,
  onSelect, onToggle, onToggleSet,
}: InstanceGroupProps) {
  const [open,      setOpen]      = useState(true)
  const [dashOpen,  setDashOpen]  = useState(false)
  const isLocal      = name === 'Local'
  const allCourses   = Object.values(categories).flat()
  const totalVers    = allCourses.reduce((s, c) => s + c.version_count, 0)
  const checkedHere  = allCourses.filter(c => checkedShortnames.has(c.shortname)).length
  const allChecked   = checkedHere === allCourses.length && allCourses.length > 0
  const someChecked  = checkedHere > 0 && !allChecked
  const allShortnames = allCourses.map(c => c.shortname)

  const sortedCategories = Object.keys(categories).sort((a, b) => {
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })

  return (
    <Box>
      {/* Instance header row */}
      <Group
        gap="xs" mt="xs" mb={2} px={4}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <Checkbox
          size="xs"
          checked={allChecked}
          indeterminate={someChecked}
          onClick={e => e.stopPropagation()}
          onChange={e => onToggleSet(allShortnames, e.currentTarget.checked)}
        />
        <ThemeIcon size="sm" variant="light" color={isLocal ? 'gray' : 'blue'}>
          {isLocal ? <IconHome size={12} /> : <IconCloud size={12} />}
        </ThemeIcon>
        <Tooltip label="View instance stats" position="right" withArrow>
          <Text
            fw={600} size="sm" c={isLocal ? 'dimmed' : 'blue'}
            style={{ flex: 1, cursor: 'pointer', textDecoration: 'underline dotted' }}
            onClick={e => { e.stopPropagation(); setDashOpen(true) }}
          >
            {name}
          </Text>
        </Tooltip>
        <Badge size="xs" variant="outline" color={isLocal ? 'gray' : 'blue'}>
          {allCourses.length}
        </Badge>
        <Badge size="xs" variant="outline" color="gray">
          {totalVers}v
        </Badge>
        <ActionIcon size="xs" variant="subtle" color="gray">
          {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        </ActionIcon>
      </Group>

      <InstanceDashboard
        instanceName={name}
        opened={dashOpen}
        onClose={() => setDashOpen(false)}
      />

      {/* Category sub-groups */}
      <Collapse in={open}>
        <Stack gap={0}>
          {sortedCategories.map(cat => (
            <CategoryGroup
              key={cat}
              name={cat}
              courses={categories[cat]}
              selected={selected}
              checkedShortnames={checkedShortnames}
              onSelect={onSelect}
              onToggle={onToggle}
              onToggleSet={onToggleSet}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  )
}

// ── Library page ──────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [courses,    setCourses]    = useState<Course[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<Course | null>(null)
  const [checked,    setChecked]    = useState<Set<string>>(new Set())
  const [bulking,    setBulking]    = useState(false)
  const [bulkDone,   setBulkDone]   = useState(0)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [search,     setSearch]     = useState('')
  const [filterCat,  setFilterCat]  = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const toggleSet = (shortnames: string[], on: boolean) => {
    setChecked(prev => {
      const n = new Set(prev)
      shortnames.forEach(sn => on ? n.add(sn) : n.delete(sn))
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

  const handleMbzUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const version = await api.courses.uploadMbz(file)
      notifications.show({ title: 'Imported', message: `${version.shortname} v${version.version_num} added to library`, color: 'green' })
      load()
    } catch (err: any) {
      notifications.show({ title: 'Import failed', message: err.message, color: 'red' })
    } finally {
      setUploading(false)
    }
  }

  const allCategories = useMemo(() =>
    [...new Set(courses.map(c => c.category || 'Uncategorized'))].sort(),
    [courses]
  )

  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase().trim()
    return courses.filter(c => {
      const matchSearch = !q ||
        c.fullname.toLowerCase().includes(q) ||
        c.shortname.toLowerCase().includes(q) ||
        (c.professor || '').toLowerCase().includes(q)
      const matchCat = !filterCat || (c.category || 'Uncategorized') === filterCat
      return matchSearch && matchCat
    })
  }, [courses, search, filterCat])

  // Group by instance → category; Local first
  const grouped = filteredCourses.reduce<Record<string, Record<string, Course[]>>>((acc, c) => {
    const inst = c.instance || 'Local'
    const cat  = c.category  || 'Uncategorized'
    if (!acc[inst]) acc[inst] = {}
    if (!acc[inst][cat]) acc[inst][cat] = []
    acc[inst][cat].push(c)
    return acc
  }, {})

  const sortedInstances = Object.keys(grouped).sort((a, b) => {
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
        <Group gap="xs">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mbz"
            title="Upload a Moodle backup (.mbz) file"
            hidden
            onChange={handleMbzUpload}
          />
          <Button
            variant="light" size="xs" color="violet"
            leftSection={uploading ? <Loader size="xs" /> : <IconUpload size={14} />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Importing…' : 'Upload .mbz'}
          </Button>
          <Button variant="subtle" size="xs"
                  leftSection={loading ? <Loader size="xs" /> : <IconRefresh size={16} />}
                  onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Group>
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

      {/* Search / filter bar */}
      <Group gap="sm" style={{ flexShrink: 0 }}>
        <TextInput
          placeholder="Search by name, shortname, professor…"
          leftSection={<IconSearch size={14} />}
          rightSection={search
            ? <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setSearch('')}><IconX size={12} /></ActionIcon>
            : null}
          value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          size="xs"
          style={{ flex: 1 }}
        />
        <Select
          placeholder="All categories"
          data={allCategories}
          value={filterCat}
          onChange={setFilterCat}
          clearable
          searchable
          size="xs"
          style={{ width: 220 }}
        />
        {(search || filterCat) && (
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {filteredCourses.length} of {courses.length}
          </Text>
        )}
      </Group>

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
                categories={grouped[instance]}
                selected={selected}
                checkedShortnames={checked}
                onSelect={setSelected}
                onToggle={toggleOne}
                onToggleSet={toggleSet}
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
