import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert, Stack, Text, Button, Code } from '@mantine/core'
import { IconX } from '@tabler/icons-react'

interface Props  { children: ReactNode }
interface State  { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <Stack p="xl" maw={600} mx="auto" mt="xl">
          <Alert color="red" title="Something went wrong" icon={<IconX />}>
            <Text mb="xs">{this.state.error.message}</Text>
            <Code block style={{ fontSize: 11 }}>
              {this.state.error.stack?.slice(0, 600)}
            </Code>
          </Alert>
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
        </Stack>
      )
    }
    return this.props.children
  }
}
