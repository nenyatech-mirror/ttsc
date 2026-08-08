import nextra from "nextra";

// KaTeX renders the coverage composition on the evidence benchmark page. The
// figure published there is only checkable if the fold is legible as the
// arithmetic it is, rather than as a code block imitating one.
const withNextra = nextra({ latex: true });

export default withNextra({
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    resolveAlias: {
      // Nextra points this specifier at Next's internal
      // `@vercel/turbopack-next/mdx-import-source` indirection, which Turbopack
      // only registers when Next itself compiles the MDX. Nextra runs its own
      // MDX pipeline, so `nextra/mdx-remote` cannot resolve it under Next 16,
      // where Turbopack is the default builder. Name the file that indirection
      // stands for.
      "next-mdx-import-source-file": "./mdx-components.jsx",
    },
  },
});
