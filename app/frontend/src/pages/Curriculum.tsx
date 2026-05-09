import { useEffect, useState } from 'react'
import {
  Stack, Title, Text, Group, Badge, Paper, Loader, Alert,
  ScrollArea, Table, ThemeIcon, Box, Select, Tooltip,
  SimpleGrid, RingProgress, Center, Divider,
} from '@mantine/core'
import {
  IconMap2, IconAlertTriangle, IconBook2, IconCheck, IconMinus,
} from '@tabler/icons-react'
import { api, type CurriculumEntry, type CurriculumMap } from '../api/client'

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

function scoreBadge(score: number) {
  if (score === 0) return null
  const color = score >= 5 ? 'green' : score >= 2 ? 'blue' : 'gray'
  return <Badge size="xs" color={color} variant="filled">{score}</Badge>
}

function CoverageRing({ entries, domains }: { entries: CurriculumEntry[]; domains: string[] }) {
  const covered = domains.filter(d => entries.some(c => (c.domains[d] ?? 0) > 0))
  const pct = domains.length > 0 ? Math.round(covered.length / domains.length * 100) : 0

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
          <Text fw={600} size="sm">Curriculum Coverage</Text>
          <Text size="xs" c="dimmed">
            {covered.length} of {domains.length} theological domains addressed across {entries.length} course{entries.length !== 1 ? 's' : ''}
          </Text>
          <Divider my={4} />
          <SimpleGrid cols={2} spacing={4}>
            {domains.map(d => {
              const covered = entries.some(c => (c.domains[d] ?? 0) > 0)
              return (
                <Group key={d} gap={4} wrap="nowrap">
                  <ThemeIcon size="xs" color={covered ? DOMAIN_COLORS[d] || 'blue' : 'gray'} variant={covered ? 'light' : 'subtle'}>
                    {covered ? <IconCheck size={10} /> : <IconMinus size={10} />}
                  </ThemeIcon>
                  <Text size="xs" c={covered ? undefined : 'dimmed'} lineClamp={1}>{d}</Text>
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
  const [data,      setData]      = useState<CurriculumMap | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [instance,  setInstance]  = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
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

  const domains = data?.domains ?? []

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Title order={3}>Curriculum Map</Title>
          <Text size="xs" c="dimmed">Theological domain coverage across all library courses</Text>
        </div>
        {instances.length > 1 && (
          <Select
            size="xs"
            placeholder="All instances"
            data={instances}
            value={instance}
            onChange={setInstance}
            clearable
            w={180}
          />
        )}
      </Group>

      {loading && (
        <Stack align="center" py="xl">
          <Loader />
          <Text size="sm" c="dimmed">Analyzing library…</Text>
        </Stack>
      )}

      {error && (
        <Alert color="red" icon={<IconAlertTriangle size={14} />} title="Error">
          {error}
        </Alert>
      )}

      {!loading && data && (
        <>
          <CoverageRing entries={filtered} domains={domains} />

          {/* Domain legend */}
          <Group gap="xs" wrap="wrap">
            {domains.map(d => (
              <Badge
                key={d}
                size="xs"
                color={DOMAIN_COLORS[d] || 'blue'}
                variant="light"
              >
                {d}
              </Badge>
            ))}
          </Group>

          {/* Coverage matrix */}
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            <ScrollArea>
              <Table withTableBorder withColumnBorders style={{ minWidth: 900 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ minWidth: 220, position: 'sticky', left: 0, background: 'var(--mantine-color-body)', zIndex: 2 }}>
                      <Group gap={4}>
                        <IconBook2 size={13} />
                        <Text size="xs" fw={600}>Course</Text>
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
                  {filtered.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={domains.length + 1}>
                        <Text size="sm" c="dimmed" ta="center" py="lg">No courses found.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {filtered.map(course => {
                    const covered = domains.filter(d => (course.domains[d] ?? 0) > 0).length
                    return (
                      <Table.Tr key={course.shortname}>
                        <Table.Td style={{ position: 'sticky', left: 0, background: 'var(--mantine-color-body)', zIndex: 1 }}>
                          <Box>
                            <Text size="xs" fw={600} lineClamp={2}>{course.fullname}</Text>
                            <Group gap={4} mt={2}>
                              <Text size="xs" c="dimmed">{course.shortname}</Text>
                              <Badge size="xs" variant="outline" color="gray">
                                {covered}/{domains.length} domains
                              </Badge>
                            </Group>
                          </Box>
                        </Table.Td>
                        {domains.map(d => (
                          <Table.Td key={d} style={{ textAlign: 'center' }}>
                            {scoreBadge(course.domains[d] ?? 0)}
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>

          {/* Domain summary row */}
          <Paper withBorder p="sm" radius="md">
            <Text size="xs" fw={600} c="dimmed" mb="xs">Domain Totals (keyword hits across all courses)</Text>
            <Group gap="xs" wrap="wrap">
              {domains.map(d => {
                const total = filtered.reduce((s, c) => s + (c.domains[d] ?? 0), 0)
                return (
                  <Tooltip key={d} label={`${d}: ${total} keyword hits`} withArrow>
                    <Badge
                      size="sm"
                      color={total > 0 ? DOMAIN_COLORS[d] || 'blue' : 'gray'}
                      variant={total > 0 ? 'light' : 'outline'}
                    >
                      {d.split(' ')[0]} · {total}
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
