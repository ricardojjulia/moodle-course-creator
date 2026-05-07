import { useEffect, useRef, useState } from 'react'
import {
  Stack, Title, Text, Badge, Group, Button,
  Loader, Alert, ActionIcon, Tooltip, Paper,
  ThemeIcon, Divider, Box, Checkbox, Collapse,
  Progress, ScrollArea, Modal, Select, TextInput, Anchor,
} from '@mantine/core'
import {
  IconDownload, IconBuildingArch,
  IconRefresh, IconTrash, IconCheck, IconX,
  IconCloud, IconHome,
  IconChevronDown, IconChevronRight, IconUpload,
  IconCloudUpload, IconExternalLink,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api, type Course, type CourseVersion } from '../api/client'
import { CourseViewer } from '../components/CourseViewer'

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

  // Deploy to Moodle
  const [deployOpen,       setDeployOpen]       = useState(false)
  const [deploying,        setDeploying]         = useState(false)
  const [deployResult,     setDeployResult]      = useState<{ moodle_course_id: number; url: string; sections_pushed: number } | null>(null)
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
      notifications.show({
        title:   'Deployed to Moodle',
        message: `${deploySn} — ${res.sections_pushed} sections pushed`,
        color:   'green',
      })
    } catch (e: any) {
      notifications.show({ title: 'Deploy failed', message: e.message, color: 'red' })
    } finally {
      setDeploying(false)
    }
  }

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
      {content && (
        <CourseViewer content={content} moodleCourseId={content.moodle_course_id} />
      )}

      {!content && selVid && <Loader size="sm" />}

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
              Course created successfully — {deployResult.sections_pushed} sections pushed.
            </Text>
            <Group gap="xs">
              <Text size="sm">Moodle course ID: <strong>{deployResult.moodle_course_id}</strong></Text>
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
              This creates a new course in Moodle and pushes section names and lecture content.
              Enrollments, activities, and quiz questions are not included.
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
  const [open, setOpen] = useState(true)
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
        <Text fw={600} size="sm" c={isLocal ? 'dimmed' : 'blue'} style={{ flex: 1 }}>{name}</Text>
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

  // Group by instance → category; Local first
  const grouped = courses.reduce<Record<string, Record<string, Course[]>>>((acc, c) => {
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
