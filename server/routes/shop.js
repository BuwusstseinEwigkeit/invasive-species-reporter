const { Router } = require("express");
const { authRequired, adminRequired } = require("../middleware/auth");
const {
  getProducts,
  getProductCategories,
  createPurchaseFull,
  getUserPurchases,
  getOrdersByUser,
  getAllOrders,
  updateOrderStatus,
} = require("../lib/store");
const { sendError } = require("../lib/helpers");

const router = Router();

// GET /api/shop/products
router.get("/products", (_req, res) => {
  const items = getProducts();
  const categories = getProductCategories();
  res.json({ items, categories });
});

// POST /api/shop/purchase
router.post("/purchase", authRequired, (req, res) => {
  const { productId, shippingName, shippingPhone, shippingAddress } = req.body || {};
  if (!productId) {
    sendError(res, "Product ID is required.", 400);
    return;
  }
  const shippingInfo = { name: shippingName, phone: shippingPhone, address: shippingAddress };
  const result = createPurchaseFull(req.user.userId, productId, shippingInfo);
  if (result.error) {
    sendError(res, result.error, 400);
    return;
  }
  res.status(201).json({ item: result });
});

// GET /api/shop/purchases/:userId
router.get("/purchases/:userId", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  res.json({ items: getUserPurchases(req.params.userId) });
});

// GET /api/shop/orders/:userId
router.get("/orders/:userId", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  res.json({ items: getOrdersByUser(req.params.userId) });
});

router.get("/admin/orders", authRequired, adminRequired, (_req, res) => {
  res.json({ items: getAllOrders() });
});

router.patch("/admin/orders/:orderId", authRequired, adminRequired, (req, res) => {
  const status = req.body && req.body.status;
  const allowed = new Set(["pending", "processing", "shipped", "completed", "cancelled"]);
  if (!allowed.has(status)) {
    sendError(res, "Invalid order status.", 400);
    return;
  }
  const order = updateOrderStatus(req.params.orderId, status);
  if (!order) {
    sendError(res, "Order not found.", 404);
    return;
  }
  res.json({ item: order });
});

module.exports = router;
