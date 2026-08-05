"use client";

import TtscWebsiteLandingFadeIn from "./TtscWebsiteLandingFadeIn";
import TtscWebsiteLandingSectionEyebrow from "./TtscWebsiteLandingSectionEyebrow";

const SOURCES = [
  { kind: "Markdown", unit: "file, H1 to H4 sections" },
  { kind: "TypeScript", unit: "type, function, property" },
  { kind: "Prisma", unit: "model, column, relation" },
  { kind: "OpenAPI", unit: "every operation under paths" },
] as const;

const CITATION = [
  { text: "/**", tone: "text-blue-400", trailing: false },
  { text: " * @evidence", tone: "text-emerald-300", trailing: true },
  { text: " */", tone: "text-blue-400", trailing: false },
] as const;

export default function TtscWebsiteLandingEvidenceGraph() {
  return (
    <section className="relative overflow-hidden bg-white px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        <TtscWebsiteLandingFadeIn>
          <TtscWebsiteLandingSectionEyebrow label="Requirement coverage" />
          <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-[#102a43] md:text-5xl">
                A requirement nobody built should not compile.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#526b82]">
                <code className="font-mono font-semibold text-[#235a97]">
                  @ttsc/evidence
                </code>{" "}
                makes every requirement you configure demand an acknowledgement
                from the code, test, or document that claims to satisfy it. An
                agent can still lie. It cannot lie by omission.
              </p>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#526b82]">
                Coverage is counted per obligation and never pooled, so a rule
                the backend honored and the screen forgot is a compile error
                naming that section rather than a percentage.
              </p>

              <dl className="mt-8 divide-y divide-[#dbeafe] border-y border-[#dbeafe]">
                {SOURCES.map((source) => (
                  <div
                    key={source.kind}
                    className="flex items-baseline justify-between gap-4 py-2.5"
                  >
                    <dt className="font-mono text-sm font-semibold text-[#235a97]">
                      {source.kind}
                    </dt>
                    <dd className="text-right text-sm text-[#60778e]">
                      {source.unit}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/docs/setup/evidence"
                  className="rounded-full bg-[#235a97] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(35,90,151,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1c4a7e]"
                >
                  Wire one claim
                </a>
                <a
                  href="/docs/evidence"
                  className="rounded-full border border-[#9fc7eb] bg-white px-6 py-3 text-sm font-semibold text-[#235a97] transition-colors hover:border-[#3178c6] hover:bg-[#eef6ff]"
                >
                  Read the guide
                </a>
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-[#235a97] bg-[#102a43] shadow-[0_24px_60px_rgba(35,90,151,0.22)]">
                <div className="flex items-center gap-2 border-b border-[#3f6f99] bg-[#173f66] px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                  <span className="ml-3 font-mono text-xs text-blue-200">
                    docs/requirements/discount.md
                  </span>
                </div>
                <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.7] text-blue-50 md:px-7">
                  <div className="text-sky-300">
                    ## Coupon Stacking{" "}
                    <span className="text-amber-300">
                      &#123;#coupon-stacking&#125;
                    </span>
                  </div>
                  {"\n"}
                  <div className="text-blue-100">
                    At most one seller coupon and one platform coupon may
                    combine.
                  </div>
                </pre>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#235a97] bg-[#102a43] shadow-[0_24px_60px_rgba(35,90,151,0.22)]">
                <div className="flex items-center gap-2 border-b border-[#3f6f99] bg-[#173f66] px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                  <span className="ml-3 font-mono text-xs text-blue-200">
                    $ npx ttsc --noEmit
                  </span>
                </div>
                <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.7] text-blue-50 md:px-7">
                  <div>
                    <span className="text-red-300">error </span>
                    <span className="text-sky-300">TS16411</span>
                    <span className="text-blue-50">
                      : [evidence/graph] Missing acknowledgement for
                    </span>
                  </div>
                  <div className="text-amber-300">
                    {"  "}
                    &apos;docs/requirements/discount.md#coupon-stacking&apos;
                  </div>
                  <div className="text-blue-100">
                    {"  "}in Claim 1 reference 1 (markdown, symbols: h2, h3).
                  </div>
                </pre>
                <div className="border-t border-white/10 bg-[#173f66] px-5 py-4 font-mono text-[13px] leading-[1.7] md:px-7">
                  {CITATION.map((line) => (
                    <div key={line.text} className={line.tone}>
                      {line.text}
                      {line.trailing && (
                        <>
                          <span className="text-amber-300">
                            {" "}
                            docs/requirements/discount.md#coupon-stacking
                          </span>
                          <span className="text-blue-100">
                            {" "}
                            Renders the combination limit.
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                  <div className="text-blue-100">
                    export function CouponStackingNotice() &#123;...&#125;
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TtscWebsiteLandingFadeIn>
      </div>
    </section>
  );
}
