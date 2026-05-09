/**
 * Version diff viewer — word-level diff between two course versions.
 * Uses an LCS-based algorithm on word tokens for medium texts,
 * falling back to side-by-side for very large content.
 */
import { useState, useEffect } from 'react'
import {
  Modal, Stack, Group, Select, Text, Loader,
  Accordion, Badge, Box, ScrollArea, Divider,
} from '@mantine/core'
import { api, type CourseVersion } from '../api/client'

// ── Diff engine ───────────────────────────────────────────────────────────────

interface DiffToken { text: string; type: 'same' | 'add' | 'del' }

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function lcsWordDiff(a: string, b: string): DiffToken[] {
  const wa = a.match(/\S+|\s+/g) ?? []
  const wb = b.match(/\S+|\s+/g) ?? []
  const m = wa.length, n = wb.length

  // For very large diffs fall back to side-by-side (no token diff)
  if (m * n > 400_000) return []

  const dp = new Uint32Array((m + 1) * (n + 1))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i * (n + 1) + j] = wa[i - 1] === wb[j - 1]
        ? dp[(i - 1) * (n + 1) + (j - 1)] + 1
        : Math.max(dp[(i - 1) * (n + 1) + j], dp[i * (n + 1) + (j - 1)])

  const result: DiffToken[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wa[i - 1] === wb[j - 1]) {
      result.unshift({ text: wa[i - 1], type: 'same' })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i * (n + 1) + (j - 1)] >= dp[(i - 1) * (n + 1) + j])) {
      result.unshift({ text: wb[j - 1], type: 'add' })
      j--
    } else {
      result.unshift({ text: wa[i - 1], type: 'del' })
      i--
    }
  }
  return result
}

function countChanges(tokens: DiffToken[]): number {
  return tokens.filter(t => t.type !== 'same').length
}

// ── Render diff tokens ────────────────────────────────────────────────────────

function TokenDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const cleanA = stripHtml(oldText)
  const cleanB = stripHtml(newText)

  if (!cleanA && !cleanB) return null

  if (!cleanA) return (
    <Text size="xs" style={{ lineHeight: 1.8 }}>
      <mark style={{ background: 'rgba(74,222,128,0.25)', borderRadius: 2, padding: '0 1px' }}>
        {cleanB}
      </mark>
    </Text>
  )

  if (!cleanB) return (
    <Text size="xs" style={{ lineHeight: 1.8, opacity: 0.6 }}>
      <del style={{ background: 'rgba(248,113,113,0.25)', borderRadius: 2, padding: '0 1px', textDecoration: 'none' }}>
        {cleanA}
      </del>
    </Text>
  )

  const tokens = lcsWordDiff(cleanA, cleanB)

  if (!tokens.length) {
    return (
      <Group gap="xs" align="flex-start">
        <Box style={{ flex: 1, background: 'rgba(248,113,113,0.08)', borderRadius: 4, padding: '6px 10px', borderLeft: '3px solid var(--mantine-color-red-4)' }}>
          <Text size="xs" c="dimmed" fw={500} mb={2}>Before</Text>
          <Text size="xs">{cleanA}</Text>
        </Box>
        <Box style={{ flex: 1, background: 'rgba(74,222,128,0.08)', borderRadius: 4, padding: '6px 10px', borderLeft: '3px solid var(--mantine-color-green-4)' }}>
          <Text size="xs" c="dimmed" fw={500} mb={2}>After</Text>
          <Text size="xs">{cleanB}</Text>
        </Box>
      </Group>
    )
  }

  const changes = countChanges(tokens)
  if (changes === 0) {
    return <Text size="xs" c="dimmed" fs="italic">No changes</Text>
  }

  return (
    <Text size="xs" style={{ lineHeight: 1.9 }}>
      {tokens.map((t, i) =>
        t.type === 'same' ? <span key={i}>{t.text}</span>
        : t.type === 'add'
          ? <mark key={i} style={{ background: 'rgba(74,222,128,0.30)', borderRadius: 2, padding: '0 1px' }}>{t.text}</mark>
          : <del key={i} style={{ background: 'rgba(248,113,113,0.30)', borderRadius: 2, padding: '0 1px', textDecoration: 'none', opacity: 0.65 }}>{t.text}</del>
      )}
    </Text>
  )
}

// ── Module diff panel ─────────────────────────────────────────────────────────

function moduleDiffStats(
  baseContent: Record<string, any>,
  headContent: Record<string, any>,
  moduleNum: number
): number {
  const getMc = (content: Record<string, any>) => {
    const mcs: any[] = content?.module_contents ?? []
    return mcs.find(m => m.module_num === moduleNum) ?? mcs[moduleNum - 1] ?? {}
  }
  const a = getMc(baseContent)
  const b = getMc(headContent)
  const lA = stripHtml(a.lecture_html ?? '')
  const lB = stripHtml(b.lecture_html ?? '')
  const fA = a.forum_question ?? a.discussion_question ?? ''
  const fB = b.forum_question ?? b.discussion_question ?? ''
  const tokens = lcsWordDiff(lA, lB)
  const fTokens = lcsWordDiff(fA, fB)
  return countChanges(tokens) + countChanges(fTokens)
}

// ── Main diff component ───────────────────────────────────────────────────────

interface VersionDiffProps {
  opened:    boolean
  onClose:   () => void
  shortname: string
  versions:  CourseVersion[]
}

export function VersionDiff({ opened, onClose, shortname, versions }: VersionDiffProps) {
  const [baseId,       setBaseId]       = useState<string | null>(null)
  const [headId,       setHeadId]       = useState<string | null>(null)
  const [baseContent,  setBaseContent]  = useState<Record<string, any> | null>(null)
  const [headContent,  setHeadContent]  = useState<Record<string, any> | null>(null)
  const [loadingBase,  setLoadingBase]  = useState(false)
  const [loadingHead,  setLoadingHead]  = useState(false)

  const versionOptions = versions.map((v, i) => ({
    value: String(v.id),
    label: `v${v.version_num}${i === 0 ? ' (latest)' : ''} — ${v.model_used || 'import'}`,
  }))

  // Default: latest vs previous
  useEffect(() => {
    if (!opened || versions.length < 2) return
    setHeadId(String(versions[0].id))
    setBaseId(String(versions[1].id))
  }, [opened])

  useEffect(() => {
    if (!baseId) return
    setLoadingBase(true)
    setBaseContent(null)
    api.courses.version(shortname, Number(baseId))
      .then(v => setBaseContent(v.content as any ?? {}))
      .catch(() => setBaseContent({}))
      .finally(() => setLoadingBase(false))
  }, [baseId, shortname])

  useEffect(() => {
    if (!headId) return
    setLoadingHead(true)
    setHeadContent(null)
    api.courses.version(shortname, Number(headId))
      .then(v => setHeadContent(v.content as any ?? {}))
      .catch(() => setHeadContent({}))
      .finally(() => setLoadingHead(false))
  }, [headId, shortname])

  const loading  = loadingBase || loadingHead
  const ready    = !loading && !!baseContent && !!headContent
  const modules: any[] = baseContent?.course_structure?.modules
    ?? headContent?.course_structure?.modules ?? []

  const quizA = baseContent?.quiz_questions ?? []
  const quizB = headContent?.quiz_questions ?? []
  const quizChanged = quizA.length !== quizB.length

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="90%"
      title={<Text fw={700} size="sm">Compare Versions — {shortname}</Text>}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="md">
        {/* Version selectors */}
        <Group gap="md" align="flex-end">
          <Select
            label="Base (before)"
            data={versionOptions}
            value={baseId}
            onChange={setBaseId}
            style={{ flex: 1 }}
          />
          <Text c="dimmed" mb={6} fw={700}>→</Text>
          <Select
            label="Compare (after)"
            data={versionOptions}
            value={headId}
            onChange={setHeadId}
            style={{ flex: 1 }}
          />
        </Group>

        {loading && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="xs" c="dimmed">Loading versions…</Text>
          </Group>
        )}

        {ready && (
          <>
            {/* Summary row */}
            <Group gap="xs">
              {modules.map(mod => {
                const changes = moduleDiffStats(baseContent!, headContent!, mod.number)
                return (
                  <Badge
                    key={mod.number} size="xs"
                    color={changes === 0 ? 'gray' : 'orange'}
                    variant={changes === 0 ? 'outline' : 'filled'}
                  >
                    M{mod.number}{changes > 0 ? ` · ${changes} Δ` : ' · ✓'}
                  </Badge>
                )
              })}
              {quizChanged && (
                <Badge size="xs" color="blue" variant="filled">
                  Quiz {quizA.length}→{quizB.length} questions
                </Badge>
              )}
            </Group>

            <Divider />

            {/* Per-module diff */}
            <Accordion chevronPosition="left" multiple defaultValue={
              modules.filter(m => moduleDiffStats(baseContent!, headContent!, m.number) > 0)
                     .map(m => String(m.number))
            }>
              {modules.map(mod => {
                const getMc = (content: Record<string, any>) => {
                  const mcs: any[] = content?.module_contents ?? []
                  return mcs.find(m => m.module_num === mod.number) ?? mcs[mod.number - 1] ?? {}
                }
                const a = getMc(baseContent!)
                const b = getMc(headContent!)
                const lA = a.lecture_html ?? ''
                const lB = b.lecture_html ?? ''
                const fA = a.forum_question ?? a.discussion_question ?? ''
                const fB = b.forum_question ?? b.discussion_question ?? ''
                const changes = moduleDiffStats(baseContent!, headContent!, mod.number)

                return (
                  <Accordion.Item key={mod.number} value={String(mod.number)}>
                    <Accordion.Control>
                      <Group gap="xs">
                        <Text size="sm" fw={600}>{mod.number}. {mod.title}</Text>
                        <Badge size="xs" color={changes === 0 ? 'gray' : 'orange'} variant="light">
                          {changes === 0 ? 'No changes' : `${changes} word changes`}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        {(lA || lB) && (
                          <Box>
                            <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.5} mb={6}>Lecture</Text>
                            <TokenDiff oldText={lA} newText={lB} />
                          </Box>
                        )}
                        {(fA || fB) && (
                          <Box>
                            <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.5} mb={6}>Forum Question</Text>
                            <TokenDiff oldText={fA} newText={fB} />
                          </Box>
                        )}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                )
              })}
            </Accordion>

            {/* Quiz diff summary */}
            {(quizA.length > 0 || quizB.length > 0) && (
              <Box p="sm" style={{ background: 'var(--mantine-color-blue-0)', borderRadius: 6, borderLeft: '3px solid var(--mantine-color-blue-4)' }}>
                <Text size="xs" fw={600} c="blue" mb={4}>Quiz Bank</Text>
                <Text size="xs">
                  {quizA.length === quizB.length
                    ? `${quizB.length} questions — count unchanged (question content may have changed)`
                    : `${quizA.length} → ${quizB.length} questions (${quizB.length > quizA.length ? '+' : ''}${quizB.length - quizA.length})`
                  }
                </Text>
              </Box>
            )}
          </>
        )}
      </Stack>
    </Modal>
  )
}
