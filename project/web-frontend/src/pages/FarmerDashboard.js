import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { productsAPI, ordersAPI } from '../services/api';
import Navbar from '../components/Navbar';

const LALAMOVE_BOOKING_URL = 'https://web.lalamove.com/?shortlink=of9j9igz&c=ROW_ROW_USR-ALL_OWN_ACQ_WEB_ALL_Button&pid=WEB&af_xp=custom&source_caller=ui';

const FarmerDashboard = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [sellerOrders, setSellerOrders] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [rejectionOrderId, setRejectionOrderId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const availabilityChartRef = useRef(null);
  const categoryChartRef = useRef(null);
  const priceChartRef = useRef(null);

  const loadFarmerData = useCallback(async () => {
    try {
      // Load farmer's products
      const productsRes = await productsAPI.getProducts();
      setProducts(productsRes.data?.products || []);
      
      // Load seller orders
      const ordersRes = await ordersAPI.getSellerOrders();
      setSellerOrders(ordersRes.data?.orders || []);
    } catch (error) {
      console.error('Failed to load farmer data:', error);
    }
  }, [user]);

  const initCharts = useCallback(() => {
    const Chart = window.Chart;
    if (!Chart) return;

    // Calculate stats
    const availableCount = products.filter(p => p.available !== false && p.quantity > 0).length;
    const unavailableCount = products.length - availableCount;

    // Category counts
    const categoryCount = {};
    products.forEach(p => {
      categoryCount[p.category || 'Other'] = (categoryCount[p.category || 'Other'] || 0) + 1;
    });

    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#A9DFBF'];

    // Availability Pie Chart
    if (availabilityChartRef.current) {
      const ctx = availabilityChartRef.current.getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Available', 'Out of Stock'],
          datasets: [{
            data: [availableCount, unavailableCount],
            backgroundColor: ['#2c7a2c', '#dc2626'],
            borderColor: ['#1f5620', '#991b1b'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 15, font: { size: 12 } } }
          }
        }
      });
    }

    // Category Bar Chart
    if (categoryChartRef.current) {
      const ctx = categoryChartRef.current.getContext('2d');
      const categoryLabels = Object.keys(categoryCount);
      const categoryColors = categoryLabels.map((_, i) => colors[i % colors.length]);

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: categoryLabels,
          datasets: [{
            label: 'Number of Products',
            data: Object.values(categoryCount),
            backgroundColor: categoryColors,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

    // Price Line Chart
    if (priceChartRef.current) {
      const ctx = priceChartRef.current.getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: products.map(p => p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name),
          datasets: [{
            label: 'Product Price (₱)',
            data: products.map(p => p.price),
            borderColor: '#2c7a2c',
            backgroundColor: 'rgba(44, 122, 44, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#2c7a2c',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            y: { beginAtZero: true, ticks: { callback: (value) => '₱' + value.toFixed(2) } }
          }
        }
      });
    }
  }, [products]);

  useEffect(() => {
    if (user && user.is_farmer) {
      loadFarmerData();
    }
  }, [user, loadFarmerData]);

  useEffect(() => {
    if (products.length > 0 && typeof window !== 'undefined' && window.Chart) {
      initCharts();
    }
  }, [products, initCharts]);

  const updateOrderStatus = async (orderId, status) => {
    if (status === 'rejected') {
      setRejectionOrderId(orderId);
      return;
    }

    try {
      const res = await ordersAPI.updateSellerOrderStatus(orderId, { status });
      const data = res.data || {};
      if (data.success) {
        loadFarmerData();
        setFlashMessages([{ category: 'success', text: `Order ${status} successfully!` }]);
      } else {
        setFlashMessages([{ category: 'error', text: data.message || 'Failed to update order status' }]);
      }
    } catch (error) {
      setFlashMessages([{ category: 'error', text: 'Failed to update order status' }]);
    }
  };

  const submitRejection = async (orderId) => {
    if (!rejectionReason.trim()) {
      setFlashMessages([{ category: 'error', text: 'Cancellation reason is required.' }]);
      return;
    }

    try {
      const res = await ordersAPI.updateSellerOrderStatus(orderId, {
        status: 'rejected',
        reason: rejectionReason,
      });
      const data = res.data || {};
      if (data.success) {
        setRejectionOrderId(null);
        setRejectionReason('');
        loadFarmerData();
        setFlashMessages([{ category: 'success', text: 'Order rejected successfully!' }]);
      } else {
        setFlashMessages([{ category: 'error', text: data.message || 'Failed to reject order' }]);
      }
    } catch (error) {
      setFlashMessages([{ category: 'error', text: 'Failed to reject order' }]);
    }
  };

  const cancelRejection = () => {
    setRejectionOrderId(null);
    setRejectionReason('');
  };

  const openLalamoveBooking = () => {
    if (typeof window !== 'undefined') {
      window.open(LALAMOVE_BOOKING_URL, '_blank', 'noopener,noreferrer');
    }
  };

  // Calculate statistics
  const availableCount = products.filter(p => p.available !== false && p.quantity > 0).length;
  const unavailableCount = products.length - availableCount;

  const sortedSellerOrders = [...sellerOrders].sort((a, b) => {
    const aDate = new Date(a.created_at || 0).getTime();
    const bDate = new Date(b.created_at || 0).getTime();
    return bDate - aDate;
  });

  const getStatusLabel = (status) => {
    const value = (status || 'pending').toString().replace(/_/g, ' ').toLowerCase();
    return value.replace(/\b\w/g, (m) => m.toUpperCase());
  };

  if (!user || !user.is_farmer) {
    return (
      <div className="farmer-dashboard-page">
        <Navbar />

        <section className="products-page">
          <div className="container">
            <div className="no-products">
              <h3>Become a Seller</h3>
              <p>Start selling on FarmtoClick to access your shop dashboard.</p>
              <Link to="/start-selling" className="btn btn-primary btn-large">
                <i className="fas fa-seedling"></i> Start Selling
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="farmer-dashboard-page">
      {/* Navigation */}
      <Navbar activePage="myshop" />

      <section className="products-page">
        <div className="container">
          {/* Flash Messages */}
          {flashMessages.length > 0 && (
            <div className="flash-messages">
              {flashMessages.map((message, index) => (
                <div key={index} className={`alert alert-${message.category}`}>
                  {message.text}
                </div>
              ))}
            </div>
          )}

          {/* YOUR PRODUCTS SECTION */}
          <div className="farmer-dashboard-section">
            <div className="farmer-section-header">
              <h2 className="farmer-section-title">
                <i className="fas fa-store"></i> Your Products
              </h2>
              <Link to="/manage-products" className="btn btn-primary">
                <i className="fas fa-cog"></i> Manage Products
              </Link>
            </div>

            {products.length > 0 ? (
              <div className="farmer-products-grid">
                {products.map(product => {
                  const isOut = !product.available || product.quantity <= 0;
                  const isLow = !isOut && product.quantity <= 10;

                  return (
                    <article key={product.id} className="farmer-product-card">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="farmer-product-image" />
                      ) : (
                        <div className="farmer-product-placeholder"><i className="fas fa-seedling"></i></div>
                      )}
                      <div className="stock-badges">
                        {isOut ? (
                          <span className="stock-badge stock-badge-out">Out of Stock</span>
                        ) : isLow ? (
                          <span className="stock-badge stock-badge-low">Low Stock</span>
                        ) : (
                          <span className="stock-badge stock-badge-ok">In Stock</span>
                        )}
                      </div>
                      <div className="farmer-product-header">
                        <h3 className="farmer-product-title">{product.name}</h3>
                        <span className={`manage-product-status ${isOut ? 'status-out' : 'status-available'}`}>
                          {isOut ? 'Unavailable' : 'Available'}
                        </span>
                      </div>
                      <p className="farmer-product-meta">{product.category} • {product.unit}</p>
                      <p className="farmer-product-price">₱{product.price?.toFixed(2)} • Stock: {product.quantity}</p>
                      <p className="farmer-product-description">
                        {product.description?.substring(0, 120)}{product.description?.length > 120 ? '…' : ''}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="farmer-products-empty">
                <i className="fas fa-inbox"></i>
                <h3>No products yet</h3>
                <p>You haven't added any products to your shop yet.</p>
                <div className="farmer-empty-actions">
                  <Link to="/manage-products" className="btn btn-primary">
                    <i className="fas fa-plus"></i> Add Your First Product
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ORDERS SECTION */}
          <div className="farmer-dashboard-section farmer-orders-section">
            <div className="farmer-section-header">
              <h2 className="farmer-section-title"><i className="fas fa-receipt"></i> Orders for Your Products</h2>
            </div>

            {sortedSellerOrders.length > 0 ? (
              <div className="farmer-orders-grid">
                {sortedSellerOrders.map(order => {
                  const statusValue = (order.status || 'pending').toLowerCase();
                  const statusLabel = getStatusLabel(statusValue);
                  const orderDate = order.created_at ? new Date(order.created_at) : null;
                  const deliveryStatus = order.delivery_status || statusValue;

                  return (
                  <article key={order.id} className="farmer-order-card">
                    <div className="farmer-order-header">
                      <div>
                        <p className="farmer-order-id">Order #{order.id}</p>
                        {orderDate && (
                          <p className="farmer-order-date">
                            {orderDate.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                          </p>
                        )}
                        <p className="farmer-order-buyer">Buyer: {order.buyer_name} {order.buyer_email && `(${order.buyer_email})`}</p>
                      </div>
                      <div className="farmer-order-status">
                        <span className={`order-status status-${statusValue.replace(' ', '-')}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    <div className="farmer-order-items" style={{ marginTop: '8px' }}>
                      <p className="farmer-order-items-title">Delivery Status</p>
                      <p style={{ margin: 0 }}>{getStatusLabel(deliveryStatus)}</p>
                      {order.delivery_tracking_id && (
                        <p style={{ margin: '6px 0 0' }}><strong>Tracking ID:</strong> {order.delivery_tracking_id}</p>
                      )}
                    </div>

                    <div className="farmer-order-items">
                      <p className="farmer-order-items-title">Items</p>
                      <ul className="farmer-order-items-list">
                        {(order.items || []).map((item, idx) => (
                          <li key={idx}>{item.name || 'Item'} × {item.quantity || 1}</li>
                        ))}
                      </ul>
                    </div>

                    {statusValue === 'pending' && (
                      <div className="farmer-order-actions">
                        <button className="btn btn-primary" onClick={() => updateOrderStatus(order.id, 'approved')}>
                          Approve
                        </button>
                        <button className="btn btn-outline" onClick={() => updateOrderStatus(order.id, 'rejected')}>
                          Reject
                        </button>
                        
                        {rejectionOrderId === order.id && (
                          <div className="cancel-reason" style={{ display: 'block', marginTop: '12px' }}>
                            <label>Cancellation reason</label>
                            <textarea
                              rows="3"
                              placeholder="Enter reason for cancellation..."
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                            />
                            <div className="cancel-reason-actions">
                              <button className="btn btn-primary" onClick={() => submitRejection(order.id)}>Submit</button>
                              <button className="btn btn-outline" onClick={cancelRejection}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {statusValue === 'approved' && (
                      <div className="farmer-order-actions">
                        <button className="btn btn-primary" onClick={() => updateOrderStatus(order.id, 'ready_for_ship')}>
                          Mark Ready for Ship
                        </button>
                      </div>
                    )}

                    {statusValue === 'ready_for_ship' && (
                      <div className="farmer-order-actions">
                        <button className="btn btn-outline" onClick={openLalamoveBooking}>
                          Book Now
                        </button>
                        <button className="btn btn-primary" onClick={() => updateOrderStatus(order.id, 'picked_up')}>
                          Mark Picked Up
                        </button>
                      </div>
                    )}

                    {statusValue === 'picked_up' && (
                      <div className="farmer-order-actions">
                        <button className="btn btn-primary" onClick={() => updateOrderStatus(order.id, 'on_the_way')}>
                          Mark On the Way
                        </button>
                      </div>
                    )}

                    {statusValue === 'on_the_way' && (
                      <div className="farmer-order-actions">
                        <button className="btn btn-primary" onClick={() => updateOrderStatus(order.id, 'delivered')}>
                          Mark Delivered
                        </button>
                      </div>
                    )}
                  </article>
                );
                })}
              </div>
            ) : (
              <div className="farmer-orders-empty">
                <i className="fas fa-inbox"></i>
                <h3>No orders yet</h3>
                <p>Orders for your products will appear here.</p>
              </div>
            )}
          </div>

          {/* STATISTICS SECTION */}
          <div className="farmer-stats-grid">
            <div className="farmer-stat-card">
              <div className="farmer-stat-icon"><i className="fas fa-box"></i></div>
              <p className="farmer-stat-label">Total Products</p>
              <p className="farmer-stat-value">{products.length}</p>
            </div>

            <div className="farmer-stat-card">
              <div className="farmer-stat-icon available"><i className="fas fa-check-circle"></i></div>
              <p className="farmer-stat-label">Available Products</p>
              <p className="farmer-stat-value">{availableCount}</p>
            </div>

            <div className="farmer-stat-card">
              <div className="farmer-stat-icon out"><i className="fas fa-exclamation-circle"></i></div>
              <p className="farmer-stat-label">Out of Stock</p>
              <p className="farmer-stat-value">{unavailableCount}</p>
            </div>
          </div>

          {/* CHARTS SECTION */}
          {products.length > 0 && (
            <>
              <div className="farmer-charts-grid">
                <div className="farmer-chart-card">
                  <h3><i className="fas fa-chart-pie"></i> Product Availability</h3>
                  <canvas ref={availabilityChartRef} style={{ maxHeight: '250px' }}></canvas>
                </div>

                <div className="farmer-chart-card">
                  <h3><i className="fas fa-chart-bar"></i> Products by Category</h3>
                  <canvas ref={categoryChartRef} style={{ maxHeight: '250px' }}></canvas>
                </div>
              </div>

              <div className="farmer-chart-card standalone">
                <h3><i className="fas fa-chart-line"></i> Product Prices</h3>
                <canvas ref={priceChartRef} style={{ maxHeight: '300px' }}></canvas>
              </div>
            </>
          )}

          {/* QUICK ACTIONS */}
          <div className="farmer-dashboard-section">
            <h2 className="farmer-section-title"><i className="fas fa-bolt"></i> Quick Actions</h2>
            <div className="farmer-quick-actions">
              <Link to="/manage-products" className="btn btn-primary">
                <i className="fas fa-plus"></i> Add Product
              </Link>
              <Link to="/profile" className="btn btn-outline">
                <i className="fas fa-user-edit"></i> Edit Farm Profile
              </Link>
              <Link to="/products" className="btn btn-outline">
                <i className="fas fa-eye"></i> View Marketplace
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3><i className="fas fa-seedling"></i> FarmtoClick</h3>
              <p>Connecting communities with fresh, local produce since 2024.</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/products">Products</Link></li>
                <li><Link to="/farmers">Farmers</Link></li>
                <li><a href="/about">About Us</a></li>
                <li><a href="/faq">FAQ</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>For Farmers</h4>
              <ul>
                <li><Link to="/start-selling">Join as Farmer</Link></li>
                <li><a href="/farmer-resources">Farmer Resources</a></li>
                <li><a href="/success-stories">Success Stories</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Follow Us</h4>
              <div className="social-links">
                <a href="https://facebook.com/farmtoclick" target="_blank" rel="noopener noreferrer"><i className="fab fa-facebook"></i> Facebook</a>
                <a href="https://instagram.com/farmtoclick" target="_blank" rel="noopener noreferrer"><i className="fab fa-instagram"></i> Instagram</a>
                <a href="https://twitter.com/farmtoclick" target="_blank" rel="noopener noreferrer"><i className="fab fa-twitter"></i> Twitter</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 FarmtoClick. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FarmerDashboard;