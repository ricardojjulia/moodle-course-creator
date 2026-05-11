import { useEffect, useState, useRef } from 'react'
import {
  Stack, Title, Text, Group, Badge, Paper, Loader, Alert,
  ScrollArea, Table, ThemeIcon, Box, Select, Tooltip, MultiSelect,
  SimpleGrid, RingProgress, Center, Divider, Checkbox, Button,
  Progress,
} from '@mantine/core'
import {
  IconMap2, IconAlertTriangle, IconBook2, IconCheck, IconMinus,
  IconBrain, IconClock, IconX,
} from '@tabler/icons-react'
import { api, type CurriculumEntry, type CurriculumMap } from '../api/client'
import { useTranslation } from 'react-i18next'

const DOMAIN_COLORS: Record<string, string> = {
  'Old Testament':        'orange',
  'New Testament':        'blue',
  'Systematic Theology':  'violet',
  'Church History':       'teal',
  'Pastoral Ministry':    'green',
  'Biblical Languages':   'yellow',
  'Ethics':               'pink',
  'Missions & Evangelism':'indigo',
}

function scoreColor(score: number): string {
  if (score >= 76) return 'green'
  if (score >= 51) return 'yellow'
  if (score >= 26) return 'blue'
  return 'gray'
}

function ScoreCell({ score, loading }: { score: number; loading?: boolean }) {
  if (loading) return <Loader size="xs" />
  if (score === 0) return <Text size="xs" c="dimmed">—</Text>
  return (
    <Badge size="xs" color={scoreColor(score)} variant={score >= 51 ? 'filled' : 'light'}>
      {score}
    </Badge>
  )
}

function CoverageRing({ entries, domains }: { entries: CurriculumEntry[]; domains: string[] }) {
  const { t } = useTranslation()
  const evaluated = entries.filter(c => c.eval_status === 'evaluated')
  const covered   = domains.filter(d => evaluated.some(c => (c.domains[d] ?? 0) > 0))
  const pct       = domains.length > 0 ? Math.round(covered.length / domains.length * 100) : 0

  const avgScore = (d: string) => {
    if (!evaluated.length) return 0
    return Math.round(evaluated.reduce((s, c) => s + (c.domains[d] ?? 0), 0) / evaluated.length)
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="xl" align="flex-start">
        <Center>
          <RingProgress
            size={110}
            thickness={12}
            sections={[
              { value: pct,       color: 'green' },
              { value: 100 - pct, color: 'gray'  },
            ]}
            label={<Text ta="center" fw={700} size="sm">{pct}%</Text>}
          />
        </Center>
        <Stack gap={6} style={{ flex: 1 }}>
          <Group gap={6}>
            <Text fw={600} size="sm">{t('cur.coverage')}</Text>
            <Tooltip label={t('cur.coverage_tt')}>
              <ThemeIcon size="xs" color="teal" variant="light">
                <IconBrain size={10} />
              </ThemeIcon>
            </Tooltip>
          </Group>
          <Text size="xs" c="dimmed">
            {t('cur.coverage_desc', { covered: covered.length, domains: domains.length, evaluated: evaluated.length, total: entries.length })}
          </Text>
          <Divider my={4} />
          <SimpleGrid cols={2} spacing={4}>
            {domains.map(d => {
              const avg = avgScore(d)
              return (
                <Group key={d} gap={4} wrap="nowrap">
                  <ThemeIcon size="xs" color={avg > 0 ? DOMAIN_COLORS[d] || 'blue' : 'gray'} variant={avg > 0 ? 'light' : 'subtle'}>
                    {avg > 0 ? <IconCheck size={10} /> : <IconMinus size={10} />}
                  </ThemeIcon>
                  <Text size="xs" c={avg > 0 ? undefined : 'dimmed'} lineClamp={1}>{d}</Text>
                  {avg > 0 && <Text size="xs" c="dimmed">{t('cur.avg_score', { score: avg })}</Text>}
                </Group>
              )
            })}
          </SimpleGrid>
        </Stack>
      </Group>
    </Paper>
  )
}

export default function CurriculumPage() {
  const { t } = useTranslation()
  const [data,      setData]      = useState<CurriculumMap | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [instance,  setInstance]  = useState<string | null>(null)
  const [pickedSns, setPickedSns] = useState<string[]>([])

  // Selection (bulk eval checkboxes)
  const [selected,  setSelected]  = useState<Set<string>>(new Set())

  // Bulk evaluation progress
  const [bulkRunning,  setBulkRunning]  = useState(false)
  const [bulkDone,     setBulkDone]     = useState(0)
  const [bulkTotal,    setBulkTotal]    = useState(0)
  const [bulkCurrent,  setBulkCurrent]  = useState('')
  const [bulkEvaluating, setBulkEvaluating] = useState<Set<string>>(new Set())
  const cancelRef = useRef(false)

  useEffect(() => {
    setLoading(true)
    api.curriculum()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const instances = data
    ? Array.from(new Set(data.courses.map(c => c.instance || 'Local'))).sort()
    : []

  const filtered: CurriculumEntry[] = data
    ? (instance ? data.courses.filter(c => (c.instance || 'Local') === instance) : data.courses)
    : []

  const visible: CurriculumEntry[] = pickedSns.length > 0
    ? filtered.filter(c => pickedSns.includes(c.shortname))
    : filtered

  const courseOptions = filtered.map(c => ({ value: c.shortname, label: `${c.shortname} — ${c.fullname}` }))

  const domains      = data?.domains ?? []
  const pendingCount = visible.filter(c => c.eval_status === 'pending').length

  // Selection helpers (operate on visible set)
  const allSelected  = visible.length > 0 && visible.every(c => selected.has(c.shortname))
  const someSelected = visible.some(c => selected.has(c.shortname)) && !allSelected

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visible.map(c => c.shortname)))
    }
  }

  const toggleOne = (sn: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(sn)) next.delete(sn); else next.add(sn)
      return next
    })
  }

  const selectPending = () =>
    setSelected(new Set(visible.filter(c => c.eval_status === 'pending').map(c => c.shortname)))

  // Patch a single entry in data after evaluation
  const patchEntry = (sn: string, update: Partial<CurriculumEntry>) => {
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        courses: prev.courses.map(c => c.shortname === sn ? { ...c, ...update } : c),
      }
    })
  }

  const runBulkEval = async () => {
    const queue = visible.filter(c => selected.has(c.shortname)).map(c => c.shortname)
    if (!queue.length) return

    cancelRef.current = false
    setBulkRunning(true)
    setBulkDone(0)
    setBulkTotal(queue.length)

    for (const sn of queue) {
      if (cancelRef.current) break
      setBulkCurrent(sn)
      setBulkEvaluating(prev => new Set(prev).add(sn))
      try {
        const result = await api.evaluateCurriculum(sn)
        patchEntry(sn, {
          domains:      result.scores,
          eval_status:  'evaluated',
          evaluated_at: result.evaluated_at,
          model_used:   result.model_used,
        })
      } catch {
        // leave as pending, continue with next
      } finally {
        setBulkEvaluating(prev => { const s = new Set(prev); s.delete(sn); return s })
        setBulkDone(d => d + 1)
      }
    }

    setBulkRunning(false)
    setBulkCurrent('')
    setSelected(new Set())
  }

  const selectedCount = visible.filter(c => selected.has(c.shortname)).length

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Title order={3}>{t('cur.title')}</Title>
          <Text size="xs" c="dimmed">{t('cur.subtitle')}</Text>
        </div>
        <Group gap="xs">
          {instances.length > 1 && (
            <Select
              size="xs"
              placeholder={t('cur.all_instances')}
              data={instances}
              value={instance}
              onChange={v => { setInstance(v); setPickedSns([]) }}
              clearable
              w={160}
            />
          )}
          {filtered.length > 0 && (
            <MultiSelect
              size="xs"
              placeholder={t('cur.all_courses')}
              data={courseOptions}
              value={pickedSns}
              onChange={setPickedSns}
              searchable
              clearable
              w={260}
              maxDropdownHeight={240}
            />
          )}
        </Group>
      </Group>

      {loading && (
        <Stack align="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">{t('cur.loading')}</Text>
        </Stack>
      )}

      {error && (
        <Alert color="red" icon={<IconAlertTriangle size={14} />} title={t('common.error')}>{error}</Alert>
      )}

      {!loading && data && filtered.length === 0 && (
        <Paper withBorder p="xl" radius="md">
          <Stack align="center" gap="xs">
            <IconMap2 size={32} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed" ta="center">{t('cur.no_courses')}</Text>
          </Stack>
        </Paper>
      )}

      {!loading && data && filtered.length > 0 && (
        <>
          <CoverageRing entries={visible} domains={domains} />

          {/* Bulk eval toolbar */}
          <Paper withBorder p="sm" radius="md">
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Group gap="xs">
                <Button
                  size="xs" variant="light"
                  onClick={selectPending}
                  disabled={bulkRunning || pendingCount === 0}
                >
                  {t('cur.select_pending', { count: pendingCount })}
                </Button>
                <Button
                  size="xs" variant="subtle"
                  onClick={toggleAll}
                  disabled={bulkRunning}
                >
                  {allSelected ? t('cur.deselect_all') : t('cur.select_all')}
                </Button>
                {selectedCount > 0 && !bulkRunning && (
                  <Button size="xs" variant="subtle" color="gray" onClick={() => setSelected(new Set())}>
                    {t('common.clear')}
                  </Button>
                )}
              </Group>

              <Group gap="xs">
                {bulkRunning ? (
                  <>
                    <Text size="xs" c="dimmed">{bulkCurrent}</Text>
                    <Text size="xs" fw={600}>{bulkDone}/{bulkTotal}</Text>
                    <Button
                      size="xs" color="red" variant="light"
                      leftSection={<IconX size={12} />}
                      onClick={() => { cancelRef.current = true }}
                    >
                      {t('cur.cancel')}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="xs"
                    color="teal"
                    leftSection={<IconBrain size={13} />}
                    disabled={selectedCount === 0}
                    onClick={runBulkEval}
                  >
                    {t('cur.evaluate', { count: selectedCount })}
                  </Button>
                )}
              </Group>
            </Group>

            {bulkRunning && (
              <Progress
                mt="xs"
                size="sm"
                value={bulkTotal > 0 ? (bulkDone / bulkTotal) * 100 : 0}
                color="teal"
                animated
              />
            )}
          </Paper>

          {/* Domain legend */}
          <Group gap="xs" wrap="wrap">
            {domains.map(d => (
              <Badge key={d} size="xs" color={DOMAIN_COLORS[d] || 'blue'} variant="light">{d}</Badge>
            ))}
          </Group>

          {/* Coverage matrix */}
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            <ScrollArea>
              <Table withTableBorder withColumnBorders style={{ minWidth: 940 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 36, position: 'sticky', left: 0, background: 'var(--mantine-color-body)', zIndex: 2 }}>
                      <Checkbox
                        size="xs"
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={toggleAll}
                        disabled={bulkRunning}
                      />
                    </Table.Th>
                    <Table.Th style={{ minWidth: 200, position: 'sticky', left: 36, background: 'var(--mantine-color-body)', zIndex: 2 }}>
                      <Group gap={4}>
                        <IconBook2 size={13} />
                        <Text size="xs" fw={600}>{t('cur.col_course')}</Text>
                      </Group>
                    </Table.Th>
                    {domains.map(d => (
                      <Table.Th key={d} style={{ minWidth: 110, textAlign: 'center' }}>
                        <Tooltip label={d} withArrow position="top">
                          <Badge
                            size="xs"
                            color={DOMAIN_COLORS[d] || 'blue'}
                            variant="dot"
                            style={{ cursor: 'default', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {d}
                          </Badge>
                        </Tooltip>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visible.map(course => {
                    const coveredCount  = domains.filter(d => (course.domains[d] ?? 0) > 0).length
                    const isPending     = course.eval_status === 'pending'
                    const isEvaluating  = bulkEvaluating.has(course.shortname)
                    const isChecked     = selected.has(course.shortname)
                    return (
                      <Table.Tr
                        key={course.shortname}
                        style={{
                          opacity:         isEvaluating ? 0.7 : isPending && !isChecked ? 0.6 : 1,
                          background:      isChecked ? 'var(--mantine-color-teal-light)' : undefined,
                        }}
                      >
                        <Table.Td style={{ position: 'sticky', left: 0, background: isChecked ? 'var(--mantine-color-teal-light)' : 'var(--mantine-color-body)', zIndex: 1 }}>
                          <Checkbox
                            size="xs"
                            checked={isChecked}
                            onChange={() => toggleOne(course.shortname)}
                            disabled={bulkRunning}
                          />
                        </Table.Td>
                        <Table.Td style={{ position: 'sticky', left: 36, background: isChecked ? 'var(--mantine-color-teal-light)' : 'var(--mantine-color-body)', zIndex: 1 }}>
                          <Box>
                            <Group gap={4} wrap="nowrap">
                              {isEvaluating && <Loader size="xs" color="teal" />}
                              <Text size="xs" fw={600} lineClamp={2}>{course.fullname}</Text>
                            </Group>
                            <Group gap={4} mt={2}>
                              <Text size="xs" c="dimmed">{course.shortname}</Text>
                              {isPending ? (
                                <Badge size="xs" variant="outline" color="yellow" leftSection={<IconClock size={8} />}>
                                  {t('cur.pending')}
                                </Badge>
                              ) : (
                                <Tooltip label={t('cur.evaluated_tt', { model: course.model_used, date: course.evaluated_at?.slice(0, 10) })}>
                                  <Badge size="xs" variant="outline" color="teal" leftSection={<IconBrain size={8} />}>
                                    {t('cur.domains_badge', { covered: coveredCount, total: domains.length })}
                                  </Badge>
                                </Tooltip>
                              )}
                            </Group>
                          </Box>
                        </Table.Td>
                        {domains.map(d => (
                          <Table.Td key={d} style={{ textAlign: 'center' }}>
                            <ScoreCell score={course.domains[d] ?? 0} loading={isEvaluating} />
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>

          {/* Domain weight summary */}
          <Paper withBorder p="sm" radius="md">
            <Text size="xs" fw={600} c="dimmed" mb="xs">{t('cur.domain_weight')}</Text>
            <Group gap="xs" wrap="wrap">
              {domains.map(d => {
                const ev  = visible.filter(c => c.eval_status === 'evaluated')
                const avg = ev.length
                  ? Math.round(ev.reduce((s, c) => s + (c.domains[d] ?? 0), 0) / ev.length)
                  : 0
                return (
                  <Tooltip key={d} label={t('cur.domain_weight_tt', { domain: d, score: avg, count: ev.length })} withArrow>
                    <Badge size="sm" color={avg > 0 ? DOMAIN_COLORS[d] || 'blue' : 'gray'} variant={avg > 0 ? 'light' : 'outline'}>
                      {d.split(' ')[0]} · {avg}
                    </Badge>
                  </Tooltip>
                )
              })}
            </Group>
          </Paper>
        </>
      )}
    </Stack>
  )
}
