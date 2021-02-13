import express from 'express'
const app = express()
const port = 3000

app.use('/lib', express.static('lib'));
app.use('/', express.static('static'));

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`)
})