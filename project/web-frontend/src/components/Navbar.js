import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ activePage }) => {
    const [hideHeader, setHideHeader] = useState(false);
    const [stickyNav, setStickyNav] = useState(false);

    // Hide main-header on scroll, show at top; stick navbar and logo
    useEffect(() => {
      const handleScroll = () => {
        if (window.scrollY > 30) {
          setHideHeader(true);
          setStickyNav(true);
        } else {
          setHideHeader(false);
          setStickyNav(false);
        }
      };
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Scroll to top handler for navbar links/buttons
    const handleNavClick = (e) => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  const handleProfileDropdown = () => {
    setDropdownOpen(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        !dropdownRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <header className="site-header">
      {/* Sticky Logo always visible */}
      <div className={`logo-standalone${stickyNav ? ' sticky-logo' : ''}`}> 
        <Link to="/" className="logo-link">
          <div className="logo-icon-3d">
            <i className="fas fa-seedling"></i>
          </div>
        </Link>
      </div>
      {/* Main Header with Title and Actions, hide on scroll */}
      <div className={`main-header${hideHeader ? ' sticky-hide' : ''}`}>
        <div className="header-container">
          {/* Title and tagline */}
          <div className="logo-title-group">
            <Link to="/" className="logo-link">
              <div className="logo-text">
                <h1>FarmtoClick</h1>
                <span className="logo-tagline">Fresh From Farm to Your Table</span>
              </div>
            </Link>
          </div>
          <div className="header-actions">
            {user ? (
              <div className="user-profile-dropdown">
                <button className="user-profile-btn" onClick={handleProfileDropdown} ref={buttonRef}>
                  <div className="user-avatar">
                    {user.profile_picture ? (
                      <img
                        src={`/uploads/profiles/${user.profile_picture}`}
                        alt={user.first_name}
                      />
                    ) : (
                      <i className={`fas ${user.is_admin ? 'fa-user-shield' : 'fa-user'}`}></i>
                    )}
                  </div>
                  <span className="user-name">{user?.first_name || 'User'}</span>
                  <i className="fas fa-chevron-down"></i>
                </button>
                <div className={`profile-dropdown${dropdownOpen ? ' show' : ''}`} ref={dropdownRef}>
                  <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                    <i className="fas fa-user-edit"></i> Edit Profile
                  </Link>
                  <Link to="/cart" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                    <i className="fas fa-shopping-cart"></i> My Cart
                  </Link>
                  <Link to="/orders" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                    <i className="fas fa-shopping-bag"></i> My Orders
                  </Link>
                  {user.is_admin && (
                    <>
                      <div className="dropdown-divider"></div>
                      <Link to="/admin-dashboard" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                        <i className="fas fa-chart-bar"></i> Admin Dashboard
                      </Link>
                    </>
                  )}
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { setDropdownOpen(false); logout(); }} className="dropdown-item logout">
                    <i className="fas fa-sign-out-alt"></i> Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="auth-buttons">
                <Link to="/login" className="btn btn-outline">Login</Link>
                <Link to="/register" className="btn btn-primary">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <nav className={`navbar${stickyNav ? ' sticky-navbar' : ''}`}>
        <div className="nav-container">
          <button className="mobile-menu-toggle" onClick={() => { handleNavClick(); setMobileMenuOpen(!mobileMenuOpen); }}>
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
          <ul className={`nav-menu ${mobileMenuOpen ? 'active' : ''}`}> 
            <li><Link to="/" className={activePage === 'home' ? 'active' : ''} onClick={handleNavClick}>Home</Link></li>
            <li><Link to="/products" className={activePage === 'products' ? 'active' : ''} onClick={handleNavClick}>Products</Link></li>
            <li><Link to="/farmers" className={activePage === 'farmers' ? 'active' : ''} onClick={handleNavClick}>Farmers</Link></li>
            <li><a href="#about" onClick={handleNavClick}>About Us</a></li>
            <li><a href="#contact" onClick={handleNavClick}>Contact</a></li>
            {user && user.is_farmer && (
              <li><Link to="/farmer-dashboard" className={activePage === 'myshop' ? 'active' : ''} onClick={handleNavClick}>My Shop</Link></li>
            )}
          </ul>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
