import express from 'express';

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get('/', (_req, res) => {
	res.send('ok');
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
