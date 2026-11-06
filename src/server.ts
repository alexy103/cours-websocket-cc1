import express from 'express';
import type { Response } from 'express';
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

// -- SSE --

const clients = new Set<Response>();

ordersRouter.get('/stream', (_req, res) => {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
	});
	res.flushHeaders();
	clients.add(res);
	res.on('close', () => clients.delete(res));
});

let eventId = 0;
function broadcast(event: string, data: unknown) {
	const msg = `id: ${++eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
	for (const res of clients) res.write(msg);
}

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

ordersRouter.post('/', async (req, res) => {
	const userId = Number(req.body.userId);
	const productId = Number(req.body.productId);
	const quantity = Number(req.body.quantity);

	if (!Number.isInteger(userId) || !Number.isInteger(productId) || !Number.isInteger(quantity)) {
		return res.status(400).json({ message: 'Invalid userId, productId or quantity' });
	}

	if (quantity <= 0) return res.status(400).json({ message: 'Quantity must be higher than 0 !' });

	try {
		const users: User[] = await db.getData('/users');
		const user = users.find((user) => user.id === userId);
		if (!user) return res.status(404).json({ message: 'User not found' });

		const products: Product[] = await db.getData('/products');
		const product = products.find((product) => product.id === productId);
		if (!product) return res.status(404).json({ message: 'Product not found' });

		if (product.stock < quantity) return res.status(400).json({ message: 'Insufficient stock' });

		const orders: Order[] = await db.getData('/orders');
		const order: Order = {
			id: orders.length + 1,
			userId,
			productId,
			quantity,
			status: 'preparing',
			createdAt: new Date().toISOString(),
		};

		product.stock -= quantity;
		await db.push('/products', products);
		await db.push('/orders[]', order);

		broadcast('order-created', order);
		broadcast('stock-updated', product);

		res.status(201).json(order);
	} catch (error) {
		console.error('Failed to create order:', error);
		res.status(500).json({ message: 'Failed to create order' });
	}
});

async function deliverOrder(orderId: number) {
	try {
		const orders: Order[] = await db.getData('/orders');
		const order = orders.find((order) => order.id === orderId);
		if (!order || order.status !== 'shipped') return;

		order.status = 'delivered';
		await db.push('/orders', orders);
		broadcast('order-status-updated', order);
	} catch (error) {
		console.error('Failed to deliver order:', error);
	}
}

ordersRouter.post('/:id/next-status', async (req, res) => {
	const orderId = Number(req.params.id);
	if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ message: 'Invalid order ID' });

	try {
		const orders: Order[] = await db.getData('/orders');
		const order = orders.find((order) => order.id === orderId);
		if (!order) return res.status(404).json({ message: 'Order not found' });

		if (order.status === 'preparing') {
			order.status = 'shipped';
		} else if (order.status === 'shipped') {
			order.status = 'delivered';
		} else {
			return res.status(400).json({ message: `Order is ${order.status}, it cannot move forward` });
		}

		await db.push('/orders', orders);
		broadcast('order-status-updated', order);

		// 20s after shipping, deliver the order
		if (order.status === 'shipped') setTimeout(() => deliverOrder(order.id), 20_000);

		res.status(200).json(order);
	} catch (error) {
		console.error('Failed to update order status:', error);
		res.status(500).json({ message: 'Failed to update order status' });
	}
});

ordersRouter.post('/:id/cancel', async (req, res) => {
	const orderId = Number(req.params.id);
	if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ message: 'Invalid order ID' });

	try {
		const orders: Order[] = await db.getData('/orders');
		const order = orders.find((order) => order.id === orderId);
		if (!order) return res.status(404).json({ message: 'Order not found' });

		if (order.status !== 'preparing') {
			return res.status(400).json({ message: `Order is ${order.status}, it cannot be cancelled` });
		}

		const products: Product[] = await db.getData('/products');
		const product = products.find((product) => product.id === order.productId);
		if (!product) return res.status(404).json({ message: 'Product not found' });

		order.status = 'cancelled';
		product.stock += order.quantity;

		await db.push('/orders', orders);
		await db.push('/products', products);
		broadcast('order-cancelled', order);
		broadcast('stock-updated', product);
		res.status(200).json(order);
	} catch (error) {
		console.error('Failed to cancel order:', error);
		res.status(500).json({ message: 'Failed to cancel order' });
	}
});
