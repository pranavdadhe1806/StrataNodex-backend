import app from './app'
import { env } from './config/env'
import './jobs/reminder.job'
import './jobs/rollover.job'

app.listen(env.PORT, () => {
  console.log(`StrataNodex API running on port ${env.PORT}`)
})
