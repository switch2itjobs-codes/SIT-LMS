import { env } from './config/env.js'
import { runZoomReconciliationJob } from './jobs/zoomReconcileJob.js'
import { app } from './app.js'

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Zoom backend listening on http://localhost:${env.port}`)
})

if (env.enableReconcileJob) {
  const intervalMs = 1000 * 60 * 30
  setInterval(() => {
    runZoomReconciliationJob().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[zoom-reconcile]', error)
    })
  }, intervalMs)
}
