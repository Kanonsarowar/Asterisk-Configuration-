// ============================================
// RBAC Middleware - Role-Based Access Control
// Enforces admin/client isolation, tenant scoping
// ============================================

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ---- VERIFY TOKEN ----
exports.verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // {id, username, role, client_id}
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token', details: err.message });
  }
};

// ---- REQUIRE ADMIN ----
exports.requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      user_role: req.user.role 
    });
  }
  next();
};

// ---- REQUIRE CLIENT ----
exports.requireClient = (req, res, next) => {
  const allowed_roles = ['client_admin', 'client_user', 'subuser'];
  
  if (!allowed_roles.includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Client access required',
      user_role: req.user.role 
    });
  }
  next();
};

// ---- ENSURE TENANT ISOLATION ----
// Prevents a client from accessing another client's data
exports.ensureTenantIsolation = (req, res, next) => {
  // Admin can access anything
  if (req.user.role === 'admin') {
    return next();
  }

  // Client can only access their own data
  const requested_client_id = req.params.client_id || req.body.client_id || req.query.client_id;
  
  if (requested_client_id && parseInt(requested_client_id) !== req.user.client_id) {
    return res.status(403).json({ 
      error: 'Unauthorized access to other client data',
      requested_client: requested_client_id,
      your_client: req.user.client_id
    });
  }
  
  next();
};

// ---- SCOPE QUERY BY ROLE ----
// Automatically adds WHERE clause for clients
exports.scopeQuery = (req) => {
  if (req.user.role === 'admin') {
    return {}; // Admin sees all
  }
  
  // Client sees only their data
  return { client_id: req.user.client_id };
};

// ---- CHECK FEATURE ENABLED ----
// Verify if client has feature enabled
exports.checkFeatureEnabled = (featureName) => {
  return async (req, res, next) => {
    if (req.user.role === 'admin') {
      return next(); // Admin has all features
    }

    const db = req.app.get('db');
    const feature = await db.query(
      'SELECT enabled FROM client_features WHERE client_id = ? AND feature_name = ?',
      [req.user.client_id, featureName]
    );

    if (!feature || !feature[0]?.enabled) {
      return res.status(403).json({ 
        error: `Feature '${featureName}' not enabled for your account`
      });
    }

    next();
  };
};

// ---- AUDIT LOG ----
// Log all admin actions and data modifications
exports.auditLog = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Log successful modifications (POST, PUT, DELETE)
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const db = req.app.get('db');
        const action = req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'update';
        
        db.query(
          `INSERT INTO audit_log (user_id, client_id, action, resource_type, resource_id, ip_address)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            req.user?.id,
            req.user?.client_id,
            action,
            req.baseUrl.split('/')[3], // e.g., 'clients', 'numbers'
            data?.id || null,
            req.ip
          ]
        ).catch(err => console.error('Audit log error:', err));
      }
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// ---- RATE LIMIT PER TENANT ----
// Prevent single client from overwhelming system
exports.rateLimitPerTenant = (maxRequests = 100, windowMs = 60000) => {
  const requests = {};
  
  return (req, res, next) => {
    const key = `${req.user.client_id}:${req.method}:${req.path}`;
    const now = Date.now();
    
    if (!requests[key]) {
      requests[key] = [];
    }
    
    // Remove old requests outside window
    requests[key] = requests[key].filter(time => now - time < windowMs);
    
    if (requests[key].length >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retry_after: Math.ceil(windowMs / 1000)
      });
    }
    
    requests[key].push(now);
    next();
  };
};

// ---- GENERATE TOKEN ----
exports.generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    client_id: user.client_id
  };
  
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: process.env.JWT_EXPIRY || '7d' 
  });
};

// ---- MIDDLEWARE CHAIN EXAMPLES ----

// For admin-only endpoints
exports.adminOnly = [
  exports.verifyToken,
  exports.requireAdmin,
  exports.auditLog
];

// For client-only endpoints
exports.clientOnly = [
  exports.verifyToken,
  exports.requireClient,
  exports.ensureTenantIsolation
];

// For endpoints accessible by both (with proper scoping)
exports.authenticatedAndScoped = [
  exports.verifyToken,
  exports.ensureTenantIsolation
];

module.exports = exports;
