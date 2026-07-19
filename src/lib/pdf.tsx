import {
  Document,
  Link,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { BriefClaim, BriefContent, BriefResponseInput } from './brief.js';

// Server-side PDF of a candidate brief (PRD 5.7): the same content as
// the web brief, one renderer, no divergent copy. Citations render as
// numbered references, linked to a verbatim appendix on its own page.
//
// Layout redesign per docs/design/argo-brief-pdf-design-brief-v1_0-2026-07-12.md
// and the approved plan: measure constrained to ~66-72ch (not full page
// width), a 4-step type scale, unitless line-heights throughout (never
// absolute pt values), single column, zero flexbox, no cards or filled
// boxes. Built-in fonts (Times-Bold / Helvetica) for v1; brand fonts are
// a triggered backlog item (tasks/todo.md).

const gold = '#E3A81C';
const ink = '#2B2A26';
const inkSoft = '#55524A';
const forest = '#2E4A3A';
const cream = '#FBF6E9';

const styles = StyleSheet.create({
  page: {
    // Horizontal padding constrains the measure to ~66-72 characters per
    // line at 10.5pt Helvetica (~72ch on Letter's 612pt width, ~68ch on
    // A4's 595pt), rather than the full page width.
    paddingTop: 54,
    paddingBottom: 64,
    paddingLeft: 118,
    paddingRight: 118,
    fontFamily: 'Helvetica',
    color: ink,
  },
  header: { borderBottom: `1 solid ${gold}`, paddingBottom: 10, marginBottom: 18 },
  brand: { fontSize: 8.5, color: inkSoft, letterSpacing: 1.5, marginBottom: 6 },
  title: { fontSize: 18, fontFamily: 'Times-Bold', lineHeight: 1.15, color: ink, marginBottom: 2 },
  role: { fontSize: 11, color: inkSoft, marginBottom: 6 },
  provenance: { fontSize: 9, color: inkSoft, lineHeight: 1.35 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Times-Bold',
    lineHeight: 1.15,
    color: forest,
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: { fontSize: 10.5, lineHeight: 1.4, color: ink, marginBottom: 4 },
  // Flush-left (no indent): keeps a consistent F-pattern left edge
  // across role context, claims, and open questions.
  claim: { fontSize: 10.5, lineHeight: 1.4, color: ink, marginBottom: 8 },
  citationLink: { fontSize: 9, color: forest },
  citationUnresolved: { fontSize: 9, color: inkSoft },
  methodNote: { fontSize: 9, color: inkSoft, lineHeight: 1.35, marginBottom: 14 },
  refBlock: { marginBottom: 10 },
  refId: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: ink, marginBottom: 2 },
  refQuestion: { fontSize: 9, color: forest, marginBottom: 3 },
  // The one place a rule earns its keep (design brief section 7): a
  // hairline left rule on the verbatim quote block.
  refNote: {
    fontSize: 10.5,
    lineHeight: 1.4,
    color: ink,
    borderLeft: `0.75 solid ${forest}`,
    paddingLeft: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 118,
    right: 118,
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
  pageSize?: 'LETTER' | 'A4';
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

// Renders each citation id as a linked [n] marker jumping to its
// appendix entry (verified live: react-pdf 4.5.1 emits a real /GoTo
// action + named destination for <Link src="#id"> + <Text id="id">).
// An id with no resolved label (should not occur; citations are
// stripped to known ids at generation time, brief.ts) falls back to a
// plain, unlinked [?] rather than a broken link.
function Citations({ ids, labels }: { ids: string[]; labels: Map<string, number> }) {
  if (ids.length === 0) return null;
  return (
    <>
      {ids.map((id) => {
        const n = labels.get(id);
        return n ? (
          <Link key={id} src={`#ref-${n}`} style={styles.citationLink}>
            {' '}
            [{n}]
          </Link>
        ) : (
          <Text key={id} style={styles.citationUnresolved}>
            {' '}
            [?]
          </Text>
        );
      })}
    </>
  );
}

function Claim({
  text,
  citations,
  labels,
}: {
  text: string;
  citations: string[];
  labels: Map<string, number>;
}) {
  return (
    <Text style={styles.claim}>
      {text}
      <Citations ids={citations} labels={labels} />
    </Text>
  );
}

function Header({ candidateName, role }: { candidateName: string; role: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.brand}>ARGO CANDIDATE BRIEF</Text>
      <Text style={styles.title}>{candidateName}</Text>
      <Text style={styles.role}>{role}</Text>
      <Text style={styles.provenance}>
        This brief contains only claims drawn from interviewer-captured
        notes. Every claim cites a specific captured response. Argo does
        not score, rank, or recommend.
      </Text>
    </View>
  );
}

function RoleContext({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View>
      <Text style={styles.sectionTitle}>Role context</Text>
      <Text style={styles.paragraph}>{text}</Text>
    </View>
  );
}

function ThematicSection({
  category,
  claims,
  labels,
}: {
  category: string;
  claims: BriefClaim[];
  labels: Map<string, number>;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{category}</Text>
      {claims.map((claim, j) => (
        <Claim key={j} text={claim.text} citations={claim.citations} labels={labels} />
      ))}
    </View>
  );
}

// De-carded (no cream fill, no gold left border): demoted by position
// after the thematic sections, never by a graphic device that could
// read as a rating (design brief section "Visual devices").
function StarredMoments({
  claims,
  labels,
}: {
  claims: BriefClaim[];
  labels: Map<string, number>;
}) {
  if (claims.length === 0) return null;
  return (
    <View>
      <Text style={styles.sectionTitle}>Starred moments</Text>
      {claims.map((claim, i) => (
        <Claim key={i} text={claim.text} citations={claim.citations} labels={labels} />
      ))}
    </View>
  );
}

function OpenQuestions({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View>
      <Text style={styles.sectionTitle}>Open questions for the team</Text>
      {items.map((q, i) => (
        <Text key={i} style={styles.claim}>
          {i + 1}. {q}
        </Text>
      ))}
    </View>
  );
}

function MethodNote({ generatedByModel }: { generatedByModel: string | null }) {
  return (
    <Text style={styles.methodNote}>
      Every claim above is retrieved from a specific interviewer-captured
      response and cited by number
      {generatedByModel ? `, drafted with ${generatedByModel}` : ''}. Argo
      does not score, rank, or recommend candidates for hire, and does
      not infer protected characteristics from anything captured. Argo
      structures what was said. Humans decide.
    </Text>
  );
}

function CitedResponsesAppendix({
  labels,
  byId,
  generatedByModel,
}: {
  labels: Map<string, number>;
  byId: Map<string, BriefResponseInput>;
  generatedByModel: string | null;
}) {
  return (
    <View break>
      <MethodNote generatedByModel={generatedByModel} />
      <Text style={styles.sectionTitle}>Cited responses</Text>
      {[...labels.entries()].map(([id, n]) => {
        const r = byId.get(id);
        return (
          <View key={id} style={styles.refBlock}>
            <Text id={`ref-${n}`} style={styles.refId}>
              [{n}]
            </Text>
            {r ? (
              <>
                <Text style={styles.refQuestion}>{r.questionText}</Text>
                <Text style={styles.refNote}>{r.responseText}</Text>
              </>
            ) : (
              <Text style={styles.refNote}>Response {id}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function BriefFooter({ candidateName, role }: { candidateName: string; role: string }) {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) =>
        `${candidateName} · ${role} · Confidential hiring record · Page ${pageNumber} of ${totalPages}`
      }
    />
  );
}

function BriefPdf({
  candidateName,
  role,
  content,
  responses,
  generatedByModel,
  pageSize = 'LETTER',
}: BriefPdfProps) {
  const labels = citationLabels(content);
  const byId = new Map(responses.map((r) => [r.id, r]));

  return (
    <Document title={`Candidate brief: ${candidateName}`}>
      <Page size={pageSize} style={styles.page}>
        <Header candidateName={candidateName} role={role} />
        <RoleContext text={content.role_context} />
        {content.sections.map((section, i) => (
          <ThematicSection
            key={i}
            category={section.category}
            claims={section.claims}
            labels={labels}
          />
        ))}
        <StarredMoments claims={content.starred_moments} labels={labels} />
        <OpenQuestions items={content.open_questions} />
        <CitedResponsesAppendix labels={labels} byId={byId} generatedByModel={generatedByModel} />
        <BriefFooter candidateName={candidateName} role={role} />
      </Page>
    </Document>
  );
}

export async function renderBriefPdf(props: BriefPdfProps): Promise<Buffer> {
  return Buffer.from(await renderToBuffer(<BriefPdf {...props} />));
}
