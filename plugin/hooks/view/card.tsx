export type Ui = { Box: any; Text: any; Button: any; Link: any }
export type CardModel = {
  id: string; title: string; subtitle?: string; badge: string; badgeColor: 'green' | 'yellow' | undefined
  description: string; calloutLabel: string; callout: string; cautionLabel: string; caution: string
  provenance: string; primary: { label: string; onPress: () => void }; links: { label: string; href: string }[]
}

// A drawing keys each Button once, so a card drawn twice on one screen (a fit that is also in
// the full list) takes a prefix for one of its copies.
export function Card({ ui, model, isSelected, onSelect, keyPrefix = '' }: { ui: Ui; model: CardModel; isSelected: boolean; onSelect: () => void; keyPrefix?: string }) {
  const { Box, Text, Button, Link } = ui
  const k = (name: string) => `${keyPrefix}${name}-${model.id}`
  return (
    <Box key={k('card')} flexDirection="column" borderStyle="round" borderColor={isSelected ? 'cyan' : undefined} borderDimColor={!isSelected} paddingX={1} marginBottom={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Button key={k('select')} plain onPress={onSelect}>{model.title}</Button>
        <Text color={model.badgeColor} dimColor={!model.badgeColor}>{model.badge}</Text>
      </Box>
      {model.subtitle && <Text dimColor>{model.subtitle}</Text>}
      {isSelected && <Text>{model.description}</Text>}
      <Text><Text bold>{model.calloutLabel}: </Text>{model.callout}</Text>
      {isSelected && <Text><Text color="yellow">! </Text>{model.cautionLabel}: {model.caution}</Text>}
      {isSelected && <Text dimColor>{model.provenance}</Text>}
      {isSelected && (
        <Box flexDirection="row" gap={1} marginTop={1}>
          <Button key={k('primary')} variant="primary" onPress={model.primary.onPress}>{model.primary.label}</Button>
          {model.links.map((l) => <Link href={l.href}>{l.label}</Link>)}
        </Box>
      )}
    </Box>
  )
}
