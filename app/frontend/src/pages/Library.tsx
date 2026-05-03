import { useEffect, useState } from 'react'
import {
  Stack, Title, Text, Badge, Group, Button, Collapse,
  Table, Loader, Alert, ActionIcon, Tooltip, Paper,
  ThemeIcon, Divider,
} from '@mantine/core'
import {
  IconChevronDown, IconChevronRight, IconDownload,
  IconBook, IconBuildingArch,
  IconRefresh, IconTrash, IconCheck, IconX,
  IconCloud, IconHome,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api, type Course, type CourseVersion } from '../api/client'

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel, loading }: {
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
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

// ── Version row ───────────────────────────────────────────────────────────────

function VersionRow({ course, version, onDeleted }: {
  course: Course
  version: CourseVersion
  onDeleted: () => void
}) {
  const [building,   setBuilding]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  const handleBuild = async () => {
    setBuilding(true)
    try {
      const res = await api.courses.build(course.shortname, version.id)
      notifications.show({ title: 'Built', message: `${res.filename} — ${res.size_kb} KB`, color: 'green' })
    } catch (e: any) {
      notifications.show({ title: 'Build failed', message: e.message, color: 'red' })
    } finally {
      setBuilding(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.courses.deleteVersion(course.shortname, version.id)
      notifications.show({ title: 'Deleted', message: `v${version.version_num} removed`, color: 'orange' })
      onDeleted()
    } catch (e: any) {
      notifications.show({ title: 'Delete failed', message: e.message, color: 'red' })
      setConfirming(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Table.Tr>
      <Table.Td>
        <Badge variant="light" color="blue">v{version.version_num}</Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">{version.model_used || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{version.start_date || '—'} → {version.end_date || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed">{new Date(version.created_at).toLocaleDateString()}</Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Tooltip label="Build .mbz">
            <ActionIcon variant="light" loading={building} onClick={handleBuild}>
              <IconBuildingArch size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Download .mbz">
            <ActionIcon
              variant="light"
              color="green"
              component="a"
              href={api.courses.downloadUrl(course.shortname, version.id)}
              download
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
          {confirming ? (
            <DeleteConfirm
              onConfirm={handleDelete}
              onCancel={() => setConfirming(false)}
              loading={deleting}
            />
          ) : (
            <Tooltip label="Delete version">
              <ActionIcon variant="subtle" color="red" onClick={() => setConfirming(true)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  )
}

// ── Course card ───────────────────────────────────────────────────────────────

function CourseCard({ course, onDeleted }: { course: Course; onDeleted: () => void }) {
  const [open,       setOpen]       = useState(false)
  const [versions,   setVersions]   = useState<CourseVersion[]>([])
  const [loading,    setLoading]    = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  const loadVersions = async () => {
    if (versions.length && open) { setOpen(false); return }
    setLoading(true)
    try {
      const v = await api.courses.versions(course.shortname)
      setVersions(v)
      setOpen(true)
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCourse = async () => {
    setDeleting(true)
    try {
      await api.courses.deleteCourse(course.shortname)
      notifications.show({ title: 'Deleted', message: `${course.shortname} and all versions removed`, color: 'orange' })
      onDeleted()
    } catch (e: any) {
      notifications.show({ title: 'Delete failed', message: e.message, color: 'red' })
      setConfirming(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleVersionDeleted = async () => {
    const v = await api.courses.versions(course.shortname)
    setVersions(v)
    if (v.length === 0) setOpen(false)
    onDeleted()
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" size="lg">
            <IconBook size={18} />
          </ThemeIcon>
          <div>
            <Text fw={600}>{course.fullname}</Text>
            <Group gap="xs">
              <Text size="xs" c="dimmed">{course.shortname}</Text>
              {course.professor && <>
                <Text size="xs" c="dimmed">·</Text>
                <Text size="xs" c="dimmed">{course.professor}</Text>
              </>}
            </Group>
          </div>
        </Group>
        <Group gap="xs">
          <Badge color="blue" variant="light">
            {course.version_count} version{course.version_count !== 1 ? 's' : ''}
          </Badge>
          <ActionIcon variant="subtle" onClick={loadVersions} loading={loading}>
            {open ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
          </ActionIcon>
          {confirming ? (
            <DeleteConfirm
              onConfirm={handleDeleteCourse}
              onCancel={() => setConfirming(false)}
              loading={deleting}
            />
          ) : (
            <Tooltip label="Delete course and all versions">
              <ActionIcon variant="subtle" color="red" onClick={() => setConfirming(true)}>
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      <Collapse in={open}>
        <Divider my="sm" />
        {versions.length === 0 ? (
          <Text size="sm" c="dimmed">No versions yet.</Text>
        ) : (
          <Table striped highlightOnHover withTableBorder={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Version</Table.Th>
                <Table.Th>Model</Table.Th>
                <Table.Th>Dates</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {versions.map(v => (
                <VersionRow
                  key={v.id}
                  course={course}
                  version={v}
                  onDeleted={handleVersionDeleted}
                />
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Collapse>
    </Paper>
  )
}

// ── Instance group header ─────────────────────────────────────────────────────

function InstanceHeader({ name }: { name: string }) {
  const isLocal = name === 'Local'
  return (
    <Group gap="xs" mt="xs">
      <ThemeIcon
        size="sm"
        variant="light"
        color={isLocal ? 'gray' : 'blue'}
      >
        {isLocal ? <IconHome size={12} /> : <IconCloud size={12} />}
      </ThemeIcon>
      <Text fw={600} size="sm" c={isLocal ? 'dimmed' : 'blue'}>
        {name}
      </Text>
    </Group>
  )
}

// ── Library page ──────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.courses.list()
      .then(setCourses)
      .catch(e => notifications.show({ title: 'Error', message: e.message, color: 'red' }))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Group by instance; Local always first
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

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Course Library</Title>
        <Button variant="subtle" leftSection={<IconRefresh size={16} />} onClick={load}>
          Refresh
        </Button>
      </Group>

      {loading && <Loader />}

      {!loading && courses.length === 0 && (
        <Alert color="blue" title="No courses yet">
          Use the <strong>New Course</strong> tab to generate your first course.
        </Alert>
      )}

      {sortedInstances.map(instance => (
        <Stack key={instance} gap="xs">
          <InstanceHeader name={instance} />
          {groups[instance].map(c => (
            <CourseCard key={c.shortname} course={c} onDeleted={load} />
          ))}
        </Stack>
      ))}
    </Stack>
  )
}
