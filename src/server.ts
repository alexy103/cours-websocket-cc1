import express from 'express';
import { JsonDB, Config } from 'node-json-db';
import type { User, Product, Order } from './types.js';

const db = new JsonDB(new Config('data/db', true, true, '/'));

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

// ---- Users ----

const usersRouter = express.Router();

app.use('/api/users', usersRouter);

usersRouter.get('/', async (_req, res) => {
	try {
		const users: User[] = await db.getData('/users');
		res.status(200).json(users);
	} catch (error) {
		console.error('Failed to read users from database:', error);
		res.status(500).json({ message: 'Failed to read users from database' });
	}
});

// ---- Products ----

const productsRouter = express.Router();

app.use('/api/products', productsRouter);

productsRouter.get('/', async (_req, res) => {
	try {
		const products: Product[] = await db.getData('/products');
		res.status(200).json(products);
	} catch (error) {
		console.error('Failed to read products from database:', error);
		res.status(500).json({ message: 'Failed to read products from database' });
	}
});

// ---- Orders ----

const ordersRouter = express.Router();

app.use('/api/orders', ordersRouter);

ordersRouter.get('/', async (_req, res) => {
	try {
		const orders: Order[] = await db.getData('/orders');
		res.status(200).json(orders);
	} catch (error) {
		console.error('Failed to read orders from database:', error);
		res.status(500).json({ message: 'Failed to read orders from database' });
	}
});

ordersRouter.get('/:id', async (req, res) => {
	const orderId = Number(req.params.id);
	if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ message: 'Invalid order ID' });

	try {
		const orders: Order[] = await db.getData('/orders');
		const order = orders.find((o) => o.id === orderId);
		if (!order) return res.status(404).json({ message: 'Order not found' });
		res.status(200).json(order);
	} catch (error) {
		console.error('Failed to read order from database:', error);
		res.status(500).json({ message: 'Failed to read order from database' });
	}
});
