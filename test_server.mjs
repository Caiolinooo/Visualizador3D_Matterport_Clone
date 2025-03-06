import express from 'express';
const app = express();

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.listen(3001, '0.0.0.0', () => {
  console.log('Test server listening on 0.0.0.0:3001');
});