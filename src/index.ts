import app from './app'
import { env } from './config/env'

app.listen(env.PORT, () => {
  console.log(`StrataNodex API running on port ${env.PORT}`)
})
