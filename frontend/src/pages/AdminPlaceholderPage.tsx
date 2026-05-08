type AdminPlaceholderPageProps = {
  title: string
  description?: string
}

export function AdminPlaceholderPage({
  title,
  description = 'This section is coming soon.',
}: AdminPlaceholderPageProps) {
  return (
    <section className="panel">
      <div className="panel-top">
        <div>
          <h3>{title}</h3>
          <p className="muted-dark">{description}</p>
        </div>
      </div>
    </section>
  )
}
