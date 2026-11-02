from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path

# Data models
class Product(BaseModel):
    id: int
    name: str
    description: str
    price: float
    image: str
    category: str
    stock: int

class CartItem(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)

class Cart(BaseModel):
    items: List[CartItem] = []

class CheckoutRequest(BaseModel):
    cart: Cart
    email: str
    name: str
    address: str
    city: str
    zip_code: str
    country: str

class Order(BaseModel):
    id: int
    email: str
    name: str
    address: str
    city: str
    zip_code: str
    country: str
    items: List[CartItem]
    total: float
    status: str = "pending"

# In-memory storage (replace with database in production)
products_db: List[Product] = []
orders_db: List[Order] = []
order_counter = 0

# Sample products
SAMPLE_PRODUCTS = [
    {"id": 1, "name": "Wireless Headphones", "description": "Premium noise-canceling wireless headphones with 30hr battery life", "price": 199.99, "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop", "category": "Electronics", "stock": 50},
    {"id": 2, "name": "Smart Watch", "description": "Fitness tracker with heart rate monitor, GPS, and sleep tracking", "price": 249.99, "image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop", "category": "Electronics", "stock": 30},
    {"id": 3, "name": "Running Shoes", "description": "Lightweight breathable running shoes with responsive cushioning", "price": 129.99, "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop", "category": "Sports", "stock": 100},
    {"id": 4, "name": "Coffee Maker", "description": "Programmable coffee maker with thermal carafe and auto-shutoff", "price": 89.99, "image": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop", "category": "Home", "stock": 25},
    {"id": 5, "name": "Backpack", "description": "Water-resistant laptop backpack with USB charging port", "price": 79.99, "image": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop", "category": "Accessories", "stock": 40},
    {"id": 6, "name": "Bluetooth Speaker", "description": "Portable waterproof speaker with 360-degree sound", "price": 59.99, "image": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop", "category": "Electronics", "stock": 60},
    {"id": 7, "name": "Yoga Mat", "description": "Eco-friendly non-slip yoga mat with carrying strap", "price": 34.99, "image": "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=400&fit=crop", "category": "Sports", "stock": 80},
    {"id": 8, "name": "Desk Lamp", "description": "LED desk lamp with adjustable brightness and color temperature", "price": 49.99, "image": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=400&fit=crop", "category": "Home", "stock": 35},
]

def init_products():
    global products_db
    products_db = [Product(**p) for p in SAMPLE_PRODUCTS]

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_products()
    yield

app = FastAPI(title="Online Store API", lifespan=lifespan)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
frontend_dir = Path(__file__).parent / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

# API Routes
@app.get("/api/products", response_model=List[Product])
async def get_products():
    return products_db

@app.get("/api/products/{product_id}", response_model=Product)
async def get_product(product_id: int):
    product = next((p for p in products_db if p.id == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.get("/api/categories")
async def get_categories():
    categories = list(set(p.category for p in products_db))
    return {"categories": categories}

@app.post("/api/cart/validate")
async def validate_cart(cart: Cart):
    """Validate cart items against stock"""
    errors = []
    for item in cart.items:
        product = next((p for p in products_db if p.id == item.product_id), None)
        if not product:
            errors.append(f"Product {item.product_id} not found")
        elif product.stock < item.quantity:
            errors.append(f"Not enough stock for {product.name} (available: {product.stock})")
    return {"valid": len(errors) == 0, "errors": errors}

@app.post("/api/checkout")
async def checkout(request: CheckoutRequest):
    global order_counter
    
    # Validate cart
    validation = await validate_cart(request.cart)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["errors"])
    
    # Calculate total and update stock
    total = 0
    order_items = []
    for item in request.cart.items:
        product = next(p for p in products_db if p.id == item.product_id)
        product.stock -= item.quantity
        total += product.price * item.quantity
        order_items.append(item)
    
    # Create order
    order_counter += 1
    order = Order(
        id=order_counter,
        email=request.email,
        name=request.name,
        address=request.address,
        city=request.city,
        zip_code=request.zip_code,
        country=request.country,
        items=order_items,
        total=total
    )
    orders_db.append(order)
    
    return {"order_id": order.id, "total": total, "status": "confirmed"}

@app.get("/api/orders/{order_id}")
async def get_order(order_id: int):
    order = next((o for o in orders_db if o.id == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# Frontend routes
@app.get("/", response_class=HTMLResponse)
async def home():
    frontend_index = frontend_dir / "index.html"
    if frontend_index.exists():
        return FileResponse(str(frontend_index))
    return HTMLResponse("<h1>Store Frontend Not Built</h1><p>Run the frontend build first.</p>")

@app.get("/cart", response_class=HTMLResponse)
async def cart_page():
    frontend_cart = frontend_dir / "cart.html"
    if frontend_cart.exists():
        return FileResponse(str(frontend_cart))
    return HTMLResponse("<h1>Cart Page Not Found</h1>")

@app.get("/checkout", response_class=HTMLResponse)
async def checkout_page():
    frontend_checkout = frontend_dir / "checkout.html"
    if frontend_checkout.exists():
        return FileResponse(str(frontend_checkout))
    return HTMLResponse("<h1>Checkout Page Not Found</h1>")

@app.get("/order/{order_id}", response_class=HTMLResponse)
async def order_confirmation(order_id: int):
    frontend_order = frontend_dir / "order.html"
    if frontend_order.exists():
        return FileResponse(str(frontend_order))
    return HTMLResponse("<h1>Order Page Not Found</h1>")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)