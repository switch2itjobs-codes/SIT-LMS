/**
 * SPX Loading Spinner – used everywhere in the app for consistent loading UX.
 *
 * Usage:
 *   <SpxLoader />                       → fullscreen centred (page-level)
 *   <SpxLoader inline />                → inline, no centering (inside panels)
 *   <SpxLoader label="Loading batch…" />→ custom label
 */

type SpxLoaderProps = {
  /** Text below the spinner (default "Loading…") */
  label?: string
  /** If true, renders inline without centering wrapper */
  inline?: boolean
}

export function SpxLoader({ label = 'Loading…', inline = false }: SpxLoaderProps) {
  const content = (
    <div className="spx-loader">
      <div className="spx-loader-ring">
        <div />
        <div />
        <div />
        <div />
      </div>
      {label && <p className="spx-loader-label">{label}</p>}
    </div>
  )

  if (inline) return content

  return <div className="spx-loader-fullscreen">{content}</div>
}
