import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { BriefContent, BriefResponseInput } from './brief.js';

// Server-side PDF of a candidate brief (PRD 5.7): the same content as
// the web brief, one renderer, no divergent copy. Citations render as
// numbered references resolving to the captured response text.

const gold = '#E3A81C';
const ink = '#2B2A26';
const inkSoft = '#55524A';
const forest = '#2E4A3A';
const cream = '#FBF6E9';

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: ink },
  header: { borderBottom: `2 solid ${gold}`, paddingBottom: 12, marginBottom: 16 },
  brand: { fontSize: 9, color: inkSoft, letterSpacing: 2, marginBottom: 6 },
  title: { fontSize: 20, fontFamily: 'Times-Bold', marginBottom: 2 },
  role: { fontSize: 11, color: inkSoft },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Times-Bold',
    color: forest,
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: { lineHeight: 1.5, marginBottom: 4 },
  claim: { lineHeight: 1.5, marginBottom: 5, paddingLeft: 10 },
  citation: { color: inkSoft, fontSize: 8 },
  starredBox: {
    backgroundColor: cream,
    borderLeft: `3 solid ${gold}`,
    padding: 8,
    marginBottom: 6,
  },
  refBlock: { marginBottom: 8 },
  refId: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 },
  refQuestion: { fontSize: 9, color: forest, marginBottom: 2 },
  refText: { fontSize: 9, color: inkSoft, lineHeight: 1.4 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: inkSoft,
    borderTop: `1 solid ${cream}`,
    paddingTop: 6,
  },
});

interface BriefPdfProps {
  candidateName: string;
  role: string;
  content: BriefContent;
  responses: BriefResponseInput[];
  generatedByModel: string | null;
}

function citationLabels(content: BriefContent): Map<string, number> {
  const labels = new Map<string, number>();
  const register = (ids: string[]) => {
    for (const id of ids) if (!labels.has(id)) labels.set(id, labels.size + 1);
  };
  for (const section of content.sections) for (const c of section.claims) register(c.citations);
  for (const c of content.starred_moments) register(c.citations);
  return labels;
}

function BriefPdf({ candidateName, role, content, responses, generatedByModel }: BriefPdfProps) {
  const labels = citationLabels(content);
  const byId = new Map(responses.map((r) => [r.id, r]));
  const cite = (ids: string[]) =>
    ids.map((id) => `[${labels.get(id) ?? '?'}]`).join(' ');

  return (
    <Document title={`Candidate brief: ${candidateName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>ARGO CANDIDATE BRIEF</Text>
          <Text style={styles.title}>{candidateName}</Text>
          <Text style={styles.role}>{role}</Text>
        </View>

        {content.role_context ? (
          <View>
            <Text style={styles.sectionTitle}>Role context</Text>
            <Text style={styles.paragraph}>{content.role_context}</Text>
          </View>
        ) : null}

        {content.sections.map((section, i) => (
          <View key={i}>
            <Text style={styles.sectionTitle}>{section.category}</Text>
            {section.claims.map((claim, j) => (
              <Text key={j} style={styles.claim}>
                {claim.text} <Text style={styles.citation}>{cite(claim.citations)}</Text>
              </Text>
            ))}
          </View>
        ))}

        {content.starred_moments.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Starred moments</Text>
            {content.starred_moments.map((claim, i) => (
              <View key={i} style={styles.starredBox}>
                <Text style={styles.paragraph}>
                  {claim.text} <Text style={styles.citation}>{cite(claim.citations)}</Text>
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {content.open_questions.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Open questions for the team</Text>
            {content.open_questions.map((q, i) => (
              <Text key={i} style={styles.claim}>
                {i + 1}. {q}
              </Text>
            ))}
          </View>
        ) : null}

        <View break>
          <Text style={styles.sectionTitle}>Cited responses</Text>
          {[...labels.entries()].map(([id, n]) => {
            const r = byId.get(id);
            return (
              <View key={id} style={styles.refBlock}>
                <Text style={styles.refId}>[{n}]</Text>
                {r ? (
                  <>
                    <Text style={styles.refQuestion}>{r.questionText}</Text>
                    <Text style={styles.refText}>{r.responseText}</Text>
                  </>
                ) : (
                  <Text style={styles.refText}>Response {id}</Text>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.footer} fixed>
          Captured responses structured by Argo
          {generatedByModel ? `, drafted with ${generatedByModel}` : ''}. Humans decide; this
          brief contains no scores, rankings, or recommendations from AI.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderBriefPdf(props: BriefPdfProps): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(<BriefPdf {...props} />));
}
